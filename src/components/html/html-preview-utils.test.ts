import { describe, expect, it } from "vitest";
import {
  HTML_PREVIEW_MAX_SOURCE_LENGTH,
  buildHtmlPreviewSrcDoc,
  sanitizeHtmlForPreview,
} from "./html-preview-utils";

describe("sanitizeHtmlForPreview", () => {
  it("removes script and event handler execution paths", () => {
    const result = sanitizeHtmlForPreview(
      '<h1 onclick="alert(1)">Plan</h1><script>alert(1)</script><img onerror="alert(2)" src="https://example.com/x.png">'
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.html).toContain("Plan");
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("onclick");
    expect(result.html).not.toContain("onerror");
    expect(result.html).not.toContain("https://example.com/x.png");
  });

  it("removes unsafe URLs and remote CSS fetches", () => {
    const result = sanitizeHtmlForPreview(
      '<a href="javascript:alert(1)">bad</a><style>@import url("https://example.com/a.css"); body { background: url(https://example.com/x); color: red; }</style><p style="background:url(https://example.com/x)">Text</p>'
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("@import");
    expect(result.html).not.toContain("url(");
    expect(result.html).toContain("color: red");
  });

  it("rejects oversized HTML", () => {
    const result = sanitizeHtmlForPreview("x".repeat(HTML_PREVIEW_MAX_SOURCE_LENGTH + 1));

    expect(result.status).toBe("too-large");
  });
});

describe("buildHtmlPreviewSrcDoc", () => {
  it("uses a sandbox-compatible bridge source marker", () => {
    const srcDoc = buildHtmlPreviewSrcDoc("<p>Hello</p>");

    expect(srcDoc).toContain("Content-Security-Policy");
    expect(srcDoc).toContain("mdcolab-html-preview");
    expect(srcDoc).toContain("<p>Hello</p>");
  });
});
