"use client";

import { useEffect, useRef } from "react";
import { type Editor } from "@tiptap/react";
import { useCommentStore } from "@/stores/comment-store";
import type { CommentThread } from "@/types";

/**
 * Applies comment marks from loaded threads to the Tiptap editor,
 * and handles scrolling to anchored text when a comment is clicked.
 */
export function useCommentAnchors(editor: Editor | null) {
  const { threads, activeThreadId } = useCommentStore();
  const appliedThreadsRef = useRef<Set<string>>(new Set());

  // Apply comment marks to the editor when threads are loaded
  useEffect(() => {
    if (!editor || threads.length === 0) return;

    const doc = editor.state.doc;
    const docText = doc.textContent;

    threads.forEach((thread) => {
      if (appliedThreadsRef.current.has(thread.id)) return;
      if (thread.anchor.type !== "text-range") return;
      if (!thread.anchor.selectedText) return;

      // Find the selected text in the document
      const selectedText = thread.anchor.selectedText;
      const textIndex = docText.indexOf(selectedText);
      if (textIndex === -1) return;

      // Convert text offset to ProseMirror position
      // Walk the document to find the correct position
      let charCount = 0;
      let fromPos: number | null = null;
      let toPos: number | null = null;

      doc.descendants((node, pos) => {
        if (fromPos !== null && toPos !== null) return false;
        if (node.isText && node.text) {
          const nodeStart = charCount;
          const nodeEnd = charCount + node.text.length;

          if (fromPos === null && textIndex >= nodeStart && textIndex < nodeEnd) {
            fromPos = pos + (textIndex - nodeStart);
          }
          if (fromPos !== null && toPos === null) {
            const targetEnd = textIndex + selectedText.length;
            if (targetEnd <= nodeEnd) {
              toPos = pos + (targetEnd - nodeStart);
            }
          }
          charCount += node.text.length;
        } else if (node.isBlock && charCount > 0) {
          // Block nodes add implicit separators in textContent
          charCount += 0; // textContent doesn't add separators between blocks in ProseMirror
        }
        return true;
      });

      if (fromPos !== null && toPos !== null) {
        try {
          editor
            .chain()
            .command(({ tr }) => {
              const markType = editor.schema.marks.commentMark;
              if (!markType) return false;
              const mark = markType.create({
                threadId: thread.id,
                resolved: thread.status === "resolved",
              });
              tr.addMark(fromPos!, toPos!, mark);
              return true;
            })
            .run();
          appliedThreadsRef.current.add(thread.id);
        } catch {
          // Mark application failed — text may have shifted
        }
      }
    });
  }, [editor, threads]);

  // Scroll to the anchored text when a comment is clicked (activeThreadId changes)
  useEffect(() => {
    if (!editor || !activeThreadId) return;

    // Find the comment mark in the document
    const markType = editor.schema.marks.commentMark;
    if (!markType) return;

    let targetPos: number | null = null;

    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== null) return false;
      const mark = node.marks.find(
        (m) => m.type === markType && m.attrs.threadId === activeThreadId
      );
      if (mark) {
        targetPos = pos;
        return false;
      }
      return true;
    });

    if (targetPos !== null) {
      // Scroll the editor to the mark position
      const domPos = editor.view.domAtPos(targetPos);
      if (domPos.node) {
        const element =
          domPos.node instanceof HTMLElement
            ? domPos.node
            : domPos.node.parentElement;
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [editor, activeThreadId]);
}
