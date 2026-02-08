import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
  const { prompt, documentContent, history } = await req.json();
  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required" },
      { status: 400 },
    );
  }

  // 3. Import CopilotClient dynamically (ESM-only package)
  let CopilotClient: typeof import("@github/copilot-sdk").CopilotClient;
  try {
    ({ CopilotClient } = await import("@github/copilot-sdk"));
  } catch (err: unknown) {
    console.error("Failed to load @github/copilot-sdk:", err);
    return NextResponse.json(
      { error: "AI features are not available on this server" },
      { status: 503 },
    );
  }

  // 4. Create a client authenticated with the user's GitHub token
  const client = new CopilotClient({
    githubToken: session.accessToken,
    useLoggedInUser: false,
  });

  try {
    // 5. Create a streaming session — disable all built-in tools for chat-only use
    const copilotSession = await client.createSession({
      model: "gpt-4.1",
      streaming: true,
      systemMessage: {
        mode: "append",
        content: buildSystemPrompt(documentContent, history),
      },
      availableTools: [],
    });

    // 6. Stream the response as SSE
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const enqueue = (payload: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        // Streaming text deltas
        copilotSession.on("assistant.message_delta", (event) => {
          if (event.data.deltaContent) {
            enqueue({ content: event.data.deltaContent });
          }
        });

        // Session errors
        copilotSession.on("session.error", (event) => {
          const msg = event.data.message || "AI request failed";
          const status = event.data.statusCode;
          const isCopilotError =
            status === 401 ||
            status === 403 ||
            /copilot|subscription|unauthorized/i.test(msg);

          enqueue({
            error: isCopilotError
              ? "GitHub Copilot subscription required. Enable Copilot at github.com/settings/copilot"
              : msg,
          });
          controller.close();
          cleanup();
        });

        // Completion
        copilotSession.on("session.idle", () => {
          enqueue({ done: true });
          controller.close();
          cleanup();
        });

        // Send the user's prompt (non-blocking — events drive the stream)
        copilotSession.send({ prompt }).catch((err: Error) => {
          enqueue({ error: err.message || "Failed to send prompt" });
          controller.close();
          cleanup();
        });
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
    console.error("AI chat error:", message);

    // Copilot CLI not installed / not found
    if (/not found|ENOENT|spawn/i.test(message)) {
      cleanup();
      return NextResponse.json(
        { error: "AI features are not available on this server" },
        { status: 503 },
      );
    }

    cleanup();
    return NextResponse.json({ error: message }, { status: 500 });
  }

  function cleanup() {
    client.stop().catch(() => {});
  }
}

function buildSystemPrompt(
  documentContent?: string,
  history?: Array<{ role: string; content: string }>,
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

## Response Format Rules

1. When providing content the user should insert into their document, wrap it in a fenced code block labeled \`markdown\` so it is easy to copy:
   \`\`\`markdown
   Your content here
   \`\`\`
2. When suggesting edits, show **before** and **after** so the change is clear.
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

  if (documentContent) {
    prompt += `\n\nThe user is currently working on this document:\n\n---\n${documentContent}\n---\n\nRefer to this document when the user asks about "this document", "the text", "this section", etc.`;
  }

  if (history?.length) {
    prompt += "\n\nPrior conversation context:\n";
    for (const msg of history) {
      prompt += `${msg.role}: ${msg.content}\n`;
    }
  }

  return prompt;
}
