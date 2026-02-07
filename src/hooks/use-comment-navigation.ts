"use client";

import { useCallback } from "react";
import { useCommentStore } from "@/stores/comment-store";

export function useCommentNavigation() {
  const { threads, activeThreadId, setActiveThread, filterStatus } =
    useCommentStore();

  const filteredThreads = threads.filter((t) => {
    if (filterStatus === "all") return true;
    return t.status === filterStatus;
  });

  const goToNext = useCallback(() => {
    if (filteredThreads.length === 0) return;
    const currentIndex = filteredThreads.findIndex(
      (t) => t.id === activeThreadId
    );
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % filteredThreads.length;
    setActiveThread(filteredThreads[nextIndex].id);
  }, [filteredThreads, activeThreadId, setActiveThread]);

  const goToPrevious = useCallback(() => {
    if (filteredThreads.length === 0) return;
    const currentIndex = filteredThreads.findIndex(
      (t) => t.id === activeThreadId
    );
    const prevIndex =
      currentIndex <= 0
        ? filteredThreads.length - 1
        : currentIndex - 1;
    setActiveThread(filteredThreads[prevIndex].id);
  }, [filteredThreads, activeThreadId, setActiveThread]);

  return { goToNext, goToPrevious, totalCount: filteredThreads.length };
}
