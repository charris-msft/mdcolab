import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/ai/health — check if the user has GitHub Copilot access
//
// The Copilot SDK authenticates via its own CLI flow, not the
// copilot_internal/v2/token endpoint (which needs a `copilot` OAuth
// scope we don't request).  We enable the button for any authenticated
// user; if they lack a Copilot subscription the SDK will surface a
// clear error at chat-time.
export async function GET() {
  const session = (await getServerSession(authOptions)) as {
    accessToken?: string;
  } | null;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { available: true },
    {
      status: 200,
      headers: { "Cache-Control": "private, max-age=300" },
    }
  );
}
