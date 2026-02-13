"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput } from "./mention-input";

interface CommentReplyInputProps {
  authorAvatarUrl?: string;
  authorLogin?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  isAnonymous?: boolean;
  onSubmit: (body: string, mentions?: string[]) => void;
  onCancel: () => void;
}

export function CommentReplyInput({
  authorAvatarUrl,
  authorLogin = "you",
  submitLabel = "Reply",
  autoFocus = false,
  isAnonymous = false,
  onSubmit,
  onCancel,
}: CommentReplyInputProps) {
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("mdcolab-guest-name") || "";
  });
  const mentionsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the textarea when autoFocus is set
  useEffect(() => {
    if (autoFocus) {
      const ta = containerRef.current?.querySelector("textarea");
      if (ta) ta.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (isAnonymous && guestName.trim()) {
      localStorage.setItem("mdcolab-guest-name", guestName.trim());
    }
    onSubmit(trimmed, mentionsRef.current);
    setBody("");
    mentionsRef.current = [];
  }, [body, onSubmit, isAnonymous, guestName]);

  const handleMention = useCallback((login: string) => {
    if (!mentionsRef.current.includes(login)) {
      mentionsRef.current.push(login);
    }
  }, []);

  return (
    <div ref={containerRef} className="flex gap-2 pt-2">
      <Avatar size="sm" className="mt-1 shrink-0">
        <AvatarImage src={authorAvatarUrl} alt={isAnonymous ? (guestName || "Guest") : authorLogin} />
        <AvatarFallback>{(isAnonymous ? (guestName || "G") : authorLogin)[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        {isAnonymous && (
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
            className="w-full text-sm bg-transparent border border-border/50 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        )}
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
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
