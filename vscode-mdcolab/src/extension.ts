import * as vscode from 'vscode';
import * as path from 'path';
import { getRepoInfo, getRelativeFilePath, buildMdcolabUrl, RepoInfo } from './git-utils.js';
import * as api from './github-api.js';
import { findAnchorRanges, applyDecorations } from './comment-decorations.js';
import { CommentsTreeProvider } from './comments-tree.js';
import {
  SharedFilesTreeProvider,
  SharedFileItem,
} from './shared-files-tree.js';
import { MdcolabEditorPanel } from './mdcolab-editor-panel.js';
import { registerCopilotTools } from './copilot-tools.js';

// State
let currentThreads: api.CommentThread[] = [];
let currentRepoInfo: RepoInfo | null = null;
let currentFilePath = '';
let refreshTimer: ReturnType<typeof setInterval> | undefined;

interface SharingDocumentConfig {
  mode: 'anyone_with_link' | 'specific_people';
  users?: string[];
  allowEditing?: boolean;
  expiresAt?: string;
}

interface ThreadCommandItem {
  thread?: {
    issueNumber?: number;
  };
}

function isSupportedMdcolabDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'markdown' || document.languageId === 'html';
}

function isMarkdownDocumentUri(uri: vscode.Uri): boolean {
  return /\.(md|mdx)$/i.test(uri.fsPath);
}

function resolveFileContext(uri?: vscode.Uri): { repoInfo: RepoInfo; filePath: string } | null {
  const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!fileUri) {
    return currentRepoInfo ? { repoInfo: currentRepoInfo, filePath: currentFilePath } : null;
  }

  const repoInfo = getRepoInfo(fileUri);
  if (!repoInfo) return null;
  return {
    repoInfo,
    filePath: getRelativeFilePath(fileUri, repoInfo.rootPath),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function showGitHubWriteFailure(prefix: string, error: unknown): Promise<void> {
  if (api.isPrivateRepoAccessRequiredError(error)) {
    const choice = await vscode.window.showErrorMessage(
      `${prefix}: ${getErrorMessage(error)}`,
      'Enable Private Repo Access',
    );
    if (choice === 'Enable Private Repo Access') {
      await vscode.commands.executeCommand('mdcolab.enablePrivateRepoAccess');
    }
    return;
  }

  vscode.window.showErrorMessage(`${prefix}: ${getErrorMessage(error)}`);
}

function getCommandIssueNumber(item: ThreadCommandItem | number): number | undefined {
  return typeof item === 'number' ? item : item.thread?.issueNumber;
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('mdcolab extension activated');

  // Register Copilot language model tools
  registerCopilotTools(context);

  // Create tree providers
  const treeProvider = new CommentsTreeProvider();
  const treeView = vscode.window.createTreeView('mdcolab.commentsView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const sharedFilesProvider = new SharedFilesTreeProvider();
  const sharedFilesView = vscode.window.createTreeView('mdcolab.sharedFilesView', {
    treeDataProvider: sharedFilesProvider,
  });
  context.subscriptions.push(sharedFilesView);
  // Populate from workspace folder regardless of active editor, so the view
  // shows shared files as soon as the extension activates.
  sharedFilesProvider.autoDetectFromWorkspace();

  // --- Load comments for current file ---
  async function loadComments() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSupportedMdcolabDocument(editor.document)) {
      currentThreads = [];
      treeProvider.setThreads([]);
      sharedFilesProvider.setCurrentFilePath(null);
      return;
    }

    const fileUri = editor.document.uri;
    currentRepoInfo = getRepoInfo(fileUri);
    if (!currentRepoInfo) {
      currentThreads = [];
      treeProvider.setThreads([]);
      sharedFilesProvider.setContext(null, null);
      return;
    }

    currentFilePath = getRelativeFilePath(fileUri, currentRepoInfo.rootPath);
    sharedFilesProvider.setContext(
      {
        owner: currentRepoInfo.owner,
        repo: currentRepoInfo.repo,
        branch: currentRepoInfo.branch,
        rootPath: currentRepoInfo.rootPath,
      },
      currentFilePath
    );

    try {
      currentThreads = await api.fetchCommentThreads(
        currentRepoInfo.owner, currentRepoInfo.repo, currentFilePath
      );
      treeProvider.setThreads(currentThreads);

      // Apply source decorations for local text anchors. Rendered HTML anchors
      // are highlighted by the web preview, not the VS Code source editor.
      const anchorRanges = findAnchorRanges(editor.document, currentThreads);
      applyDecorations(editor, anchorRanges, treeProvider.activeIssueNumber);

      vscode.commands.executeCommand('setContext', 'mdcolab.hasComments', currentThreads.length > 0);
    } catch (err) {
      console.error('Failed to load mdcolab comments:', err);
    }
  }

  // --- Register commands ---

  // Open WYSIWYG Editor
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.openWysiwygEditor', (uri?: vscode.Uri) => {
      const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!fileUri) {
        vscode.window.showWarningMessage('Open a markdown file first');
        return;
      }
      if (!isMarkdownDocumentUri(fileUri)) {
        vscode.window.showInformationMessage('HTML files open in mdcolab web preview.');
        vscode.commands.executeCommand('mdcolab.openInMdcolab');
        return;
      }
      MdcolabEditorPanel.open(context.extensionUri, fileUri);
    })
  );

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
    vscode.commands.registerCommand('mdcolab.openInMdcolab', (uri?: vscode.Uri) => {
      const active = resolveFileContext(uri);
      if (!active) {
        vscode.window.showErrorMessage('Not a GitHub repository');
        return;
      }
      const config = vscode.workspace.getConfiguration('mdcolab');
      const baseUrl = config.get<string>('webAppUrl', 'https://ca-web-ai-preview.calmflower-64b2252f.eastus2.azurecontainerapps.io');
      const url = buildMdcolabUrl(active.repoInfo, active.filePath, baseUrl);
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  // Share Link
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.shareLink', async () => {
      const active = resolveFileContext();
      if (!active) {
        vscode.window.showErrorMessage('Not a GitHub repository');
        return;
      }
      const config = vscode.workspace.getConfiguration('mdcolab');
      const baseUrl = config.get<string>('webAppUrl', 'https://ca-web-ai-preview.calmflower-64b2252f.eastus2.azurecontainerapps.io');
      const url = buildMdcolabUrl(active.repoInfo, active.filePath, baseUrl);
      await vscode.env.clipboard.writeText(url);
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

      // Pre-check: is this file already shared? Surface it prominently so the
      // user isn't confused about state. They can still reshare to change
      // mode/expiry/permission.
      let existingDoc = sharedFilesProvider.getCurrentDocument();
      if (!existingDoc) {
        // Shared Files view may not yet be loaded for this repo — fetch inline.
        try {
          const octokitPre = await api.getOctokit(repoInfo.owner);
          const pre = await octokitPre.repos.getContent({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            path: '.mdcolab/sharing.json',
          });
          if (!Array.isArray(pre.data) && pre.data.type === 'file' && pre.data.content) {
            const parsed = JSON.parse(
              Buffer.from(pre.data.content, 'base64').toString('utf-8')
            ) as { documents?: Record<string, SharingDocumentConfig> };
            existingDoc = parsed.documents?.[relativePath] ?? null;
          }
        } catch {
          /* 404 or permission — treat as not shared */
        }
      }
      if (existingDoc) {
        const cfg0 = vscode.workspace.getConfiguration('mdcolab');
        const baseUrl0 = cfg0.get<string>(
          'webAppUrl',
          'https://ca-web-ai-preview.calmflower-64b2252f.eastus2.azurecontainerapps.io'
        );
        const url0 = buildMdcolabUrl(repoInfo, relativePath, baseUrl0);
        const fileName0 = relativePath.split('/').pop() ?? relativePath;
        const modeLabel0 =
          existingDoc.mode === 'anyone_with_link'
            ? 'anyone with the link'
            : `${existingDoc.users?.length ?? 0} specific user${
                existingDoc.users?.length === 1 ? '' : 's'
              }`;
        const expLabel = existingDoc.expiresAt
          ? `expires ${new Date(existingDoc.expiresAt).toLocaleDateString()}`
          : 'no expiration';
        const choice = await vscode.window.showInformationMessage(
          `Already shared with ${modeLabel0} (${expLabel}).`,
          'Copy link',
          'Update sharing',
          'Stop sharing'
        );
        if (choice === 'Copy link' || choice === undefined) {
          await vscode.env.clipboard.writeText(url0);
          if (choice === 'Copy link') {
            vscode.window.showInformationMessage('Link copied to clipboard.');
          }
          return;
        }
        if (choice === 'Stop sharing') {
          await vscode.commands.executeCommand('mdcolab.unshareFile', {
            filePath: relativePath,
            repoContext: {
              owner: repoInfo.owner,
              repo: repoInfo.repo,
              branch: repoInfo.branch,
            },
          });
          return;
        }
        // else fall through to prompts and overwrite
      }

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
        await api.withContentWriteAccess(repoInfo.owner, repoInfo.repo, async (octokit) => {
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
          } catch (err: unknown) {
            if ((err as { status?: number }).status !== 404) { throw err; }
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
          });
        });

        // Copy the link
        const cfg = vscode.workspace.getConfiguration('mdcolab');
        const baseUrl = cfg.get<string>(
          'webAppUrl',
          'https://ca-web-ai-preview.calmflower-64b2252f.eastus2.azurecontainerapps.io'
        );
        const url = buildMdcolabUrl(repoInfo, relativePath, baseUrl);
        await vscode.env.clipboard.writeText(url);

        // Refresh the Shared Files view so the new entry appears.
        sharedFilesProvider.refresh().catch(() => { /* best-effort */ });

        const modeLabel = mode === 'anyone_with_link' ? 'Anyone with the link' : `${users.length} user${users.length === 1 ? '' : 's'}`;
        const permLabel = allowEditing ? 'can edit' : 'view/comment';
        vscode.window.showInformationMessage(
          `Shared (${modeLabel}, ${permLabel}). Link copied to clipboard.`
        );
      } catch (err) {
        await showGitHubWriteFailure('Failed to share', err);
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
    vscode.commands.registerCommand('mdcolab.resolveThread', async (item: ThreadCommandItem | number) => {
      const issueNumber = getCommandIssueNumber(item);
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
    vscode.commands.registerCommand('mdcolab.reopenThread', async (item: ThreadCommandItem | number) => {
      const issueNumber = getCommandIssueNumber(item);
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

  // Save and push a shared file: save any dirty editor, git add/commit/push.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.saveAndPushFile',
      async (item?: SharedFileItem) => {
        if (!item) { return; }
        const rootPath = item.repoContext.rootPath;
        if (!rootPath) {
          vscode.window.showErrorMessage(
            'Local clone path not known; cannot push.'
          );
          return;
        }
        const absPath = vscode.Uri.file(
          path.join(rootPath, ...item.filePath.split('/'))
        );

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Saving and pushing ${item.filePath}…`,
          },
          async (progress) => {
            try {
              // 1. Save editor if dirty.
              progress.report({ message: 'Saving…' });
              const openDoc = vscode.workspace.textDocuments.find(
                (d) =>
                  d.uri.scheme === 'file' &&
                  d.uri.fsPath.toLowerCase() === absPath.fsPath.toLowerCase()
              );
              if (openDoc && openDoc.isDirty) {
                await openDoc.save();
              }

              const { execSync } = await import('child_process');
              const run = (cmd: string) =>
                execSync(cmd, {
                  cwd: rootPath,
                  encoding: 'utf-8',
                  stdio: ['ignore', 'pipe', 'pipe'],
                });

              // 2. Stage.
              progress.report({ message: 'Staging…' });
              run(`git add -- "${item.filePath}"`);

              // 3. Commit if there's anything staged for this file.
              const staged = run(
                `git diff --cached --name-only -- "${item.filePath}"`
              ).trim();
              if (staged.length > 0) {
                progress.report({ message: 'Committing…' });
                const fileName = item.filePath.split('/').pop() ?? item.filePath;
                run(
                  `git commit -m "docs: update ${fileName}" -- "${item.filePath}"`
                );
              }

              // 4. Push (always, in case prior commits are unpushed).
              progress.report({ message: 'Pushing…' });
              run('git push');

              vscode.window.showInformationMessage(
                `Pushed ${item.filePath}.`
              );
            } catch (err: unknown) {
              const stderr: string =
                (err as { stderr?: { toString?: () => string } })?.stderr?.toString?.() ??
                getErrorMessage(err);
              vscode.window.showErrorMessage(
                `Save & push failed: ${stderr.trim()}`
              );
            } finally {
              sharedFilesProvider.notifyStatusMayHaveChanged();
            }
          }
        );
      }
    )
  );

  // Helper to compute the mdcolab web URL for a shared-file item.
  function mdcolabUrlFor(item: SharedFileItem): string {
    const cfg = vscode.workspace.getConfiguration('mdcolab');
    const baseUrl = cfg.get<string>(
      'webAppUrl',
      'https://ca-web-ai-preview.calmflower-64b2252f.eastus2.azurecontainerapps.io'
    );
    return buildMdcolabUrl(
      { ...item.repoContext, rootPath: item.repoContext.rootPath ?? '' } as RepoInfo,
      item.filePath,
      baseUrl
    );
  }

  // Copy share link
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.copyShareLink',
      async (item?: SharedFileItem) => {
        if (!item) { return; }
        const url = mdcolabUrlFor(item);
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage('Share link copied.');
      }
    )
  );

  // Open shared file in browser (always web, never local)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.openSharedFileInBrowser',
      async (item?: SharedFileItem) => {
        if (!item) { return; }
        vscode.env.openExternal(vscode.Uri.parse(mdcolabUrlFor(item)));
      }
    )
  );

  // Open shared file's GitHub blob page
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.openSharedFileOnGitHub',
      async (item?: SharedFileItem) => {
        if (!item) { return; }
        const { owner, repo, branch } = item.repoContext;
        const url = `https://github.com/${owner}/${repo}/blob/${branch}/${item.filePath}`;
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    )
  );

  // Reveal the shared file in VS Code's file explorer
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.revealSharedFile',
      async (item?: SharedFileItem) => {
        if (!item) { return; }
        const rootPath = item.repoContext.rootPath;
        if (!rootPath) {
          vscode.window.showWarningMessage(
            'File not in a local clone — cannot reveal.'
          );
          return;
        }
        const abs = vscode.Uri.file(
          path.join(rootPath, ...item.filePath.split('/'))
        );
        await vscode.commands.executeCommand('revealInExplorer', abs);
      }
    )
  );

  // Copy link to a comment thread (points at the GitHub issue)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.copyThreadLink',
      async (item: ThreadCommandItem) => {
        const issueNumber = item?.thread?.issueNumber;
        if (!currentRepoInfo || !issueNumber) { return; }
        const url = `https://github.com/${currentRepoInfo.owner}/${currentRepoInfo.repo}/issues/${issueNumber}`;
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage('Comment link copied.');
      }
    )
  );

  // Open a thread's issue on GitHub
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.openThreadOnGitHub',
      async (item: ThreadCommandItem) => {
        const issueNumber = item?.thread?.issueNumber;
        if (!currentRepoInfo || !issueNumber) { return; }
        const url = `https://github.com/${currentRepoInfo.owner}/${currentRepoInfo.repo}/issues/${issueNumber}`;
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    )
  );

  // Enable private repo access (triggered from Shared Files info item)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.enablePrivateRepoAccess',
      async () => {
        await vscode.workspace
          .getConfiguration('mdcolab')
          .update(
            'privateRepoAccess',
            true,
            vscode.ConfigurationTarget.Global
          );
        // Force a fresh auth session with the wider `repo` scope.
        try {
          await vscode.authentication.getSession('github', ['repo'], {
            createIfNone: true,
          });
        } catch {
          /* user cancelled — refresh will show error next time */
        }
        await sharedFilesProvider.refresh();
        loadComments().catch(() => { /* best effort */ });
      }
    )
  );

  // Refresh Shared Files
  context.subscriptions.push(
    vscode.commands.registerCommand('mdcolab.refreshSharedFiles', () =>
      sharedFilesProvider.refresh()
    )
  );

  // Open Shared File (tree item click)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.openSharedFile',
      async (item?: SharedFileItem) => {
        if (!item) { return; }

        // Try to resolve the local file path from the repo's known rootPath
        // (or the currently active repo if it matches).
        const rootPath =
          item.repoContext.rootPath ||
          (currentRepoInfo &&
          currentRepoInfo.owner === item.repoContext.owner &&
          currentRepoInfo.repo === item.repoContext.repo
            ? currentRepoInfo.rootPath
            : undefined);

        const isMarkdown = /\.(md|mdx)$/i.test(item.filePath);

        if (rootPath) {
          const localUri = vscode.Uri.file(
            path.join(rootPath, ...item.filePath.split('/'))
          );
          try {
            // Verify the file actually exists locally before opening
            await vscode.workspace.fs.stat(localUri);
            if (isMarkdown) {
              // Open in mdcolab WYSIWYG editor
              MdcolabEditorPanel.open(context.extensionUri, localUri);
            } else {
              const doc = await vscode.workspace.openTextDocument(localUri);
              await vscode.window.showTextDocument(doc);
            }
            return;
          } catch {
            // File not found locally — fall through to web URL
          }
        }

        // Fall back to the web app
        const cfg = vscode.workspace.getConfiguration('mdcolab');
        const baseUrl = cfg.get<string>(
          'webAppUrl',
          'https://ca-web-ai-preview.calmflower-64b2252f.eastus2.azurecontainerapps.io'
        );
        const url = buildMdcolabUrl(
          { ...item.repoContext, rootPath: '' } as RepoInfo,
          item.filePath,
          baseUrl
        );
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    )
  );

  // Unshare (stop sharing) from the Shared Files view
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdcolab.unshareFile',
      async (item?: SharedFileItem) => {
        if (!item) { return; }
        const confirm = await vscode.window.showWarningMessage(
          `Stop sharing "${item.filePath}"?`,
          { modal: true },
          'Stop sharing'
        );
        if (confirm !== 'Stop sharing') { return; }
        try {
          await api.withContentWriteAccess(
            item.repoContext.owner,
            item.repoContext.repo,
            async (octokit) => {
              const sharingPath = '.mdcolab/sharing.json';
              const { data } = await octokit.repos.getContent({
                owner: item.repoContext.owner,
                repo: item.repoContext.repo,
                path: sharingPath,
              });
              if (Array.isArray(data) || data.type !== 'file' || !data.content) {
                throw new Error('sharing.json not found');
              }
              const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
              const parsed = JSON.parse(decoded) as {
                version?: number;
                documents: Record<string, unknown>;
              };
              delete parsed.documents[item.filePath];
              const remaining = Object.keys(parsed.documents).length;
              if (remaining === 0) {
                await octokit.repos.deleteFile({
                  owner: item.repoContext.owner,
                  repo: item.repoContext.repo,
                  path: sharingPath,
                  message: 'docs: remove sharing config',
                  sha: data.sha,
                });
              } else {
                await octokit.repos.createOrUpdateFileContents({
                  owner: item.repoContext.owner,
                  repo: item.repoContext.repo,
                  path: sharingPath,
                  message: `docs: stop sharing ${item.filePath}`,
                  content: Buffer.from(
                    JSON.stringify(parsed, null, 2) + '\n'
                  ).toString('base64'),
                  sha: data.sha,
                });
              }
            },
          );
          await sharedFilesProvider.refresh();
          vscode.window.showInformationMessage(
            `Stopped sharing ${item.filePath}`
          );
        } catch (err) {
          await showGitHubWriteFailure('Failed to unshare', err);
        }
      }
    )
  );

  // --- Event listeners ---

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      loadComments().catch((err) =>
        console.error('loadComments failed:', err)
      );
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isSupportedMdcolabDocument(doc)) {
        loadComments().catch((err) =>
          console.error('loadComments failed:', err)
        );
      }
      // Saving a file may flip its unsaved/uncommitted status.
      sharedFilesProvider.notifyStatusMayHaveChanged();
    })
  );

  // A document becoming dirty/clean is reflected in the tree without a
  // sharing.json refetch. Debounce since onDidChange fires per-keystroke.
  let dirtyTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.scheme !== 'file') { return; }
      if (dirtyTimer) { clearTimeout(dirtyTimer); }
      dirtyTimer = setTimeout(
        () => sharedFilesProvider.notifyStatusMayHaveChanged(),
        400
      );
    })
  );

  // Auto-refresh timer
  const config = vscode.workspace.getConfiguration('mdcolab');
  const interval = config.get<number>('autoRefreshInterval', 30);
  if (interval > 0) {
    refreshTimer = setInterval(
      () =>
        loadComments().catch((err) =>
          console.error('loadComments failed:', err)
        ),
      interval * 1000
    );
    context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });
  }

  // Initial load — fire and forget so activate() returns promptly and all
  // commands are immediately available from the tree view / palette.
  loadComments().catch((err) => console.error('Initial loadComments failed:', err));
}

export function deactivate() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
}
