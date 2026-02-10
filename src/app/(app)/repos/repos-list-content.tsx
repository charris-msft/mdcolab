"use client";

import { useQuery } from "@tanstack/react-query";
import { Star, Clock, Search, ExternalLink, Lock, Globe } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { GitHubRepo } from "@/types";

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const languageColors: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-500",
  Rust: "bg-orange-500",
  Go: "bg-cyan-500",
  Java: "bg-red-500",
  "C#": "bg-purple-500",
  CSS: "bg-pink-500",
  HTML: "bg-orange-400",
  Shell: "bg-emerald-500",
};

export function ReposListContent() {
  const [search, setSearch] = useState("");

  const { data: repos, isLoading, error } = useQuery<GitHubRepo[]>({
    queryKey: ["repos", "all"],
    queryFn: async () => {
      const res = await fetch("/api/repos");
      if (!res.ok) throw new Error("Failed to fetch repos");
      return res.json();
    },
  });

  const filtered = repos?.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.owner.login.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Repositories</h1>
        <a
          href="https://github.com/apps/mdcolab1-ai/installations/new"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Connect private repos
        </a>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load repositories
        </div>
      )}

      {filtered && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No repositories found
            </p>
          )}
          {filtered.map((repo) => (
            <div
              key={repo.id}
              className="group relative flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              <a
                href={`https://github.com/${repo.owner.login}/${repo.name}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-foreground z-10"
                title="Open on GitHub"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Link
                href={`/repos/${repo.owner.login}/${repo.name}`}
                className="flex items-center justify-between min-w-0 flex-1"
              >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {repo.private ? (
                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-semibold text-foreground group-hover:text-primary">
                    {repo.owner.login}/{repo.name}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {repo.description ?? "No description"}
                </p>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-4 text-xs text-muted-foreground mr-6">
                {repo.language && (
                  <span className="flex items-center gap-1">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        languageColors[repo.language] ?? "bg-gray-400"
                      }`}
                    />
                    {repo.language}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {repo.stargazers_count}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(repo.updated_at)}
                </span>
              </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
