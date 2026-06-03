import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import "./editor-styles.css";
import { common, createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";
import { CommentMark } from "./comment-mark";
import { MermaidCodeBlock } from "./mermaid-block";
import { SearchHighlight, getSearchResults } from "./search-highlight";

// ─── Types ─────────────────────────────────────────────────────
interface CommentAuthor {
  login: string;
  avatarUrl: string;
}

interface CommentAnchor {
  type: "text-range" | "document";
  selectedText: string;
  context: { before: string; after: string };
}

interface Comment {
  id: string;
  author: CommentAuthor;
  body: string;
  createdAt: string;
  updatedAt?: string | null;
  optimistic?: boolean;
}

interface CommentThread {
  id: string;
  issueNumber: number;
  status: "open" | "resolved";
  anchor: CommentAnchor;
  comments: Comment[];
}

// ─── VS Code API ──────────────────────────────────────────────
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

const lowlight = createLowlight(common);

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      className={`toolbar-btn ${active ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="toolbar-sep" />;
}

// ─── Toolbar Component ────────────────────────────────────────
function EditorToolbar({ editor, sidebarVisible, onToggleSidebar, onShare }: {
  editor: ReturnType<typeof useEditor>;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  onShare: () => void;
}) {
  const [inTable, setInTable] = useState(false);

  // Track whether cursor is inside a table
  useEffect(() => {
    if (!editor) return;
    const update = () => setInTable(editor.isActive("table"));
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="editor-toolbar">
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        ↶
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        ↷
      </Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
        <strong>B</strong>
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
        <em>I</em>
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <s>S</s>
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
        {"</>"}
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        H1
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        H3
      </Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
        •≡
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
        1.≡
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Task list">
        ☑
      </Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
        ❝
      </Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        ―
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
        {"{ }"}
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insert table"
      >
        ⊞
      </Btn>

      {inTable && (
        <>
          <Sep />
          <Btn onClick={() => editor.chain().focus().addRowBefore().run()} title="Add row above">↑+</Btn>
          <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">↓+</Btn>
          <Btn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add column left">←+</Btn>
          <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">→+</Btn>
          <Sep />
          <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">↕✕</Btn>
          <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">↔✕</Btn>
          <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">⊞✕</Btn>
        </>
      )}

      <span style={{ flex: 1 }} />
      <Btn onClick={onShare} title="Share document">
        🔗
      </Btn>
      <Btn
        onClick={onToggleSidebar}
        title={sidebarVisible ? "Hide comments (Ctrl+\\)" : "Show comments (Ctrl+\\)"}
      >
        {sidebarVisible ? "💬 ▸" : "💬 ◂"}
      </Btn>
    </div>
  );
}

// ─── Comment Sidebar ───────────────────────────────────────────
function CommentSidebar({
  threads,
  activeThreadId,
  onSelect,
  onReply,
  onResolve,
  onReopen,
  onCancelDraft,
  documentText,
}: {
  threads: CommentThread[];
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onReply: (threadId: string, body: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onCancelDraft: (draftId: string) => void;
  documentText: string;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("all");
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the draft textarea when a draft thread becomes active
  const draftThreadId = threads.find((t) => t.id.startsWith("draft-") && activeThreadId === t.id && t.comments.length === 0)?.id;
  useEffect(() => {
    if (draftThreadId) {
      // Small delay to ensure the DOM has rendered
      requestAnimationFrame(() => {
        draftTextareaRef.current?.focus();
      });
    }
  }, [draftThreadId]);

  const openCount = threads.filter((t) => t.status === "open").length;
  const filteredThreads = threads
    .filter((t) => {
      if (filter === "all") return true;
      return filter === "open" ? t.status === "open" : t.status === "resolved";
    })
    .sort((a, b) => {
      // Sort by document position; document-level (no anchor) at the bottom
      const aIsDoc = a.anchor.type === "document" || !a.anchor.selectedText;
      const bIsDoc = b.anchor.type === "document" || !b.anchor.selectedText;
      if (aIsDoc && bIsDoc) return 0;
      if (aIsDoc) return 1;
      if (bIsDoc) return -1;
      const posA = documentText ? documentText.indexOf(a.anchor.selectedText) : -1;
      const posB = documentText ? documentText.indexOf(b.anchor.selectedText) : -1;
      // Threads whose anchor text isn't found get pushed to the bottom (orphaned)
      if (posA === -1 && posB === -1) return 0;
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });

  const handleSubmitReply = (threadId: string) => {
    if (!replyBody.trim()) return;
    onReply(threadId, replyBody);
    setReplyBody("");
    setReplyingTo(null);
  };

  return (
    <div className="comment-sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">
          💬 Comments
          {openCount > 0 && <span className="badge">{openCount}</span>}
        </span>
        <select
          className="filter-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "open" | "resolved" | "all")}
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="thread-list">
        {filteredThreads.length === 0 ? (
          <div className="empty-state">
            <p>No comments yet</p>
            <p className="hint">Select text in the editor and click &quot;💬 Comment&quot; to add one.</p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isDraft = thread.id.startsWith("draft-");
            const showAutoInput = isDraft && activeThreadId === thread.id && thread.comments.length === 0;
            const showReplyInput = replyingTo === thread.id;

            return (
            <div
              key={thread.id}
              className={`thread-card ${activeThreadId === thread.id ? "active" : ""} ${thread.status === "resolved" ? "resolved" : ""} ${isDraft ? "draft" : ""}`}
              onClick={() => onSelect(thread.id)}
            >
              {thread.anchor.selectedText && (
                <div className="anchor-text">
                  &ldquo;{thread.anchor.selectedText.length > 80
                    ? thread.anchor.selectedText.slice(0, 80) + "…"
                    : thread.anchor.selectedText}&rdquo;
                </div>
              )}

              {thread.status === "resolved" && (
                <div className="resolved-badge">
                  ✓ Resolved
                  <button
                    className="reopen-btn"
                    onClick={(e) => { e.stopPropagation(); onReopen(thread.id); }}
                  >
                    ↺ Reopen
                  </button>
                </div>
              )}

              {thread.comments.map((comment, i) => (
                <div key={comment.id} className={`comment ${i > 0 ? "reply" : ""} ${comment.optimistic ? "optimistic" : ""}`}>
                  <div className="comment-header">
                    {comment.author.avatarUrl ? (
                      <img
                        className="avatar"
                        src={comment.author.avatarUrl}
                        alt={comment.author.login}
                      />
                    ) : (
                      <span className="avatar-fallback">{comment.author.login[0]?.toUpperCase() ?? '?'}</span>
                    )}
                    <span className="author">@{comment.author.login}</span>
                    <span className="time">{relativeTime(comment.createdAt)}</span>
                    {comment.optimistic && <span className="sending-indicator">Sending…</span>}
                  </div>
                  <div className="comment-body" dangerouslySetInnerHTML={{ __html: renderCommentBody(comment.body) }} />
                </div>
              ))}

              {/* Draft thread: auto-show comment input */}
              {showAutoInput && (
                <div className="draft-input-area">
                  <textarea
                    ref={draftTextareaRef}
                    className="reply-input"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your comment..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSubmitReply(thread.id);
                      }
                      if (e.key === "Escape") {
                        setReplyBody("");
                        onCancelDraft(thread.id);
                      }
                    }}
                  />
                  <div className="reply-buttons">
                    <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setReplyBody(""); onCancelDraft(thread.id); }}>Cancel</button>
                    <button className="btn-primary" onClick={(e) => { e.stopPropagation(); handleSubmitReply(thread.id); }} disabled={!replyBody.trim()}>Comment</button>
                  </div>
                </div>
              )}

              {/* Existing thread actions (reply/resolve) */}
              {!isDraft && thread.status === "open" && (
                <div className="thread-actions">
                  {showReplyInput ? (
                    <div className="reply-input-area">
                      <textarea
                        className="reply-input"
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write a reply..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleSubmitReply(thread.id);
                          }
                          if (e.key === "Escape") { setReplyingTo(null); setReplyBody(""); }
                        }}
                      />
                      <div className="reply-buttons">
                        <button className="btn-ghost" onClick={() => { setReplyingTo(null); setReplyBody(""); }}>Cancel</button>
                        <button className="btn-primary" onClick={() => handleSubmitReply(thread.id)} disabled={!replyBody.trim()}>Reply</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setReplyingTo(thread.id); }}>
                        💬 Reply
                      </button>
                      <button className="btn-ghost resolve-action" onClick={(e) => { e.stopPropagation(); onResolve(thread.id); }}>
                        ✓ Resolve
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );})
        )}
      </div>
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Render comment body with lightweight markdown: bold, italic, code, links, @mentions */
function renderCommentBody(body: string): string {
  const html = body
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (```)
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // @mentions
    .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
    // Line breaks
    .replace(/\n/g, '<br/>');
  return html;
}

// ─── Main App ──────────────────────────────────────────────────
function App() {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const threadsRef = useRef<CommentThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [editable, setEditable] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [currentUser, setCurrentUser] = useState<CommentAuthor>({ login: 'you', avatarUrl: '' });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFindBar, setShowFindBar] = useState(false);
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;
  const ZOOM_STEP = 10;
  const contentRef = useRef<string>("");
  const initialContentRef = useRef<string>("");
  const isExternalUpdateRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, horizontalRule: false }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      HorizontalRule,
      MermaidCodeBlock.configure({ lowlight }),
      Markdown.configure({ html: false, transformCopiedText: true, transformPastedText: true }),
      CommentMark.configure({ HTMLAttributes: { class: "comment-highlight" } }),
      SearchHighlight,
    ],
    content: "",
    editable: true,
    editorProps: {
      attributes: {
        class: "prose-editor outline-none min-h-full px-8 py-6 mx-auto",
      },
      clipboardTextSerializer: (slice) => {
        // Extract plain text from the slice so partial table selections
        // copy the actual cell text instead of "[table]"
        let text = "";
        slice.content.descendants((node) => {
          if (node.isText) {
            text += node.text;
          } else if (node.isBlock && text.length > 0) {
            text += "\n";
          }
        });
        return text.trim();
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isExternalUpdateRef.current) return;
      setIsDirty(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (ed.storage as any).markdown.getMarkdown() as string;
      contentRef.current = md;
      vscode.postMessage({ type: "contentChanged", markdown: md });
    },
  });

  // Sync selection to extension host (debounced) so Copilot Chat can see it
  useEffect(() => {
    if (!editor) return;

    let timeout: number | null = null;

    const handler = () => {
      const { from, to } = editor.state.selection;
      if (from === to) return;

      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      if (!selectedText.trim()) return;

      if (timeout) clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        vscode.postMessage({ type: 'selectionChanged', selectedText });
        timeout = null;
      }, 300);
    };

    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      if (timeout) clearTimeout(timeout);
    };
  }, [editor]);


  // Keep threadsRef in sync for use in non-reactive callbacks
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Apply comment marks to editor
  const applyCommentMarks = useCallback(
    (threadList: CommentThread[]) => {
      if (!editor) return;
      const docText = editor.state.doc.textContent;

      threadList.forEach((thread) => {
        if (thread.anchor.type !== "text-range" || !thread.anchor.selectedText) return;
        const selectedText = thread.anchor.selectedText;
        const textIndex = docText.indexOf(selectedText);
        if (textIndex === -1) return;

        // Walk document to convert text offset to ProseMirror position
        let charCount = 0;
        let fromPos: number | null = null;
        let toPos: number | null = null;

        editor.state.doc.descendants((node, pos) => {
          if (fromPos !== null && toPos !== null) return false;
          if (node.isText && node.text) {
            const nodeStart = charCount;
            const nodeEnd = charCount + node.text.length;
            if (fromPos === null && textIndex >= nodeStart && textIndex < nodeEnd) {
              fromPos = pos + (textIndex - nodeStart);
            }
            if (fromPos !== null && toPos === null) {
              const targetEnd = textIndex + selectedText.length;
              if (targetEnd <= nodeEnd) {
                toPos = pos + (targetEnd - nodeStart);
              }
            }
            charCount += node.text.length;
          }
          return true;
        });

        if (fromPos !== null && toPos !== null) {
          try {
            const fPos = fromPos;
            const tPos = toPos;
            editor
              .chain()
              .command(({ tr }) => {
                const markType = editor.schema.marks.commentMark;
                if (!markType) return false;
                tr.addMark(fPos, tPos, markType.create({
                  threadId: thread.id,
                  resolved: thread.status === "resolved",
                }));
                return true;
              })
              .run();
          } catch {
            // Mark application failed
          }
        }
      });
    },
    [editor],
  );

  // Handle messages from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case "setContent":
          if (editor) {
            editor.commands.setContent(msg.markdown);
            contentRef.current = msg.markdown;
            initialContentRef.current = msg.markdown;
            setIsDirty(false);
          }
          break;
        case "setThreads":
          setThreads(msg.threads);
          if (editor) {
            // Delay to let content settle
            setTimeout(() => applyCommentMarks(msg.threads), 100);
          }
          break;
        case "setEditable":
          setEditable(msg.editable);
          editor?.setEditable(msg.editable);
          break;
        case "setFilePath":
          setFilePath(msg.filePath);
          break;
        case "setCurrentUser":
          setCurrentUser(msg.user);
          break;
        case "fileSaved":
          setIsDirty(false);
          break;
        case 'threadCreated': {
          const draftId = msg.draftId as string | undefined;
          if (draftId) {
            // Replace draft thread with the real one
            setThreads((prev) => prev.map((t) => t.id === draftId ? msg.thread : t));
            setActiveThreadId(msg.thread.id);
            // Update comment marks: replace draft ID with real thread ID
            if (editor) {
              const markType = editor.schema.marks.commentMark;
              if (markType) {
                editor.view.state.doc.descendants((node, pos) => {
                  if (node.isText) {
                    const mark = node.marks.find(
                      (m) => m.type === markType && m.attrs.threadId === draftId
                    );
                    if (mark) {
                      editor.chain().command(({ tr }) => {
                        tr.removeMark(pos, pos + node.nodeSize, markType);
                        tr.addMark(pos, pos + node.nodeSize, markType.create({
                          threadId: msg.thread.id,
                          resolved: false,
                        }));
                        return true;
                      }).run();
                    }
                  }
                });
              }
            }
          } else {
            setThreads((prev) => [...prev, msg.thread]);
            if (editor) {
              setTimeout(() => applyCommentMarks([msg.thread]), 100);
            }
          }
          break;
        }
        case "replyAdded":
          setThreads((prev) =>
            prev.map((t) => {
              if (t.id !== msg.threadId) return t;
              // Replace optimistic reply with real one
              const updatedComments = t.comments
                .filter((c) => !c.optimistic)
                .concat([msg.comment]);
              return { ...t, comments: updatedComments };
            }),
          );
          break;
        case "replyFailed":
          // Remove optimistic reply on failure
          setThreads((prev) =>
            prev.map((t) => {
              if (t.id !== msg.threadId) return t;
              return { ...t, comments: t.comments.filter((c) => !c.optimistic) };
            }),
          );
          break;
        case "threadResolved":
          setThreads((prev) =>
            prev.map((t) =>
              t.id === msg.threadId ? { ...t, status: "resolved" as const } : t,
            ),
          );
          break;
        case "threadReopened":
          setThreads((prev) =>
            prev.map((t) =>
              t.id === msg.threadId ? { ...t, status: "open" as const } : t,
            ),
          );
          break;
        case "externalContentUpdate": {
          // File changed externally (Copilot, git, etc.) — update the editor
          if (editor) {
            isExternalUpdateRef.current = true;
            editor.commands.setContent(msg.markdown as string);
            contentRef.current = msg.markdown as string;
            initialContentRef.current = msg.markdown as string;
            setIsDirty(false);
            // Reapply comment marks after content loads
            setTimeout(() => {
              applyCommentMarks(threadsRef.current);
              isExternalUpdateRef.current = false;
            }, 100);
          }
          break;
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [editor, applyCommentMarks]);

  // Tell extension we're ready
  useEffect(() => {
    if (editor) {
      vscode.postMessage({ type: "ready" });
    }
  }, [editor]);

  // Ctrl+Scroll to zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomLevel((prev) => {
        const next = prev + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
      });
    };
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  const handleCreateComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;

    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    const docText = editor.state.doc.textContent;
    const beforeStart = Math.max(0, from - 50);
    const afterEnd = Math.min(docText.length, to + 50);
    const before = editor.state.doc.textBetween(
      Math.max(1, beforeStart),
      from,
      " ",
    );
    const after = editor.state.doc.textBetween(to, Math.min(editor.state.doc.content.size - 1, afterEnd), " ");

    // Generate a local draft thread ID
    const draftId = `draft-${crypto.randomUUID()}`;

    // Apply comment mark immediately
    editor.chain().focus().setCommentMark(draftId).run();

    // Create a local draft thread (empty comments = draft)
    const draftThread: CommentThread = {
      id: draftId,
      issueNumber: 0,
      status: "open",
      anchor: {
        type: "text-range",
        selectedText,
        context: { before: before.slice(-100), after: after.slice(0, 100) },
      },
      comments: [],
    };

    setThreads((prev) => [...prev, draftThread]);
    setActiveThreadId(draftId);
  }, [editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) {
          vscode.postMessage({ type: "save", markdown: contentRef.current });
        }
      }
      // Ctrl+Alt+M to comment
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "m") {
        e.preventDefault();
        handleCreateComment();
      }
      // Ctrl+\ to toggle comment sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }
      // Ctrl+F to open find bar
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowFindBar(true);
      }
      // Escape to close find bar
      if (e.key === "Escape" && showFindBar) {
        setShowFindBar(false);
        // Clear any browser highlight
        window.getSelection()?.removeAllRanges();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateComment, isDirty, showFindBar]);

  // Click on comment marks to activate
  useEffect(() => {
    if (!editor) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const commentSpan = target.closest("[data-comment-mark]") as HTMLElement;
      if (commentSpan) {
        const threadId = commentSpan.getAttribute("data-comment-mark");
        if (threadId) setActiveThreadId(threadId);
      }
    };
    editor.view.dom.addEventListener("click", handleClick);
    return () => editor.view.dom.removeEventListener("click", handleClick);
  }, [editor]);

  // Scroll to anchor when active thread changes
  useEffect(() => {
    if (!editor || !activeThreadId) return;
    const editorEl = editor.view.dom;
    editorEl.querySelectorAll(".active-comment").forEach((el) => {
      el.classList.remove("active-comment");
    });
    const spans = editorEl.querySelectorAll(`[data-comment-mark="${activeThreadId}"]`);
    spans.forEach((el) => el.classList.add("active-comment"));
    if (spans.length > 0) {
      spans[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [editor, activeThreadId]);

  const handleSelectThread = useCallback((id: string) => {
    setActiveThreadId(id);
  }, []);

  const handleReply = useCallback((threadId: string, body: string) => {
    // Draft thread (not yet persisted) → create via API
    if (threadId.startsWith("draft-")) {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      vscode.postMessage({
        type: "createComment",
        anchor: thread.anchor,
        body,
        draftId: threadId,
      });
    } else {
      // Optimistic reply — add immediately then send to API
      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        author: currentUser,
        body,
        createdAt: new Date().toISOString(),
        optimistic: true,
      };
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, comments: [...t.comments, optimisticComment] }
            : t,
        ),
      );
      vscode.postMessage({ type: "reply", threadId, body });
    }
  }, [threads, currentUser]);

  const handleResolve = useCallback((threadId: string) => {
    vscode.postMessage({ type: "resolve", threadId });
  }, []);

  const handleReopen = useCallback((threadId: string) => {
    vscode.postMessage({ type: "reopen", threadId });
  }, []);

  const handleCancelDraft = useCallback((draftId: string) => {
    // Remove draft thread from state
    setThreads((prev) => prev.filter((t) => t.id !== draftId));
    setActiveThreadId(null);
    // Remove the comment mark from the editor
    if (editor) {
      const markType = editor.schema.marks.commentMark;
      if (markType) {
        editor.view.state.doc.descendants((node, pos) => {
          if (node.isText) {
            const mark = node.marks.find(
              (m) => m.type === markType && m.attrs.threadId === draftId
            );
            if (mark) {
              editor.chain().command(({ tr }) => {
                tr.removeMark(pos, pos + node.nodeSize, mark);
                return true;
              }).run();
            }
          }
        });
      }
    }
  }, [editor]);

  return (
    <div className="app-container">
      <div className="editor-area">
        {editable && <EditorToolbar editor={editor} sidebarVisible={sidebarVisible} onToggleSidebar={() => setSidebarVisible((v) => !v)} onShare={() => vscode.postMessage({ type: "share" })} />}
        {showFindBar && <FindBar editor={editor} onClose={() => setShowFindBar(false)} />}
        {/* Selection toolbar for commenting */}
        <SelectionToolbar editor={editor} onComment={handleCreateComment} />
        <div className="editor-scroll" style={{ zoom: zoomLevel / 100 }}>
          <EditorContent editor={editor} className="editor-content" />
        </div>
        {/* Status bar */}
        <div className="status-bar">
          <span className="file-path">{filePath}</span>
          <span className="status-indicators">
            {isDirty && <span className="dirty-indicator">● Modified</span>}
            {!editable && <span className="readonly-indicator">Read Only</span>}
            <button
              className="toolbar-btn zoom-indicator"
              onClick={() => setZoomLevel(100)}
              title="Reset zoom (click to reset)"
            >
              {zoomLevel}%
            </button>
          </span>
        </div>
      </div>
      {sidebarVisible && (
        <CommentSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelect={handleSelectThread}
          onReply={handleReply}
          onResolve={handleResolve}
          onReopen={handleReopen}
          onCancelDraft={handleCancelDraft}
          documentText={editor?.state.doc.textContent ?? ""}
        />
      )}
    </div>
  );
}

// ─── Find Bar ──────────────────────────────────────────────────
function FindBar({
  editor,
  onClose,
}: {
  editor: ReturnType<typeof useEditor>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const scrollToActive = useCallback(() => {
    if (!editor) return;
    requestAnimationFrame(() => {
      const active = editor.view.dom.querySelector(".find-active");
      active?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [editor]);

  const refreshState = useCallback(() => {
    if (!editor) return;
    const { count, active } = getSearchResults(editor);
    setMatchCount(count);
    setMatchIndex(active < 0 ? 0 : active);
  }, [editor]);

  // Clear search highlights on unmount (covers all close paths)
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      editor?.commands.clearSearch();
    };
  }, [editor]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      editor?.commands.clearSearch();
      setMatchCount(0);
      setMatchIndex(0);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      if (!editor) return;
      editor.commands.setSearchTerm(value);
      refreshState();
      scrollToActive();
    }, 200);
  };

  const goNext = () => {
    if (!editor || matchCount === 0) return;
    editor.commands.nextSearchResult();
    refreshState();
    scrollToActive();
  };

  const goPrev = () => {
    if (!editor || matchCount === 0) return;
    editor.commands.prevSearchResult();
    refreshState();
    scrollToActive();
  };

  const handleClose = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    editor?.commands.clearSearch();
    onClose();
  };

  return (
    <div className="find-bar">
      <input
        ref={inputRef}
        className="find-input"
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
      <span className="find-count">
        {query ? `${matchCount > 0 ? matchIndex + 1 : 0}/${matchCount}` : ""}
      </span>
      <button className="toolbar-btn" onClick={goPrev} title="Previous (Shift+Enter)">
        ↑
      </button>
      <button className="toolbar-btn" onClick={goNext} title="Next (Enter)">
        ↓
      </button>
      <button className="toolbar-btn" onClick={handleClose} title="Close (Esc)">
        ✕
      </button>
    </div>
  );
}

// ─── Selection Toolbar (floating comment button) ───────────────
function SelectionToolbar({
  editor,
  onComment,
}: {
  editor: ReturnType<typeof useEditor>;
  onComment: () => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setPosition(null);
      return;
    }
    if (!editor?.view?.dom?.contains(selection.anchorNode)) {
      setPosition(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0) {
      setPosition(null);
      return;
    }
    setPosition({
      top: rect.top + window.scrollY - 40,
      left: rect.left + window.scrollX + rect.width / 2,
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener("selectionchange", updatePosition);
    return () => document.removeEventListener("selectionchange", updatePosition);
  }, [updatePosition]);

  if (!position) return null;

  return (
    <div
      className="selection-toolbar"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <button
        className="comment-selection-btn"
        onClick={() => { onComment(); setPosition(null); }}
      >
        💬 Comment
      </button>
    </div>
  );
}

// ─── Mount ─────────────────────────────────────────────────────
const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<App />);
