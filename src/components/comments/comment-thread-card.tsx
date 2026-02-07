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
import { Check, MessageSquare, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CommentThread, Comment } from "@/types";

export interface CommentThreadCardProps {
  thread: CommentThread;
  isActive: boolean;
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
            src={comment.author.avatarUrl}
            alt={comment.author.login}
          />
          <AvatarFallback>
            {comment.author.login[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">@{comment.author.login}</span>
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
  onReply,
  onResolve,
  onReopen,
  onSelect,
  onAcceptSuggestion,
  onRejectSuggestion,
}: CommentThreadCardProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);

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
            />
          </div>
        )}

        {/* Actions */}
        {thread.status === "open" && !replyVisible && (
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
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
