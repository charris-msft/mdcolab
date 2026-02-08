import { useCallback } from "react";
import { useAIStore } from "@/stores/ai-store";
import { useEditorStore } from "@/stores/editor-store";

export function useAIChat(documentContent?: string) {
  const { addMessage, updateMessage, setStreaming, setLoading, setError, messages } =
    useAIStore();
  const selectedText = useEditorStore((s) => s.selectedText);
  const isEditable = useEditorStore((s) => s.isEditable);

  const sendMessage = useCallback(
    async (prompt: string) => {
      // 1. Add user message to store
      const userMsgId = crypto.randomUUID();
      addMessage({ id: userMsgId, role: "user", content: prompt, timestamp: new Date() });

      // 2. Add placeholder assistant message
      const assistantMsgId = crypto.randomUUID();
      addMessage({
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });
      setLoading(true);
      setError(null);

      let streamedContent = "";

      try {
        // 3. Build history from previous messages (exclude the ones we just added)
        const history = messages.map((m) => ({ role: m.role, content: m.content }));

        // 4. Fetch the streaming API
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, documentContent, history, selectedText, mode: isEditable ? "edit" : "review" }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        // 5. Read the SSE stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.content) {
                streamedContent += data.content;
                updateMessage(assistantMsgId, streamedContent);
              } else if (data.error) {
                setError(data.error);
                setStreaming(assistantMsgId, false);
                if (!streamedContent) {
                  updateMessage(assistantMsgId, "_AI request failed_");
                }
              } else if (data.done) {
                setStreaming(assistantMsgId, false);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        setStreaming(assistantMsgId, false);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to connect to AI";
        setError(message);
        setStreaming(assistantMsgId, false);
        if (!streamedContent) {
          updateMessage(assistantMsgId, "_Failed to get AI response_");
        }
      } finally {
        setLoading(false);
      }
    },
    [documentContent, selectedText, isEditable, messages, addMessage, updateMessage, setStreaming, setLoading, setError],
  );

  return { sendMessage };
}
