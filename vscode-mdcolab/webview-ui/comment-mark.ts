import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      setCommentMark: (threadId: string) => ReturnType;
      unsetCommentMark: (threadId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "commentMark",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-thread-id"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-thread-id": attributes.threadId,
        }),
      },
      resolved: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-resolved") === "true",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-resolved": attributes.resolved ? "true" : undefined,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-thread-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const classes = HTMLAttributes["data-resolved"] === "true"
      ? "comment-highlight comment-highlight-resolved"
      : "comment-highlight";
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: classes,
        "data-comment-mark": HTMLAttributes["data-thread-id"],
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentMark:
        (threadId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { threadId });
        },
      unsetCommentMark:
        (threadId: string) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          const markType = state.schema.marks[this.name];
          if (!markType) return false;
          if (dispatch) {
            doc.descendants((node, pos) => {
              node.marks.forEach((mark) => {
                if (mark.type === markType && mark.attrs.threadId === threadId) {
                  tr.removeMark(pos, pos + node.nodeSize, mark);
                }
              });
            });
          }
          return true;
        },
    };
  },
});
