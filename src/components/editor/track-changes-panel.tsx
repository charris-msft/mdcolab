"use client";

import { useCommentStore } from "@/stores/comment-store";
import { useEditorStore } from "@/stores/editor-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, GitCompare } from "lucide-react";

export function TrackChangesPanel() {
  const { threads, updateThread } = useCommentStore();

  const pendingSuggestions = threads.flatMap((t) =>
    t.comments
      .filter((c) => c.suggestedEdit?.status === "pending")
      .map((c) => ({ thread: t, comment: c }))
  );

  const handleAccept = (threadId: string, commentId: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    updateThread(threadId, {
      comments: thread.comments.map((c) =>
        c.id === commentId && c.suggestedEdit
          ? {
              ...c,
              suggestedEdit: {
                ...c.suggestedEdit,
                status: "accepted" as const,
                resolvedBy: "current-user",
                resolvedAt: new Date().toISOString(),
              },
            }
          : c
      ),
    });
  };

  const handleReject = (threadId: string, commentId: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    updateThread(threadId, {
      comments: thread.comments.map((c) =>
        c.id === commentId && c.suggestedEdit
          ? {
              ...c,
              suggestedEdit: {
                ...c.suggestedEdit,
                status: "rejected" as const,
                resolvedBy: "current-user",
                resolvedAt: new Date().toISOString(),
              },
            }
          : c
      ),
    });
  };

  if (pendingSuggestions.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No pending suggestions
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-4 w-4" />
          <span className="font-medium text-sm">
            {pendingSuggestions.length} pending suggestion(s)
          </span>
        </div>
        {pendingSuggestions.map(({ thread, comment }) => (
          <div
            key={comment.id}
            className="rounded-lg border border-border bg-card p-3 space-y-2"
          >
            <div className="text-xs text-muted-foreground">
              @{comment.author.login} suggested:
            </div>
            <div className="space-y-1">
              <div className="text-sm line-through text-red-400 bg-red-500/10 px-2 py-1 rounded">
                {thread.anchor.selectedText}
              </div>
              <div className="text-sm text-green-400 bg-green-500/10 px-2 py-1 rounded">
                {comment.suggestedEdit!.replacement}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAccept(thread.id, comment.id)}
                className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium text-green-400 border-green-500/30 hover:bg-green-500/10 transition-colors"
              >
                <Check className="h-3 w-3 mr-1" /> Accept
              </button>
              <button
                onClick={() => handleReject(thread.id, comment.id)}
                className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium text-red-400 border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                <X className="h-3 w-3 mr-1" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
