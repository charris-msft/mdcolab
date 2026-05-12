import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

let nextBlockId = 1;

export function generateBlockId(): string {
  return `blk-${nextBlockId++}`;
}

/**
 * TipTap extension that assigns a stable `blockId` to every top-level block node.
 * Used by the hybrid serializer to track which blocks have been modified.
 *
 * - On load, assigns IDs to all top-level blocks
 * - On transactions that create new blocks, assigns IDs to any missing ones
 * - The blockId is stored as a node attr but is NOT serialized to markdown
 */
export const BlockIdExtension = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "codeBlock",
          "blockquote",
          "bulletList",
          "orderedList",
          "taskList",
          "table",
          "horizontalRule",
          "image",
        ],
        attributes: {
          blockId: {
            default: null,
            // Never render to HTML (prevents markdown serialization)
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockId"),
        appendTransaction(_transactions, _oldState, newState) {
          const { doc, tr } = newState;
          let modified = false;

          doc.forEach((node, pos) => {
            if (node.type.spec.attrs?.blockId !== undefined && !node.attrs.blockId) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                blockId: generateBlockId(),
              });
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
