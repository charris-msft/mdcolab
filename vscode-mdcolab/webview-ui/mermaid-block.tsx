import { useEffect, useRef, useState, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import mermaid from "mermaid";

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "hsl(222, 47%, 6%)",
    primaryColor: "hsl(250, 80%, 65%)",
    primaryTextColor: "hsl(210, 40%, 96%)",
    lineColor: "hsl(215, 20%, 55%)",
    secondaryColor: "hsl(222, 35%, 10%)",
    tertiaryColor: "hsl(222, 30%, 14%)",
  },
  securityLevel: "loose",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  flowchart: { useMaxWidth: false, htmlLabels: true, padding: 15 },
  sequence: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
  journey: { useMaxWidth: false },
  class: { useMaxWidth: false },
  state: { useMaxWidth: false },
  pie: { useMaxWidth: false },
  er: { useMaxWidth: false },
});

let mermaidCounter = 0;

function MermaidNodeView(props: any) {
  const { node, updateAttributes, extension } = props;
  const language = node.attrs.language;
  const isMermaid = language === "mermaid";
  const [showSource, setShowSource] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [diagramZoom, setDiagramZoom] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // After SVG renders, compute zoom to fit container
  useEffect(() => {
    if (!svgHtml || !containerRef.current) return;
    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;
    const svgWidth = svg.viewBox?.baseVal?.width || svg.getBoundingClientRect().width;
    const containerWidth = containerRef.current.clientWidth - 32; // padding
    if (svgWidth > 0 && containerWidth > 0 && svgWidth > containerWidth) {
      setDiagramZoom(Math.floor((containerWidth / svgWidth) * 100));
    } else {
      setDiagramZoom(100);
    }
  }, [svgHtml]);

  const renderDiagram = useCallback(async () => {
    if (!isMermaid) return;
    let code = node.textContent;
    if (!code.trim()) {
      setSvgHtml("");
      setError("");
      return;
    }
    // Unescape HTML entities that markdown-it may have introduced
    code = code
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');
    try {
      const id = `mermaid-${++mermaidCounter}`;
      const { svg } = await mermaid.render(id, code);
      setSvgHtml(svg);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Invalid mermaid syntax");
      setSvgHtml("");
      const orphan = document.getElementById(`dmermaid-${mermaidCounter}`);
      orphan?.remove();
    }
  }, [isMermaid, node.textContent]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  if (!isMermaid) {
    // Standard code block — use default rendering
    return (
      <NodeViewWrapper className="code-block-wrapper">
        <pre>
          <NodeViewContent as={"code" as any} />
        </pre>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="mermaid-block">
      <div className="mermaid-header">
        <span className="mermaid-label">📊 Mermaid Diagram</span>
        <div className="mermaid-controls">
          {!showSource && svgHtml && (
            <>
              <button
                className="toolbar-btn mermaid-zoom-btn"
                onClick={() => setDiagramZoom((z) => Math.max(10, (z ?? 100) - 10))}
                title="Zoom out"
              >−</button>
              <span className="mermaid-zoom-level">{diagramZoom ?? 100}%</span>
              <button
                className="toolbar-btn mermaid-zoom-btn"
                onClick={() => setDiagramZoom((z) => Math.min(200, (z ?? 100) + 10))}
                title="Zoom in"
              >+</button>
              <button
                className="toolbar-btn mermaid-zoom-btn"
                onClick={() => {
                  const svg = containerRef.current?.querySelector("svg");
                  if (!svg || !containerRef.current) return;
                  const svgW = svg.viewBox?.baseVal?.width || svg.getBoundingClientRect().width;
                  const cW = containerRef.current.clientWidth - 32;
                  setDiagramZoom(svgW > 0 && cW > 0 ? Math.floor((cW / svgW) * 100) : 100);
                }}
                title="Fit to width"
              >⊡</button>
            </>
          )}
          <button
            className="toolbar-btn mermaid-toggle"
            onClick={() => setShowSource((s) => !s)}
            title={showSource ? "Show diagram" : "Edit source"}
          >
            {showSource ? "◉ Preview" : "✎ Source"}
          </button>
        </div>
      </div>

      {showSource ? (
        <pre className="mermaid-source">
          <NodeViewContent as={"code" as any} />
        </pre>
      ) : (
        <>
          {svgHtml ? (
            <div
              ref={containerRef}
              className="mermaid-render"
            >
              <div
                style={{ transform: `scale(${(diagramZoom ?? 100) / 100})`, transformOrigin: "top center" }}
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            </div>
          ) : error ? (
            <div className="mermaid-error">
              <pre className="mermaid-source">
                <NodeViewContent as={"code" as any} />
              </pre>
              <div className="mermaid-error-msg">⚠ {error}</div>
            </div>
          ) : (
            <div className="mermaid-empty">Empty diagram</div>
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Extends CodeBlockLowlight with a React NodeView that renders
 * mermaid code blocks as diagrams.
 */
export const MermaidCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});
