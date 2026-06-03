"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

interface PresentationViewProps {
  markdown: string;
  onExit: () => void;
  theme?: "dark" | "light";
}

interface RevealDeck {
  initialize: () => Promise<void> | void;
  destroy: () => void;
  on: (event: string, callback: () => void) => void;
  getTotalSlides?: () => number;
  getIndices?: () => { h: number; v: number };
  getHorizontalSlides?: () => Element[];
  isOverview?: () => boolean;
}

type RevealConstructor = new (
  container: HTMLElement,
  options: Record<string, unknown>
) => RevealDeck;
type RevealPlugin = unknown;

export function PresentationView({
  markdown,
  onExit,
  theme = "dark",
}: PresentationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<RevealDeck | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slideInfo, setSlideInfo] = useState({ current: 0, total: 0 });
  const [controlsVisible, setControlsVisible] = useState(false);

  const handleExit = useCallback(() => {
    onExit();
  }, [onExit]);

  // Load CSS for reveal.js
  useEffect(() => {
    const links: HTMLLinkElement[] = [];

    const addCSS = (href: string) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    };

    addCSS("https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.css");
    addCSS(
      theme === "light"
        ? "https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/theme/white.css"
        : "https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/theme/black.css"
    );
    addCSS(
      "https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/plugin/highlight/monokai.css"
    );

    return () => {
      links.forEach((link) => link.remove());
    };
  }, [theme]);

  // Initialize Reveal.js
  useEffect(() => {
    if (!containerRef.current || !markdown.trim()) return;

    let destroyed = false;

    const initReveal = async () => {
      const [Reveal, RevealMarkdown, RevealHighlight, RevealNotes] =
        await Promise.all([
          // @ts-expect-error -- reveal.js lacks type declarations
          import("reveal.js").then((m: unknown) => (m as { default: RevealConstructor }).default),
          // @ts-expect-error -- reveal.js plugin ESM imports lack type declarations
          import("reveal.js/plugin/markdown/markdown.esm.js").then((m: unknown) => (m as { default: RevealPlugin }).default),
          // @ts-expect-error -- reveal.js plugin ESM imports lack type declarations
          import("reveal.js/plugin/highlight/highlight.esm.js").then((m: unknown) => (m as { default: RevealPlugin }).default),
          // @ts-expect-error -- reveal.js plugin ESM imports lack type declarations
          import("reveal.js/plugin/notes/notes.esm.js").then((m: unknown) => (m as { default: RevealPlugin }).default),
        ]);

      if (destroyed || !containerRef.current) return;

      const deck = new Reveal(containerRef.current, {
        plugins: [RevealMarkdown, RevealHighlight, RevealNotes],
        hash: false,
        history: false,
        embedded: false,
        transition: "slide",
        controls: true,
        progress: true,
        center: true,
        width: 1280,
        height: 720,
      });

      await deck.initialize();

      if (destroyed) {
        deck.destroy();
        return;
      }

      deckRef.current = deck;

      const updateSlideInfo = () => {
        const totalSlides = deck.getTotalSlides?.() ?? 0;
        const indices = deck.getIndices?.() ?? { h: 0, v: 0 };
        let current = 0;
        const horizontalSlides = deck.getHorizontalSlides?.() ?? [];
        for (let h = 0; h < horizontalSlides.length; h++) {
          const verticalSlides =
            horizontalSlides[h]?.querySelectorAll?.("section") ?? [];
          const isStack = verticalSlides.length > 0;
          if (h < indices.h) {
            current += isStack ? verticalSlides.length : 1;
          } else if (h === indices.h) {
            current += isStack ? indices.v + 1 : 1;
            break;
          }
        }
        setSlideInfo({ current, total: totalSlides });
      };

      deck.on("slidechanged", updateSlideInfo);
      deck.on("ready", updateSlideInfo);
      updateSlideInfo();
    };

    initReveal();

    return () => {
      destroyed = true;
      if (deckRef.current) {
        try {
          deckRef.current.destroy();
        } catch {
          // ignore destroy errors during cleanup
        }
        deckRef.current = null;
      }
    };
  }, [markdown]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const deck = deckRef.current;
        const isOverview = deck?.isOverview?.() ?? false;
        if (!isOverview) {
          e.preventDefault();
          e.stopPropagation();
          handleExit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleExit]);

  if (!markdown.trim()) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <p className="text-xl mb-4">No content to present</p>
          <button
            onClick={handleExit}
            className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={() => {
        setControlsVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(
          () => setControlsVisible(false),
          2000
        );
      }}
    >
      {/* Reveal.js container */}
      <div ref={containerRef} className="reveal h-full w-full">
        <div className="slides">
          <section
            data-markdown=""
            data-separator="^\n---\n$"
            data-separator-vertical="^\n--\n$"
            data-separator-notes="^Notes?:"
          >
            <textarea data-template defaultValue={markdown} />
          </section>
        </div>
      </div>

      {/* Exit button — top-right */}
      <button
        onClick={handleExit}
        className={`fixed top-4 right-4 z-[60] p-2 rounded-full bg-black/50 text-white/70
          hover:bg-black/80 hover:text-white transition-all duration-200
          ${controlsVisible ? "opacity-100" : "opacity-0 hover:opacity-100"}`}
        aria-label="Exit presentation"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Slide counter — bottom-right */}
      {slideInfo.total > 0 && (
        <div
          className={`fixed bottom-4 right-4 z-[60] px-3 py-1.5 rounded-full
            bg-black/50 text-white/70 text-sm font-mono
            transition-opacity duration-200
            ${controlsVisible ? "opacity-100" : "opacity-0"}`}
        >
          {slideInfo.current} / {slideInfo.total}
        </div>
      )}
    </div>
  );
}
