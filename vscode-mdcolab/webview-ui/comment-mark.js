"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentMark = void 0;
const core_1 = require("@tiptap/core");
exports.CommentMark = core_1.Mark.create({
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
                parseHTML: (element) => element.getAttribute("data-thread-id"),
                renderHTML: (attributes) => ({
                    "data-thread-id": attributes.threadId,
                }),
            },
            resolved: {
                default: false,
                parseHTML: (element) => element.getAttribute("data-resolved") === "true",
                renderHTML: (attributes) => ({
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
            (0, core_1.mergeAttributes)(this.options.HTMLAttributes, HTMLAttributes, {
                class: classes,
                "data-comment-mark": HTMLAttributes["data-thread-id"],
            }),
            0,
        ];
    },
    addCommands() {
        return {
            setCommentMark: (threadId) => ({ commands }) => {
                return commands.setMark(this.name, { threadId });
            },
            unsetCommentMark: (threadId) => ({ tr, state, dispatch }) => {
                const { doc } = state;
                const markType = state.schema.marks[this.name];
                if (!markType)
                    return false;
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
//# sourceMappingURL=comment-mark.js.map