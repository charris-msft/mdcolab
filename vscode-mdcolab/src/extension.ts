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
      const fileName = currentFilePath.split('/').pop() ?? currentFilePath;
      const markdownLink = `[${fileName}](${url})`;
      await vscode.env.clipboard.writeText(markdownLink);
      vscode.window.showInformationMessage('mdcolab link copied to clipboard!');
    })
  );

  // Share with mdcolab (explorer context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.shareWithMdcolab', async (uri?: vscode.Uri) => {
      // Resolve the file URI — from explorer context menu or active editor
      const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!fileUri) {
        vscode.window.showErrorMessage('No file selected');
        return;
      }

      // Get repo info from the file's location
      const repoInfo = getRepoInfo(fileUri);
      if (!repoInfo) {
        vscode.window.showErrorMessage('Not a GitHub repository');
        return;
      }

      const relativePath = getRelativeFilePath(fileUri, repoInfo.rootPath);

      try {
        // Authenticate and get Octokit
        const octokit = await api.getOctokit();

        // Read existing .mdcolab/sharing.json (if any)
        const sharingPath = '.mdcolab/sharing.json';
        let existingSha: string | undefined;
        let sharingConfig: { documents: Record<string, { mode: string; users: string[]; allowEditing: boolean; expiresAt: string }> } = { documents: {} };

        try {
          const { data } = await octokit.repos.getContent({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            path: sharingPath,
            ref: repoInfo.branch,
          });
          if (!Array.isArray(data) && data.type === 'file' && data.content) {
            existingSha = data.sha;
            const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
            sharingConfig = JSON.parse(decoded);
          }
        } catch (err: any) {
          if (err.status !== 404) { throw err; }
          // File doesn't exist yet — we'll create it
        }

        // Check if already shared
        const existingEntry = sharingConfig.documents[relativePath];
        if (existingEntry) {
          // Already shared — check if expired
          const expiry = new Date(existingEntry.expiresAt);
          if (expiry > new Date()) {
            // Still valid — just copy the link
            const config = vscode.workspace.getConfiguration('mdcolab');
            const baseUrl = config.get<string>('webAppUrl', 'https://ca-web-v6zqqr2u3p5du.calmflower-64b2252f.eastus2.azurecontainerapps.io');
            const url = buildMdcolabUrl(repoInfo, relativePath, baseUrl);
            const fileName = relativePath.split('/').pop() ?? relativePath;
            await vscode.env.clipboard.writeText(`[${fileName}](${url})`);
            vscode.window.showInformationMessage('Already shared! Link copied to clipboard.');
            return;
          }
        }

        // Create/update sharing entry
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        sharingConfig.documents[relativePath] = {
          mode: 'anyone_with_link',
          users: [],
          allowEditing: false,
          expiresAt,
        };

        const updatedContent = Buffer.from(JSON.stringify(sharingConfig, null, 2) + '\n').toString('base64');

        await octokit.repos.createOrUpdateFileContents({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          path: sharingPath,
          message: `Share ${relativePath} via mdcolab`,
          content: updatedContent,
          sha: existingSha,
          branch: repoInfo.branch,
        });

        // Copy the link
        const config = vscode.workspace.getConfiguration('mdcolab');
        const baseUrl = config.get<string>('webAppUrl', 'https://ca-web-v6zqqr2u3p5du.calmflower-64b2252f.eastus2.azurecontainerapps.io');
        const url = buildMdcolabUrl(repoInfo, relativePath, baseUrl);
        const fileName = relativePath.split('/').pop() ?? relativePath;
        await vscode.env.clipboard.writeText(`[${fileName}](${url})`);
        vscode.window.showInformationMessage('Shared! Link copied to clipboard.');
      } catch (err) {
        vscode.window.showErrorMessage('Failed to share: ' + (err instanceof Error ? err.message : err));
      }
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
