"use client";

import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput } from "./mention-input";

interface CommentReplyInputProps {
  authorAvatarUrl?: string;
  authorLogin?: string;
  onSubmit: (body: string, mentions?: string[]) => void;
  onCancel: () => void;
}

export function CommentReplyInput({
  authorAvatarUrl,
  authorLogin = "you",
  onSubmit,
  onCancel,
}: CommentReplyInputProps) {
  const [body, setBody] = useState("");
  const mentionsRef = useRef<string[]>([]);

  const handleSubmit = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed, mentionsRef.current);
    setBody("");
    mentionsRef.current = [];
  }, [body, onSubmit]);

  const handleMention = useCallback((login: string) => {
    if (!mentionsRef.current.includes(login)) {
      mentionsRef.current.push(login);
    }
  }, []);

  return (
    <div className="flex gap-2 pt-2">
      <Avatar size="sm" className="mt-1 shrink-0">
        <AvatarImage src={authorAvatarUrl} alt={authorLogin} />
        <AvatarFallback>{authorLogin[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <MentionInput
          value={body}
          onChange={setBody}
          onSubmit={handleSubmit}
          onMention={handleMention}
          placeholder="Reply… (@ to mention)"
        />
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!body.trim()}>
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}
