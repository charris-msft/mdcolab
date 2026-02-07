/**
 * Markdown round-trip utilities for mdcolab.
 * Handles frontmatter preservation and clean serialization.
 */

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;

export interface ParsedDocument {
  frontmatter: string | null;
  body: string;
}

/** Extract YAML frontmatter from markdown, returning it separately */
export function extractFrontmatter(markdown: string): ParsedDocument {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (match) {
    return {
      frontmatter: match[0],
      body: markdown.slice(match[0].length),
    };
  }
  return { frontmatter: null, body: markdown };
}

/** Re-attach frontmatter to markdown body */
export function attachFrontmatter(
  frontmatter: string | null,
  body: string
): string {
  if (!frontmatter) return body;
  return frontmatter + (frontmatter.endsWith("\n") ? "" : "\n") + body;
}

/** Clean up markdown output from Tiptap to be idiomatic */
export function cleanMarkdown(markdown: string): string {
  let result = markdown;

  // Ensure single trailing newline
  result = result.trimEnd() + "\n";

  // Normalize multiple blank lines to max 2
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

/**
 * Compute a simple hash of content for the comments sidecar file.
 * Uses a fast string hash (not cryptographic).
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
