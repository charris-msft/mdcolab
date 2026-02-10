import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";

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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const status = (error as { status?: number })?.status;
    if (status === 403 || status === 404) {
      return NextResponse.json(
        { error: "no_access", message: "You don't have access to this repository. Grant access via the GitHub App to view private repos." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
