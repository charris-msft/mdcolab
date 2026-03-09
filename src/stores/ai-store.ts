import { create } from "zustand";

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AIStore {
  isOpen: boolean;
  messages: AIMessage[];
  isLoading: boolean;
  error: string | null;

  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  addMessage: (message: AIMessage) => void;
  updateMessage: (id: string, content: string) => void;
  setStreaming: (id: string, isStreaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

export const useAIStore = create<AIStore>((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  error: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateMessage: (id, content) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),
  setStreaming: (id, isStreaming) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming } : m
      ),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], error: null }),
}));
