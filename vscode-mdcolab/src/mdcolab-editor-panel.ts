import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getRepoInfo, getRelativeFilePath, RepoInfo } from './git-utils.js';
import * as api from './github-api.js';

/**
 * Manages the mdcolab WYSIWYG editor webview panel.
 * Provides a rich TipTap-based markdown editor with an integrated comment sidebar.
 */
export class MdcolabEditorPanel {
  public static readonly viewType = 'mdcolab.wysiwygEditor';

  private static panels: Map<string, MdcolabEditorPanel> = new Map();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _fileUri: vscode.Uri;
  private _repoInfo: RepoInfo | null = null;
  private _relativePath = '';
  private _currentUser: { login: string; avatarUrl: string } | null = null;
  private _lastKnownContent = '';
  private _isSaving = false;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Open (or reveal) the mdcolab editor for the given file.
   */
  public static open(extensionUri: vscode.Uri, fileUri: vscode.Uri) {
    const key = fileUri.fsPath;

    // If we already have a panel for this file, reveal it
    const existing = MdcolabEditorPanel.panels.get(key);
    if (existing) {
      existing._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const fileName = path.basename(fileUri.fsPath);

    const panel = vscode.window.createWebviewPanel(
      MdcolabEditorPanel.viewType,
      `mdcolab: ${fileName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'out', 'webview'),
        ],
      },
    );

    const editorPanel = new MdcolabEditorPanel(panel, extensionUri, fileUri);
    MdcolabEditorPanel.panels.set(key, editorPanel);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    fileUri: vscode.Uri,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._fileUri = fileUri;

    // Set the webview HTML
    this._panel.webview.html = this._getHtmlForWebview();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (msg) => this._handleMessage(msg),
      null,
      this._disposables,
    );

    // Clean up on dispose
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set icon
    this._panel.iconPath = new vscode.ThemeIcon('comment-discussion');

    // Watch for in-editor changes to the markdown file (e.g. Copilot edits)
    const docChangeWatcher = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.fsPath === this._fileUri.fsPath && !this._isSaving && e.contentChanges.length > 0) {
        const newContent = e.document.getText();
        if (newContent !== this._lastKnownContent) {
          this._lastKnownContent = newContent;
          this._panel.webview.postMessage({
            type: 'externalContentUpdate',
            markdown: newContent,
          });
        }
      }
    });
    this._disposables.push(docChangeWatcher);

    // Watch file system for disk changes (e.g. from terminal, git, external tools)
    const dirUri = vscode.Uri.joinPath(this._fileUri, '..');
    const fsWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(dirUri, path.basename(this._fileUri.fsPath)),
    );
    fsWatcher.onDidChange(async () => {
      if (this._isSaving) return;
      try {
        const newContent = fs.readFileSync(this._fileUri.fsPath, 'utf-8');
        if (newContent !== this._lastKnownContent) {
          this._lastKnownContent = newContent;
          this._panel.webview.postMessage({
            type: 'externalContentUpdate',
            markdown: newContent,
          });
        }
      } catch {
        // File may have been deleted
      }
    });
    this._disposables.push(fsWatcher);
  }

  public dispose() {
    MdcolabEditorPanel.panels.delete(this._fileUri.fsPath);
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  private async _handleMessage(msg: Record<string, unknown>) {
    switch (msg.type) {
      case 'ready':
        await this._sendInitialData();
        break;

      case 'save':
        await this._saveFile(msg.markdown as string);
        break;

      case 'createComment':
        await this._createComment(
          msg.anchor as api.CommentAnchor,
          msg.body as string,
          msg.draftId as string | undefined,
        );
        break;

      case 'reply':
        await this._replyToThread(msg.threadId as string, msg.body as string);
        break;

      case 'resolve':
        await this._resolveThread(msg.threadId as string);
        break;

      case 'reopen':
        await this._reopenThread(msg.threadId as string);
        break;

      case 'selectionChanged':
        this._syncSelectionToEditor(msg.selectedText as string);
        break;

      case 'contentChanged':
        // Track what the webview currently has to avoid echo on external change detection
        this._lastKnownContent = msg.markdown as string;
        break;
    }
  }

  private async _sendInitialData() {
    // Read file content
    const content = fs.readFileSync(this._fileUri.fsPath, 'utf-8');
    this._lastKnownContent = content;

    // Get repo info
    this._repoInfo = getRepoInfo(this._fileUri);
    if (this._repoInfo) {
      this._relativePath = getRelativeFilePath(this._fileUri, this._repoInfo.rootPath);
    }

    // Get current user info for optimistic replies
    try {
      const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
      if (session) {
        this._currentUser = {
          login: session.account.label,
          avatarUrl: '',
        };
        this._panel.webview.postMessage({
          type: 'setCurrentUser',
          user: this._currentUser,
        });
      }
    } catch {
      // Not authenticated yet — will get user info later
    }

    // Send content
    this._panel.webview.postMessage({
      type: 'setContent',
      markdown: content,
    });

    // Send file path
    this._panel.webview.postMessage({
      type: 'setFilePath',
      filePath: this._relativePath || path.basename(this._fileUri.fsPath),
    });

    // Load and send comments — threads now match the web format exactly
    if (this._repoInfo) {
      try {
        const threads = await api.fetchCommentThreads(
          this._repoInfo.owner,
          this._repoInfo.repo,
          this._relativePath,
        );

        this._panel.webview.postMessage({
          type: 'setThreads',
          threads,
        });
      } catch (err) {
        console.error('Failed to load comments for webview:', err);
        this._panel.webview.postMessage({
          type: 'setThreads',
          threads: [],
          error: err instanceof Error ? err.message : 'Failed to load comments',
        });
      }
    }
  }

  private async _saveFile(markdown: string) {
    try {
      this._isSaving = true;
      this._lastKnownContent = markdown;
      fs.writeFileSync(this._fileUri.fsPath, markdown, 'utf-8');
      this._panel.webview.postMessage({ type: 'fileSaved' });
      vscode.window.showInformationMessage('File saved');
      // Let file-system events settle before re-enabling external change detection
      setTimeout(() => { this._isSaving = false; }, 500);
    } catch (err) {
      this._isSaving = false;
      vscode.window.showErrorMessage(
        'Failed to save: ' + (err instanceof Error ? err.message : err),
      );
    }
  }

  /**
   * Sync the webview selection to a visible text editor showing the same file.
   * This lets Copilot Chat pick up the selection via #selection / #file context.
   */
  private _syncSelectionToEditor(selectedText: string) {
    if (!selectedText.trim()) return;

    const editors = vscode.window.visibleTextEditors.filter(
      (e) => e.document.uri.fsPath === this._fileUri.fsPath,
    );
    if (editors.length === 0) return;

    const editor = editors[0];
    const text = editor.document.getText();
    const index = text.indexOf(selectedText);
    if (index === -1) return;

    const startPos = editor.document.positionAt(index);
    const endPos = editor.document.positionAt(index + selectedText.length);
    editor.selection = new vscode.Selection(startPos, endPos);
    editor.revealRange(
      new vscode.Range(startPos, endPos),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  }

  private async _createComment(anchor: api.CommentAnchor, body: string, draftId?: string) {
    if (!this._repoInfo) {
      vscode.window.showErrorMessage('Not a GitHub repository');
      return;
    }

    if (!body || !body.trim()) {
      return;
    }

    try {
      const thread = await api.createCommentThread(
        this._repoInfo.owner,
        this._repoInfo.repo,
        this._relativePath,
        anchor,
        body,
      );

      if (thread) {
        this._panel.webview.postMessage({
          type: 'threadCreated',
          draftId,
          thread,
        });
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        'Failed to create comment: ' + (err instanceof Error ? err.message : err),
      );
    }
  }

  private async _replyToThread(threadId: string, body: string) {
    if (!this._repoInfo) return;

    try {
      const comment = await api.replyToThread(
        this._repoInfo.owner,
        this._repoInfo.repo,
        Number(threadId),
        body,
      );

      if (comment) {
        this._panel.webview.postMessage({
          type: 'replyAdded',
          threadId,
          comment,
        });
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        'Failed to reply: ' + (err instanceof Error ? err.message : err),
      );
      // Tell webview the optimistic reply failed so it can roll back
      this._panel.webview.postMessage({
        type: 'replyFailed',
        threadId,
        error: err instanceof Error ? err.message : 'Failed to reply',
      });
    }
  }

  private async _resolveThread(threadId: string) {
    if (!this._repoInfo) return;

    try {
      await api.resolveThread(
        this._repoInfo.owner,
        this._repoInfo.repo,
        Number(threadId),
      );
      this._panel.webview.postMessage({ type: 'threadResolved', threadId });
    } catch {
      vscode.window.showErrorMessage('Failed to resolve thread');
    }
  }

  private async _reopenThread(threadId: string) {
    if (!this._repoInfo) return;

    try {
      await api.reopenThread(
        this._repoInfo.owner,
        this._repoInfo.repo,
        Number(threadId),
      );
      this._panel.webview.postMessage({ type: 'threadReopened', threadId });
    } catch {
      vscode.window.showErrorMessage('Failed to reopen thread');
    }
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'editor-app.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'editor-app.css'),
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: https:; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>mdcolab Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
