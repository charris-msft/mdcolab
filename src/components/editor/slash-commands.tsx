"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type ComponentType,
} from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Table as TableIcon,
  Minus,
  type LucideIcon,
} from "lucide-react";

// --- Command items ---

interface SlashCommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  command: (editor: Editor, range: Range) => void;
}

const slashCommandItems: SlashCommandItem[] = [
  {
    title: "Heading 1",
    description: "Large heading",
    icon: Heading1,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium heading",
    icon: Heading2,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small heading",
    icon: Heading3,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: List,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    description: "Ordered list",
    icon: ListOrdered,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Task List",
    description: "Todo checklist",
    icon: ListTodo,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Blockquote",
    description: "Quote block",
    icon: Quote,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code Block",
    description: "Code snippet",
    icon: Code,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Table",
    description: "3×3 table",
    icon: TableIcon,
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: Minus,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

// --- React component for the command list popup ---

export interface SlashCommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const activeIndex = items[selectedIndex] ? selectedIndex : 0;

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(activeIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="glass rounded-lg shadow-xl border border-border/50 p-3 text-sm text-muted-foreground">
          No results
        </div>
      );
    }

    return (
      <div className="glass rounded-lg shadow-xl border border-border/50 p-1 w-64 max-h-80 overflow-y-auto">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => selectItem(index)}
              className={`flex items-center gap-3 w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                index === activeIndex
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/50">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  },
);

SlashCommandList.displayName = "SlashCommandList";

// --- Suggestion configuration ---

const suggestionConfig: Omit<SuggestionOptions<SlashCommandItem>, "editor"> = {
  char: "/",
  items: ({ query }) =>
    slashCommandItems.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()),
    ),
  command: ({ editor, range, props }) => {
    props.command(editor, range);
  },
  render: () => {
    let component: ReactRenderer<SlashCommandListRef> | null = null;
    let popup: TippyInstance | null = null;

    return {
      onStart: (props: SuggestionProps<SlashCommandItem>) => {
        component = new ReactRenderer(
          SlashCommandList as ComponentType<SlashCommandListProps>,
          {
            props: { items: props.items, command: props.command },
            editor: props.editor,
          },
        );

        if (!props.clientRect) return;

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          animation: "shift-toward-subtle",
          duration: 150,
        }) as unknown as TippyInstance;
      },

      onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
        component?.updateProps({ items: props.items, command: props.command });

        if (popup && props.clientRect) {
          popup.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === "Escape") {
          popup?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.destroy();
        component?.destroy();
        popup = null;
        component = null;
      },
    };
  },
};

// --- Tiptap Extension ---

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: suggestionConfig,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
