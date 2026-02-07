import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";

export async function GET() {
  try {
    const octokit = await getOctokit();
    const { data } = await octokit.rateLimit.get();

    return NextResponse.json({
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: data.rate.reset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch rate limit" }, { status: 500 });
  }
}
