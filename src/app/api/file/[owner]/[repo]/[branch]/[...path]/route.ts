import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { auth } from "@/lib/auth";
import { isAppConfigured, getInstallationId, getInstallationOctokit } from "@/lib/github-app";
import { checkSharingAccess } from "@/lib/sharing-utils";

type SessionWithLogin = { login?: string };
import type { SharingConfig } from "@/lib/sharing-types";

function determineShareReason(sharing: SharingConfig | null, filePath: string): string {
  if (!sharing) return "no_sharing_config";

  const doc =
    sharing.documents[filePath] ??
    sharing.documents[decodeURIComponent(filePath)] ??
    sharing.documents[encodeURIComponent(filePath).replace(/%2F/gi, "/")] ??
    null;

  if (!doc) return "not_shared";

  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
    return "share_expired";
  }

  return "not_shared";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; branch: string; path: string[] }> }
) {
  try {
    const { owner, repo, branch, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");
    const octokit = await getOctokit();

    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });

    const data = response.data;

    if (Array.isArray(data) || data.type !== "file") {
      return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
    }

    const content = data.content
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : "";

    const headers: Record<string, string> = {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
    };
    const etag = response.headers.etag;
    if (etag) {
      headers["ETag"] = etag;
    }

    return NextResponse.json(
      { content, sha: data.sha, path: data.path },
      { headers }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Not authenticated") {
      // Allow anonymous access for "anyone_with_link" shared docs
      const { owner, repo, branch, path: pathSegments } = await params;
      const filePath = pathSegments.join("/");
      let reason = "no_access";

      if (!isAppConfigured()) {
        reason = "app_not_configured";
      } else {
        try {
          const installationId = await getInstallationId(owner);
          if (!installationId) {
            reason = "app_not_installed";
          } else {
            const installationOctokit = await getInstallationOctokit(owner, repo);
            const { authorized, sharing } = await checkSharingAccess(installationOctokit, owner, repo, filePath, null);
            if (authorized) {
              const response = await installationOctokit.repos.getContent({
                owner,
                repo,
                path: filePath,
                ref: branch,
              });
              const data = response.data;
              if (Array.isArray(data) || data.type !== "file") {
                return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
              }
              const content = data.content
                ? Buffer.from(data.content, "base64").toString("utf-8")
                : "";
              return NextResponse.json(
                { content, sha: data.sha, path: data.path, anonymous: true },
                { headers: { "x-anonymous-access": "true" } }
              );
            }
            reason = determineShareReason(sharing, filePath);
          }
        } catch {
          // Fall through to 401
        }
      }

      return NextResponse.json(
        { error: "Not authenticated", reason, owner },
        { status: 401 }
      );
    }
    const status = (error as { status?: number })?.status;
    if (status === 403 || status === 404) {
      const { owner, repo, branch, path: pathSegments } = await params;
      const filePath = pathSegments.join("/");
      let reason = "no_access";

      if (!isAppConfigured()) {
        reason = "app_not_configured";
      } else {
        try {
          const session = await auth();
          const login = (session as SessionWithLogin | null)?.login;
          const installationId = await getInstallationId(owner);
          if (!installationId) {
            reason = "app_not_installed";
          } else if (login) {
            const installationOctokit = await getInstallationOctokit(owner, repo);
            const { authorized, sharing } = await checkSharingAccess(installationOctokit, owner, repo, filePath, login);
            if (authorized) {
              const response = await installationOctokit.repos.getContent({
                owner,
                repo,
                path: filePath,
                ref: branch,
              });
              const data = response.data;
              if (Array.isArray(data) || data.type !== "file") {
                return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
              }
              const content = data.content
                ? Buffer.from(data.content, "base64").toString("utf-8")
                : "";
              return NextResponse.json({ content, sha: data.sha, path: data.path });
            }
            reason = determineShareReason(sharing, filePath);
          }
        } catch {
          // Fall through to no_access
        }
      }

      return NextResponse.json(
        {
          error: "no_access",
          reason,
          owner,
          message: isAppConfigured()
            ? "You don't have access to this repository. Grant access via the GitHub App to view private repos."
            : "You don't have access to this repository, or it doesn't exist.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
