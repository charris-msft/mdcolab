"use client";

import { useEffect, useCallback } from "react";
import { type Editor } from "@tiptap/react";

interface CodeBlockComponentProps {
  editor: Editor;
}

export function CodeBlockComponent({ editor }: CodeBlockComponentProps) {
  const addCopyButtons = useCallback(() => {
    const editorEl = editor.view.dom;
    const preBlocks = editorEl.querySelectorAll("pre");

    preBlocks.forEach((pre) => {
      if (pre.querySelector(".code-block-copy-btn")) return;

      const btn = document.createElement("button");
      btn.className = "code-block-copy-btn";
      btn.textContent = "Copy";
      btn.type = "button";
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = pre.querySelector("code");
        const text = code?.textContent ?? "";

        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = "Copy";
          }, 2000);
        } catch {
          btn.textContent = "Failed";
          setTimeout(() => {
            btn.textContent = "Copy";
          }, 2000);
        }
      });

      pre.appendChild(btn);
    });
  }, [editor]);

  useEffect(() => {
    // Add copy buttons on initial render and content changes
    addCopyButtons();

    const handleUpdate = () => {
      // Defer to allow DOM to update
      requestAnimationFrame(addCopyButtons);
    };

    editor.on("update", handleUpdate);
    editor.on("create", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("create", handleUpdate);
    };
  }, [editor, addCopyButtons]);

  return null;
}
