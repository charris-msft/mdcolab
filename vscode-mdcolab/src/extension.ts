import * as vscode from 'vscode';
import { getRepoInfo, getRelativeFilePath, buildMdcolabUrl, RepoInfo } from './git-utils.js';
import * as api from './github-api.js';
import { findAnchorRanges, applyDecorations } from './comment-decorations.js';
import { CommentsTreeProvider } from './comments-tree.js';

// State
let currentThreads: api.CommentThread[] = [];
let currentRepoInfo: RepoInfo | null = null;
let currentFilePath = '';
let refreshTimer: ReturnType<typeof setInterval> | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('mdcolab extension activated');

  // Create tree provider
  const treeProvider = new CommentsTreeProvider();
  const treeView = vscode.window.createTreeView('mdcolab.commentsView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // --- Load comments for current file ---
  async function loadComments() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      currentThreads = [];
      treeProvider.setThreads([]);
      return;
    }

    const fileUri = editor.document.uri;
    currentRepoInfo = getRepoInfo(fileUri);
    if (!currentRepoInfo) {
      currentThreads = [];
      treeProvider.setThreads([]);
      return;
    }

    currentFilePath = getRelativeFilePath(fileUri, currentRepoInfo.rootPath);

    try {
      currentThreads = await api.fetchCommentThreads(
        currentRepoInfo.owner, currentRepoInfo.repo, currentFilePath
      );
      treeProvider.setThreads(currentThreads);

      // Apply decorations
      const anchorRanges = findAnchorRanges(editor.document, currentThreads);
      applyDecorations(editor, anchorRanges, treeProvider.activeIssueNumber);

      vscode.commands.executeCommand('setContext', 'mdcolab.hasComments', currentThreads.length > 0);
    } catch (err) {
      console.error('Failed to load mdcolab comments:', err);
    }
  }

  // --- Register commands ---

  // Add Comment
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.addComment', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.selection || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Select text to add a comment');
        return;
      }

      if (!currentRepoInfo) {
        vscode.window.showErrorMessage('Not a GitHub repository');
        return;
      }

      const selectedText = editor.document.getText(editor.selection);

      // Get context (text before and after selection)
      const doc = editor.document;
      const startLine = Math.max(0, editor.selection.start.line - 1);
      const endLine = Math.min(doc.lineCount - 1, editor.selection.end.line + 1);
      const before = doc.getText(new vscode.Range(startLine, 0, editor.selection.start.line, editor.selection.start.character));
      const after = doc.getText(new vscode.Range(editor.selection.end.line, editor.selection.end.character, endLine, doc.lineAt(endLine).text.length));

      const commentBody = await vscode.window.showInputBox({
        prompt: 'Enter your comment',
        placeHolder: 'Type your comment here...',
        validateInput: (value) => value.trim() ? null : 'Comment cannot be empty',
      });

      if (!commentBody) { return; }

      const anchor: api.CommentAnchor = {
        type: 'text-range',
        selectedText,
        context: { before: before.slice(-100), after: after.slice(0, 100) },
      };

      try {
        const thread = await api.createCommentThread(
          currentRepoInfo.owner, currentRepoInfo.repo, currentFilePath, anchor, commentBody
        );
        if (thread) {
          vscode.window.showInformationMessage(`Comment added (Issue #${thread.issueNumber})`);
          await loadComments();
        }
      } catch (err) {
        vscode.window.showErrorMessage('Failed to create comment: ' + (err instanceof Error ? err.message : err));
      }
    })
  );

  // Open in mdcolab
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.openInMdcolab', () => {
      if (!currentRepoInfo) {
        vscode.window.showErrorMessage('Not a GitHub repository');
        return;
      }
      const config = vscode.workspace.getConfiguration('mdcolab');
      const baseUrl = config.get<string>('webAppUrl', 'https://ca-web-v6zqqr2u3p5du.calmflower-64b2252f.eastus2.azurecontainerapps.io');
      const url = buildMdcolabUrl(currentRepoInfo, currentFilePath, baseUrl);
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  // Share Link
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.shareLink', async () => {
      if (!currentRepoInfo) {
        vscode.window.showErrorMessage('Not a GitHub repository');
        return;
      }
      const config = vscode.workspace.getConfiguration('mdcolab');
      const baseUrl = config.get<string>('webAppUrl', 'https://ca-web-v6zqqr2u3p5du.calmflower-64b2252f.eastus2.azurecontainerapps.io');
      const url = buildMdcolabUrl(currentRepoInfo, currentFilePath, baseUrl);
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage('mdcolab link copied to clipboard!');
    })
  );

  // Refresh Comments
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.refreshComments', () => loadComments())
  );

  // Select Thread (from tree view click)
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.selectThread', (issueNumber: number) => {
      treeProvider.setActiveThread(issueNumber);

      // Scroll editor to the anchor
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const anchorRanges = findAnchorRanges(editor.document, currentThreads);
        const match = anchorRanges.find(ar => ar.thread.issueNumber === issueNumber);
        if (match) {
          editor.revealRange(match.range, vscode.TextEditorRevealType.InCenter);
          editor.selection = new vscode.Selection(match.range.start, match.range.end);
        }
        applyDecorations(editor, anchorRanges, issueNumber);
      }
    })
  );

  // Resolve Thread
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.resolveThread', async (item: any) => {
      const issueNumber = item?.thread?.issueNumber ?? item;
      if (!currentRepoInfo || !issueNumber) { return; }
      try {
        await api.resolveThread(currentRepoInfo.owner, currentRepoInfo.repo, issueNumber);
        vscode.window.showInformationMessage(`Thread #${issueNumber} resolved`);
        await loadComments();
      } catch {
        vscode.window.showErrorMessage('Failed to resolve thread');
      }
    })
  );

  // Reopen Thread
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.reopenThread', async (item: any) => {
      const issueNumber = item?.thread?.issueNumber ?? item;
      if (!currentRepoInfo || !issueNumber) { return; }
      try {
        await api.reopenThread(currentRepoInfo.owner, currentRepoInfo.repo, issueNumber);
        vscode.window.showInformationMessage(`Thread #${issueNumber} reopened`);
        await loadComments();
      } catch {
        vscode.window.showErrorMessage('Failed to reopen thread');
      }
    })
  );

  // --- Event listeners ---

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => loadComments())
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === 'markdown') {
        loadComments();
      }
    })
  );

  // Auto-refresh timer
  const config = vscode.workspace.getConfiguration('mdcolab');
  const interval = config.get<number>('autoRefreshInterval', 30);
  if (interval > 0) {
    refreshTimer = setInterval(() => loadComments(), interval * 1000);
    context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });
  }

  // Initial load
  await loadComments();
}

export function deactivate() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
}
