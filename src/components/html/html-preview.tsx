"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { AlertTriangle, FileCode2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCommentStore } from "@/stores/comment-store";
import { useEditorStore } from "@/stores/editor-store";
import type { CommentAnchor, CommentThread } from "@/types";
import {
  buildHtmlPreviewSrcDoc,
  sanitizeHtmlForPreview,
} from "./html-preview-utils";

interface HtmlPreviewProps {
  html: string;
  fileSha: string | null;
  filePath: string;
}

interface HtmlBridgeSelection {
  selectedText: string;
  context: { before: string; after: string };
  html: {
    domPath: string;
    textQuote: string;
  };
}

interface HtmlBridgeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type HtmlBridgeMessage =
  | { source: "mdcolab-html-preview"; type: "ready" }
  | {
      source: "mdcolab-html-preview";
      type: "selection";
      selection: HtmlBridgeSelection;
      rect: HtmlBridgeRect;
    }
  | {
      source: "mdcolab-html-preview";
      type: "anchor-click";
      threadId: string;
    };

function isHtmlBridgeMessage(data: unknown): data is HtmlBridgeMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "source" in data &&
    (data as { source: unknown }).source === "mdcolab-html-preview"
  );
}

function toThreadPayload(thread: CommentThread) {
  return {
    id: thread.id,
    status: thread.status,
    anchor: thread.anchor,
  };
}

export function HtmlPreview({ html, fileSha, filePath }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    anchor: CommentAnchor;
    position: { left: number; top: number };
  } | null>(null);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const { threads, activeThreadId, addThread, setActiveThread, setSidebarOpen } =
    useCommentStore();
  const setContent = useEditorStore((state) => state.setContent);
  const setSelectedText = useEditorStore((state) => state.setSelectedText);

  const preview = useMemo(() => sanitizeHtmlForPreview(html), [html]);
  const srcDoc = useMemo(
    () => (preview.status === "ok" ? buildHtmlPreviewSrcDoc(preview.html) : ""),
    [preview]
  );

  useEffect(() => {
    setContent(html);
  }, [html, setContent]);

  const postToFrame = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "mdcolab-html-parent", ...message },
      "*"
    );
  }, []);

  const sendThreadsToFrame = useCallback(() => {
    const htmlThreads = threads
      .filter((thread) => thread.anchor.type === "html-range")
      .map(toThreadPayload);
    postToFrame({ type: "threads", threads: htmlThreads });
  }, [postToFrame, threads]);

  useEffect(() => {
    if (isFrameReady) sendThreadsToFrame();
  }, [isFrameReady, sendThreadsToFrame]);

  useEffect(() => {
    if (!isFrameReady || !activeThreadId) return;
    const thread = threads.find((candidate) => candidate.id === activeThreadId);
    if (!thread || thread.anchor.type !== "html-range") return;
    postToFrame({
      type: "activate",
      threadId: activeThreadId,
      anchor: thread.anchor,
    });
  }, [activeThreadId, isFrameReady, postToFrame, threads]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isHtmlBridgeMessage(event.data)) return;

      if (event.data.type === "ready") {
        setIsFrameReady(true);
        return;
      }

      if (event.data.type === "anchor-click") {
        setActiveThread(event.data.threadId);
        setSidebarOpen(true);
        return;
      }

      const iframeRect = iframeRef.current?.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!iframeRect || !containerRect) return;

      const anchor: CommentAnchor = {
        type: "html-range",
        selectedText: event.data.selection.selectedText,
        context: event.data.selection.context,
        html: {
          ...event.data.selection.html,
          fileSha: fileSha ?? undefined,
          status: "exact",
        },
      };

      setSelectedText(anchor.selectedText);
      setPendingSelection({
        anchor,
        position: {
          left:
            iframeRect.left -
            containerRect.left +
            event.data.rect.left +
            Math.min(event.data.rect.width, 16),
          top: iframeRect.top - containerRect.top + event.data.rect.top - 36,
        },
      });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fileSha, setActiveThread, setSelectedText, setSidebarOpen]);

  useEffect(() => {
    const handler = (event: Event) => {
      const threadId = (event as CustomEvent).detail?.threadId;
      if (!threadId) return;
      const thread = threads.find((candidate) => candidate.id === threadId);
      if (thread?.anchor.type !== "html-range") return;
      postToFrame({ type: "activate", threadId, anchor: thread.anchor });
    };
    window.addEventListener("comment:scroll-to-anchor", handler);
    return () => window.removeEventListener("comment:scroll-to-anchor", handler);
  }, [postToFrame, threads]);

  const createComment = useCallback(() => {
    if (!pendingSelection) return;

    const threadId = uuidv4();
    const thread: CommentThread = {
      id: threadId,
      status: "open",
      anchor: pendingSelection.anchor,
      comments: [],
    };

    addThread(thread);
    setActiveThread(threadId);
    setSidebarOpen(true);
    setPendingSelection(null);
    postToFrame({
      type: "threads",
      threads: [...threads, thread]
        .filter((candidate) => candidate.anchor.type === "html-range")
        .map(toThreadPayload),
    });
    postToFrame({ type: "activate", threadId, anchor: thread.anchor });
  }, [
    addThread,
    pendingSelection,
    postToFrame,
    setActiveThread,
    setSidebarOpen,
    threads,
  ]);

  if (preview.status !== "ok") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">
            HTML preview unavailable
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{preview.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{filePath}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <ShieldCheck className="size-3" />
            Sanitized preview
          </Badge>
          <span className="text-xs text-muted-foreground">
            Scripts and remote resources disabled
          </span>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        title={`${filePath} preview`}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => setIsFrameReady(true)}
        className="h-full w-full flex-1 border-0 bg-background"
      />
      {pendingSelection && (
        <Button
          size="sm"
          className="absolute z-10 shadow-lg"
          style={{
            left: Math.max(8, pendingSelection.position.left),
            top: Math.max(8, pendingSelection.position.top),
          }}
          onClick={createComment}
        >
          Comment
        </Button>
      )}
    </div>
  );
}
