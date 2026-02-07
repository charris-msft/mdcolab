"use client";

import { useCallback } from "react";
import { type Editor } from "@tiptap/react";
import { v4 as uuidv4 } from "uuid";
import { useCommentStore } from "@/stores/comment-store";
import type { CommentThread, CommentAuthor } from "@/types";

export function useCommentCreation(editor: Editor | null) {
  const { addThread, setActiveThread, setSidebarOpen } = useCommentStore();

  const createComment = useCallback(
    (author: CommentAuthor) => {
      if (!editor) return;

      const { from, to } = editor.state.selection;
      if (from === to) return;

      const selectedText = editor.state.doc.textBetween(from, to, " ");
      if (!selectedText.trim()) return;

      const docText = editor.state.doc.textContent;
      const beforeStart = Math.max(0, from - 30);
      const afterEnd = Math.min(docText.length, to + 30);
      const before = editor.state.doc.textBetween(beforeStart, from, " ");
      const after = editor.state.doc.textBetween(to, afterEnd, " ");

      const threadId = uuidv4();

      editor.chain().focus().setCommentMark(threadId).run();

      const thread: CommentThread = {
        id: threadId,
        status: "open",
        anchor: {
          type: "text-range",
          markdownOffset: { start: from, end: to },
          selectedText,
          context: { before, after },
        },
        comments: [],
      };

      addThread(thread);
      setActiveThread(threadId);
      setSidebarOpen(true);
    },
    [editor, addThread, setActiveThread, setSidebarOpen]
  );

  const createDocumentComment = useCallback(
    (author: CommentAuthor, body: string) => {
      const threadId = uuidv4();
      const commentId = uuidv4();

      const thread: CommentThread = {
        id: threadId,
        status: "open",
        anchor: {
          type: "document",
          selectedText: "",
          context: { before: "", after: "" },
        },
        comments: [
          {
            id: commentId,
            author,
            body,
            mentions: [],
            suggestedEdit: null,
            createdAt: new Date().toISOString(),
            updatedAt: null,
          },
        ],
      };

      addThread(thread);
      setActiveThread(threadId);
      setSidebarOpen(true);
    },
    [addThread, setActiveThread, setSidebarOpen]
  );

  return { createComment, createDocumentComment };
}
