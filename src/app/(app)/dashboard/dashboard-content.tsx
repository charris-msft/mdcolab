"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Star, Clock, FileText, ArrowRight, ExternalLink, Lock, Globe } from "lucide-react";
import Link from "next/link";
import type { GitHubRepo } from "@/types";
import { getRecentDocs, type RecentDoc } from "@/lib/recent-docs";

const REPOS_CACHE_KEY = "mdcolab:repos-cache";

function getCachedRepos(): GitHubRepo[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(REPOS_CACHE_KEY);
    if (!raw) return undefined;
    const { repos, ts } = JSON.parse(raw);
    // Expire after 1 hour
    if (Date.now() - ts > 60 * 60 * 1000) return undefined;
    return repos as GitHubRepo[];
  } catch { return undefined; }
}

function setCachedRepos(repos: GitHubRepo[]) {
  try {
    localStorage.setItem(REPOS_CACHE_KEY, JSON.stringify({ repos: repos.slice(0, 12), ts: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

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

export function DashboardContent() {
  const { data: session } = useSession();
  const sessionAny = session as unknown as Record<string, unknown> | null;
  const login = (sessionAny?.login as string) ?? session?.user?.name;
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

  useEffect(() => {
    if (login) setRecentDocs(getRecentDocs(login));
  }, [login]);

  const { data: repos, isLoading, error } = useQuery<GitHubRepo[]>({
    queryKey: ["repos", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/repos?limit=12");
      if (!res.ok) throw new Error("Failed to fetch repos");
      const data = await res.json();
      setCachedRepos(data);
      return data;
    },
    placeholderData: getCachedRepos,
  });

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center gap-4">
        {session?.user?.image && (
          <img
            src={session.user.image}
            alt={session.user.name ?? "User"}
            className="h-12 w-12 rounded-full ring-2 ring-primary/20"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {session?.user?.name ?? "there"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your collaborative markdown workspace
          </p>
        </div>
      </div>

      {/* Recent Documents */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Documents</h2>
        </div>
        {recentDocs.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12">
            <div className="text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No recent documents yet
              </p>
              <p className="text-xs text-muted-foreground/70">
                Open a markdown file from one of your repos to get started
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentDocs.map((doc) => (
              <Link
                key={`${doc.owner}/${doc.repo}/${doc.path}`}
                href={`/d/${doc.owner}/${doc.repo}/${doc.branch}/${doc.path}`}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-card/80"
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate group-hover:text-primary">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.owner}/{doc.repo}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {formatRelativeTime(doc.accessedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Repositories */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Repositories</h2>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/apps/mdcolab1-ai/installations/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Connect private repos
            </a>
            <Link
              href="/repos"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-lg border border-border bg-card"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Failed to load repositories
          </div>
        )}

        {repos && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="group relative rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-card/80"
              >
                <a
                  href={`https://github.com/${repo.owner.login}/${repo.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-foreground z-10"
                  title="Open on GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Link
                  href={`/repos/${repo.owner.login}/${repo.name}`}
                  className="block"
                >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-foreground group-hover:text-primary">
                    <span className="text-muted-foreground font-normal">{repo.owner.login}/</span>{repo.name}
                  </h3>
                  {repo.private ? (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {repo.description ?? "No description"}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
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
      </section>
    </div>
  );
}
