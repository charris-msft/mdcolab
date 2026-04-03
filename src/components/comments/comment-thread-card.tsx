"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { slideInRight } from "@/lib/animations";
import { relativeTime } from "@/lib/time";
import { renderMentions } from "@/lib/render-mentions";
import { CommentReplyInput } from "./comment-reply-input";
import { SuggestedEditView } from "./suggested-edit-view";
import { Check, MessageSquare, RotateCcw, Megaphone, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { CommentThread, Comment } from "@/types";

export interface CommentThreadCardProps {
  thread: CommentThread;
  isActive: boolean;
  isAnonymous?: boolean;
  canEdit?: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  filePath?: string;
  onReply: (threadId: string, body: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onSelect: (threadId: string) => void;
  onAcceptSuggestion?: (threadId: string, commentId: string) => void;
  onRejectSuggestion?: (threadId: string, commentId: string) => void;
}

function CommentItem({
  comment,
  isReply,
  anchorText,
  canResolve,
  onAccept,
  onReject,
}: {
  comment: Comment;
  isReply: boolean;
  anchorText?: string;
  canResolve?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  return (
    <div className={isReply ? "ml-6 mt-3" : "mt-3"}>
      <div className="flex items-center gap-2">
        <Avatar size="sm">
          <AvatarImage
            src={comment.author.avatarUrl ?? undefined}
            alt={comment.author.displayName ?? comment.author.login ?? "Anonymous"}
          />
          <AvatarFallback>
            {(comment.author.displayName ?? comment.author.login ?? "A")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{comment.author.isAnonymous ? (comment.author.displayName ?? "Anonymous") : `@${comment.author.login}`}</span>
        <span className="text-xs text-muted-foreground">
          {relativeTime(comment.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-sm text-foreground/90 leading-relaxed">
        {renderMentions(comment.body)}
      </p>
      {comment.suggestedEdit && anchorText && (
        <SuggestedEditView
          originalText={anchorText}
          replacement={comment.suggestedEdit.replacement}
          status={comment.suggestedEdit.status}
          canResolve={canResolve ?? false}
          resolvedBy={comment.suggestedEdit.resolvedBy}
          onAccept={onAccept ?? (() => {})}
          onReject={onReject ?? (() => {})}
        />
      )}
    </div>
  );
}

export function CommentThreadCard({
  thread,
  isActive,
  isAnonymous,
  canEdit,
  owner,
  repo,
  branch,
  filePath,
  onReply,
  onResolve,
  onReopen,
  onSelect,
  onAcceptSuggestion,
  onRejectSuggestion,
}: CommentThreadCardProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promotedUrl, setPromotedUrl] = useState<string | null>(null);

  // Auto-show reply input for new threads with no comments
  const autoReply = isActive && thread.comments.length === 0;
  const replyVisible = showReplyInput || autoReply;

  const handleReply = useCallback(
    (body: string) => {
      onReply(thread.id, body);
      setShowReplyInput(false);
    },
    [thread.id, onReply]
  );

  const handleSelect = useCallback(() => {
    onSelect(thread.id);
  }, [thread.id, onSelect]);

  const handlePromote = useCallback(
    async (issueType: "bug" | "feature") => {
      if (!owner || !repo || !branch || !filePath) return;
      setPromoting(true);
      try {
        const res = await fetch(
          `/api/comments/${owner}/${repo}/${branch}/${filePath}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "promote",
              issueNumber: Number(thread.id),
              issueType,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Promotion failed");
        setPromotedUrl(data.issueUrl);
        toast.success("Promoted to issue!", {
          description: (
            <a
              href={data.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              View on GitHub <ExternalLink className="size-3" />
            </a>
          ),
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to promote to issue"
        );
      } finally {
        setPromoting(false);
      }
    },
    [owner, repo, branch, filePath, thread.id]
  );

  const anchorText = thread.anchor.selectedText;
  const truncatedAnchor =
    anchorText.length > 80 ? anchorText.slice(0, 80) + "…" : anchorText;

  return (
    <motion.div
      variants={slideInRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      onClick={handleSelect}
      className={`glass rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "ring-1 ring-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
          : "hover:border-border/80"
      } ${thread.status === "resolved" ? "opacity-60" : ""}`}
    >
      {/* Promoted type badge */}
      {thread.promoted && (
        <div className="flex items-center px-3 pt-2">
          {thread.promoted === "bug" ? (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-red-500/15 text-red-400">
              🐛 Bug
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-teal-500/15 text-teal-400">
              ✨ Feature
            </Badge>
          )}
        </div>
      )}

      {/* Promoted badge */}
      {promotedUrl && (
        <div className="flex items-center justify-between px-3 pt-2">
          <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-violet-500/15 text-violet-400">
            <Megaphone className="size-3" />
            Promoted
          </Badge>
          <a
            href={promotedUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            View issue <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {/* Resolved badge */}
      {thread.status === "resolved" && (
        <div className="flex items-center justify-between px-3 pt-2">
          <Badge variant="secondary" className="text-[10px] h-5 gap-1">
            <Check className="size-3" />
            Resolved
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 gap-1 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onReopen(thread.id);
            }}
          >
            <RotateCcw className="size-3" />
            Reopen
          </Button>
        </div>
      )}

      {/* Anchor text */}
      {anchorText && (
        <div className="border-l-2 border-yellow-500/60 px-3 py-2 bg-yellow-500/5 rounded-t-lg">
          <p className="text-xs text-muted-foreground italic truncate">
            &ldquo;{truncatedAnchor}&rdquo;
          </p>
        </div>
      )}

      <div className="p-3">
        {/* Comments */}
        {thread.comments.map((comment, i) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            isReply={i > 0}
            anchorText={thread.anchor.selectedText}
            canResolve={thread.status === "open"}
            onAccept={() => onAcceptSuggestion?.(thread.id, comment.id)}
            onReject={() => onRejectSuggestion?.(thread.id, comment.id)}
          />
        ))}

        {/* Reply input */}
        {replyVisible && (
          <div className="mt-3">
            <CommentReplyInput
              onSubmit={handleReply}
              onCancel={() => setShowReplyInput(false)}
              submitLabel={thread.comments.length === 0 ? "Comment" : "Reply"}
              autoFocus={autoReply}
              isAnonymous={isAnonymous}
              owner={owner}
              repo={repo}
            />
          </div>
        )}

        {/* Actions */}
        {thread.status === "open" && !replyVisible && (
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReplyInput(true);
                }}
              >
                <MessageSquare className="size-3" />
                Reply
              </Button>
              {canEdit && !isNaN(Number(thread.id)) && !promotedUrl && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 gap-1 text-muted-foreground hover:text-violet-500"
                      disabled={promoting}
                      onClick={(e) => e.stopPropagation()}
                      title="Promote to GitHub issue"
                    >
                      {promoting ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Megaphone className="size-3" />
                      )}
                      Promote
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => handlePromote("bug")}>
                      🐛 Bug Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePromote("feature")}>
                      ✨ Feature Request
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1 text-muted-foreground hover:text-green-500"
              onClick={(e) => {
                e.stopPropagation();
                onResolve(thread.id);
              }}
            >
              <Check className="size-3" />
              Resolve
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
