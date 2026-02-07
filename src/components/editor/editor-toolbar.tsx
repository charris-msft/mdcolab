"use client";

import { type Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Undo,
  Redo,
  Table as TableIcon,
  Rows3,
  Columns3,
  Trash2,
  BetweenHorizontalStart,
  BetweenHorizontalEnd,
  BetweenVerticalStart,
  BetweenVerticalEnd,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 flex-wrap p-2 border-b border-border sticky top-0 z-10 overflow-x-auto toolbar min-h-[44px] bg-card text-card-foreground">
      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 min-h-[32px] min-w-[32px]"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 min-h-[32px] min-w-[32px]"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
        title="Bold (Ctrl+B)"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
        title="Italic (Ctrl+I)"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
        title="Strikethrough"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("code")}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        aria-label="Code"
        title="Inline code (Ctrl+E)"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Code className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Headings */}
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 1 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        aria-label="Heading 1"
        title="Heading 1"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 2 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        aria-label="Heading 2"
        title="Heading 2"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 3 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        aria-label="Heading 3"
        title="Heading 3"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Heading3 className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bulletList")}
        onPressedChange={() =>
          editor.chain().focus().toggleBulletList().run()
        }
        aria-label="Bullet list"
        title="Bullet list"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("orderedList")}
        onPressedChange={() =>
          editor.chain().focus().toggleOrderedList().run()
        }
        aria-label="Numbered list"
        title="Numbered list"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("taskList")}
        onPressedChange={() =>
          editor.chain().focus().toggleTaskList().run()
        }
        aria-label="Task list"
        title="Task list"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <ListTodo className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Blocks */}
      <Toggle
        size="sm"
        pressed={editor.isActive("blockquote")}
        onPressedChange={() =>
          editor.chain().focus().toggleBlockquote().run()
        }
        aria-label="Blockquote"
        title="Blockquote"
        className="h-8 w-8 min-h-[32px] min-w-[32px] p-0"
      >
        <Quote className="h-4 w-4" />
      </Toggle>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 min-h-[32px] min-w-[32px]"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        aria-label="Horizontal rule"
        title="Horizontal rule"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 min-h-[32px] min-w-[32px]"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        aria-label="Insert table"
        title="Insert table"
      >
        <TableIcon className="h-4 w-4" />
      </Button>

      {/* Table controls — shown when cursor is inside a table */}
      {editor.isActive("table") && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[32px] min-w-[32px]"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            title="Add row above"
          >
            <BetweenHorizontalStart className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[32px] min-w-[32px]"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add row below"
          >
            <BetweenHorizontalEnd className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[32px] min-w-[32px]"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title="Add column left"
          >
            <BetweenVerticalStart className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[32px] min-w-[32px]"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add column right"
          >
            <BetweenVerticalEnd className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="mx-1 h-6" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[32px] min-w-[32px]"
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete row"
          >
            <Rows3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[32px] min-w-[32px]"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete column"
          >
            <Columns3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete table"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            title="Toggle header row"
          >
            Header
          </Button>
        </>
      )}
    </div>
  );
}
