"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditorStore } from "@/stores/editor-store";
import { useCommentStore } from "@/stores/comment-store";
import { useAIStore } from "@/stores/ai-store";
import { DocumentEditor } from "@/components/editor";
import { PresentationView } from "@/components/presentation";
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
  RefreshCw,
  Play,
  Lock,
  ExternalLink,
  Info,
  X,
} from "lucide-react";
import { CopilotIcon } from "@/components/icons/copilot-icon";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommentSidebar } from "@/components/comments/comment-sidebar";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { AIChatPanel } from "@/components/ai/ai-chat-panel";
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
import { addRecentDoc } from "@/lib/recent-docs";
import type { SharingConfig } from "@/lib/sharing-types";

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
  const [presentationMode, setPresentationMode] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAnonymous = status === "unauthenticated";
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const sessionAny = session as unknown as Record<string, unknown> | null;
  const author = {
    login: (sessionAny?.login as string) ?? session?.user?.name ?? "anonymous",
    avatarUrl: session?.user?.image ?? "",
  };
  const { isDirty, isSaving, setDirty, setSaving, setFilePath, setFileSha, fileSha, content: editorContent } =
    useEditorStore();
  const { threads, isSidebarOpen, setSidebarOpen } = useCommentStore();
  const { isOpen: isAIOpen, togglePanel: toggleAIPanel } = useAIStore();
  const queryClient = useQueryClient();

  // Check Copilot availability
  const { data: aiHealth } = useQuery({
    queryKey: ["ai-health"],
    queryFn: async () => {
      const res = await fetch("/api/ai/health");
      if (!res.ok) return { available: false };
      return res.json() as Promise<{ available: boolean }>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!session,
  });
  const copilotAvailable = aiHealth?.available ?? false;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Dynamic page title
  useEffect(() => {
    document.title = `mdcolab — ${fileName}`;
    return () => { document.title = "mdcolab — Collaborative Markdown Review"; };
  }, [fileName]);

  // Load comments via GitHub Issues
  const { refreshComments } = useComments({
    owner,
    repo,
    branch,
    path: filePath,
  });

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
      if (res.status === 403) {
        const body = await res.json();
        throw Object.assign(new Error(body.message ?? "No access"), { code: "no_access" });
      }
      if (!res.ok) throw new Error("Failed to load file");
      return res.json() as Promise<{ content: string; sha: string; path: string }>;
    },
    refetchInterval: 10000,
  });

  // Fetch permissions
  const { data: permData } = useQuery({
    queryKey: ["permission", owner, repo, filePath],
    queryFn: async () => {
      const qs = new URLSearchParams({ file: filePath });
      const res = await fetch(`/api/repos/${owner}/${repo}/permission?${qs}`);
      if (!res.ok) return { permission: "read" as const, canEdit: false, hasIssues: true };
      return res.json() as Promise<{ permission: string; canEdit: boolean; hasIssues: boolean }>;
    },
  });

  const canEdit = permData?.canEdit ?? false;
  const hasIssues = permData?.hasIssues ?? true;

  // Set file SHA when loaded (skip if user has unsaved edits)
  useEffect(() => {
    if (fileData) {
      if (!isDirty) {
        setFileSha(fileData.sha);
        setDirty(false);
      }
      setFilePath(filePath);
      addRecentDoc({
        owner,
        repo,
        branch,
        path: filePath,
        fileName,
      }, author.login);
    }
  }, [fileData, filePath, isDirty, setFileSha, setFilePath, setDirty, owner, repo, branch, fileName, author.login]);

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
    onError: (err) => {
      setSaving(false);
      const msg = err instanceof Error ? err.message : "Failed to save file";
      toast.error(msg);
    },
  });

  const handleSave = useCallback(
    (markdown: string) => {
      if (!canEdit) {
        toast.error("You don't have write access to this file");
        return;
      }
      if (!fileSha) {
        toast.error("File not loaded yet — please wait");
        return;
      }
      if (!markdown) {
        toast.error("Nothing to save");
        return;
      }
      saveMutation.mutate(markdown);
    },
    [canEdit, fileSha, saveMutation]
  );

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
      {
        ...SHORTCUTS.AI_PANEL,
        handler: () => { if (copilotAvailable) toggleAIPanel(); },
      },
      {
        key: 'F5',
        handler: () => setPresentationMode(true),
        description: 'Present as slideshow',
      },
    ],
    [handleSave, setSidebarOpen, isSidebarOpen, nextComment, prevComment, toggleAIPanel, setPresentationMode, copilotAvailable]
  );
  useKeyboardShortcuts(shortcuts);

  const openThreadCount = threads.filter((t) => t.status === "open").length;

  const isNoAccess = !!(fileError && (fileError as Error & { code?: string }).code === "no_access");

  // When access is denied, check if sharing config exists for this document
  const sharingQuery = useQuery({
    queryKey: ["sharing", owner, repo],
    queryFn: () => fetch(`/api/sharing/${owner}/${repo}`).then((r) => r.json()) as Promise<{ sharing: SharingConfig | null }>,
    enabled: isNoAccess,
  });

  if (fileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fileError || !fileData) {
    const sharingDoc = sharingQuery.data?.sharing?.documents?.[filePath];
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        {isNoAccess ? (
          <>
            <div className="rounded-full bg-amber-500/10 p-3">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            {sharingDoc ? (
              <>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-foreground">You don&apos;t have access to this document</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Ask <span className="font-medium">@{sharingDoc.sharedBy}</span> to share it with you.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/repos/${owner}/${repo}`}>Back to repository</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-foreground">Private repository</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    You don&apos;t have access to <span className="font-medium">{owner}/{repo}</span> through mdcolab yet.
                    Grant access to this repo via the GitHub App to view and collaborate on private files.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button asChild>
                    <a href="https://github.com/apps/mdcolab1-ai/installations/new" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Grant repo access
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/repos/${owner}/${repo}`}>Back to repository</Link>
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Failed to load file</p>
            <Button asChild variant="outline">
              <Link href={`/repos/${owner}/${repo}`}>Back to repository</Link>
            </Button>
          </>
        )}
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

          {/* Present */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setPresentationMode(true)}
              >
                <Play className="h-4 w-4" />
                Present
              </Button>
            </TooltipTrigger>
            <TooltipContent>Present as slideshow</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Share */}
          {!isAnonymous && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setShareDialogOpen(true)}
                disabled={!hasIssues}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasIssues
                ? "Copy link to clipboard"
                : "Enable Issues in repo settings to share"}
            </TooltipContent>
          </Tooltip>
          )}

          {/* AI Assistant */}
          {session && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 ${isAIOpen ? "bg-accent text-accent-foreground" : ""}`}
                onClick={toggleAIPanel}
                disabled={!copilotAvailable}
              >
                <CopilotIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {copilotAvailable ? "Copilot (⌘J)" : "GitHub Copilot subscription required"}
            </TooltipContent>
          </Tooltip>
          )}

          {/* Comment count */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                disabled={!hasIssues}
              >
                <MessageSquare className="h-4 w-4" />
                {openThreadCount > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    {openThreadCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasIssues
                ? "Comments"
                : "Enable Issues in repo settings to use comments"}
            </TooltipContent>
          </Tooltip>

          {/* Refresh */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  refreshComments();
                  queryClient.invalidateQueries({ queryKey: ["file", owner, repo, branch, filePath] });
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
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

          {canEdit && editMode && <Separator orientation="vertical" className="h-6" />}

          {/* Save indicator */}
          {canEdit && editMode && (
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
          )}

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

      {/* Guest banner */}
      {isAnonymous && !guestBannerDismissed && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-indigo-500/10 border-b border-indigo-500/20 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span className="text-xs">
              Viewing as guest —{" "}
              <a
                href={`/auth/signin?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`}
                className="font-medium text-indigo-400 underline hover:text-indigo-300"
              >
                Sign in with GitHub
              </a>{" "}
              to connect your identity
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => setGuestBannerDismissed(true)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <DocumentEditor
            initialContent={fileData.content}
            editable={canEdit && editMode}
            onSave={handleSave}
            className="flex flex-col h-full"
            author={author}
          />
        </div>

        {/* Comment Sidebar — Desktop: side panel, Mobile: bottom sheet */}
        {isSidebarOpen && !isMobile && (
          <aside className="w-80 border-l border-border overflow-y-auto shrink-0 comment-sidebar">
            <CommentSidebar hasIssues={hasIssues} />
          </aside>
        )}

        {/* AI Chat Panel */}
        {isAIOpen && copilotAvailable && (
          <AIChatPanel documentContent={editorContent || fileData.content} />
        )}

        {isMobile && (
          <Sheet
            open={isSidebarOpen}
            onOpenChange={(open) => setSidebarOpen(open)}
          >
            <SheetContent side="bottom" className="h-[70vh]" showCloseButton={false}>
              <SheetTitle className="sr-only">Comments</SheetTitle>
              <CommentSidebar hasIssues={hasIssues} />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>

    {/* Presentation Mode */}
    {presentationMode && (
      <PresentationView
        markdown={editorContent || fileData.content}
        onExit={() => setPresentationMode(false)}
        theme="dark"
      />
    )}
    <ShareDialog
      open={shareDialogOpen}
      onOpenChange={setShareDialogOpen}
      owner={owner}
      repo={repo}
      branch={branch}
      filePath={filePath}
      canEdit={canEdit}
      isEmu={(sessionAny?.isEmu as boolean) ?? false}
    />
    </TooltipProvider>
  );
}
