"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Sun,
  Moon,
  Eye,
  Pencil,
  PanelRightOpen,
  Heading,
  Home,
  FolderOpen,
  Keyboard,
  Monitor,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTheme } from "@/components/layout/theme-provider";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Home />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/repos"))}
          >
            <FolderOpen />
            <span>Repositories</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Editor">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.dispatchEvent(
                  new CustomEvent("mdcolab:toggle-edit-mode")
                );
              })
            }
          >
            <Pencil />
            <span>Toggle Edit Mode</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.dispatchEvent(
                  new CustomEvent("mdcolab:toggle-review-mode")
                );
              })
            }
          >
            <Eye />
            <span>Toggle Review Mode</span>
            <CommandShortcut>⌘⇧R</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.dispatchEvent(
                  new CustomEvent("mdcolab:toggle-outline")
                );
              })
            }
          >
            <Heading />
            <span>Toggle Document Outline</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Comments">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.dispatchEvent(
                  new CustomEvent("mdcolab:toggle-comment-sidebar")
                );
              })
            }
          >
            <PanelRightOpen />
            <span>Toggle Comment Sidebar</span>
            <CommandShortcut>⌘⇧C</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.dispatchEvent(
                  new CustomEvent("mdcolab:next-comment")
                );
              })
            }
          >
            <ChevronDown />
            <span>Next Comment</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.dispatchEvent(
                  new CustomEvent("mdcolab:prev-comment")
                );
              })
            }
          >
            <ChevronUp />
            <span>Previous Comment</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
            <Moon />
            <span>Dark Mode</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
            <Sun />
            <span>Light Mode</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
            <Monitor />
            <span>System Theme</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Help">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.dispatchEvent(
                  new CustomEvent("mdcolab:show-shortcuts")
                );
              })
            }
          >
            <Keyboard />
            <span>Show Keyboard Shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
