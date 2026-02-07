"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface MentionUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onMention?: (login: string) => void;
  placeholder?: string;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  onMention,
  placeholder = "Reply… (@ to mention)",
  className,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUsers = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`
        );
        const data: MentionUser[] = await res.json();
        setResults(data);
        setShowDropdown(data.length > 0);
        setSelectedIndex(0);
      } catch {
        setResults([]);
        setShowDropdown(false);
      }
    }, 300);
  }, []);

  const insertMention = useCallback(
    (login: string) => {
      if (mentionStart === null) return;
      const before = value.slice(0, mentionStart);
      const after = value.slice(
        mentionStart + 1 + mentionQuery.length // +1 for the @
      );
      const newValue = `${before}@${login} ${after}`;
      onChange(newValue);
      onMention?.(login);
      setShowDropdown(false);
      setMentionStart(null);
      setMentionQuery("");
      // Refocus textarea
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          const pos = before.length + login.length + 2; // @login + space
          ta.focus();
          ta.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [mentionStart, mentionQuery, value, onChange, onMention]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      const cursorPos = e.target.selectionStart ?? newValue.length;
      // Walk backwards from cursor to find @
      let atPos: number | null = null;
      for (let i = cursorPos - 1; i >= 0; i--) {
        const ch = newValue[i];
        if (ch === "@") {
          // Only if preceded by start-of-string or whitespace
          if (i === 0 || /\s/.test(newValue[i - 1])) {
            atPos = i;
          }
          break;
        }
        if (/\s/.test(ch)) break;
      }

      if (atPos !== null) {
        const query = newValue.slice(atPos + 1, cursorPos);
        setMentionStart(atPos);
        setMentionQuery(query);
        fetchUsers(query);
      } else {
        setShowDropdown(false);
        setMentionStart(null);
        setMentionQuery("");
      }
    },
    [onChange, fetchUsers]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showDropdown && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % results.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + results.length) % results.length);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          insertMention(results[selectedIndex].login);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowDropdown(false);
          return;
        }
      }
      // Ctrl+Enter to submit
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit();
      }
    },
    [showDropdown, results, selectedIndex, insertMention, onSubmit]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`min-h-[60px] resize-none text-sm ${className ?? ""}`}
        autoFocus
      />
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-md"
        >
          {results.map((user, i) => (
            <button
              key={user.login}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user.login);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={user.avatar_url} alt={user.login} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">@{user.login}</span>
              {user.name && (
                <span className="text-muted-foreground">{user.name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
