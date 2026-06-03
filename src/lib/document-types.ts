const MARKDOWN_EXTENSIONS = [".md", ".mdx"] as const;
const HTML_EXTENSIONS = [".html", ".htm"] as const;

function hasExtension(path: string, extensions: readonly string[]) {
  const lower = path.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
}

export function isMarkdownDocument(path: string) {
  return hasExtension(path, MARKDOWN_EXTENSIONS);
}

export function isHtmlDocument(path: string) {
  return hasExtension(path, HTML_EXTENSIONS);
}

export function isSupportedDocument(path: string) {
  return isMarkdownDocument(path) || isHtmlDocument(path);
}

export function getDocumentKind(path: string): "markdown" | "html" | "unsupported" {
  if (isMarkdownDocument(path)) return "markdown";
  if (isHtmlDocument(path)) return "html";
  return "unsupported";
}
