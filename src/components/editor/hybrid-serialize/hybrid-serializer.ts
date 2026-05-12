import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { SourceBlock } from "./source-map";
import type { DirtyTracker } from "./dirty-tracker";

// Block types safe to serialize in isolation (no cross-block dependencies)
const SAFE_ISOLATED_TYPES = new Set([
  "paragraph",
  "heading",
  "horizontalRule",
  "codeBlock",
  "image",
]);

/**
 * Serialize a single ProseMirror block node to markdown using tiptap-markdown.
 * Creates a temporary doc containing only the given block.
 */
function serializeSingleBlock(editor: Editor, block: PMNode): string {
  const tempDoc = editor.schema.topNodeType.create(null, [block]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializer = (editor.storage as any).markdown?.serializer;
  if (!serializer) {
    throw new Error("tiptap-markdown serializer not available");
  }
  return serializer.serialize(tempDoc);
}

/**
 * Full-document serialize via tiptap-markdown (fallback).
 */
function fullSerialize(editor: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (editor.storage as any).markdown.getMarkdown() as string;
}

export interface HybridSerializeOptions {
  editor: Editor;
  originalMarkdown: string;
  sourceBlocks: SourceBlock[];
  dirtyTracker: DirtyTracker;
  frontmatter?: string;
}

/**
 * Hybrid serializer: keeps original markdown for clean blocks,
 * re-serializes only dirty blocks.
 *
 * Falls back to full re-serialize if:
 * - Block count doesn't match (structural mismatch)
 * - Any invariant fails
 */
export function hybridSerialize(options: HybridSerializeOptions): string {
  const { editor, originalMarkdown, sourceBlocks, dirtyTracker, frontmatter } = options;
  const doc = editor.state.doc;

  // Build blockId → SourceBlock map
  const sourceByBlockId = new Map<string, SourceBlock>();
  for (const sb of sourceBlocks) {
    if (sb.blockId) {
      sourceByBlockId.set(sb.blockId, sb);
    }
  }

  // Validate: check if we have a reasonable mapping
  let pmBlockCount = 0;
  doc.forEach(() => { pmBlockCount++; });

  if (sourceBlocks.length === 0 || pmBlockCount === 0) {
    return (frontmatter || "") + fullSerialize(editor);
  }

  // Count how many PM blocks have a matching source block
  let matchedCount = 0;
  doc.forEach((node) => {
    if (node.attrs.blockId && sourceByBlockId.has(node.attrs.blockId)) {
      matchedCount++;
    }
  });

  // If very few blocks match, the mapping is unreliable — fall back
  if (matchedCount < Math.min(sourceBlocks.length, pmBlockCount) * 0.5) {
    return (frontmatter || "") + fullSerialize(editor);
  }

  // Stitch output
  const outputParts: string[] = [];
  let lastSourceEndOffset = 0; // track position in original for inter-block whitespace

  doc.forEach((node) => {
    const blockId = node.attrs.blockId as string | null;
    const source = blockId ? sourceByBlockId.get(blockId) : undefined;

    if (blockId && source && !dirtyTracker.isDirty(blockId)) {
      // Clean block → use original text (preserving inter-block whitespace)
      if (outputParts.length > 0 && source.startOffset > lastSourceEndOffset) {
        // Splice the gap between previous block and this one from original
        const gap = originalMarkdown.slice(lastSourceEndOffset, source.startOffset);
        outputParts.push(gap);
      } else if (outputParts.length > 0) {
        outputParts.push("\n\n");
      }
      outputParts.push(source.originalText);
      lastSourceEndOffset = source.endOffset;
    } else {
      // Dirty or new block → serialize
      let serialized: string;
      if (SAFE_ISOLATED_TYPES.has(node.type.name)) {
        serialized = serializeSingleBlock(editor, node);
      } else {
        // For complex types (lists, tables with ref-links, etc.),
        // still use isolated serialization but accept it may not be perfect.
        // A more sophisticated approach would do full-doc-then-extract.
        serialized = serializeSingleBlock(editor, node);
      }

      // No-op detection: if the serialized output matches original, use original
      if (source && serialized.trimEnd() === source.originalText.trimEnd()) {
        if (outputParts.length > 0 && source.startOffset > lastSourceEndOffset) {
          outputParts.push(originalMarkdown.slice(lastSourceEndOffset, source.startOffset));
        } else if (outputParts.length > 0) {
          outputParts.push("\n\n");
        }
        outputParts.push(source.originalText);
        lastSourceEndOffset = source.endOffset;
      } else {
        if (outputParts.length > 0) {
          outputParts.push("\n\n");
        }
        outputParts.push(serialized);
        // We've lost track of original offsets for this block
        if (source) {
          lastSourceEndOffset = source.endOffset;
        }
      }
    }
  });

  let result = outputParts.join("");

  // Ensure trailing newline
  if (!result.endsWith("\n")) {
    result += "\n";
  }

  return (frontmatter || "") + result;
}
