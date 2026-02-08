"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";
import { useEffect, useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { useCommentCreation } from "@/hooks/use-comment-creation";
import { useCommentAnchors } from "@/hooks/use-comment-anchors";
import { EditorToolbar } from "./editor-toolbar";
import { BubbleToolbar } from "./bubble-toolbar";
import { SlashCommands } from "./slash-commands";
import { CodeBlockComponent } from "./code-block-component";
import { CommentMark } from "./extensions/comment-mark";
import { ReviewSelectionToolbar } from "./review-selection-toolbar";
import "@/components/editor/editor-styles.css";

const lowlight = createLowlight(common);

interface DocumentEditorProps {
  initialContent: string;
  editable?: boolean;
  onSave?: (markdown: string) => void;
  className?: string;
  author?: { login: string; avatarUrl: string };
}

export function DocumentEditor({
  initialContent,
  editable = false,
  onSave,
  className,
  author,
}: DocumentEditorProps) {
  const { isDirty, setDirty, setContent, setEditable, setEditor, setSelectedText } = useEditorStore();
  const editorInteracted = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: !editable,
        HTMLAttributes: {
          class:
            "text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      HorizontalRule,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      CommentMark.configure({
        HTMLAttributes: {
          class: "comment-highlight",
        },
      }),
      SlashCommands,
    ],
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        class:
          "prose-editor outline-none min-h-[500px] px-4 py-8 mx-auto max-w-[720px]",
      },
    },
    onUpdate: ({ editor }) => {
      // Skip marking dirty if editor hasn't been interacted with yet
      if (!editor.isFocused && !editorInteracted.current) { return; }
      editorInteracted.current = true;
      setDirty(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown() as string;
      setContent(markdown);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = from !== to ? editor.state.doc.textBetween(from, to, '\n') : '';
      setSelectedText(text);
    },
  });

  // Comment creation hook
  const { createComment } = useCommentCreation(editor);
  const commentAuthor = author ?? { login: "anonymous", avatarUrl: "" };
  const handleCreateComment = useCallback(() => {
    createComment(commentAuthor);
  }, [createComment, commentAuthor]);

  // Apply comment marks and handle click-to-scroll
  useCommentAnchors(editor);

  // Expose editor instance to store for cross-component access
  useEffect(() => {
    if (editor) {
      setEditor(editor);
    }
    return () => setEditor(null);
  }, [editor, setEditor]);

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
      setEditable(editable);
    }
  }, [editor, editable, setEditable]);

  // Keyboard shortcut: Cmd+S to save, Ctrl+Alt+M to comment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editor && isDirty) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const markdown = (editor.storage as any).markdown.getMarkdown() as string;
          onSave?.(markdown);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "m") {
        e.preventDefault();
        handleCreateComment();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, isDirty, onSave, handleCreateComment]);

  if (!editor) {
    return (
      <div className="animate-pulse px-4 py-8 mx-auto max-w-[720px]">
        <div className="h-8 bg-muted rounded w-3/4 mb-4" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-5/6 mb-2" />
        <div className="h-4 bg-muted rounded w-4/6 mb-6" />
      </div>
    );
  }

  return (
    <div className={className}>
      {editable && <EditorToolbar editor={editor} />}
      {editable && <BubbleToolbar editor={editor} editable={editable} onCreateComment={handleCreateComment} />}
      {!editable && <ReviewSelectionToolbar editor={editor} onCreateComment={handleCreateComment} />}
      <CodeBlockComponent editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
