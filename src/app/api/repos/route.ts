import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import type { GitHubRepo } from "@/types";

export async function GET(request: Request) {
  try {
    const octokit = await getOctokit();
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const perPage = parseInt(url.searchParams.get("per_page") ?? "30", 10);

    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      direction: "desc",
      per_page: perPage,
      page,
    });

    const repos: GitHubRepo[] = data.map((r) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      owner: {
        login: r.owner.login,
        avatar_url: r.owner.avatar_url,
      },
      description: r.description ?? null,
      private: r.private,
      default_branch: r.default_branch,
      updated_at: r.updated_at ?? new Date().toISOString(),
      language: r.language ?? null,
      stargazers_count: r.stargazers_count,
    }));

    return NextResponse.json(repos);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}
