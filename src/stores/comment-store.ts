import { create } from "zustand";
import type { CommentThread, Comment } from "@/types";

type FilterStatus = "open" | "resolved" | "all";

interface CommentState {
  threads: CommentThread[];
  activeThreadId: string | null;
  filterStatus: FilterStatus;
  commentsSha: string | null;
  isSidebarOpen: boolean;
  searchQuery: string;
  authorFilter: string[];
  orphanedThreadIds: string[];
  setThreads: (threads: CommentThread[]) => void;
  addThread: (thread: CommentThread) => void;
  updateThread: (id: string, updates: Partial<CommentThread>) => void;
  addReply: (threadId: string, comment: Comment) => void;
  removeThread: (id: string) => void;
  setActiveThread: (id: string | null) => void;
  setFilterStatus: (status: FilterStatus) => void;
  setCommentsSha: (sha: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setAuthorFilter: (authors: string[]) => void;
  setOrphanedThreadIds: (ids: string[]) => void;
}

export const useCommentStore = create<CommentState>((set) => ({
  threads: [],
  activeThreadId: null,
  filterStatus: "open",
  commentsSha: null,
  isSidebarOpen: true,
  searchQuery: "",
  authorFilter: [],
  orphanedThreadIds: [],
  setThreads: (threads) => set({ threads }),
  addThread: (thread) =>
    set((state) => ({ threads: [...state.threads, thread] })),
  updateThread: (id, updates) =>
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  addReply: (threadId, comment) =>
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId
          ? { ...t, comments: [...t.comments, comment] }
          : t
      ),
    })),
  removeThread: (id) =>
    set((state) => ({
      threads: state.threads.filter((t) => t.id !== id),
    })),
  setActiveThread: (id) => set({ activeThreadId: id }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setCommentsSha: (sha) => set({ commentsSha: sha }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setAuthorFilter: (authors) => set({ authorFilter: authors }),
  setOrphanedThreadIds: (ids) => set({ orphanedThreadIds: ids }),
}));
