"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";

function formatKey(shortcut: (typeof SHORTCUTS)[keyof typeof SHORTCUTS]) {
  const parts: string[] = [];
  if ("ctrl" in shortcut && shortcut.ctrl) parts.push("Ctrl");
  if ("alt" in shortcut && shortcut.alt) parts.push("Alt");
  if ("shift" in shortcut && shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key === "Escape" ? "Esc" : shortcut.key.toUpperCase());
  return parts.join(" + ");
}

const shortcutList = Object.values(SHORTCUTS).map((s) => ({
  description: s.description,
  keys: formatKey(s),
}));

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("mdcolab:show-shortcuts", handler);
    return () => document.removeEventListener("mdcolab:show-shortcuts", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Available keyboard shortcuts for the editor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {shortcutList.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-1.5 px-1"
            >
              <span className="text-sm">{s.description}</span>
              <kbd className="pointer-events-none inline-flex h-6 items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
