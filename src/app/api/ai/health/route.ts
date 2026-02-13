import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/ai/health — check if the user has GitHub Copilot access
export async function GET() {
  const session = (await getServerSession(authOptions)) as {
    accessToken?: string;
  } | null;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.github.com/copilot_internal/v2/token", {
      headers: {
        Authorization: `token ${session.accessToken}`,
        Accept: "application/json",
      },
    });

    const available = res.ok;
    return NextResponse.json(
      { available },
      {
        status: 200,
        headers: { "Cache-Control": "private, max-age=300" },
      }
    );
  } catch {
    return NextResponse.json(
      { available: false },
      {
        status: 200,
        headers: { "Cache-Control": "private, max-age=300" },
      }
    );
  }
}
