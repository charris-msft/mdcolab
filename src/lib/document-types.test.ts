import { describe, expect, it } from "vitest";
import {
  getDocumentKind,
  isHtmlDocument,
  isMarkdownDocument,
  isSupportedDocument,
} from "./document-types";

describe("document type helpers", () => {
  it("recognizes Markdown documents", () => {
    expect(isMarkdownDocument("README.md")).toBe(true);
    expect(isMarkdownDocument("docs/plan.MDX")).toBe(true);
    expect(getDocumentKind("docs/plan.md")).toBe("markdown");
  });

  it("recognizes HTML documents", () => {
    expect(isHtmlDocument("status.html")).toBe(true);
    expect(isHtmlDocument("plans/Memory.HTM")).toBe(true);
    expect(getDocumentKind("plans/status.html")).toBe("html");
  });

  it("rejects unsupported documents", () => {
    expect(isSupportedDocument("notes.txt")).toBe(false);
    expect(getDocumentKind("notes.txt")).toBe("unsupported");
  });
});
