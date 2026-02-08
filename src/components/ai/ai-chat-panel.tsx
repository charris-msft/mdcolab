"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIStore, type AIMessage } from "@/stores/ai-store";
import { useEditorStore } from "@/stores/editor-store";
import { useAIChat } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { slideInRight } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  X,
  ArrowUp,
  Trash2,
  AlertCircle,
  ExternalLink,
  Lightbulb,
  ClipboardPaste,
  Replace,
  Copy,
  Check,
} from "lucide-react";
import { CopilotIcon } from "@/components/icons/copilot-icon";

interface AIChatPanelProps {
  documentContent?: string;
}

const suggestions = [
  { label: "Draft an introduction", icon: "✍️" },
  { label: "Make this more concise", icon: "✂️" },
  { label: "Fix grammar and spelling", icon: "🔤" },
  { label: "Summarize this section", icon: "📝" },
];

/**
 * Extract content from a markdown code fence if present, otherwise return full content.
 */
function extractCodeFenceContent(content: string): string {
  const match = content.match(/```[\w]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : content;
}

function MessageActions({ message }: { message: AIMessage }) {
  const editor = useEditorStore((s) => s.editor);
  const [copied, setCopied] = useState(false);

  const contentToInsert = extractCodeFenceContent(message.content);

  const parseMarkdownContent = useCallback(
    (markdown: string) => {
      if (!editor) return markdown;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parser = (editor.storage as any).markdown?.parser;
      if (parser) {
        const doc = parser.parse(markdown);
        if (doc && doc.content) {
          return doc.content.toJSON();
        }
      }
      return markdown;
    },
    [editor]
  );

  const handleInsertAtCursor = useCallback(() => {
    if (!editor) {
      toast.error("Editor not available");
      return;
    }
    const content = parseMarkdownContent(contentToInsert);
    editor.chain().focus().insertContent(content).run();
    toast.success("Inserted at cursor");
  }, [editor, contentToInsert, parseMarkdownContent]);

  const handleReplaceSelection = useCallback(() => {
    if (!editor) {
      toast.error("Editor not available");
      return;
    }
    const content = parseMarkdownContent(contentToInsert);
    const { from, to } = editor.state.selection;
    if (from === to) {
      editor.chain().focus().insertContent(content).run();
      toast.success("Inserted at cursor (no selection)");
    } else {
      editor.chain().focus().deleteSelection().insertContent(content).run();
      toast.success("Selection replaced");
    }
  }, [editor, contentToInsert, parseMarkdownContent]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(contentToInsert);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [contentToInsert]);

  return (
    <div className="flex items-center gap-1 mt-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
        onClick={handleInsertAtCursor}
        title="Insert at cursor position in editor"
      >
        <ClipboardPaste className="size-3" />
        Insert
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
        onClick={handleReplaceSelection}
        title="Replace selected text in editor"
      >
        <Replace className="size-3" />
        Replace
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        title="Copy to clipboard"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function AIChatPanel({ documentContent }: AIChatPanelProps) {
  const {
    isOpen,
    messages,
    isLoading,
    error,
    closePanel,
    setError,
    clearMessages,
  } = useAIStore();

  const { sendMessage } = useAIChat(documentContent);
  const selectedText = useEditorStore((s) => s.selectedText);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const isCopilotError = error?.includes("Copilot subscription required") ?? false;

  const handleSend = useCallback(
    (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isLoading) return;

      setInput("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      sendMessage(content);
    },
    [input, isLoading, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    },
    []
  );

  if (!isOpen) return null;

  return (
    <motion.aside
      variants={slideInRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-80 max-md:w-full h-full glass border-l border-border/50 flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <CopilotIcon className="size-4 text-purple-400" />
          <h2 className="text-sm font-semibold">Copilot</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={clearMessages}
            disabled={messages.length === 0}
            title="Clear conversation"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={closePanel}
            title="Close panel"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "mx-3 mt-2 p-2.5 rounded-md border flex items-start gap-2",
              isCopilotError
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-red-500/30 bg-red-500/5"
            )}>
              <AlertCircle className={cn(
                "size-4 shrink-0 mt-0.5",
                isCopilotError ? "text-amber-400" : "text-red-400"
              )} />
              <div className="flex-1 space-y-1.5">
                <p className={cn(
                  "text-xs",
                  isCopilotError ? "text-amber-300" : "text-red-300"
                )}>{error}</p>
                {isCopilotError && (
                  <a
                    href="https://github.com/settings/copilot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    Manage Copilot subscription
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className={cn(
                  isCopilotError
                    ? "text-amber-400 hover:text-amber-300"
                    : "text-red-400 hover:text-red-300"
                )}
              >
                <X className="size-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="h-full">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="size-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
                <CopilotIcon className="size-5 text-purple-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                How can I help?
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                Ask me to help you write, edit, or improve your document.
              </p>
              <div className="w-full space-y-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSend(s.label)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors text-left"
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message list */
            <div className="p-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/50 text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    {msg.isStreaming && (
                      <span className="inline-flex gap-0.5 ml-1">
                        <span className="size-1 rounded-full bg-current animate-pulse" />
                        <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                        <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                      </span>
                    )}
                    {msg.role === "assistant" &&
                      !msg.isStreaming &&
                      msg.content.trim() && (
                        <MessageActions message={msg} />
                      )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-accent/50 rounded-lg px-3 py-2">
                    <span className="inline-flex gap-1 items-center">
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Input area */}
      <div className="p-3">
        {selectedText && (
          <div className="mb-2 px-2 py-1.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-1.5 truncate">
            <span>📌</span>
            <span className="truncate">
              &quot;{selectedText.length > 50 ? selectedText.slice(0, 50) + "…" : selectedText}&quot;
            </span>
            <span className="shrink-0 text-purple-400/60">
              ({selectedText.length} chars)
            </span>
          </div>
        )}
        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Copilot to help you write..."
            rows={1}
            className="flex-1 min-h-[36px] max-h-[120px] resize-none text-sm bg-transparent border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder:text-muted-foreground/50"
          />
          <Button
            size="sm"
            className="h-9 w-9 p-0 shrink-0 bg-purple-600 hover:bg-purple-500"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            title="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </motion.aside>
  );
}
