"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Folder, FileText, ChevronRight, Home, GitBranch } from "lucide-react";
import Link from "next/link";
import type { GitHubFile, GitHubRepo } from "@/types";

interface FileBrowserContentProps {
  owner: string;
  repo: string;
}

export function FileBrowserContent({ owner, repo }: FileBrowserContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPath = searchParams.get("path") ?? "";
  const currentRef = searchParams.get("ref") ?? "";

  // Fetch repo info for default branch
  const { data: repoInfo } = useQuery<GitHubRepo>({
    queryKey: ["repo-info", owner, repo],
    queryFn: async () => {
      const res = await fetch(`/api/repos?per_page=100`);
      if (!res.ok) throw new Error("Failed to fetch repos");
      const repos: GitHubRepo[] = await res.json();
      const found = repos.find(
        (r) => r.owner.login === owner && r.name === repo
      );
      if (!found) throw new Error("Repo not found");
      return found;
    },
  });

  const branch = currentRef || repoInfo?.default_branch || "main";

  const { data: files, isLoading, error } = useQuery<GitHubFile[]>({
    queryKey: ["tree", owner, repo, branch, currentPath],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branch) params.set("ref", branch);
      if (currentPath) params.set("path", currentPath);
      const res = await fetch(
        `/api/repos/${owner}/${repo}/tree?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch tree");
      return res.json();
    },
    enabled: !!branch,
  });

  const breadcrumbParts = currentPath ? currentPath.split("/") : [];

  function navigateToPath(path: string) {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    if (currentRef) params.set("ref", currentRef);
    router.push(`/repos/${owner}/${repo}?${params.toString()}`);
  }

  function handleFileClick(file: GitHubFile) {
    if (file.type === "dir") {
      navigateToPath(file.path);
    } else if (file.name.endsWith(".md") || file.name.endsWith(".mdx")) {
      router.push(`/d/${owner}/${repo}/${branch}/${file.path}`);
    }
  }

  function handleBranchChange(newBranch: string) {
    const params = new URLSearchParams();
    if (currentPath) params.set("path", currentPath);
    params.set("ref", newBranch);
    router.push(`/repos/${owner}/${repo}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <Link
            href={`/repos/${owner}/${repo}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {owner}
          </Link>
          <span className="mx-1 text-muted-foreground">/</span>
          <Link
            href={`/repos/${owner}/${repo}`}
            className="hover:text-primary"
          >
            {repo}
          </Link>
        </h1>

        {/* Branch selector */}
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <select
            value={branch}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={repoInfo?.default_branch ?? "main"}>
              {repoInfo?.default_branch ?? "main"}
            </option>
          </select>
        </div>
      </div>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        <button
          onClick={() => navigateToPath("")}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home className="h-3.5 w-3.5" />
          root
        </button>
        {breadcrumbParts.map((part, idx) => {
          const path = breadcrumbParts.slice(0, idx + 1).join("/");
          const isLast = idx === breadcrumbParts.length - 1;
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              {isLast ? (
                <span className="font-medium text-foreground">{part}</span>
              ) : (
                <button
                  onClick={() => navigateToPath(path)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {part}
                </button>
              )}
            </span>
          );
        })}
      </nav>

      {/* File list */}
      {isLoading && (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded border border-border bg-card"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load files
        </div>
      )}

      {files && (
        <div className="overflow-hidden rounded-lg border border-border">
          {files.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              This directory is empty
            </p>
          )}
          {files.map((file, idx) => {
            const isMarkdown =
              file.name.endsWith(".md") || file.name.endsWith(".mdx");
            return (
              <button
                key={file.sha}
                onClick={() => handleFileClick(file)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                  idx > 0 ? "border-t border-border" : ""
                } ${
                  file.type === "file" && !isMarkdown
                    ? "cursor-default opacity-60"
                    : ""
                }`}
                disabled={file.type === "file" && !isMarkdown}
              >
                {file.type === "dir" ? (
                  <Folder className="h-4 w-4 shrink-0 text-primary/70" />
                ) : (
                  <FileText
                    className={`h-4 w-4 shrink-0 ${
                      isMarkdown
                        ? "text-green-500"
                        : "text-muted-foreground/50"
                    }`}
                  />
                )}
                <span
                  className={
                    file.type === "dir" || isMarkdown
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {file.name}
                </span>
                {isMarkdown && (
                  <span className="ml-auto text-xs text-primary/60">
                    Open in editor →
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
