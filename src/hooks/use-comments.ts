"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommentStore } from "@/stores/comment-store";
import type { CommentThread, CommentAnchor, Comment } from "@/types";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";

interface UseCommentsOptions {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export function useComments({ owner, repo, branch, path }: UseCommentsOptions) {
  const { setThreads, addThread, updateThread, addReply } = useCommentStore();
  const queryClient = useQueryClient();
  const apiBase = `/api/comments/${owner}/${repo}/${branch}/${path}`;

  // Load comments from GitHub Issues
  const { isLoading, error } = useQuery({
    queryKey: ["comments", owner, repo, branch, path],
    queryFn: async () => {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json() as Promise<{ threads: CommentThread[] }>;
    },
    select: (data) => data.threads,
  });

  // Sync loaded data to store
  const queryData = queryClient.getQueryData<{ threads: CommentThread[] }>(["comments", owner, repo, branch, path]);
  useEffect(() => {
    if (queryData) {
      setThreads(queryData.threads);
    }
  }, [queryData, setThreads]);

  // Create thread mutation
  const createThreadMutation = useMutation({
    mutationFn: async (params: { anchor: CommentAnchor; body: string }) => {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", anchor: params.anchor, body: params.body }),
      });
      if (!res.ok) throw new Error("Failed to create thread");
      return res.json() as Promise<{ thread: CommentThread }>;
    },
    onSuccess: (data) => {
      addThread(data.thread);
    },
    onError: () => {
      toast.error("Failed to create comment");
    },
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (params: { issueNumber: number; body: string }) => {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", issueNumber: params.issueNumber, body: params.body }),
      });
      if (!res.ok) throw new Error("Failed to reply");
      return res.json() as Promise<{ comment: Comment }>;
    },
    onError: () => {
      toast.error("Failed to add reply");
    },
  });

  // Resolve / reopen mutation
  const resolveOrReopenMutation = useMutation({
    mutationFn: async (params: { issueNumber: number; action: "resolve" | "reopen" }) => {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: params.action, issueNumber: params.issueNumber }),
      });
      if (!res.ok) throw new Error("Failed to update thread");
      return res.json();
    },
    onError: () => {
      toast.error("Failed to update comment status");
    },
  });

  const createThread = useCallback(
    (anchor: CommentAnchor, body: string) => {
      createThreadMutation.mutate({ anchor, body });
    },
    [createThreadMutation]
  );

  const replyToThread = useCallback(
    (threadId: string, body: string) => {
      const issueNumber = Number(threadId);
      // Optimistically add the reply to the store
      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        author: { login: "you", avatarUrl: "" },
        body,
        mentions: [],
        suggestedEdit: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      addReply(threadId, optimisticComment);

      replyMutation.mutate(
        { issueNumber, body },
        {
          onSuccess: (data) => {
            // Replace optimistic comment with real one
            const store = useCommentStore.getState();
            const thread = store.threads.find((t) => t.id === threadId);
            if (thread) {
              const updatedComments = thread.comments.map((c) =>
                c.id === optimisticComment.id ? data.comment : c
              );
              updateThread(threadId, { comments: updatedComments });
            }
          },
        }
      );
    },
    [replyMutation, addReply, updateThread]
  );

  const resolveThread = useCallback(
    (threadId: string) => {
      updateThread(threadId, { status: "resolved" });
      resolveOrReopenMutation.mutate({ issueNumber: Number(threadId), action: "resolve" });
    },
    [resolveOrReopenMutation, updateThread]
  );

  const reopenThread = useCallback(
    (threadId: string) => {
      updateThread(threadId, { status: "open" });
      resolveOrReopenMutation.mutate({ issueNumber: Number(threadId), action: "reopen" });
    },
    [resolveOrReopenMutation, updateThread]
  );

  const refreshComments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["comments", owner, repo, branch, path] });
  }, [queryClient, owner, repo, branch, path]);

  return {
    isLoading,
    error,
    createThread,
    replyToThread,
    resolveThread,
    reopenThread,
    refreshComments,
    isSaving: createThreadMutation.isPending || replyMutation.isPending || resolveOrReopenMutation.isPending,
  };
}
