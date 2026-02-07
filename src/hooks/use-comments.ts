"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommentStore } from "@/stores/comment-store";
import type { CommentsFile, CommentThread } from "@/types";
import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

interface UseCommentsOptions {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export function useComments({ owner, repo, branch, path }: UseCommentsOptions) {
  const {
    threads,
    setThreads,
    commentsSha,
    setCommentsSha,
  } = useCommentStore();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Load comments
  const { data, isLoading, error } = useQuery({
    queryKey: ["comments", owner, repo, branch, path],
    queryFn: async () => {
      const res = await fetch(
        `/api/comments/${owner}/${repo}/${branch}/${path}`
      );
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json() as Promise<{ comments: CommentsFile; sha: string | null }>;
    },
  });

  // Sync loaded data to store
  useEffect(() => {
    if (data) {
      setThreads(data.comments.threads);
      setCommentsSha(data.sha);
    }
  }, [data, setThreads, setCommentsSha]);

  // Save comments mutation
  const saveMutation = useMutation({
    mutationFn: async (commentsFile: CommentsFile) => {
      const res = await fetch(
        `/api/comments/${owner}/${repo}/${branch}/${path}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comments: commentsFile,
            sha: commentsSha,
          }),
        }
      );
      if (res.status === 409) {
        throw new Error("CONFLICT");
      }
      if (!res.ok) throw new Error("Failed to save comments");
      return res.json() as Promise<{ sha: string }>;
    },
    onSuccess: (data) => {
      setCommentsSha(data.sha);
    },
    onError: (error) => {
      if (error.message === "CONFLICT") {
        toast.error("Comment conflict detected. Refreshing...");
        queryClient.invalidateQueries({
          queryKey: ["comments", owner, repo, branch, path],
        });
      } else {
        toast.error("Failed to save comments");
      }
    },
  });

  // Debounced save
  const saveComments = useCallback(
    (updatedThreads: CommentThread[]) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const commentsFile: CommentsFile = {
          version: "1.0",
          documentHash: "",
          threads: updatedThreads,
        };
        saveMutation.mutate(commentsFile);
      }, 2000);
    },
    [saveMutation]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return {
    isLoading,
    error,
    saveComments,
    isSaving: saveMutation.isPending,
  };
}
