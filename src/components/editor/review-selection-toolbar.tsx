"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { type Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";

interface ReviewSelectionToolbarProps {
  editor: Editor;
  onCreateComment: () => void;
}

export function ReviewSelectionToolbar({
  editor,
  onCreateComment,
}: ReviewSelectionToolbarProps) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setPosition(null);
      return;
    }

    // Check the selection is within the editor
    const editorEl = editor.view.dom;
    if (!editorEl.contains(selection.anchorNode)) {
      setPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0) {
      setPosition(null);
      return;
    }

    setPosition({
      top: rect.top + window.scrollY - 45,
      left: rect.left + window.scrollX + rect.width / 2,
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener("selectionchange", updatePosition);
    return () => {
      document.removeEventListener("selectionchange", updatePosition);
    };
  }, [updatePosition]);

  const handleComment = useCallback(() => {
    onCreateComment();
    setPosition(null);
  }, [onCreateComment]);

  if (!position) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 glass rounded-lg shadow-xl border border-border/50 p-1"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
        onClick={handleComment}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Comment
      </Button>
    </div>
  );
}
