"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import { type Editor } from "@tiptap/react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Highlighter,
  MessageSquarePlus,
} from "lucide-react";

interface BubbleToolbarProps {
  editor: Editor;
  editable?: boolean;
  onCreateComment?: () => void;
}

export function BubbleToolbar({ editor, editable = false, onCreateComment }: BubbleToolbarProps) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 8,
      }}
      className="glass rounded-lg shadow-xl border border-border/50 flex items-center gap-0.5 p-1"
    >
      {editable && (
        <>
          <Toggle
            size="sm"
            pressed={editor.isActive("bold")}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            className="h-8 w-8 p-0 data-[state=on]:bg-primary/20"
          >
            <Bold className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("italic")}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            className="h-8 w-8 p-0 data-[state=on]:bg-primary/20"
          >
            <Italic className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("strike")}
            onPressedChange={() => editor.chain().focus().toggleStrike().run()}
            className="h-8 w-8 p-0 data-[state=on]:bg-primary/20"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("code")}
            onPressedChange={() => editor.chain().focus().toggleCode().run()}
            className="h-8 w-8 p-0 data-[state=on]:bg-primary/20"
          >
            <Code className="h-3.5 w-3.5" />
          </Toggle>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Toggle
            size="sm"
            pressed={editor.isActive("highlight")}
            onPressedChange={() => editor.chain().focus().toggleHighlight().run()}
            className="h-8 w-8 p-0 data-[state=on]:bg-yellow-500/20"
          >
            <Highlighter className="h-3.5 w-3.5" />
          </Toggle>

          <Separator orientation="vertical" className="mx-0.5 h-5" />
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
        onClick={() => onCreateComment?.()}
        title="Add comment (Ctrl+Alt+M)"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Comment
      </Button>
    </BubbleMenu>
  );
}
