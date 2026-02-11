import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { auth } from "@/lib/auth";
import { isAppConfigured, getInstallationOctokit } from "@/lib/github-app";
import { checkAnySharingAccess } from "@/lib/sharing-utils";
import type { GitHubFile } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params;
    const octokit = await getOctokit();
    const url = new URL(request.url);
    const ref = url.searchParams.get("ref") ?? undefined;
    const path = url.searchParams.get("path") ?? "";

    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
    }

    const files: GitHubFile[] = data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type === "dir" ? "dir" : "file",
      sha: item.sha,
      size: item.size,
    }));

    // Sort: directories first, then files, alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(files);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const status = (error as { status?: number })?.status;
    if (status === 403 || status === 404) {
      if (isAppConfigured()) {
        try {
          const session = await auth();
          const login = (session as any)?.login;
          if (login) {
            const { owner, repo } = await params;
            const installationOctokit = await getInstallationOctokit(owner, repo);
            const { authorized } = await checkAnySharingAccess(installationOctokit, owner, repo, login);
            if (authorized) {
              const url = new URL(request.url);
              const ref = url.searchParams.get("ref") ?? undefined;
              const path = url.searchParams.get("path") ?? "";
              const { data } = await installationOctokit.repos.getContent({
                owner,
                repo,
                path,
                ref,
              });
              if (!Array.isArray(data)) {
                return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
              }
              const files: GitHubFile[] = data.map((item) => ({
                name: item.name,
                path: item.path,
                type: item.type === "dir" ? "dir" : "file",
                sha: item.sha,
                size: item.size,
              }));
              files.sort((a, b) => {
                if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
                return a.name.localeCompare(b.name);
              });
              return NextResponse.json(files);
            }
          }
        } catch {
          // Fall through to no_access
        }
      }
      return NextResponse.json(
        { error: "no_access", message: "You don't have access to this repository. Grant access via the GitHub App to view private repos." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Failed to fetch tree" }, { status: 500 });
  }
}
