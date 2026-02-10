"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const client_1 = require("react-dom/client");
const react_2 = require("@tiptap/react");
const starter_kit_1 = __importDefault(require("@tiptap/starter-kit"));
const extension_placeholder_1 = __importDefault(require("@tiptap/extension-placeholder"));
const extension_highlight_1 = __importDefault(require("@tiptap/extension-highlight"));
const extension_link_1 = __importDefault(require("@tiptap/extension-link"));
const extension_image_1 = __importDefault(require("@tiptap/extension-image"));
const extension_table_1 = require("@tiptap/extension-table");
const extension_table_row_1 = __importDefault(require("@tiptap/extension-table-row"));
const extension_table_cell_1 = __importDefault(require("@tiptap/extension-table-cell"));
const extension_table_header_1 = __importDefault(require("@tiptap/extension-table-header"));
const extension_task_list_1 = __importDefault(require("@tiptap/extension-task-list"));
const extension_task_item_1 = __importDefault(require("@tiptap/extension-task-item"));
const extension_horizontal_rule_1 = __importDefault(require("@tiptap/extension-horizontal-rule"));
const extension_code_block_lowlight_1 = __importDefault(require("@tiptap/extension-code-block-lowlight"));
require("./editor-styles.css");
const lowlight_1 = require("lowlight");
const tiptap_markdown_1 = require("tiptap-markdown");
const comment_mark_1 = require("./comment-mark");
const vscode = acquireVsCodeApi();
const lowlight = (0, lowlight_1.createLowlight)(lowlight_1.common);
// ─── Toolbar Component ────────────────────────────────────────
function EditorToolbar({ editor }) {
    if (!editor)
        return null;
    const Btn = ({ onClick, active, disabled, title, children, }) => (<button className={`toolbar-btn ${active ? "active" : ""}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>);
    const Sep = () => <span className="toolbar-sep"/>;
    return (<div className="editor-toolbar">
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
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
        H1
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
        H2
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
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
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
        ⊞
      </Btn>

      {editor.isActive("table") && (<>
          <Sep />
          <Btn onClick={() => editor.chain().focus().addRowBefore().run()} title="Add row above">↑+</Btn>
          <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">↓+</Btn>
          <Btn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add column left">←+</Btn>
          <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">→+</Btn>
          <Sep />
          <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">↕✕</Btn>
          <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">↔✕</Btn>
          <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">⊞✕</Btn>
        </>)}
    </div>);
}
// ─── Comment Sidebar ───────────────────────────────────────────
function CommentSidebar({ threads, activeThreadId, onSelect, onReply, onResolve, onReopen, onCancelDraft, }) {
    const [replyingTo, setReplyingTo] = (0, react_1.useState)(null);
    const [replyBody, setReplyBody] = (0, react_1.useState)("");
    const [filter, setFilter] = (0, react_1.useState)("all");
    const draftTextareaRef = (0, react_1.useRef)(null);
    // Auto-focus the draft textarea when a draft thread becomes active
    const draftThreadId = threads.find((t) => t.id.startsWith("draft-") && activeThreadId === t.id && t.comments.length === 0)?.id;
    (0, react_1.useEffect)(() => {
        if (draftThreadId) {
            // Small delay to ensure the DOM has rendered
            requestAnimationFrame(() => {
                draftTextareaRef.current?.focus();
            });
        }
    }, [draftThreadId]);
    const openCount = threads.filter((t) => t.status === "open").length;
    const filteredThreads = threads.filter((t) => {
        if (filter === "all")
            return true;
        return filter === "open" ? t.status === "open" : t.status === "resolved";
    });
    const handleSubmitReply = (threadId) => {
        if (!replyBody.trim())
            return;
        onReply(threadId, replyBody);
        setReplyBody("");
        setReplyingTo(null);
    };
    return (<div className="comment-sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">
          💬 Comments
          {openCount > 0 && <span className="badge">{openCount}</span>}
        </span>
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="thread-list">
        {filteredThreads.length === 0 ? (<div className="empty-state">
            <p>No comments yet</p>
            <p className="hint">Select text in the editor and click "💬 Comment" to add one.</p>
          </div>) : (filteredThreads.map((thread) => {
            const isDraft = thread.id.startsWith("draft-");
            const showAutoInput = isDraft && activeThreadId === thread.id && thread.comments.length === 0;
            const showReplyInput = replyingTo === thread.id;
            return (<div key={thread.id} className={`thread-card ${activeThreadId === thread.id ? "active" : ""} ${thread.status === "resolved" ? "resolved" : ""} ${isDraft ? "draft" : ""}`} onClick={() => onSelect(thread.id)}>
              {thread.anchor.selectedText && (<div className="anchor-text">
                  &ldquo;{thread.anchor.selectedText.length > 80
                        ? thread.anchor.selectedText.slice(0, 80) + "…"
                        : thread.anchor.selectedText}&rdquo;
                </div>)}

              {thread.status === "resolved" && (<div className="resolved-badge">
                  ✓ Resolved
                  <button className="reopen-btn" onClick={(e) => { e.stopPropagation(); onReopen(thread.id); }}>
                    ↺ Reopen
                  </button>
                </div>)}

              {thread.comments.map((comment, i) => (<div key={comment.id} className={`comment ${i > 0 ? "reply" : ""} ${comment.optimistic ? "optimistic" : ""}`}>
                  <div className="comment-header">
                    {comment.author.avatarUrl ? (<img className="avatar" src={comment.author.avatarUrl} alt={comment.author.login}/>) : (<span className="avatar-fallback">{comment.author.login[0]?.toUpperCase() ?? '?'}</span>)}
                    <span className="author">@{comment.author.login}</span>
                    <span className="time">{relativeTime(comment.createdAt)}</span>
                    {comment.optimistic && <span className="sending-indicator">Sending…</span>}
                  </div>
                  <div className="comment-body" dangerouslySetInnerHTML={{ __html: renderCommentBody(comment.body) }}/>
                </div>))}

              {/* Draft thread: auto-show comment input */}
              {showAutoInput && (<div className="draft-input-area">
                  <textarea ref={draftTextareaRef} className="reply-input" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write your comment..." autoFocus onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleSubmitReply(thread.id);
                        }
                        if (e.key === "Escape") {
                            setReplyBody("");
                            onCancelDraft(thread.id);
                        }
                    }}/>
                  <div className="reply-buttons">
                    <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setReplyBody(""); onCancelDraft(thread.id); }}>Cancel</button>
                    <button className="btn-primary" onClick={(e) => { e.stopPropagation(); handleSubmitReply(thread.id); }} disabled={!replyBody.trim()}>Comment</button>
                  </div>
                </div>)}

              {/* Existing thread actions (reply/resolve) */}
              {!isDraft && thread.status === "open" && (<div className="thread-actions">
                  {showReplyInput ? (<div className="reply-input-area">
                      <textarea className="reply-input" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply..." autoFocus onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleSubmitReply(thread.id);
                            }
                            if (e.key === "Escape") {
                                setReplyingTo(null);
                                setReplyBody("");
                            }
                        }}/>
                      <div className="reply-buttons">
                        <button className="btn-ghost" onClick={() => { setReplyingTo(null); setReplyBody(""); }}>Cancel</button>
                        <button className="btn-primary" onClick={() => handleSubmitReply(thread.id)} disabled={!replyBody.trim()}>Reply</button>
                      </div>
                    </div>) : (<>
                      <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setReplyingTo(thread.id); }}>
                        💬 Reply
                      </button>
                      <button className="btn-ghost resolve-action" onClick={(e) => { e.stopPropagation(); onResolve(thread.id); }}>
                        ✓ Resolve
                      </button>
                    </>)}
                </div>)}
            </div>);
        }))}
      </div>
    </div>);
}
function relativeTime(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return "just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}
/** Render comment body with lightweight markdown: bold, italic, code, links, @mentions */
function renderCommentBody(body) {
    let html = body
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
    const [threads, setThreads] = (0, react_1.useState)([]);
    const threadsRef = (0, react_1.useRef)([]);
    const [activeThreadId, setActiveThreadId] = (0, react_1.useState)(null);
    const [editable, setEditable] = (0, react_1.useState)(true);
    const [isDirty, setIsDirty] = (0, react_1.useState)(false);
    const [filePath, setFilePath] = (0, react_1.useState)("");
    const [currentUser, setCurrentUser] = (0, react_1.useState)({ login: 'you', avatarUrl: '' });
    const contentRef = (0, react_1.useRef)("");
    const initialContentRef = (0, react_1.useRef)("");
    const isExternalUpdateRef = (0, react_1.useRef)(false);
    const editor = (0, react_2.useEditor)({
        extensions: [
            starter_kit_1.default.configure({ codeBlock: false, horizontalRule: false }),
            extension_placeholder_1.default.configure({ placeholder: "Start writing..." }),
            extension_highlight_1.default.configure({ multicolor: true }),
            extension_link_1.default.configure({
                openOnClick: false,
                HTMLAttributes: { class: "editor-link" },
            }),
            extension_image_1.default.configure({ inline: false, allowBase64: true }),
            extension_table_1.Table.configure({ resizable: true }),
            extension_table_row_1.default,
            extension_table_cell_1.default,
            extension_table_header_1.default,
            extension_task_list_1.default,
            extension_task_item_1.default.configure({ nested: true }),
            extension_horizontal_rule_1.default,
            extension_code_block_lowlight_1.default.configure({ lowlight }),
            tiptap_markdown_1.Markdown.configure({ html: false, transformCopiedText: true, transformPastedText: true }),
            comment_mark_1.CommentMark.configure({ HTMLAttributes: { class: "comment-highlight" } }),
        ],
        content: "",
        editable: true,
        editorProps: {
            attributes: {
                class: "prose-editor outline-none min-h-full px-8 py-6 mx-auto",
            },
        },
        onUpdate: ({ editor: ed }) => {
            if (isExternalUpdateRef.current)
                return;
            setIsDirty(true);
            const md = ed.storage.markdown.getMarkdown();
            contentRef.current = md;
            vscode.postMessage({ type: "contentChanged", markdown: md });
        },
    });
    // Sync selection to extension host (debounced) so Copilot Chat can see it
    (0, react_1.useEffect)(() => {
        if (!editor)
            return;
        let timeout = null;
        const handler = () => {
            const { from, to } = editor.state.selection;
            if (from === to)
                return;
            const selectedText = editor.state.doc.textBetween(from, to, ' ');
            if (!selectedText.trim())
                return;
            if (timeout)
                clearTimeout(timeout);
            timeout = window.setTimeout(() => {
                vscode.postMessage({ type: 'selectionChanged', selectedText });
                timeout = null;
            }, 300);
        };
        editor.on('selectionUpdate', handler);
        return () => {
            editor.off('selectionUpdate', handler);
            if (timeout)
                clearTimeout(timeout);
        };
    }, [editor]);
    // Keep threadsRef in sync for use in non-reactive callbacks
    (0, react_1.useEffect)(() => {
        threadsRef.current = threads;
    }, [threads]);
    // Apply comment marks to editor
    const applyCommentMarks = (0, react_1.useCallback)((threadList) => {
        if (!editor)
            return;
        const docText = editor.state.doc.textContent;
        threadList.forEach((thread) => {
            if (thread.anchor.type !== "text-range" || !thread.anchor.selectedText)
                return;
            const selectedText = thread.anchor.selectedText;
            const textIndex = docText.indexOf(selectedText);
            if (textIndex === -1)
                return;
            // Walk document to convert text offset to ProseMirror position
            let charCount = 0;
            let fromPos = null;
            let toPos = null;
            editor.state.doc.descendants((node, pos) => {
                if (fromPos !== null && toPos !== null)
                    return false;
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
                        if (!markType)
                            return false;
                        tr.addMark(fPos, tPos, markType.create({
                            threadId: thread.id,
                            resolved: thread.status === "resolved",
                        }));
                        return true;
                    })
                        .run();
                }
                catch {
                    // Mark application failed
                }
            }
        });
    }, [editor]);
    // Handle messages from extension host
    (0, react_1.useEffect)(() => {
        const handler = (event) => {
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
                    const draftId = msg.draftId;
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
                                        const mark = node.marks.find((m) => m.type === markType && m.attrs.threadId === draftId);
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
                    }
                    else {
                        setThreads((prev) => [...prev, msg.thread]);
                        if (editor) {
                            setTimeout(() => applyCommentMarks([msg.thread]), 100);
                        }
                    }
                    break;
                }
                case "replyAdded":
                    setThreads((prev) => prev.map((t) => {
                        if (t.id !== msg.threadId)
                            return t;
                        // Replace optimistic reply with real one
                        const updatedComments = t.comments
                            .filter((c) => !c.optimistic)
                            .concat([msg.comment]);
                        return { ...t, comments: updatedComments };
                    }));
                    break;
                case "replyFailed":
                    // Remove optimistic reply on failure
                    setThreads((prev) => prev.map((t) => {
                        if (t.id !== msg.threadId)
                            return t;
                        return { ...t, comments: t.comments.filter((c) => !c.optimistic) };
                    }));
                    break;
                case "threadResolved":
                    setThreads((prev) => prev.map((t) => t.id === msg.threadId ? { ...t, status: "resolved" } : t));
                    break;
                case "threadReopened":
                    setThreads((prev) => prev.map((t) => t.id === msg.threadId ? { ...t, status: "open" } : t));
                    break;
                case "externalContentUpdate": {
                    // File changed externally (Copilot, git, etc.) — update the editor
                    if (editor) {
                        isExternalUpdateRef.current = true;
                        editor.commands.setContent(msg.markdown);
                        contentRef.current = msg.markdown;
                        initialContentRef.current = msg.markdown;
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
    (0, react_1.useEffect)(() => {
        if (editor) {
            vscode.postMessage({ type: "ready" });
        }
    }, [editor]);
    // Keyboard shortcuts
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (e) => {
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
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isDirty]);
    const handleCreateComment = (0, react_1.useCallback)(() => {
        if (!editor)
            return;
        const { from, to } = editor.state.selection;
        if (from === to)
            return;
        const selectedText = editor.state.doc.textBetween(from, to, " ");
        if (!selectedText.trim())
            return;
        const docText = editor.state.doc.textContent;
        const beforeStart = Math.max(0, from - 50);
        const afterEnd = Math.min(docText.length, to + 50);
        const before = editor.state.doc.textBetween(Math.max(1, beforeStart), from, " ");
        const after = editor.state.doc.textBetween(to, Math.min(editor.state.doc.content.size - 1, afterEnd), " ");
        // Generate a local draft thread ID
        const draftId = `draft-${crypto.randomUUID()}`;
        // Apply comment mark immediately
        editor.chain().focus().setCommentMark(draftId).run();
        // Create a local draft thread (empty comments = draft)
        const draftThread = {
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
    // Click on comment marks to activate
    (0, react_1.useEffect)(() => {
        if (!editor)
            return;
        const handleClick = (event) => {
            const target = event.target;
            const commentSpan = target.closest("[data-comment-mark]");
            if (commentSpan) {
                const threadId = commentSpan.getAttribute("data-comment-mark");
                if (threadId)
                    setActiveThreadId(threadId);
            }
        };
        editor.view.dom.addEventListener("click", handleClick);
        return () => editor.view.dom.removeEventListener("click", handleClick);
    }, [editor]);
    // Scroll to anchor when active thread changes
    (0, react_1.useEffect)(() => {
        if (!editor || !activeThreadId)
            return;
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
    const handleSelectThread = (0, react_1.useCallback)((id) => {
        setActiveThreadId(id);
    }, []);
    const handleReply = (0, react_1.useCallback)((threadId, body) => {
        // Draft thread (not yet persisted) → create via API
        if (threadId.startsWith("draft-")) {
            const thread = threads.find((t) => t.id === threadId);
            if (!thread)
                return;
            vscode.postMessage({
                type: "createComment",
                anchor: thread.anchor,
                body,
                draftId: threadId,
            });
        }
        else {
            // Optimistic reply — add immediately then send to API
            const optimisticComment = {
                id: `temp-${Date.now()}`,
                author: currentUser,
                body,
                createdAt: new Date().toISOString(),
                optimistic: true,
            };
            setThreads((prev) => prev.map((t) => t.id === threadId
                ? { ...t, comments: [...t.comments, optimisticComment] }
                : t));
            vscode.postMessage({ type: "reply", threadId, body });
        }
    }, [threads, currentUser]);
    const handleResolve = (0, react_1.useCallback)((threadId) => {
        vscode.postMessage({ type: "resolve", threadId });
    }, []);
    const handleReopen = (0, react_1.useCallback)((threadId) => {
        vscode.postMessage({ type: "reopen", threadId });
    }, []);
    const handleCancelDraft = (0, react_1.useCallback)((draftId) => {
        // Remove draft thread from state
        setThreads((prev) => prev.filter((t) => t.id !== draftId));
        setActiveThreadId(null);
        // Remove the comment mark from the editor
        if (editor) {
            const markType = editor.schema.marks.commentMark;
            if (markType) {
                editor.view.state.doc.descendants((node, pos) => {
                    if (node.isText) {
                        const mark = node.marks.find((m) => m.type === markType && m.attrs.threadId === draftId);
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
    return (<div className="app-container">
      <div className="editor-area">
        {editable && <EditorToolbar editor={editor}/>}
        {/* Selection toolbar for commenting */}
        <SelectionToolbar editor={editor} onComment={handleCreateComment}/>
        <div className="editor-scroll">
          <react_2.EditorContent editor={editor} className="editor-content"/>
        </div>
        {/* Status bar */}
        <div className="status-bar">
          <span className="file-path">{filePath}</span>
          <span className="status-indicators">
            {isDirty && <span className="dirty-indicator">● Modified</span>}
            {!editable && <span className="readonly-indicator">Read Only</span>}
          </span>
        </div>
      </div>
      <CommentSidebar threads={threads} activeThreadId={activeThreadId} onSelect={handleSelectThread} onReply={handleReply} onResolve={handleResolve} onReopen={handleReopen} onCancelDraft={handleCancelDraft}/>
    </div>);
}
// ─── Selection Toolbar (floating comment button) ───────────────
function SelectionToolbar({ editor, onComment, }) {
    const [position, setPosition] = (0, react_1.useState)(null);
    const updatePosition = (0, react_1.useCallback)(() => {
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
    (0, react_1.useEffect)(() => {
        document.addEventListener("selectionchange", updatePosition);
        return () => document.removeEventListener("selectionchange", updatePosition);
    }, [updatePosition]);
    if (!position)
        return null;
    return (<div className="selection-toolbar" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
      <button className="comment-selection-btn" onClick={() => { onComment(); setPosition(null); }}>
        💬 Comment
      </button>
    </div>);
}
// ─── Mount ─────────────────────────────────────────────────────
const container = document.getElementById("root");
const root = (0, client_1.createRoot)(container);
root.render(<App />);
//# sourceMappingURL=editor-app.js.map