import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import packageJson from "../../../../../package.json";

const START_TIMEOUT_MS = 15_000; // 15s max to start CLI
const SESSION_TIMEOUT_MS = 15_000; // 15s max to create session
const RESPONSE_TIMEOUT_MS = 60_000; // 60s max wait for first token

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// POST /api/ai/chat
// Body: { prompt: string, documentContent?: string, history?: Array<{role: string, content: string}> }
// Returns: SSE stream with text chunks
export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = (await getServerSession(authOptions)) as {
    accessToken?: string;
  } | null;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse request body
  const { prompt, documentContent, history, selectedText, mode } = await req.json();
  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required" },
      { status: 400 },
    );
  }

  // 3. Import CopilotClient dynamically (ESM-only package)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CopilotClient: any;
  try {
    ({ CopilotClient } = await import("@github/copilot-sdk"));
  } catch (err: unknown) {
    console.error("[AI] Failed to load @github/copilot-sdk:", err);
    return NextResponse.json(
      { error: "AI features are not available on this server" },
      { status: 503 },
    );
  }

  // 4. Create a client authenticated with the user's GitHub token
  // TODO: Pass client identifier once @github/copilot-sdk supports it.
  // CopilotClientOptions has no clientName/editorInfo field yet (SDK is in
  // technical preview).  When a field is added, use:
  //   clientName: "mdcolab", clientVersion: packageJson.version
  const client = new CopilotClient({
    githubToken: session.accessToken,
    useLoggedInUser: false,
  });
  console.log(`[AI] mdcolab v${packageJson.version} — creating Copilot client`);

  try {
    // 5. Explicitly start the CLI subprocess (with timeout)
    console.log("[AI] Starting Copilot CLI...");
    await withTimeout(client.start(), START_TIMEOUT_MS, "Copilot CLI start");
    console.log("[AI] Copilot CLI started, creating session...");

    // 6. Create a streaming session (with timeout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copilotSession: any = await withTimeout(client.createSession({
      model: "gpt-4.1",
      streaming: true,
      systemMessage: {
        mode: "append",
        content: buildSystemPrompt(documentContent, history, selectedText, mode),
      },
      availableTools: [],
    }), SESSION_TIMEOUT_MS, "Session creation");
    console.log("[AI] Session created, sending prompt...");

    // 7. Stream the response as SSE
    let closed = false;
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const enqueue = (payload: Record<string, unknown>) => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
            );
          } catch {
            // Stream already closed by client disconnect
          }
        };

        const finish = (cleanup = true) => {
          if (closed) return;
          closed = true;
          clearTimeout(timeout);
          try { controller.close(); } catch { /* already closed */ }
          if (cleanup) client.stop().catch(() => {});
        };

        // Timeout: if no events fire within 60s, close with error
        const timeout = setTimeout(() => {
          console.error("[AI] Response timeout — no events received");
          enqueue({ error: "AI response timed out. Please try again." });
          finish();
        }, RESPONSE_TIMEOUT_MS);

        // Streaming text deltas
        copilotSession.on("assistant.message_delta", (event: { data: { deltaContent?: string } }) => {
          if (event.data.deltaContent) {
            enqueue({ content: event.data.deltaContent });
          }
        });

        // Session errors
        copilotSession.on("session.error", (event: { data: { message?: string; statusCode?: number } }) => {
          const msg = event.data.message || "AI request failed";
          const status = event.data.statusCode;
          console.error("[AI] Session error:", msg, "status:", status);
          const isCopilotError =
            status === 401 ||
            status === 403 ||
            /copilot|subscription|unauthorized/i.test(msg);

          enqueue({
            error: isCopilotError
              ? "GitHub Copilot subscription required. Enable Copilot at github.com/settings/copilot"
              : msg,
          });
          finish();
        });

        // Completion
        copilotSession.on("session.idle", () => {
          console.log("[AI] Session idle — response complete");
          enqueue({ done: true });
          finish();
        });

        // Catch-all for any events (debugging)
        copilotSession.on((event: { type: string }) => {
          console.log("[AI] Event:", event.type);
        });

        // Send the user's prompt
        copilotSession.send({ prompt }).catch((err: Error) => {
          console.error("[AI] Send error:", err.message);
          enqueue({ error: err.message || "Failed to send prompt" });
          finish();
        });
      },
      cancel() {
        // Client disconnected
        if (!closed) {
          closed = true;
          client.stop().catch(() => {});
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to AI service";
    console.error("[AI] Chat error:", message);

    client.stop().catch(() => {});

    if (/not found|ENOENT|spawn/i.test(message)) {
      return NextResponse.json(
        { error: "AI features are not available on this server. The Copilot CLI may not be installed." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(
  documentContent?: string,
  history?: Array<{ role: string; content: string }>,
  selectedText?: string,
  mode?: string,
): string {
  let prompt = `You are **mdcolab AI**, a markdown writing assistant embedded in a collaborative document editing application.

## Core Capabilities

You help users with:
- **Drafting** new content: introductions, sections, conclusions, abstracts, and more.
- **Editing & improving** existing text for clarity, conciseness, and tone.
- **Grammar, spelling & punctuation** fixes.
- **Restructuring** content: reordering sections, adding or adjusting headings.
- **Summarizing** sections or the entire document.
- **Expanding** brief points into detailed explanations.
- **Markdown formatting**: creating tables, lists, code blocks, task lists, and other GFM elements.

## Direct Editing

When the user asks you to make a specific change to the document (e.g., "change X to Y", "remove this paragraph", "add a section about Z after the introduction"), respond with a structured edit block:

\`\`\`edit
<<<< SEARCH
[exact text to find in the document]
>>>>
<<<< REPLACE
[replacement text]
>>>>
\`\`\`

- The SEARCH block must contain text that exists verbatim in the document.
- The REPLACE block contains what should replace it.
- For deletions, leave the REPLACE block empty.
- For insertions, use a SEARCH block that finds the location, and include the original text plus new content in REPLACE.
- You may include multiple edit blocks in one response for multi-part changes.
- After the edit block(s), briefly explain what you changed.

## Response Format Rules

1. When providing content the user should insert into their document, wrap it in a fenced code block labeled \`markdown\` so it is easy to copy:
   \`\`\`markdown
   Your content here
   \`\`\`
2. When the user asks for a specific document change, use the edit block format above instead of showing before/after.
3. For short responses (explanations, answers to questions, brief feedback), respond in plain text without code fences.
4. Be concise — prefer shorter responses unless the user explicitly asks for detail or the task requires it.

## Markdown Awareness

- Use proper markdown syntax: ATX-style headings (\`#\`), fenced code blocks (\`\`\`), pipe tables, and standard emphasis.
- Support GitHub Flavored Markdown (GFM) extensions: task lists (\`- [ ]\`), tables, strikethrough (\`~~text~~\`), and autolinks.
- Maintain consistent formatting with the rest of the document (heading levels, list style, etc.).

## Document Context Awareness

- When the user's document is provided below, reference specific sections by heading or location.
- Understand the document's heading hierarchy and overall flow.
- Do **not** repeat the entire document back — only show the parts relevant to the request.

## Tone Guidelines

- Match the document's existing tone and voice when one is established.
- Default to a professional, clear tone when no style is apparent.
- Be helpful and direct, not verbose.
- When asked to write or edit content, provide the actual text — not meta-instructions about how to write it.
- When making suggestions, explain briefly why.`;

  if (mode === "review") {
    prompt += `\n\n## Mode: Review

The user is in **Review mode**. You can answer questions about the document, explain content, and provide feedback. Do **NOT** use edit blocks — the user cannot edit in this mode. If the user asks for changes, let them know they need to switch to Edit mode first.`;
  }

  if (documentContent) {
    prompt += `\n\nThe user is currently working on this document:\n\n---\n${documentContent}\n---\n\nRefer to this document when the user asks about "this document", "the text", "this section", etc.`;
  }

  if (selectedText) {
    prompt += `\n\nThe user currently has the following text selected in the editor:\n\n> ${selectedText}\n\nWhen the user refers to "this text", "the selection", "selected text", etc., they mean the text above.`;
  }

  if (history?.length) {
    prompt += "\n\nPrior conversation context:\n";
    for (const msg of history) {
      prompt += `${msg.role}: ${msg.content}\n`;
    }
  }

  return prompt;
}
