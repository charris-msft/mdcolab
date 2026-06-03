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
import { useEffect, useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { useCommentCreation } from "@/hooks/use-comment-creation";
import { useCommentAnchors } from "@/hooks/use-comment-anchors";
import { EditorToolbar } from "./editor-toolbar";
import { BubbleToolbar } from "./bubble-toolbar";
import { SlashCommands } from "./slash-commands";
import { CodeBlockComponent } from "./code-block-component";
import { CommentMark } from "./extensions/comment-mark";
import { MermaidCodeBlock } from "./extensions/mermaid-block";
import { ReviewSelectionToolbar } from "./review-selection-toolbar";
import { FindBar } from "./find-bar";
import {
  BlockIdExtension,
  extractSourceBlocks,
  extractFrontmatter,
  DirtyTracker,
  hybridSerialize,
  type SourceBlock,
} from "./hybrid-serialize";
import { serializeClipboardText } from "./clipboard";
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
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFindBar, setShowFindBar] = useState(false);

  // Hybrid serialize state
  const dirtyTrackerRef = useRef(new DirtyTracker());
  const sourceBlocksRef = useRef<SourceBlock[]>([]);
  const originalMarkdownRef = useRef(initialContent);
  const frontmatterRef = useRef("");

  // Extract source map and frontmatter on initial load
  useEffect(() => {
    const { frontmatter, content } = extractFrontmatter(initialContent);
    frontmatterRef.current = frontmatter;
    originalMarkdownRef.current = content;
    sourceBlocksRef.current = extractSourceBlocks(content, { html: false });
  }, [initialContent]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: false,
        link: false,
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
      MermaidCodeBlock.configure({
        lowlight,
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: false,
        transformPastedText: true,
      }),
      CommentMark.configure({
        HTMLAttributes: {
          class: "comment-highlight",
        },
      }),
      BlockIdExtension,
      SlashCommands,
    ],
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        class:
          "prose-editor outline-none min-h-[500px] px-4 py-8 mx-auto max-w-[720px]",
      },
      clipboardTextSerializer: serializeClipboardText,
    },
    onCreate: ({ editor }) => {
      // Populate store with the editor's serialized markdown on first load
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown?.getMarkdown?.() as string;
      if (markdown) {
        setContent(markdown);
      }

      // Map blockIds to source blocks after the appendTransaction assigns them
      requestAnimationFrame(() => {
        const doc = editor.state.doc;
        const blocks = sourceBlocksRef.current;
        let blockIndex = 0;
        doc.forEach((node) => {
          const id = node.attrs.blockId;
          if (id && blockIndex < blocks.length) {
            blocks[blockIndex].blockId = id;
            blockIndex++;
          }
        });
        // Set initial clean IDs for dirty tracker
        const cleanIds = blocks.filter((b) => b.blockId).map((b) => b.blockId!);
        dirtyTrackerRef.current.setInitialCleanIds(cleanIds);
      });
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
    onTransaction: ({ transaction }) => {
      dirtyTrackerRef.current.onTransaction(transaction);
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

  // Hybrid save: serialize only dirty blocks, keep original for clean blocks
  const performHybridSave = useCallback(() => {
    if (!editor) return;
    const markdown = hybridSerialize({
      editor,
      originalMarkdown: originalMarkdownRef.current,
      sourceBlocks: sourceBlocksRef.current,
      dirtyTracker: dirtyTrackerRef.current,
      frontmatter: frontmatterRef.current,
    });
    onSave?.(markdown);
    // Reset dirty tracker and update baseline for next edit cycle
    dirtyTrackerRef.current.reset(editor.state.doc);
    const { frontmatter: fm, content: ct } = extractFrontmatter(markdown);
    frontmatterRef.current = fm;
    originalMarkdownRef.current = ct;
    sourceBlocksRef.current = extractSourceBlocks(ct, { html: false });
    // Re-map blockIds
    let idx = 0;
    editor.state.doc.forEach((node) => {
      const id = node.attrs.blockId;
      if (id && idx < sourceBlocksRef.current.length) {
        sourceBlocksRef.current[idx].blockId = id;
        idx++;
      }
    });
  }, [editor, onSave]);

  // Keep the latest hybrid-save callback in a ref so the registration effect
  // below does not need to re-run (and re-write the store) on every render.
  const performHybridSaveRef = useRef(performHybridSave);
  useEffect(() => {
    performHybridSaveRef.current = performHybridSave;
  }, [performHybridSave]);

  // Expose hybrid save for external callers (e.g. save button in page toolbar).
  // Register once per editor instance via a stable wrapper. Writing to the store
  // here re-renders store subscribers; depending on `performHybridSave` directly
  // would recreate it and re-trigger this effect, causing an infinite render loop.
  useEffect(() => {
    if (!editor) return;
    const setHybridSave = useEditorStore.getState().setHybridSave;
    setHybridSave(() => performHybridSaveRef.current());
    return () => setHybridSave(null);
  }, [editor]);

  // Keyboard shortcut: Cmd+S to save, Ctrl+Alt+M to comment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editor && isDirty) {
          performHybridSave();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "m") {
        e.preventDefault();
        handleCreateComment();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowFindBar(true);
      }
      if (e.key === "Escape" && showFindBar) {
        setShowFindBar(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, isDirty, onSave, handleCreateComment, showFindBar]);

  // Ctrl+Scroll to zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomLevel((prev) => {
        const next = prev + (e.deltaY < 0 ? 10 : -10);
        return Math.min(200, Math.max(50, next));
      });
    };
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

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
      {showFindBar && <FindBar onClose={() => setShowFindBar(false)} />}
      {editable && <BubbleToolbar editor={editor} editable={editable} onCreateComment={handleCreateComment} />}
      {!editable && <ReviewSelectionToolbar editor={editor} onCreateComment={handleCreateComment} />}
      <CodeBlockComponent editor={editor} />
      <div className="flex-1 overflow-y-auto" style={{ zoom: zoomLevel / 100 }}>
        <EditorContent editor={editor} />
      </div>
      {zoomLevel !== 100 && (
        <div className="flex items-center justify-end px-3 py-1 border-t border-border bg-card text-xs text-muted-foreground">
          <button
            className="hover:text-foreground transition-colors"
            onClick={() => setZoomLevel(100)}
            title="Reset zoom"
          >
            {zoomLevel}% — click to reset
          </button>
        </div>
      )}
    </div>
  );
}
