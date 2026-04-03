import { NextRequest, NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";

interface UserResult {
  login: string;
  avatar_url: string;
  name: string | null;
}

async function searchGlobalUsers(octokit: Awaited<ReturnType<typeof getOctokit>>, q: string): Promise<UserResult[]> {
  const { data } = await octokit.search.users({ q, per_page: 5 });
  return data.items.map((u) => ({
    login: u.login,
    avatar_url: u.avatar_url,
    name: u.name ?? null,
  }));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 1) {
    return NextResponse.json([]);
  }

  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");

  try {
    const octokit = await getOctokit();

    if (owner && repo) {
      let collabResults: UserResult[] = [];
      let collabFailed = false;

      try {
        const { data: collaborators } = await octokit.repos.listCollaborators({
          owner,
          repo,
          per_page: 50,
        });
        const lowerQ = q.toLowerCase();
        collabResults = collaborators
          .filter((c) => {
            const loginMatch = c.login.toLowerCase().includes(lowerQ);
            const nameMatch = (c.name ?? "").toLowerCase().includes(lowerQ);
            return loginMatch || nameMatch;
          })
          .map((c) => ({
            login: c.login,
            avatar_url: c.avatar_url,
            name: c.name ?? null,
          }));
      } catch {
        collabFailed = true;
      }

      if (collabFailed) {
        return NextResponse.json(await searchGlobalUsers(octokit, q));
      }

      // Deduplicate: collaborator results first, then fill with global results
      const seen = new Set(collabResults.map((u) => u.login));
      const globalResults = await searchGlobalUsers(octokit, q);
      for (const u of globalResults) {
        if (!seen.has(u.login)) {
          collabResults.push(u);
          seen.add(u.login);
        }
      }

      return NextResponse.json(collabResults.slice(0, 10));
    }

    return NextResponse.json(await searchGlobalUsers(octokit, q));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
