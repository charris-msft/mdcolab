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
        const body = JSON.stringify({ prompt, documentContent, history, selectedText, mode: isEditable ? "edit" : "review" });

        // 4. Fetch the streaming API (with retry for transient failures)
        const MAX_ATTEMPTS = 3;
        const RETRY_DELAY_MS = 1500;
        let response: Response | null = null;
        let lastErrorMsg = "";
        let lastStatus: number | undefined;
        let attempts = 0;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          attempts = attempt + 1;
          if (attempt > 0) {
            updateMessage(assistantMsgId, `_Retrying... (attempt ${attempts} of ${MAX_ATTEMPTS})_`);
            streamedContent = "";
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }

          try {
            response = await fetch("/api/ai/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            });

            if (!response.ok) {
              lastStatus = response.status;
              const errData = await response.json().catch(() => ({ error: "Request failed" }));
              lastErrorMsg = errData.error || `HTTP ${lastStatus}`;
              if (lastStatus === 401 || lastStatus === 403) break;
              response = null;
              continue;
            }
            break;
          } catch (fetchErr: unknown) {
            lastErrorMsg = fetchErr instanceof Error ? fetchErr.message : "Failed to connect to AI";
            response = null;
          }
        }

        if (!response || !response.ok) {
          const isAuth = lastStatus === 401 || lastStatus === 403;
          const statusSuffix = lastStatus && !isAuth ? ` (HTTP ${lastStatus})` : "";
          const msg = !isAuth && attempts > 1
            ? `Failed after ${attempts} attempts: ${lastErrorMsg}${statusSuffix}`
            : `${lastErrorMsg}${statusSuffix}`;
          throw new Error(msg);
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
          updateMessage(assistantMsgId, `_${message}_`);
        }
      } finally {
        setLoading(false);
      }
    },
    [documentContent, selectedText, isEditable, messages, addMessage, updateMessage, setStreaming, setLoading, setError],
  );

  return { sendMessage };
}
