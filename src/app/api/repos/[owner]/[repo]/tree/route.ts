import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
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
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch tree" }, { status: 500 });
  }
}
