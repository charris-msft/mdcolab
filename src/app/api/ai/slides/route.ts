import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import path from "path";

export const runtime = "nodejs";

const START_TIMEOUT_MS = 15_000;
const SESSION_TIMEOUT_MS = 15_000;
const SLIDES_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// POST /api/ai/slides
// Body: { content: string }
// Returns: { slides: string }
export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as {
    accessToken?: string;
  } | null;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content } = await req.json();
  if (!content) {
    return NextResponse.json({ error: "Document content is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CopilotClient: any;
  try {
    ({ CopilotClient } = await import("@github/copilot-sdk"));
  } catch (err: unknown) {
    console.error("[Slides] Failed to load @github/copilot-sdk:", err);
    return NextResponse.json(
      { error: "AI features are not available on this server" },
      { status: 503 },
    );
  }

  const client = new CopilotClient({
    githubToken: session.accessToken,
    useLoggedInUser: false,
  });

  try {
    await withTimeout(client.start(), START_TIMEOUT_MS, "Copilot CLI start");

    const marpSkillDir = path.join(process.cwd(), "skills", "marp");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copilotSession: any = await withTimeout(
      client.createSession({
        model: "gpt-4.1",
        streaming: true,
        skillDirectories: [marpSkillDir],
        systemMessage: {
          mode: "append",
          content: `You are converting a markdown document into a Marp presentation.
Output ONLY the complete Marp markdown — no explanations, no commentary, no code fences around the output.
The output should be a valid Marp markdown file starting with the YAML frontmatter block (---\\nmarp: true\\n...).`,
        },
        availableTools: [],
      }),
      SESSION_TIMEOUT_MS,
      "Session creation",
    );

    const slidesContent = await withTimeout(
      new Promise<string>((resolve, reject) => {
        let accumulated = "";

        copilotSession.on(
          "assistant.message_delta",
          (event: { data: { deltaContent?: string } }) => {
            accumulated += event.data.deltaContent ?? "";
          },
        );

        copilotSession.on("session.idle", () => resolve(accumulated));

        copilotSession.on(
          "session.error",
          (event: { data: { message?: string; statusCode?: number } }) => {
            const msg = event.data.message || "Slides generation failed";
            const status = event.data.statusCode;
            const isCopilotError =
              status === 401 ||
              status === 403 ||
              /copilot|subscription|unauthorized/i.test(msg);
            reject(
              new Error(
                isCopilotError
                  ? "GitHub Copilot subscription required"
                  : msg,
              ),
            );
          },
        );

        copilotSession
          .send({
            prompt: `Convert the following document into a Marp presentation. Output only the complete Marp markdown.\n\nDocument:\n\n${content}`,
          })
          .catch((err: Error) => reject(err));
      }),
      SLIDES_TIMEOUT_MS,
      "Slides generation",
    );

    return NextResponse.json({ slides: slidesContent });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate slides";
    console.error("[Slides] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.stop().catch(() => {});
  }
}
