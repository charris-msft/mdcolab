import * as vscode from 'vscode';
import { CommentThread as MdcolabThread } from './github-api.js';

/**
 * WebviewView provider for the mdcolab comments sidebar.
 * Renders full comment threads with wrapped text, avatars, and action buttons.
 */
export class CommentsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'mdcolab.commentsView';

  private _view?: vscode.WebviewView;
  private _threads: MdcolabThread[] = [];
  private _activeIssueNumber?: number;
  private _filter: 'all' | 'open' | 'resolved' = 'all';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  get activeIssueNumber() { return this._activeIssueNumber; }

  setThreads(threads: MdcolabThread[]) {
    this._threads = threads;
    this._updateWebview();
  }

  setActiveThread(issueNumber: number | undefined) {
    this._activeIssueNumber = issueNumber;
    this._updateWebview();
  }

  refresh() {
    this._updateWebview();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'selectThread':
          vscode.commands.executeCommand('mdcolab.selectThread', msg.issueNumber);
          break;
        case 'deselectThread':
          vscode.commands.executeCommand('mdcolab.selectThread', undefined);
          break;
        case 'resolveThread':
          vscode.commands.executeCommand('mdcolab.resolveThread', msg.issueNumber);
          break;
        case 'reopenThread':
          vscode.commands.executeCommand('mdcolab.reopenThread', msg.issueNumber);
          break;
        case 'replyToThread':
          vscode.commands.executeCommand('mdcolab.replyToThread', msg.issueNumber);
          break;
        case 'goToComment':
          vscode.commands.executeCommand('mdcolab.goToComment', { thread: this._threads.find(t => t.issueNumber === msg.issueNumber) });
          break;
        case 'setFilter':
          this._filter = msg.filter;
          this._updateWebview();
          break;
      }
    });

    this._updateWebview();
  }

  private _updateWebview() {
    if (!this._view) return;
    this._view.webview.html = this._getHtml();
  }

  private _getHtml(): string {
    const nonce = getNonce();

    const openThreads = this._threads.filter(t => t.state === 'open');
    const resolvedThreads = this._threads.filter(t => t.state === 'closed');

    const filteredThreads = this._threads.filter(t => {
      if (this._filter === 'all') return true;
      return this._filter === 'open' ? t.state === 'open' : t.state === 'closed';
    });

    const threadsHtml = filteredThreads.length === 0
      ? `<div class="empty-state">
           <span class="codicon codicon-info"></span>
           <p>No comments yet</p>
           <p class="hint">Select text and use Ctrl+Alt+M to add a comment</p>
         </div>`
      : filteredThreads.map(t => this._renderThread(t)).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src https: data:;">
  <style nonce="${nonce}">
    :root {
      --radius: 5px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
      padding: 0;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, rgba(255,255,255,0.1)));
      position: sticky;
      top: 0;
      background: var(--vscode-sideBar-background);
      z-index: 10;
    }
    .header-title {
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 10px;
      font-weight: 600;
      padding: 0 5px;
      margin-left: 6px;
    }
    .filter-select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 11px;
      outline: none;
      cursor: pointer;
    }

    /* ── Thread card ── */
    .thread-list {
      padding: 4px 0;
    }
    .thread-card {
      margin: 4px 8px;
      padding: 10px 12px;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, rgba(255,255,255,0.08)));
      background: var(--vscode-editor-background);
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .thread-card:hover {
      border-color: var(--vscode-focusBorder);
    }
    .thread-card.active {
      border-color: var(--vscode-focusBorder);
      background: color-mix(in srgb, var(--vscode-focusBorder) 8%, var(--vscode-editor-background));
    }
    .thread-card.resolved {
      opacity: 0.7;
    }

    /* ── Anchor quote ── */
    .anchor-text {
      font-style: italic;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      padding: 6px 10px;
      margin-bottom: 8px;
      border-left: 3px solid var(--vscode-textBlockQuote-border, rgba(123,97,255,0.5));
      background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.03));
      border-radius: 0 var(--radius) var(--radius) 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* ── Resolved badge ── */
    .resolved-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--vscode-testing-iconPassed, #73c991);
      margin-bottom: 6px;
    }

    /* ── Comment ── */
    .comment {
      margin-top: 8px;
      padding-top: 8px;
    }
    .comment:first-child {
      margin-top: 0;
      padding-top: 0;
    }
    .comment.reply {
      border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
    }
    .comment-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .avatar-fallback {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .author {
      font-weight: 600;
      font-size: 12px;
    }
    .time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    /* ── Comment body — this is the key: full word-wrap ── */
    .comment-body {
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      color: var(--vscode-foreground);
    }
    .comment-body code {
      background: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.08));
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }
    .comment-body pre {
      background: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.06));
      padding: 8px 10px;
      border-radius: var(--radius);
      overflow-x: auto;
      margin: 6px 0;
    }
    .comment-body strong { font-weight: 600; }
    .comment-body em { font-style: italic; }
    .comment-body a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    .comment-body a:hover { text-decoration: underline; }
    .mention {
      color: var(--vscode-textLink-foreground);
      font-weight: 500;
    }
    .comment-signature {
      margin-top: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      text-align: right;
    }

    /* ── Action buttons ── */
    .thread-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
      flex-wrap: wrap;
    }
    .action-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-button-secondaryBackground, rgba(255,255,255,0.1));
      border-radius: 3px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: var(--vscode-font-family);
    }
    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.1));
    }
    .action-btn.resolve {
      color: var(--vscode-testing-iconPassed, #73c991);
    }
    .action-btn.reopen {
      color: var(--vscode-notificationsWarningIcon-foreground, #cca700);
    }

    /* ── Empty state ── */
    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state p { margin-top: 8px; }
    .empty-state .hint { font-size: 11px; opacity: 0.8; }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-title">
      Comments
      ${openThreads.length > 0 ? `<span class="badge">${openThreads.length}</span>` : ''}
    </span>
    <select class="filter-select" onchange="setFilter(this.value)">
      <option value="all"${this._filter === 'all' ? ' selected' : ''}>All (${this._threads.length})</option>
      <option value="open"${this._filter === 'open' ? ' selected' : ''}>Open (${openThreads.length})</option>
      <option value="resolved"${this._filter === 'resolved' ? ' selected' : ''}>Resolved (${resolvedThreads.length})</option>
    </select>
  </div>
  <div class="thread-list">
    ${threadsHtml}
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let activeIssueNumber = ${this._activeIssueNumber ?? 'undefined'};
    function selectThread(issueNumber) {
      // Toggle: if already active, deselect
      if (issueNumber === activeIssueNumber) {
        activeIssueNumber = undefined;
        vscode.postMessage({ type: 'deselectThread' });
      } else {
        activeIssueNumber = issueNumber;
        vscode.postMessage({ type: 'selectThread', issueNumber });
      }
    }
    function resolveThread(e, issueNumber) {
      e.stopPropagation();
      vscode.postMessage({ type: 'resolveThread', issueNumber });
    }
    function reopenThread(e, issueNumber) {
      e.stopPropagation();
      vscode.postMessage({ type: 'reopenThread', issueNumber });
    }
    function replyToThread(e, issueNumber) {
      e.stopPropagation();
      vscode.postMessage({ type: 'replyToThread', issueNumber });
    }
    function goToComment(e, issueNumber) {
      e.stopPropagation();
      vscode.postMessage({ type: 'goToComment', issueNumber });
    }
    function setFilter(value) {
      vscode.postMessage({ type: 'setFilter', filter: value });
    }
  </script>
</body>
</html>`;
  }

  private _renderThread(thread: MdcolabThread): string {
    const isActive = thread.issueNumber === this._activeIssueNumber;
    const classes = ['thread-card'];
    if (isActive) classes.push('active');
    if (thread.state === 'closed') classes.push('resolved');

    const anchorHtml = thread.anchor.selectedText
      ? `<div class="anchor-text">&ldquo;${escapeHtml(thread.anchor.selectedText)}&rdquo;</div>`
      : '';

    const resolvedBadgeHtml = thread.state === 'closed'
      ? `<div class="resolved-badge">
           ✓ Resolved
         </div>`
      : '';

    const allComments = [
      { author: thread.author, body: thread.body, createdAt: thread.createdAt },
      ...thread.replies.map(r => ({ author: r.author, body: r.body, createdAt: r.createdAt })),
    ];

    const commentsHtml = allComments.map((comment, i) => {
      const avatarHtml = `<span class="avatar-fallback">${escapeHtml(comment.author[0]?.toUpperCase() ?? '?')}</span>`;

      const bodyHtml = renderCommentBody(comment.body);

      return `<div class="comment${i > 0 ? ' reply' : ''}">
        <div class="comment-header">
          ${avatarHtml}
          <span class="author">@${escapeHtml(comment.author)}</span>
          <span class="time">${relativeTime(comment.createdAt)}</span>
        </div>
        <div class="comment-body">${bodyHtml}</div>
        <div class="comment-signature">— ${escapeHtml(comment.author)}</div>
      </div>`;
    }).join('\n');

    // Action buttons
    let actionsHtml = '';
    if (thread.state === 'open') {
      actionsHtml = `<div class="thread-actions">
        <button class="action-btn" onclick="replyToThread(event, ${thread.issueNumber})" title="Reply">💬 Reply</button>
        <button class="action-btn resolve" onclick="resolveThread(event, ${thread.issueNumber})" title="Resolve">✓ Resolve</button>
        <button class="action-btn" onclick="goToComment(event, ${thread.issueNumber})" title="Go to line">📄 Go to line</button>
      </div>`;
    } else {
      actionsHtml = `<div class="thread-actions">
        <button class="action-btn reopen" onclick="reopenThread(event, ${thread.issueNumber})" title="Reopen">↺ Reopen</button>
        <button class="action-btn" onclick="goToComment(event, ${thread.issueNumber})" title="Go to line">📄 Go to line</button>
      </div>`;
    }

    return `<div class="${classes.join(' ')}" onclick="selectThread(${thread.issueNumber})">
      ${anchorHtml}
      ${resolvedBadgeHtml}
      ${commentsHtml}
      ${actionsHtml}
    </div>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCommentBody(body: string): string {
  return escapeHtml(body)
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
    .replace(/\n/g, '<br>');
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
