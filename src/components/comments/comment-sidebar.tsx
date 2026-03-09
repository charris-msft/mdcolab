"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCommentStore } from "@/stores/comment-store";
import { useEditorStore } from "@/stores/editor-store";
import { CommentThreadCard } from "./comment-thread-card";
import { CommentSearch } from "./comment-search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { slideInRight, staggerContainer, staggerItem } from "@/lib/animations";
import {
  MessageSquare,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  Plus,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useCommentNavigation } from "@/hooks/use-comment-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useComments } from "@/hooks/use-comments";
import { getGuestDisplayName, setGuestDisplayName, randomizeGuestName } from "@/lib/friendly-names";
import { RefreshCw } from "lucide-react";

type FilterStatus = "open" | "resolved" | "all";

const filterLabels: Record<FilterStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  all: "All",
};

export function CommentSidebar({ hasIssues = true }: { hasIssues?: boolean }) {
  const params = useParams<{ owner: string; repo: string; branch: string; path: string[] }>();
  const filePath = params.path?.join("/") ?? "";
  const { status } = useSession();
  const isAnonymous = status === "unauthenticated";

  const { replyToThread, resolveThread, reopenThread, createThread } = useComments({
    owner: params.owner,
    repo: params.repo,
    branch: params.branch,
    path: filePath,
  });

  const {
    threads,
    activeThreadId,
    filterStatus,
    isSidebarOpen,
    searchQuery,
    authorFilter,
    orphanedThreadIds,
    setActiveThread,
    setFilterStatus,
    setSidebarOpen,
    updateThread,
  } = useCommentStore();

  const content = useEditorStore((s) => s.content);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      // Status filter
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      // Exclude orphaned threads from main list
      if (orphanedThreadIds.includes(t.id)) return false;
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesBody = t.comments.some((c) =>
          c.body.toLowerCase().includes(q)
        );
        if (!matchesBody) return false;
      }
      // Author filter
      if (authorFilter.length > 0) {
        const matchesAuthor = t.comments.some((c) =>
          authorFilter.includes(c.author.isAnonymous ? (c.author.displayName ?? "Anonymous") : (c.author.login ?? "unknown"))
        );
        if (!matchesAuthor) return false;
      }
      return true;
    });
  }, [threads, filterStatus, searchQuery, authorFilter, orphanedThreadIds]);

  const orphanedThreads = useMemo(
    () => threads.filter((t) => orphanedThreadIds.includes(t.id)),
    [threads, orphanedThreadIds]
  );

  const textThreads = useMemo(() => {
    const filtered = filteredThreads.filter((t) => t.anchor.type === "text-range");
    if (!content) return filtered;
    return [...filtered].sort((a, b) => {
      const posA = a.anchor.selectedText ? content.indexOf(a.anchor.selectedText) : -1;
      const posB = b.anchor.selectedText ? content.indexOf(b.anchor.selectedText) : -1;
      if (posA === -1 && posB === -1) return 0;
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });
  }, [filteredThreads, content]);
  const docThreads = filteredThreads.filter((t) => t.anchor.type === "document");

  const openCount = threads.filter((t) => t.status === "open").length;
  const { goToNext, goToPrevious, totalCount } = useCommentNavigation();

  const [showDocInput, setShowDocInput] = useState(false);
  const [docCommentBody, setDocCommentBody] = useState("");
  const [orphanedExpanded, setOrphanedExpanded] = useState(false);
  const [guestName, setGuestName] = useState(() => {
    if (typeof window === "undefined") return "";
    return getGuestDisplayName();
  });

  const handleReply = useCallback(
    (threadId: string, body: string) => {
      // If threadId is not a number, it's an unpersisted thread (UUID from editor mark).
      // Create the Issue first, then the first comment body is the thread body.
      const isUnpersisted = isNaN(Number(threadId));
      if (isUnpersisted) {
        const thread = threads.find((t) => t.id === threadId);
        if (!thread) return;
        createThread(thread.anchor, body);
        // Remove the local-only placeholder thread
        useCommentStore.getState().removeThread(threadId);
      } else {
        replyToThread(threadId, body);
      }
    },
    [replyToThread, createThread, threads]
  );

  const handleResolve = useCallback(
    (threadId: string) => {
      if (isNaN(Number(threadId))) return; // Can't resolve unpersisted threads
      resolveThread(threadId);
    },
    [resolveThread]
  );

  const handleReopen = useCallback(
    (threadId: string) => {
      if (isNaN(Number(threadId))) return;
      reopenThread(threadId);
    },
    [reopenThread]
  );

  const handleAcceptSuggestion = useCallback(
    (threadId: string, commentId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      const updatedComments = thread.comments.map((c) =>
        c.id === commentId && c.suggestedEdit
          ? {
              ...c,
              suggestedEdit: {
                ...c.suggestedEdit,
                status: "accepted" as const,
                resolvedBy: "you",
                resolvedAt: new Date().toISOString(),
              },
            }
          : c
      );
      updateThread(threadId, { comments: updatedComments });
    },
    [threads, updateThread]
  );

  const handleRejectSuggestion = useCallback(
    (threadId: string, commentId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      const updatedComments = thread.comments.map((c) =>
        c.id === commentId && c.suggestedEdit
          ? {
              ...c,
              suggestedEdit: {
                ...c.suggestedEdit,
                status: "rejected" as const,
                resolvedBy: "you",
                resolvedAt: new Date().toISOString(),
              },
            }
          : c
      );
      updateThread(threadId, { comments: updatedComments });
    },
    [threads, updateThread]
  );

  const handleAddDocComment = useCallback(() => {
    const trimmed = docCommentBody.trim();
    if (!trimmed) return;
    if (isAnonymous && guestName.trim()) {
      setGuestDisplayName(guestName.trim());
    }
    createThread(
      {
        type: "document",
        selectedText: "",
        context: { before: "", after: "" },
      },
      trimmed
    );
    setDocCommentBody("");
    setShowDocInput(false);
  }, [docCommentBody, createThread, isAnonymous, guestName]);

  const handleSelect = useCallback(
    (threadId: string) => {
      setActiveThread(threadId);
      window.dispatchEvent(
        new CustomEvent("comment:scroll-to-anchor", { detail: { threadId } })
      );
    },
    [setActiveThread]
  );

  if (!isSidebarOpen) return null;

  return (
    <motion.aside
      variants={slideInRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-80 h-full glass border-l border-border/50 flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Comments</h2>
          {openCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {openCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={goToPrevious}
            disabled={totalCount === 0}
            title="Previous comment"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={goToNext}
            disabled={totalCount === 0}
            title="Next comment"
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Filter comments">
                <Filter className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(filterLabels) as FilterStatus[]).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={filterStatus === status ? "bg-accent" : ""}
                >
                  {filterLabels[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Search & author filter */}
      <div className="pt-2">
        <CommentSearch />
      </div>

      {/* Issues disabled banner */}
      {!hasIssues && (
        <div className="mx-3 mt-2 p-3 rounded-md border border-blue-500/30 bg-blue-500/5">
          <div className="flex gap-2">
            <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Comments require GitHub Issues to be enabled.{" "}
              Go to your repo <strong>Settings → Features → Issues</strong> to enable.
            </p>
          </div>
        </div>
      )}

      {/* Thread list */}
      <ScrollArea className="flex-1">
        {filteredThreads.length === 0 && !showDocInput ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No comments yet
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Select text in the document to add a comment.
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="p-3 space-y-2"
          >
            <AnimatePresence mode="popLayout">
              {textThreads.map((thread) => (
                <motion.div key={thread.id} variants={staggerItem} layout>
                  <CommentThreadCard
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    isAnonymous={isAnonymous}
                    onReply={handleReply}
                    onResolve={handleResolve}
                    onReopen={handleReopen}
                    onSelect={handleSelect}
                    onAcceptSuggestion={handleAcceptSuggestion}
                    onRejectSuggestion={handleRejectSuggestion}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* General Comments Section */}
            {(docThreads.length > 0 || showDocInput) && (
              <>
                {textThreads.length > 0 && <Separator className="my-3" />}
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    General Comments
                  </span>
                </div>
                <AnimatePresence mode="popLayout">
                  {docThreads.map((thread) => (
                    <motion.div key={thread.id} variants={staggerItem} layout>
                      <CommentThreadCard
                        thread={thread}
                        isActive={thread.id === activeThreadId}
                        isAnonymous={isAnonymous}
                        onReply={handleReply}
                        onResolve={handleResolve}
                        onReopen={handleReopen}
                        onSelect={handleSelect}
                        onAcceptSuggestion={handleAcceptSuggestion}
                        onRejectSuggestion={handleRejectSuggestion}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}

            {/* Add general comment input */}
            {showDocInput && (
              <div className="glass rounded-lg p-3 space-y-2">
                {isAnonymous && (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Your name"
                      className="flex-1 text-sm bg-transparent border border-border/50 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      title="Get a new random name"
                      onClick={() => setGuestName(randomizeGuestName())}
                    >
                      <RefreshCw className="size-3" />
                    </Button>
                  </div>
                )}
                <textarea
                  value={docCommentBody}
                  onChange={(e) => setDocCommentBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddDocComment();
                    }
                    if (e.key === "Escape") setShowDocInput(false);
                  }}
                  placeholder="Add a general comment..."
                  className="w-full min-h-[60px] resize-none text-sm bg-transparent border border-border/50 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setShowDocInput(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddDocComment} disabled={!docCommentBody.trim()}>
                    Comment
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Add general comment button */}
        {!showDocInput && (
          <div className="p-3 pt-0">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1.5 text-muted-foreground"
              onClick={() => setShowDocInput(true)}
              title="Add a comment about the whole document"
            >
              <Plus className="size-3" />
              Add general comment
            </Button>
          </div>
        )}

        {/* Orphaned Comments */}
        {orphanedThreads.length > 0 && (
          <div className="p-3 pt-0">
            <button
              onClick={() => setOrphanedExpanded(!orphanedExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-500 hover:text-amber-400 w-full"
            >
              <AlertTriangle className="size-3" />
              ⚠️ Orphaned Comments ({orphanedThreads.length})
              <ChevronDown
                className={`size-3 ml-auto transition-transform ${
                  orphanedExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {orphanedExpanded && (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  These comments could not be matched to the current document.
                </p>
                <AnimatePresence mode="popLayout">
                  {orphanedThreads.map((thread) => (
                    <motion.div key={thread.id} variants={staggerItem} layout>
                      <div className="opacity-60 border border-amber-500/30 rounded-lg">
                        <CommentThreadCard
                          thread={thread}
                          isActive={thread.id === activeThreadId}
                          isAnonymous={isAnonymous}
                          onReply={handleReply}
                          onResolve={handleResolve}
                          onReopen={handleReopen}
                          onSelect={handleSelect}
                          onAcceptSuggestion={handleAcceptSuggestion}
                          onRejectSuggestion={handleRejectSuggestion}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </motion.aside>
  );
}
