import { NextRequest, NextResponse } from "next/server";
import { getOctokit, getSession } from "@/lib/github";
import type { GitHubRepo } from "@/types";

type SessionWithLogin = { login?: string };

export async function GET(req: NextRequest) {
  try {
    const octokit = await getOctokit();
    const session = await getSession();
    const login = (session as SessionWithLogin | null)?.login;
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : undefined;

    let allRepos;
    if (limit) {
      // Fast path: single page, no pagination
      const { data } = await octokit.repos.listForAuthenticatedUser({
        sort: "updated",
        direction: "desc",
        per_page: limit,
      });
      allRepos = data;
    } else {
      // Full fetch: paginate through ALL repos
      allRepos = await octokit.paginate(
        octokit.repos.listForAuthenticatedUser,
        {
          sort: "updated",
          direction: "desc",
          per_page: 100,
        }
      );
    }

    const repos: GitHubRepo[] = allRepos.map((r) => ({
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

    // Sort user-owned repos first, then by updated_at desc
    repos.sort((a, b) => {
      const aOwned = a.owner.login.toLowerCase() === login?.toLowerCase() ? 0 : 1;
      const bOwned = b.owner.login.toLowerCase() === login?.toLowerCase() ? 0 : 1;
      if (aOwned !== bOwned) return aOwned - bOwned;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return NextResponse.json(repos);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}
