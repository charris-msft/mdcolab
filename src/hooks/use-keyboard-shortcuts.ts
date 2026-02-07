"use client";

import { useEffect } from "react";

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl
          ? e.ctrlKey || e.metaKey
          : !e.ctrlKey && !e.metaKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          altMatch &&
          shiftMatch
        ) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

export const SHORTCUTS = {
  SAVE: { key: "s", ctrl: true, description: "Save document" },
  COMMENT: { key: "m", ctrl: true, alt: true, description: "New comment" },
  PALETTE: { key: "k", ctrl: true, description: "Command palette" },
  NEXT_COMMENT: { key: "ArrowDown", ctrl: true, alt: true, description: "Next comment" },
  PREV_COMMENT: { key: "ArrowUp", ctrl: true, alt: true, description: "Previous comment" },
  TOGGLE_SIDEBAR: { key: "b", ctrl: true, shift: true, description: "Toggle sidebar" },
  ESCAPE: { key: "Escape", description: "Close panels" },
} as const;
