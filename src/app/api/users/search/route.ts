import { NextRequest, NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const octokit = await getOctokit();
    const { data } = await octokit.search.users({
      q,
      per_page: 5,
    });

    const results = data.items.map((u) => ({
      login: u.login,
      avatar_url: u.avatar_url,
      name: u.name ?? null,
    }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
