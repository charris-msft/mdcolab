"use client";

import { useEffect, useRef, useCallback } from "react";
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

      // Find the best position for this anchor in the document.
      // Priority: 1) exact offset match, 2) context-based match, 3) first occurrence
      const selectedText = thread.anchor.selectedText;
      const { context, markdownOffset } = thread.anchor;
      let textIndex = -1;

      // 1. Try exact offset match
      if (markdownOffset) {
        const textAtOffset = docText.slice(markdownOffset.start, markdownOffset.end);
        if (textAtOffset === selectedText) {
          textIndex = markdownOffset.start;
        }
      }

      // 2. Try context-based match (before + selectedText + after)
      if (textIndex === -1 && context && (context.before || context.after)) {
        const searchPattern = (context.before || "") + selectedText + (context.after || "");
        const patternIndex = docText.indexOf(searchPattern);
        if (patternIndex !== -1) {
          textIndex = patternIndex + (context.before?.length ?? 0);
        } else if (context.before) {
          // Try matching with just the before context
          const beforeWithText = context.before + selectedText;
          const beforeIndex = docText.indexOf(beforeWithText);
          if (beforeIndex !== -1) {
            textIndex = beforeIndex + context.before.length;
          }
        }
      }

      // 3. Fall back to first occurrence (least reliable)
      if (textIndex === -1) {
        textIndex = docText.indexOf(selectedText);
      }

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

  // Scroll to and highlight the anchor for a given threadId
  const scrollToThread = useCallback((threadId: string) => {
    if (!editor) return;
    const editorEl = editor.view.dom;

    // Remove active class from all comment marks
    editorEl.querySelectorAll('.active-comment').forEach(el => {
      el.classList.remove('active-comment');
    });

    // Small delay to let marks be applied first
    setTimeout(() => {
      // Try DOM-based approach first (most reliable)
      const commentSpans = editorEl.querySelectorAll(`[data-comment-mark="${threadId}"]`);
      if (commentSpans.length > 0) {
        commentSpans[0].scrollIntoView({ behavior: "smooth", block: "center" });
        commentSpans.forEach(el => el.classList.add('active-comment'));
        return;
      }

      // Fallback: search ProseMirror marks
      const markType = editor.schema.marks.commentMark;
      if (!markType) return;

      let targetPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (targetPos !== null) return false;
        const mark = node.marks.find(
          (m) => m.type === markType && m.attrs.threadId === threadId
        );
        if (mark) {
          targetPos = pos;
          return false;
        }
        return true;
      });

      if (targetPos !== null) {
        const domPos = editor.view.domAtPos(targetPos);
        if (domPos.node) {
          const element =
            domPos.node instanceof HTMLElement
              ? domPos.node
              : domPos.node.parentElement;
          element?.scrollIntoView({ behavior: "smooth", block: "center" });
          if (element) element.classList.add('active-comment');
        }
      }
    }, 50);
  }, [editor]);

  // Scroll when activeThreadId changes via store
  useEffect(() => {
    if (!editor || !activeThreadId) {
      if (editor) {
        editor.view.dom.querySelectorAll('.active-comment').forEach(el => {
          el.classList.remove('active-comment');
        });
      }
      return;
    }
    scrollToThread(activeThreadId);
  }, [editor, activeThreadId, scrollToThread]);

  // Also listen for the custom event (handles re-clicks on the same comment)
  useEffect(() => {
    const handler = (e: Event) => {
      const threadId = (e as CustomEvent).detail?.threadId;
      if (threadId) scrollToThread(threadId);
    };
    window.addEventListener("comment:scroll-to-anchor", handler);
    return () => window.removeEventListener("comment:scroll-to-anchor", handler);
  }, [scrollToThread]);

  // Click on highlighted text in the document activates the corresponding comment
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const commentSpan = target.closest('[data-comment-mark]') as HTMLElement;
      if (commentSpan) {
        const threadId = commentSpan.getAttribute('data-comment-mark');
        if (threadId) {
          useCommentStore.getState().setActiveThread(threadId);
          useCommentStore.getState().setSidebarOpen(true);
        }
      }
    };

    editor.view.dom.addEventListener('click', handleClick);
    return () => editor.view.dom.removeEventListener('click', handleClick);
  }, [editor]);
}
