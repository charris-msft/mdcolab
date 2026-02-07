"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Users } from "lucide-react";
import { useCommentStore } from "@/stores/comment-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CommentSearch() {
  const { threads, searchQuery, setSearchQuery, authorFilter, setAuthorFilter } =
    useCommentStore();
  const [authorOpen, setAuthorOpen] = useState(false);

  const uniqueAuthors = useMemo(() => {
    const authors = new Set<string>();
    threads.forEach((t) =>
      t.comments.forEach((c) => authors.add(c.author.login))
    );
    return Array.from(authors).sort();
  }, [threads]);

  const matchCount = useMemo(() => {
    if (!searchQuery && authorFilter.length === 0) return null;
    return threads.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.comments.some((c) =>
          c.body.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesAuthor =
        authorFilter.length === 0 ||
        t.comments.some((c) => authorFilter.includes(c.author.login));
      return matchesSearch && matchesAuthor;
    }).length;
  }, [threads, searchQuery, authorFilter]);

  const toggleAuthor = (login: string) => {
    setAuthorFilter(
      authorFilter.includes(login)
        ? authorFilter.filter((a) => a !== login)
        : [...authorFilter, login]
    );
  };

  return (
    <div className="px-3 pb-2 space-y-2">
      <div className="relative flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search comments..."
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <DropdownMenu open={authorOpen} onOpenChange={setAuthorOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              title="Filter by author"
            >
              <Users className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-2">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Authors
            </p>
            {uniqueAuthors.length === 0 ? (
              <p className="text-xs text-muted-foreground">No authors</p>
            ) : (
              uniqueAuthors.map((login) => (
                <label
                  key={login}
                  className="flex items-center gap-2 px-1 py-1 text-xs cursor-pointer hover:bg-accent rounded"
                >
                  <input
                    type="checkbox"
                    checked={authorFilter.includes(login)}
                    onChange={() => toggleAuthor(login)}
                    className="rounded"
                  />
                  @{login}
                </label>
              ))
            )}
            {authorFilter.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 text-[11px] mt-1"
                onClick={() => setAuthorFilter([])}
              >
                Clear
              </Button>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {matchCount !== null && (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {matchCount} result{matchCount !== 1 ? "s" : ""}
          </Badge>
          {(searchQuery || authorFilter.length > 0) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setAuthorFilter([]);
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
