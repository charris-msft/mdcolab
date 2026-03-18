"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  FileText,
  Globe,
  Lock,
  Trash2,
  Loader2,
  CalendarClock,
  Users,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SharedDocItem {
  owner: string;
  repo: string;
  path: string;
  mode: "specific_people" | "anyone_with_link";
  users?: string[];
  allowEditing?: boolean;
  sharedBy: string;
  sharedAt: string;
  expiresAt?: string;
  isExpired: boolean;
}

type FilterMode = "all" | "active" | "expired";

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

function formatExpirationDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = date.getTime() - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days < 30) return `Expires in ${days}d`;
  return `Expires ${date.toLocaleDateString()}`;
}

function getFileName(path: string) {
  return path.split("/").pop() ?? path;
}

export function SharedContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data: docs, isLoading, error } = useQuery<SharedDocItem[]>({
    queryKey: ["my-shares"],
    queryFn: async () => {
      const res = await fetch("/api/sharing/my-shares");
      if (!res.ok) throw new Error("Failed to fetch shared documents");
      return res.json();
    },
  });

  const { mutate: revokeShare, isPending: isRevoking } = useMutation({
    mutationFn: async (doc: SharedDocItem) => {
      // First get the current SHA
      const sharingRes = await fetch(`/api/sharing/${doc.owner}/${doc.repo}`);
      if (!sharingRes.ok) throw new Error("Failed to fetch sharing config");
      const { sha } = await sharingRes.json();

      const res = await fetch(`/api/sharing/${doc.owner}/${doc.repo}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: doc.path, sha }),
      });
      if (!res.ok) throw new Error("Failed to revoke sharing");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shares"] });
      toast.success("Sharing revoked");
    },
    onError: () => {
      toast.error("Failed to revoke sharing");
    },
  });

  const handleRevoke = useCallback(
    (doc: SharedDocItem) => {
      revokeShare(doc);
    },
    [revokeShare]
  );

  const filtered = docs?.filter((doc) => {
    if (filter === "active" && doc.isExpired) return false;
    if (filter === "expired" && !doc.isExpired) return false;

    if (search) {
      const q = search.toLowerCase();
      return (
        doc.path.toLowerCase().includes(q) ||
        doc.repo.toLowerCase().includes(q) ||
        doc.owner.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = docs?.filter((d) => !d.isExpired).length ?? 0;
  const expiredCount = docs?.filter((d) => d.isExpired).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shared Documents</h1>
        <p className="text-sm text-muted-foreground">
          Manage all documents you&apos;ve shared across your repositories
        </p>
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by file, repo, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "active", "expired"] as FilterMode[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {f === "all" && `All (${docs?.length ?? 0})`}
              {f === "active" && `Active (${activeCount})`}
              {f === "expired" && `Expired (${expiredCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Scanning repositories for shared documents...
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load shared documents
        </div>
      )}

      {/* Empty state */}
      {filtered && filtered.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-16">
          <div className="text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {search || filter !== "all"
                ? "No matching shared documents found"
                : "You haven't shared any documents yet"}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {search || filter !== "all"
                ? "Try adjusting your search or filter"
                : "Share a document from any markdown file in your repos"}
            </p>
          </div>
        </div>
      )}

      {/* Document list */}
      {filtered && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={`${doc.owner}/${doc.repo}/${doc.path}`}
              className={`group flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                doc.isExpired
                  ? "border-border/50 bg-muted/30 opacity-70"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              {/* Icon */}
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                  doc.isExpired
                    ? "bg-muted text-muted-foreground"
                    : doc.mode === "anyone_with_link"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-amber-500/10 text-amber-500"
                }`}
              >
                {doc.isExpired ? (
                  <AlertTriangle className="size-5" />
                ) : doc.mode === "anyone_with_link" ? (
                  <Globe className="size-5" />
                ) : (
                  <Lock className="size-5" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/d/${doc.owner}/${doc.repo}/main/${doc.path}`}
                  className="font-medium text-foreground hover:text-primary truncate block"
                >
                  {getFileName(doc.path)}
                </Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {doc.owner}/{doc.repo}
                  </span>
                  <span className="truncate max-w-[200px]" title={doc.path}>
                    {doc.path}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Shared {formatRelativeTime(doc.sharedAt)}
                  </span>
                  {doc.mode === "specific_people" && doc.users && doc.users.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {doc.users.length} {doc.users.length === 1 ? "user" : "users"}
                    </span>
                  )}
                  {doc.mode === "anyone_with_link" && (
                    <span className="flex items-center gap-1">
                      <Globe className="size-3" />
                      Public link
                    </span>
                  )}
                  {doc.expiresAt && (
                    <span
                      className={`flex items-center gap-1 ${
                        doc.isExpired ? "text-destructive" : ""
                      }`}
                    >
                      <CalendarClock className="size-3" />
                      {formatExpirationDate(doc.expiresAt)}
                    </span>
                  )}
                  {!doc.expiresAt && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <CalendarClock className="size-3" />
                      No expiration
                    </span>
                  )}
                  {doc.allowEditing && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                      Can edit
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRevoke(doc)}
                disabled={isRevoking}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isRevoking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
