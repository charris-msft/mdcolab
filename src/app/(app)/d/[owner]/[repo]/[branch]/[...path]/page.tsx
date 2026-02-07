"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEditorStore } from "@/stores/editor-store";
import { useCommentStore } from "@/stores/comment-store";
import { DocumentEditor } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Share2,
  Save,
  Eye,
  Pencil,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Check,
  Loader2,
  GitCompare,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommentSidebar } from "@/components/comments/comment-sidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComments } from "@/hooks/use-comments";
import { useKeyboardShortcuts, SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";
import { useCommentNavigation } from "@/hooks/use-comment-navigation";
import { TrackChangesToggle } from "@/components/editor/track-changes-toggle";
import { TrackChangesPanel } from "@/components/editor/track-changes-panel";

export default function DocumentPage() {
  const params = useParams<{
    owner: string;
    repo: string;
    branch: string;
    path: string[];
  }>();
  const owner = params.owner;
  const repo = params.repo;
  const branch = params.branch;
  const filePath = params.path.join("/");
  const fileName = params.path[params.path.length - 1];

  const [editMode, setEditMode] = useState(false);
  const { isDirty, isSaving, setDirty, setSaving, setFilePath, setFileSha, fileSha, showTrackChanges } =
    useEditorStore();
  const { threads, isSidebarOpen, setSidebarOpen } = useCommentStore();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Load & auto-save comments
  const { saveComments, isSaving: isCommentSaving } = useComments({
    owner,
    repo,
    branch,
    path: filePath,
  });

  // Track previous threads to detect changes
  const prevThreadsRef = useRef<string>("");
  const initialLoadRef = useRef(true);
  useEffect(() => {
    const serialized = JSON.stringify(threads);
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      prevThreadsRef.current = serialized;
      return;
    }
    if (serialized !== prevThreadsRef.current) {
      prevThreadsRef.current = serialized;
      saveComments(threads);
    }
  }, [threads, saveComments]);

  // Comment navigation
  const { goToNext: nextComment, goToPrevious: prevComment } = useCommentNavigation();

  // Fetch file content
  const {
    data: fileData,
    isLoading: fileLoading,
    error: fileError,
  } = useQuery({
    queryKey: ["file", owner, repo, branch, filePath],
    queryFn: async () => {
      const res = await fetch(
        `/api/file/${owner}/${repo}/${branch}/${filePath}`
      );
      if (!res.ok) throw new Error("Failed to load file");
      return res.json() as Promise<{ content: string; sha: string; path: string }>;
    },
  });

  // Fetch permissions
  const { data: permData } = useQuery({
    queryKey: ["permission", owner, repo],
    queryFn: async () => {
      const res = await fetch(`/api/repos/${owner}/${repo}/permission`);
      if (!res.ok) return { permission: "read" as const, canEdit: false };
      return res.json() as Promise<{ permission: string; canEdit: boolean }>;
    },
  });

  const canEdit = permData?.canEdit ?? false;

  // Set file SHA when loaded
  useEffect(() => {
    if (fileData) {
      setFileSha(fileData.sha);
      setFilePath(filePath);
      setDirty(false);
    }
  }, [fileData, filePath, setFileSha, setFilePath, setDirty]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(
        `/api/save/${owner}/${repo}/${branch}/${filePath}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, sha: fileSha }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      return res.json() as Promise<{ sha: string; commit: string }>;
    },
    onMutate: () => setSaving(true),
    onSuccess: (data) => {
      setFileSha(data.sha);
      setDirty(false);
      setSaving(false);
    },
    onError: () => {
      setSaving(false);
      toast.error("Failed to save file");
    },
  });

  const handleSave = useCallback(
    (markdown: string) => {
      if (!canEdit || !fileSha) return;
      saveMutation.mutate(markdown);
    },
    [canEdit, fileSha, saveMutation]
  );

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  }, []);

  // Keyboard shortcuts
  const shortcuts = useMemo(
    () => [
      {
        ...SHORTCUTS.SAVE,
        handler: () => {
          const content = useEditorStore.getState().content;
          handleSave(content);
        },
      },
      {
        ...SHORTCUTS.TOGGLE_SIDEBAR,
        handler: () => setSidebarOpen(!isSidebarOpen),
      },
      {
        ...SHORTCUTS.NEXT_COMMENT,
        handler: () => nextComment(),
      },
      {
        ...SHORTCUTS.PREV_COMMENT,
        handler: () => prevComment(),
      },
      {
        ...SHORTCUTS.ESCAPE,
        handler: () => setSidebarOpen(false),
      },
    ],
    [handleSave, setSidebarOpen, isSidebarOpen, nextComment, prevComment]
  );
  useKeyboardShortcuts(shortcuts);

  const openThreadCount = threads.filter((t) => t.status === "open").length;

  if (fileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fileError || !fileData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Failed to load file</p>
        <Button asChild variant="outline">
          <Link href={`/repos/${owner}/${repo}`}>Back to repository</Link>
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8">
      {/* Toolbar Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/repos/${owner}/${repo}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <nav className="flex items-center gap-1 text-sm text-muted-foreground truncate">
            <Link href={`/repos/${owner}/${repo}`} className="font-medium text-foreground hover:text-primary transition-colors">
              {owner}
            </Link>
            <span>/</span>
            <Link href={`/repos/${owner}/${repo}`} className="font-medium text-foreground hover:text-primary transition-colors">
              {repo}
            </Link>
            <span>/</span>
            <span>{branch}</span>
            {params.path.map((segment, i) => {
              const isLast = i === params.path.length - 1;
              const folderPath = params.path.slice(0, i + 1).join("/");
              return (
                <span key={i} className="flex items-center gap-1">
                  <span>/</span>
                  {isLast ? (
                    <span className="text-foreground truncate">{segment}</span>
                  ) : (
                    <Link
                      href={`/repos/${owner}/${repo}?path=${folderPath}`}
                      className="hover:text-primary transition-colors"
                    >
                      {segment}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit / Review toggle */}
          {canEdit && (
            <div className="flex items-center rounded-md border border-border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={editMode ? "default" : "ghost"}
                    size="sm"
                    className="rounded-r-none gap-1.5"
                    onClick={() => setEditMode(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit document</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={!editMode ? "default" : "ghost"}
                    size="sm"
                    className="rounded-l-none gap-1.5"
                    onClick={() => setEditMode(false)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Review
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Review & comment</TooltipContent>
              </Tooltip>
            </div>
          )}

          <Separator orientation="vertical" className="h-6" />

          {/* Share */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy link to clipboard</TooltipContent>
          </Tooltip>

          {/* Track Changes */}
          <TrackChangesToggle />

          {/* Comment count */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
              >
                <MessageSquare className="h-4 w-4" />
                {openThreadCount > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    {openThreadCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Comments</TooltipContent>
          </Tooltip>

          {/* Sidebar toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
              >
                {isSidebarOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isSidebarOpen ? "Close sidebar" : "Open sidebar"}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Save indicator */}
          <div className="flex items-center gap-1.5 text-sm">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Saving...</span>
              </>
            ) : isDirty ? (
              <>
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Unsaved</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Saved</span>
              </>
            )}
          </div>

          {/* Manual save button */}
          {canEdit && editMode && isDirty && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const content = useEditorStore.getState().content;
                    handleSave(content);
                  }}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save (Ctrl+S)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <DocumentEditor
            initialContent={fileData.content}
            editable={canEdit && editMode}
            onSave={handleSave}
            className="flex flex-col h-full"
          />
        </div>

        {/* Comment Sidebar — Desktop: side panel, Mobile: bottom sheet */}
        {isSidebarOpen && !isMobile && (
          <aside className="w-80 border-l border-border overflow-y-auto shrink-0 comment-sidebar">
            {showTrackChanges ? <TrackChangesPanel /> : <CommentSidebar />}
          </aside>
        )}

        {isMobile && (
          <Sheet
            open={isSidebarOpen}
            onOpenChange={(open) => setSidebarOpen(open)}
          >
            <SheetContent side="bottom" className="h-[70vh]" showCloseButton={false}>
              <SheetTitle className="sr-only">Comments</SheetTitle>
              {showTrackChanges ? <TrackChangesPanel /> : <CommentSidebar />}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
