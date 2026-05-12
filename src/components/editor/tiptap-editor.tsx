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
import { useEffect } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { CommentMark } from "./extensions/comment-mark";
import { serializeClipboardText } from "./clipboard";

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  editable?: boolean;
  onUpdate?: (markdown: string) => void;
  className?: string;
}

export function TiptapEditor({
  content,
  editable = false,
  onUpdate,
  className,
}: TiptapEditorProps) {
  const { setDirty } = useEditorStore();

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
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer",
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
        transformCopiedText: false,
        transformPastedText: true,
      }),
      CommentMark.configure({
        HTMLAttributes: {
          class: "comment-highlight",
        },
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "prose-editor outline-none min-h-[500px] px-4 py-8 mx-auto max-w-[720px]",
      },
      clipboardTextSerializer: serializeClipboardText,
    },
    onUpdate: ({ editor }) => {
      setDirty(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown() as string;
      onUpdate?.(markdown);
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Update content if it changes externally
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (editor && content !== ((editor.storage as any).markdown.getMarkdown() as string)) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="animate-pulse px-4 py-8 mx-auto max-w-[720px]">
        <div className="h-8 bg-muted rounded w-3/4 mb-4" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-5/6 mb-2" />
        <div className="h-4 bg-muted rounded w-4/6 mb-6" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
    );
  }

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}

export { useEditor as useTiptapEditor } from "@tiptap/react";
