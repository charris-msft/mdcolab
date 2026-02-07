import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import type { CommentsFile } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; branch: string; path: string[] }> }
) {
  try {
    const { owner, repo, branch, path: pathSegments } = await params;
    const filePath = pathSegments.join("/") + ".comments.json";
    const octokit = await getOctokit();

    try {
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
        : "{}";

      const comments: CommentsFile = JSON.parse(content);

      const headers: Record<string, string> = {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      };
      const etag = response.headers.etag;
      if (etag) {
        headers["ETag"] = etag;
      }

      return NextResponse.json(
        { comments, sha: data.sha },
        { headers }
      );
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        const emptyComments: CommentsFile = {
          version: "1.0",
          documentHash: "",
          threads: [],
        };
        return NextResponse.json({
          comments: emptyComments,
          sha: null,
        });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; branch: string; path: string[] }> }
) {
  try {
    const { owner, repo, branch, path: pathSegments } = await params;
    const filePath = pathSegments.join("/") + ".comments.json";
    const octokit = await getOctokit();

    const body = await request.json();
    const comments: CommentsFile = body.comments;
    const sha: string | null = body.sha;

    if (!comments) {
      return NextResponse.json({ error: "comments is required" }, { status: 400 });
    }

    const content = Buffer.from(
      JSON.stringify(comments, null, 2)
    ).toString("base64");

    const createOrUpdateParams: {
      owner: string;
      repo: string;
      path: string;
      message: string;
      content: string;
      branch: string;
      sha?: string;
    } = {
      owner,
      repo,
      path: filePath,
      message: `Update comments for ${pathSegments.join("/")} via mdcolab`,
      content,
      branch,
    };

    if (sha) {
      createOrUpdateParams.sha = sha;
    }

    const { data } = await octokit.repos.createOrUpdateFileContents(createOrUpdateParams);

    return NextResponse.json({
      sha: data.content?.sha,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const status = (error as { status?: number }).status;
    if (status === 409) {
      return NextResponse.json(
        { error: "Conflict: comments were modified by another user" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to save comments" }, { status: 500 });
  }
}
