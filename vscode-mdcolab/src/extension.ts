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

      // --- Interactive share configuration (matches the web app) ---
      type SharingMode = 'anyone_with_link' | 'specific_people';
      type ModePick = vscode.QuickPickItem & { value: SharingMode };
      const modePick = await vscode.window.showQuickPick<ModePick>(
        [
          {
            label: '$(globe) Anyone with the link',
            description: 'View/comment without sign-in',
            value: 'anyone_with_link',
          },
          {
            label: '$(lock) Specific people',
            description: 'Only listed GitHub users',
            value: 'specific_people',
          },
        ],
        { placeHolder: 'Who should have access?', ignoreFocusOut: true }
      );
      if (!modePick) { return; }
      const mode: SharingMode = modePick.value;

      let users: string[] = [];
      if (mode === 'specific_people') {
        const usersInput = await vscode.window.showInputBox({
          prompt: 'GitHub usernames (comma-separated)',
          placeHolder: 'alice, bob',
          ignoreFocusOut: true,
        });
        if (usersInput === undefined) { return; }
        users = usersInput
          .split(',')
          .map((u) => u.trim().replace(/^@/, ''))
          .filter((u) => u.length > 0);
      }

      type ExpiryPick = vscode.QuickPickItem & { days: number };
      const expiryPick = await vscode.window.showQuickPick<ExpiryPick>(
        [
          { label: '7 days', days: 7 },
          { label: '1 day', days: 1 },
          { label: '30 days', days: 30 },
          { label: '90 days', days: 90 },
          { label: 'No expiration', days: 0 },
        ],
        { placeHolder: 'Expiration', ignoreFocusOut: true }
      );
      if (!expiryPick) { return; }
      const expiresAt: string | undefined =
        expiryPick.days > 0
          ? new Date(Date.now() + expiryPick.days * 24 * 60 * 60 * 1000).toISOString()
          : undefined;

      type EditingPick = vscode.QuickPickItem & { value: boolean };
      const editingPick = await vscode.window.showQuickPick<EditingPick>(
        [
          { label: '$(eye) View and comment only', value: false },
          { label: '$(pencil) Allow editing', value: true },
        ],
        { placeHolder: 'Permission level', ignoreFocusOut: true }
      );
      if (!editingPick) { return; }
      const allowEditing = editingPick.value;

      try {
        // Authenticate and get Octokit
        const octokit = await api.getOctokit();

        // Identify the current user for sharedBy
        let sharedBy = 'unknown';
        try {
          const { data } = await octokit.users.getAuthenticated();
          sharedBy = data.login;
        } catch { /* best-effort */ }

        // Read existing .mdcolab/sharing.json (if any). Always read-merge-write
        // so we never clobber entries for other documents.
        const sharingPath = '.mdcolab/sharing.json';
        let existingSha: string | undefined;
        interface SharingDocument {
          mode: SharingMode;
          users?: string[];
          allowEditing?: boolean;
          expiresAt?: string;
          sharedBy: string;
          sharedAt: string;
        }
        interface SharingConfig {
          version: number;
          documents: Record<string, SharingDocument>;
        }
        let sharingConfig: SharingConfig = { version: 1, documents: {} };

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
            const parsed = JSON.parse(decoded) as Partial<SharingConfig>;
            sharingConfig = {
              version: parsed.version ?? 1,
              documents: parsed.documents ?? {},
            };
          }
        } catch (err: any) {
          if (err.status !== 404) { throw err; }
          // File doesn't exist yet — we'll create it
        }

        // Write/overwrite entry for this file
        sharingConfig.documents[relativePath] = {
          mode,
          users: mode === 'specific_people' ? users : undefined,
          allowEditing: allowEditing === true ? true : undefined,
          expiresAt,
          sharedBy,
          sharedAt: new Date().toISOString(),
        };

        const updatedContent = Buffer.from(
          JSON.stringify(sharingConfig, null, 2) + '\n'
        ).toString('base64');

        await octokit.repos.createOrUpdateFileContents({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          path: sharingPath,
          message: `docs: update sharing for ${relativePath}`,
          content: updatedContent,
          sha: existingSha,
          branch: repoInfo.branch,
        });

        // Copy the link
        const cfg = vscode.workspace.getConfiguration('mdcolab');
        const baseUrl = cfg.get<string>(
          'webAppUrl',
          'https://ca-web-v6zqqr2u3p5du.calmflower-64b2252f.eastus2.azurecontainerapps.io'
        );
        const url = buildMdcolabUrl(repoInfo, relativePath, baseUrl);
        const fileName = relativePath.split('/').pop() ?? relativePath;
        await vscode.env.clipboard.writeText(`[${fileName}](${url})`);

        const modeLabel = mode === 'anyone_with_link' ? 'Anyone with the link' : `${users.length} user${users.length === 1 ? '' : 's'}`;
        const permLabel = allowEditing ? 'can edit' : 'view/comment';
        vscode.window.showInformationMessage(
          `Shared (${modeLabel}, ${permLabel}). Link copied to clipboard.`
        );
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
