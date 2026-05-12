"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface FindBarProps {
  onClose: () => void;
}

export function FindBar({ onClose }: FindBarProps) {
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const clearHighlights = useCallback(() => {
    document.querySelectorAll("mark.find-highlight").forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      document.querySelectorAll("mark.find-highlight").forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ""), el);
          parent.normalize();
        }
      });
    };
  }, []);

  const doSearch = useCallback(
    (searchText: string, jumpTo?: number) => {
      clearHighlights();
      if (!searchText.trim()) {
        setMatchCount(0);
        setMatchIndex(0);
        return;
      }

      const editorEl = document.querySelector(".prose-editor");
      if (!editorEl) return;

      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode as Text);
      }

      const lowerQuery = searchText.toLowerCase();
      const allMatches: { node: Text; start: number }[] = [];

      for (const textNode of textNodes) {
        const text = textNode.textContent || "";
        let idx = text.toLowerCase().indexOf(lowerQuery);
        while (idx !== -1) {
          allMatches.push({ node: textNode, start: idx });
          idx = text.toLowerCase().indexOf(lowerQuery, idx + 1);
        }
      }

      setMatchCount(allMatches.length);
      if (allMatches.length === 0) {
        setMatchIndex(0);
        return;
      }

      const target = jumpTo !== undefined ? jumpTo % allMatches.length : 0;
      setMatchIndex(target);

      const processed = [...allMatches].reverse();
      for (let i = 0; i < processed.length; i++) {
        const { node, start } = processed[i];
        const originalIndex = allMatches.length - 1 - i;
        try {
          const matchNode = node.splitText(start);
          matchNode.splitText(searchText.length);
          const mark = document.createElement("mark");
          mark.className =
            "find-highlight" + (originalIndex === target ? " find-active" : "");
          matchNode.parentNode!.replaceChild(mark, matchNode);
          mark.appendChild(matchNode);
        } catch {
          // Skip if split fails
        }
      }

      const active = document.querySelector("mark.find-active");
      active?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [clearHighlights],
  );

  const handleChange = (value: string) => {
    setQuery(value);
    clearHighlights();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setMatchCount(0);
      setMatchIndex(0);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      doSearch(value, 0);
    }, 200);
  };

  const goNext = () => {
    if (matchCount === 0) return;
    doSearch(query, (matchIndex + 1) % matchCount);
  };

  const goPrev = () => {
    if (matchCount === 0) return;
    doSearch(query, (matchIndex - 1 + matchCount) % matchCount);
  };

  const handleClose = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    clearHighlights();
    onClose();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card shrink-0">
      <input
        ref={inputRef}
        className="flex-1 max-w-[280px] px-2 py-1 text-sm border border-border rounded bg-background text-foreground outline-none focus:border-primary/50"
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            goPrev();
          } else if (e.key === "Enter") {
            e.preventDefault();
            goNext();
          }
          if (e.key === "Escape") {
            handleClose();
          }
        }}
        placeholder="Find..."
      />
      <span className="text-xs text-muted-foreground min-w-[40px] text-center">
        {query ? `${matchCount > 0 ? matchIndex + 1 : 0}/${matchCount}` : ""}
      </span>
      <button
        className="p-1 rounded text-sm hover:bg-accent text-muted-foreground"
        onClick={goPrev}
        title="Previous (Shift+Enter)"
      >
        ↑
      </button>
      <button
        className="p-1 rounded text-sm hover:bg-accent text-muted-foreground"
        onClick={goNext}
        title="Next (Enter)"
      >
        ↓
      </button>
      <button
        className="p-1 rounded text-sm hover:bg-accent text-muted-foreground"
        onClick={handleClose}
        title="Close (Esc)"
      >
        ✕
      </button>
    </div>
  );
}
