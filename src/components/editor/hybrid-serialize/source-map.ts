import MarkdownIt from "markdown-it";

export interface SourceBlock {
  blockId: string | null; // assigned after PM doc loads
  type: string;           // markdown-it token type
  startLine: number;      // 0-based inclusive
  endLine: number;        // 0-based exclusive
  startOffset: number;    // byte offset in original
  endOffset: number;      // byte offset (exclusive)
  originalText: string;   // exact slice from original
}

/**
 * Extract top-level block source ranges from markdown using markdown-it.
 * Uses the same markdown-it config as tiptap-markdown to ensure token parity.
 */
export function extractSourceBlocks(
  markdown: string,
  options: { html?: boolean; linkify?: boolean; breaks?: boolean } = {}
): SourceBlock[] {
  const md = new MarkdownIt({
    html: options.html ?? false,
    linkify: options.linkify ?? false,
    breaks: options.breaks ?? false,
  });

  const tokens = md.parse(markdown, {});
  const lines = markdown.split("\n");
  const blocks: SourceBlock[] = [];

  // Build line → byte offset index
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1; // +1 for \n
  }
  lineOffsets.push(offset); // sentinel for end-of-file

  // Walk tokens at depth 0 (top-level blocks)
  let depth = 0;
  let blockStart: { type: string; startLine: number } | null = null;

  for (const token of tokens) {
    if (token.nesting === 1) {
      // Opening token
      if (depth === 0 && token.map) {
        blockStart = { type: token.type.replace(/_open$/, ""), startLine: token.map[0] };
      }
      depth++;
    } else if (token.nesting === -1) {
      // Closing token
      depth--;
      if (depth === 0 && blockStart && token.map) {
        const endLine = token.map[1];
        const startOff = lineOffsets[blockStart.startLine] ?? 0;
        const endOff = lineOffsets[endLine] ?? markdown.length;
        blocks.push({
          blockId: null,
          type: blockStart.type,
          startLine: blockStart.startLine,
          endLine,
          startOffset: startOff,
          endOffset: endOff,
          originalText: markdown.slice(startOff, endOff),
        });
        blockStart = null;
      }
    } else if (token.nesting === 0 && depth === 0) {
      // Self-closing token at top level (hr, fence, code_block, paragraph, etc.)
      if (token.map) {
        const startLine = token.map[0];
        const endLine = token.map[1];
        const startOff = lineOffsets[startLine] ?? 0;
        const endOff = lineOffsets[endLine] ?? markdown.length;
        blocks.push({
          blockId: null,
          type: token.type,
          startLine,
          endLine,
          startOffset: startOff,
          endOffset: endOff,
          originalText: markdown.slice(startOff, endOff),
        });
      } else if (token.type === "inline" && blockStart) {
        // Inline tokens inside an open block — skip, handled by parent
      }
    }
  }

  return blocks;
}

/**
 * Detect and extract YAML frontmatter from the beginning of a markdown string.
 * Returns the frontmatter text (including delimiters) and the remaining content.
 */
export function extractFrontmatter(markdown: string): {
  frontmatter: string;
  content: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (match) {
    return {
      frontmatter: match[0],
      content: markdown.slice(match[0].length),
    };
  }
  return { frontmatter: "", content: markdown };
}
