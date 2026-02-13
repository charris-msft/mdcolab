import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { auth } from "@/lib/auth";
import { isAppConfigured, getInstallationOctokit } from "@/lib/github-app";
import { checkSharingAccess } from "@/lib/sharing-utils";

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
      if (isAppConfigured()) {
        try {
          const { owner, repo, branch, path: pathSegments } = await params;
          const filePath = pathSegments.join("/");
          const installationOctokit = await getInstallationOctokit(owner, repo);
          const { authorized } = await checkSharingAccess(installationOctokit, owner, repo, filePath, null);
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
        } catch {
          // Fall through to 401
        }
      }
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const status = (error as { status?: number })?.status;
    if (status === 403 || status === 404) {
      if (isAppConfigured()) {
        try {
          const session = await auth();
          const login = (session as any)?.login;
          if (login) {
            const { owner, repo, branch, path: pathSegments } = await params;
            const filePath = pathSegments.join("/");
            const installationOctokit = await getInstallationOctokit(owner, repo);
            const { authorized } = await checkSharingAccess(installationOctokit, owner, repo, filePath, login);
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
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
