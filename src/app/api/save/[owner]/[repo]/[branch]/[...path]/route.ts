import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; branch: string; path: string[] }> }
) {
  try {
    const { owner, repo, branch, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");
    const octokit = await getOctokit();

    const body = await request.json();
    if (!body.content && body.content !== "") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: body.message || `Update ${filePath} via mdcolab`,
      content: Buffer.from(body.content).toString("base64"),
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
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}
