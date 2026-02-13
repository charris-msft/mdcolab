import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { isAppConfigured, getInstallationOctokit } from "@/lib/github-app";
import { checkSharingAccess } from "@/lib/sharing-utils";

function toBase64(str: string): string {
  // Works in both Node.js and Edge runtime
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(str)));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; branch: string; path: string[] }> }
) {
  try {
    const { owner, repo, branch, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");
    let octokit;
    try {
      octokit = await getOctokit();
    } catch {
      // Anonymous user — check if this specific file allows editing
      if (isAppConfigured()) {
        try {
          const installationOctokit = await getInstallationOctokit(owner, repo);
          const { authorized, allowEditing } = await checkSharingAccess(installationOctokit, owner, repo, filePath, null);
          if (authorized && allowEditing) {
            const body = await request.json();
            if (!body.content && body.content !== "") {
              return NextResponse.json({ error: "content is required" }, { status: 400 });
            }
            const { data } = await installationOctokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: filePath,
              message: body.message || `Update ${filePath} via mdcolab (anonymous)`,
              content: toBase64(body.content),
              ...(body.sha ? { sha: body.sha } : {}),
              branch,
            });
            return NextResponse.json({
              sha: data.content?.sha,
              commit: data.commit.sha,
            });
          }
        } catch (err) {
          console.error("Anonymous save fallback error:", err);
        }
      }
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.content && body.content !== "") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: body.message || `Update ${filePath} via mdcolab`,
      content: toBase64(body.content),
      ...(body.sha ? { sha: body.sha } : {}),
      branch,
    });

    return NextResponse.json({
      sha: data.content?.sha,
      commit: data.commit.sha,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Save file error:", message, error);
    return NextResponse.json({ error: "Failed to save file", detail: message }, { status: 500 });
  }
}
