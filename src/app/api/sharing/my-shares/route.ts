import { NextResponse } from "next/server";
import { getOctokit, getSession } from "@/lib/github";
import {
  getInstallationOctokit,
  isAppConfigured,
} from "@/lib/github-app";
import { resolveTargetForPrivacy } from "@/lib/central-storage";
import type { SharingConfig } from "@/lib/sharing-types";

export interface SharedDocItem {
  owner: string;
  repo: string;
  path: string;
  mode: "specific_people" | "anyone_with_link";
  users?: string[];
  allowEditing?: boolean;
  sharedBy: string;
  sharedAt: string;
  expiresAt?: string;
  isExpired: boolean;
}

export async function GET() {
  const session = await getSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const login = (session as any)?.login as string;
  if (!login) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const octokit = await getOctokit();

    // Fetch user's repos (paginated)
    const repos = await octokit.paginate(
      octokit.repos.listForAuthenticatedUser,
      { sort: "updated", direction: "desc", per_page: 100 }
    );

    const sharedDocs: SharedDocItem[] = [];
    const now = Date.now();

    // Check each repo for sharing config
    const checks = repos.map(async (repo) => {
      const owner = repo.owner.login;
      const repoName = repo.name;

      // Route private repos to the central metadata repo when one exists.
      const target = await resolveTargetForPrivacy(
        octokit,
        owner,
        repoName,
        repo.private === true
      );

      try {
        // Try user token first
        const response = await octokit.repos.getContent({
          owner: target.owner,
          repo: target.repo,
          path: target.sharingPath,
        });

        const data = response.data;
        if (Array.isArray(data) || data.type !== "file") return;

        const content = Buffer.from(data.content, "base64").toString("utf-8");
        const config: SharingConfig = JSON.parse(content);

        for (const [path, doc] of Object.entries(config.documents)) {
          if (doc.sharedBy?.toLowerCase() === login.toLowerCase()) {
            sharedDocs.push({
              owner,
              repo: repoName,
              path,
              mode: doc.mode,
              users: doc.users,
              allowEditing: doc.allowEditing,
              sharedBy: doc.sharedBy,
              sharedAt: doc.sharedAt,
              expiresAt: doc.expiresAt,
              isExpired: !!doc.expiresAt && new Date(doc.expiresAt).getTime() <= now,
            });
          }
        }
      } catch (error: unknown) {
        const status = (error as { status?: number })?.status;
        if (status === 404) return; // No sharing config

        // Try installation token fallback
        if (status === 403 && isAppConfigured()) {
          try {
            const installationOctokit = await getInstallationOctokit(target.owner, target.repo);
            const response = await installationOctokit.repos.getContent({
              owner: target.owner,
              repo: target.repo,
              path: target.sharingPath,
            });

            const data = response.data;
            if (Array.isArray(data) || data.type !== "file") return;

            const content = Buffer.from(data.content, "base64").toString("utf-8");
            const config: SharingConfig = JSON.parse(content);

            for (const [path, doc] of Object.entries(config.documents)) {
              if (doc.sharedBy?.toLowerCase() === login.toLowerCase()) {
                sharedDocs.push({
                  owner,
                  repo: repoName,
                  path,
                  mode: doc.mode,
                  users: doc.users,
                  allowEditing: doc.allowEditing,
                  sharedBy: doc.sharedBy,
                  sharedAt: doc.sharedAt,
                  expiresAt: doc.expiresAt,
                  isExpired: !!doc.expiresAt && new Date(doc.expiresAt).getTime() <= now,
                });
              }
            }
          } catch {
            // Skip repos we can't access
          }
        }
      }
    });

    await Promise.all(checks);

    // Sort: active first, then by sharedAt descending
    sharedDocs.sort((a, b) => {
      if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
      return new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime();
    });

    return NextResponse.json(sharedDocs);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch shared documents" },
      { status: 500 }
    );
  }
}
