"use client";

import DOMPurify from "dompurify";

export const HTML_PREVIEW_MAX_SOURCE_LENGTH = 1024 * 1024;
export const HTML_PREVIEW_MAX_ELEMENTS = 20_000;

export type HtmlPreviewResult =
  | { status: "ok"; html: string; elementCount: number }
  | { status: "too-large"; message: string }
  | { status: "too-complex"; message: string }
  | { status: "unsupported"; message: string };

const FORBIDDEN_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "textarea",
  "select",
  "option",
];

function cleanStyleValue(value: string) {
  return value
    .replace(/@import[^;]+;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function isSafeHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) return true;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeImageDataUrl(value: string) {
  return /^data:image\/(?:png|gif|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(
    value.trim()
  );
}

function hardenPreviewResources(html: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(
    `<!doctype html><html><body>${html}</body></html>`,
    "text/html"
  );

  document.body.querySelectorAll("*").forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on")) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (name === "style") {
        const cleaned = cleanStyleValue(value);
        if (cleaned.trim()) {
          element.setAttribute(attr.name, cleaned);
        } else {
          element.removeAttribute(attr.name);
        }
        continue;
      }

      if (name === "href") {
        if (isSafeHref(value)) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        } else {
          element.removeAttribute(attr.name);
        }
        continue;
      }

      if (name === "src") {
        if (!isSafeImageDataUrl(value)) {
          element.removeAttribute(attr.name);
        }
        continue;
      }

      if (name === "srcset" || name === "formaction" || name === "poster") {
        element.removeAttribute(attr.name);
      }
    }
  });

  document.body.querySelectorAll("style").forEach((style) => {
    style.textContent = cleanStyleValue(style.textContent ?? "");
  });

  return {
    html: document.body.innerHTML,
    elementCount: document.body.querySelectorAll("*").length,
  };
}

export function sanitizeHtmlForPreview(source: string): HtmlPreviewResult {
  if (source.length > HTML_PREVIEW_MAX_SOURCE_LENGTH) {
    return {
      status: "too-large",
      message: `This HTML file is too large to preview safely (${Math.ceil(
        source.length / 1024
      )} KB).`,
    };
  }

  if (typeof window === "undefined") {
    return {
      status: "unsupported",
      message: "HTML preview is only available in the browser.",
    };
  }

  const sanitized = DOMPurify.sanitize(source, {
    ADD_TAGS: ["style"],
    ADD_ATTR: ["style", "target", "rel", "aria-label", "aria-hidden"],
    FORBID_TAGS: FORBIDDEN_TAGS,
    WHOLE_DOCUMENT: false,
  });

  const hardened = hardenPreviewResources(sanitized);
  if (hardened.elementCount > HTML_PREVIEW_MAX_ELEMENTS) {
    return {
      status: "too-complex",
      message: `This HTML file has too many elements to preview safely (${hardened.elementCount.toLocaleString()}).`,
    };
  }

  return { status: "ok", ...hardened };
}

const BRIDGE_SCRIPT = String.raw`
(function () {
  const SOURCE = "mdcolab-html-preview";
  const PARENT_SOURCE = "mdcolab-html-parent";
  let activeElement = null;

  function send(type, payload) {
    window.parent.postMessage({ source: SOURCE, type, ...payload }, "*");
  }

  function cssPath(element) {
    if (!element || element === document.body) return "body";
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName.toLowerCase() === tag) index += 1;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(tag + ":nth-of-type(" + index + ")");
      current = current.parentElement;
    }
    return "body" + (parts.length ? " > " + parts.join(" > ") : "");
  }

  function elementFromNode(node) {
    if (!node) return document.body;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement || document.body;
  }

  function textContext(selectedText) {
    const text = document.body.innerText || document.body.textContent || "";
    const index = text.indexOf(selectedText);
    if (index === -1) return { before: "", after: "" };
    return {
      before: text.slice(Math.max(0, index - 32), index),
      after: text.slice(index + selectedText.length, index + selectedText.length + 32),
    };
  }

  function clearActive() {
    if (activeElement) activeElement.classList.remove("mdcolab-html-active-comment");
    activeElement = null;
  }

  function findTextElement(selectedText) {
    if (!selectedText) return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if ((node.nodeValue || "").includes(selectedText)) {
        return node.parentElement;
      }
      node = walker.nextNode();
    }
    return null;
  }

  function findAnchor(anchor) {
    if (anchor.html && anchor.html.domPath) {
      try {
        const byPath = document.querySelector(anchor.html.domPath);
        if (byPath) return byPath;
      } catch {}
    }
    return findTextElement(anchor.selectedText);
  }

  function markThreads(threads) {
    document.querySelectorAll("[data-mdcolab-thread-id]").forEach((element) => {
      element.classList.remove("mdcolab-html-comment-anchor", "mdcolab-html-active-comment", "mdcolab-html-resolved-comment");
      element.removeAttribute("data-mdcolab-thread-id");
    });

    threads.forEach((thread) => {
      const element = findAnchor(thread.anchor);
      if (!element) return;
      element.setAttribute("data-mdcolab-thread-id", thread.id);
      element.classList.add("mdcolab-html-comment-anchor");
      if (thread.status === "resolved") element.classList.add("mdcolab-html-resolved-comment");
    });
  }

  function activateThread(threadId, anchor) {
    clearActive();
    const element = anchor ? findAnchor(anchor) : document.querySelector('[data-mdcolab-thread-id="' + threadId + '"]');
    if (!element) return;
    activeElement = element;
    activeElement.classList.add("mdcolab-html-active-comment");
    activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function reportSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const element = elementFromNode(range.commonAncestorContainer);
    const context = textContext(selectedText);
    send("selection", {
      selection: {
        selectedText,
        context,
        html: {
          domPath: cssPath(element),
          textQuote: selectedText,
        },
      },
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    });
  }

  document.addEventListener("mouseup", function () {
    window.setTimeout(reportSelection, 0);
  });
  document.addEventListener("keyup", function (event) {
    if (event.key === "Shift" || event.key.startsWith("Arrow")) reportSelection();
  });
  document.addEventListener("click", function (event) {
    const target = event.target && event.target.closest ? event.target.closest("[data-mdcolab-thread-id]") : null;
    if (!target) return;
    send("anchor-click", { threadId: target.getAttribute("data-mdcolab-thread-id") });
  });

  window.addEventListener("message", function (event) {
    const data = event.data || {};
    if (data.source !== PARENT_SOURCE) return;
    if (data.type === "threads") markThreads(data.threads || []);
    if (data.type === "activate") activateThread(data.threadId, data.anchor);
  });

  send("ready", {});
})();
`;

export function buildHtmlPreviewSrcDoc(sanitizedHtml: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 32px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
      color: CanvasText;
      background: Canvas;
    }
    img { max-width: 100%; height: auto; }
    pre, code { white-space: pre-wrap; }
    .mdcolab-html-comment-anchor {
      outline: 2px solid rgba(234, 179, 8, 0.65);
      outline-offset: 2px;
      background: rgba(234, 179, 8, 0.12);
      border-radius: 4px;
    }
    .mdcolab-html-active-comment {
      outline-color: rgba(123, 97, 255, 0.9);
      background: rgba(123, 97, 255, 0.18);
    }
    .mdcolab-html-resolved-comment {
      opacity: 0.75;
    }
  </style>
</head>
<body>
${sanitizedHtml}
<script>${BRIDGE_SCRIPT}</script>
</body>
</html>`;
}
