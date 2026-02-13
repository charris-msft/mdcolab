"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Lock, Globe, Loader2, X, UserPlus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import type { SharingConfig } from "@/lib/sharing-types";

type SharingMode = "specific_people" | "anyone_with_link";

interface SharingResponse {
  sharing: SharingConfig | null;
  sha?: string;
}

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  canEdit: boolean;
  isEmu?: boolean;
}

export function ShareDialog({
  open,
  onOpenChange,
  owner,
  repo,
  // branch is part of the props interface for future use (e.g. branch-specific sharing)
  branch: _branch,
  filePath,
  canEdit,
  isEmu,
}: ShareDialogProps) {
  void _branch;
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: sharingData, isLoading } = useQuery<SharingResponse>({
    queryKey: ["sharing", owner, repo],
    queryFn: async () => {
      const res = await fetch(`/api/sharing/${owner}/${repo}`);
      if (!res.ok) throw new Error("Failed to fetch sharing config");
      return res.json();
    },
    enabled: open,
  });

  const doc = sharingData?.sharing?.documents?.[filePath];
  const mode: SharingMode = doc?.mode ?? "specific_people";
  const allowEditing: boolean = doc?.allowEditing === true;
  const users: string[] = useMemo(
    () => doc?.users ?? [],
    [doc?.users]
  );
  const sha: string = sharingData?.sha ?? "";

  const { mutate: updateSharing, isPending: isSaving } = useMutation({
    mutationFn: async (body: {
      path: string;
      mode: SharingMode;
      users: string[];
      sha: string;
      allowEditing?: boolean;
    }) => {
      const res = await fetch(`/api/sharing/${owner}/${repo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update sharing");
      return res.json();
    },
    onSuccess: (data: { sha?: string }) => {
      if (data?.sha) {
        // Update cache with new SHA to prevent 409 on rapid successive mutations
        queryClient.setQueryData(["sharing", owner, repo], (old: SharingResponse | undefined) => {
          if (!old) return old;
          return { ...old, sha: data.sha };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["sharing", owner, repo] });
    },
    onError: () => {
      toast.error("Failed to update sharing settings");
    },
  });

  const setMode = useCallback(
    (newMode: SharingMode) => {
      updateSharing({ path: filePath, mode: newMode, users, sha, allowEditing });
    },
    [updateSharing, filePath, users, sha, allowEditing]
  );

  const addUser = useCallback(() => {
    const username = usernameInput.trim().replace(/^@/, "");
    if (!username) return;
    if (users.includes(username)) {
      toast.error(`@${username} already has access`);
      return;
    }
    updateSharing({
      path: filePath,
      mode,
      users: [...users, username],
      sha,
      allowEditing,
    });
    setUsernameInput("");
  }, [usernameInput, users, updateSharing, filePath, mode, sha, allowEditing]);

  const removeUser = useCallback(
    (username: string) => {
      updateSharing({
        path: filePath,
        mode,
        users: users.filter((u) => u !== username),
        sha,
        allowEditing,
      });
    },
    [users, updateSharing, filePath, mode, sha, allowEditing]
  );

  const { mutate: stopSharing, isPending: isUnsharing } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sharing/${owner}/${repo}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, sha }),
      });
      if (!res.ok) throw new Error("Failed to stop sharing");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sharing", owner, repo] });
      toast.success("Document is no longer shared");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to stop sharing");
    },
  });

  const isShared = !!doc;
  const isAnyPending = isSaving || isUnsharing;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addUser();
      }
    },
    [addUser]
  );

  const toggleEditing = useCallback(() => {
    updateSharing({ path: filePath, mode, users, sha, allowEditing: !allowEditing });
  }, [updateSharing, filePath, mode, users, sha, allowEditing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {filePath}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sharing mode toggle */}
            <div className="space-y-2">
              <ModeOption
                icon={<Lock className="size-4" />}
                label="Specific people"
                description="Only listed GitHub users can access"
                selected={mode === "specific_people"}
                disabled={!canEdit || isAnyPending}
                onClick={() => setMode("specific_people")}
              />
              <ModeOption
                icon={<Globe className="size-4" />}
                label="Anyone with the link"
                description={
                  isEmu
                    ? "Not available for EMU organizations — anonymous public access is restricted"
                    : "Anyone can view and comment, no sign-in required"
                }
                selected={mode === "anyone_with_link"}
                disabled={!canEdit || isAnyPending || !!isEmu}
                onClick={() => setMode("anyone_with_link")}
              />
            </div>

            {/* Allow editing toggle */}
            {isShared && canEdit && (
              <button
                type="button"
                onClick={toggleEditing}
                disabled={isAnyPending}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  allowEditing
                    ? "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
                    : "border-border hover:bg-accent"
                } ${isAnyPending ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    allowEditing
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Pencil className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Allow editing</div>
                  <div className="text-xs text-muted-foreground">
                    {allowEditing
                      ? "Shared users can edit this document"
                      : "Shared users can only view and comment"}
                  </div>
                </div>
                <div
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    allowEditing ? "bg-amber-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block size-4 rounded-full bg-white transition-transform ${
                      allowEditing ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
            )}

            {/* User list section */}
            {mode === "specific_people" && (
              <div className="space-y-3">
                {canEdit && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="GitHub username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isAnyPending}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={addUser}
                      disabled={!usernameInput.trim() || isAnyPending}
                    >
                      {isSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                      Add
                    </Button>
                  </div>
                )}

                {users.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-3">
                    {isShared
                      ? "No users have access. Consider unsharing or adding users."
                      : "No users added yet"}
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {users.map((username) => (
                      <li
                        key={username}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                      >
                        <Avatar className="size-6">
                          <AvatarImage
                            src={`https://github.com/${username}.png?size=32`}
                            alt={username}
                          />
                          <AvatarFallback>
                            {username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm">
                          @{username}
                        </span>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeUser(username)}
                            disabled={isAnyPending}
                            aria-label={`Remove ${username}`}
                          >
                            <X className="size-3" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Copy link */}
            <Button
              variant="outline"
              className="w-full"
              onClick={copyLink}
            >
              <Link2 className="size-4" />
              {linkCopied ? "Copied!" : "Copy link"}
            </Button>

            {/* Stop sharing */}
            {isShared && canEdit && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => stopSharing()}
                disabled={isAnyPending}
              >
                {isUnsharing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Stop sharing
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  icon,
  label,
  description,
  selected,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5 dark:bg-primary/10"
          : "border-border hover:bg-accent"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div
        className={`size-4 shrink-0 rounded-full border-2 ${
          selected ? "border-primary bg-primary" : "border-muted-foreground"
        }`}
      >
        {selected && (
          <div className="m-0.5 size-2 rounded-full bg-primary-foreground" />
        )}
      </div>
    </button>
  );
}
