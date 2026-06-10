import * as vscode from 'vscode';
import * as path from 'path';
import * as api from './github-api.js';
import { getRepoInfo, getFileStatus, FileStatus, RepoInfo } from './git-utils.js';
import { resolveStorageTarget } from './central-storage.js';

export interface SharingDocument {
  mode: 'anyone_with_link' | 'specific_people';
  users?: string[];
  allowEditing?: boolean;
  expiresAt?: string;
  sharedBy?: string;
  sharedAt?: string;
}

export interface SharingConfig {
  version?: number;
  documents: Record<string, SharingDocument>;
}

export interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  rootPath?: string; // local clone path, if available
}

export class SharedFilesTreeProvider
  implements vscode.TreeDataProvider<SharedFilesItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    SharedFilesItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private repoContext: RepoContext | null = null;
  private config: SharingConfig | null = null;
  private loadError: string | null = null;
  private loading = false;
  private currentFilePath: string | null = null;

  setContext(repoContext: RepoContext | null, currentFilePath: string | null) {
    // Don't lose the auto-detected repo context just because the user
    // focused a non-markdown tab or a file outside the workspace.
    const prev = this.repoContext;
    if (repoContext) {
      // Preserve previously-known rootPath if the new context doesn't
      // include one (e.g. loadComments may pass a RepoContext derived from
      // a different source). Without rootPath we can't compute local file
      // status, so clobbering it would silently disable dirty indicators.
      this.repoContext = {
        ...repoContext,
        rootPath: repoContext.rootPath ?? prev?.rootPath,
      };
    }
    this.currentFilePath = currentFilePath;
    this._onDidChangeTreeData.fire();
    const repoChanged =
      !!repoContext &&
      (!prev ||
        prev.owner !== repoContext.owner ||
        prev.repo !== repoContext.repo ||
        prev.branch !== repoContext.branch);
    if (repoChanged || (!prev && this.repoContext)) {
      void this.load();
    }
  }

  /**
   * Detect the repo from the first workspace folder that is a GitHub clone.
   * Called on activation so the view populates even if no markdown file is
   * yet open (or if activation was triggered by opening the view itself).
   */
  autoDetectFromWorkspace() {
    if (this.repoContext) { return; }
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const probe = vscode.Uri.joinPath(folder.uri, '.mdcolab');
      const info: RepoInfo | null = getRepoInfo(probe);
      if (info) {
        this.repoContext = {
          owner: info.owner,
          repo: info.repo,
          branch: info.branch,
          rootPath: info.rootPath,
        };
        this._onDidChangeTreeData.fire();
        void this.load();
        return;
      }
    }
  }

  /**
   * Re-fire tree data without re-fetching sharing.json. Cheap — used to
   * pick up changes in per-file dirty/uncommitted/unpushed status after
   * editor save, document change, etc.
   */
  notifyStatusMayHaveChanged() {
    this._onDidChangeTreeData.fire();
  }

  setCurrentFilePath(filePath: string | null) {
    this.currentFilePath = filePath;
    this._onDidChangeTreeData.fire();
  }

  getCurrentDocument(): SharingDocument | null {
    if (!this.currentFilePath || !this.config) { return null; }
    return this.config.documents[this.currentFilePath] ?? null;
  }

  private needsPrivateAccess = false;

  async refresh() {
    await this.load();
  }

  private async load() {
    if (!this.repoContext) {
      this.config = null;
      this.loadError = null;
      this._onDidChangeTreeData.fire();
      return;
    }
    this.loading = true;
    this.loadError = null;
    this.needsPrivateAccess = false;
    this._onDidChangeTreeData.fire();
    try {
      const octokit = await api.getOctokit(this.repoContext.owner);
      const target = await resolveStorageTarget(
        octokit,
        this.repoContext.owner,
        this.repoContext.repo,
      );
      // Don't pin to the user's local branch — sharing.json lives on the
      // metadata repo's default branch; the caller's working branch may not
      // contain the file at all. Omitting `ref` uses the default branch.
      const { data } = await octokit.repos.getContent({
        owner: target.owner,
        repo: target.repo,
        path: target.sharingPath,
      });
      if (!Array.isArray(data) && data.type === 'file' && data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
        this.config = JSON.parse(decoded);
      } else {
        this.config = { documents: {} };
      }
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 404) {
        // A 404 under `public_repo` scope could mean either "the file does
        // not exist" OR "the whole repo is private and invisible to us".
        // Disambiguate by probing the repo itself. If that also 404s and
        // the user hasn't granted `repo` scope yet, tell them how to fix it.
        const hasPrivate = vscode.workspace
          .getConfiguration('mdcolab')
          .get<boolean>('privateRepoAccess', false);
        if (!hasPrivate) {
          try {
            const octokit2 = await api.getOctokit(this.repoContext.owner);
            await octokit2.repos.get({
              owner: this.repoContext.owner,
              repo: this.repoContext.repo,
            });
            // Repo is visible → file genuinely doesn't exist.
            this.config = { documents: {} };
          } catch (probeErr: unknown) {
            if ((probeErr as { status?: number })?.status === 404) {
              this.needsPrivateAccess = true;
              this.config = null;
            } else {
              this.config = { documents: {} };
            }
          }
        } else {
          this.config = { documents: {} };
        }
      } else {
        this.config = null;
        this.loadError = err instanceof Error ? err.message : String(err);
      }
    } finally {
      this.loading = false;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(el: SharedFilesItem): vscode.TreeItem {
    return el;
  }

  getChildren(element?: SharedFilesItem): SharedFilesItem[] {
    if (element) { return []; }
    if (!this.repoContext) {
      return [new InfoItem('Open a file in a GitHub repo to see shares', 'info')];
    }
    if (this.loading) {
      return [new InfoItem('Loading…', 'loading~spin')];
    }
    if (this.loadError) {
      return [new InfoItem(`Failed to load: ${this.loadError}`, 'error')];
    }
    if (this.needsPrivateAccess) {
      const item = new InfoItem(
        'Private repo — click to grant access',
        'lock'
      );
      item.command = {
        command: 'mdcolab.enablePrivateRepoAccess',
        title: 'Enable private repo access',
      };
      return [item];
    }
    const entries = Object.entries(this.config?.documents ?? {});
    if (entries.length === 0) {
      return [new InfoItem('No files shared yet', 'info')];
    }
    const now = Date.now();
    const rootPath = this.repoContext.rootPath;
    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([p, doc]) =>
          new SharedFileItem(p, doc, this.repoContext!, {
            isCurrent: p === this.currentFilePath,
            isExpired: !!(doc.expiresAt && new Date(doc.expiresAt).getTime() <= now),
            status: rootPath ? getFileStatus(rootPath, p) : undefined,
          })
      );
  }
}

export type SharedFilesItem = SharedFileItem | InfoItem;

export class SharedFileItem extends vscode.TreeItem {
  public readonly status?: FileStatus;

  constructor(
    public readonly filePath: string,
    public readonly doc: SharingDocument,
    public readonly repoContext: RepoContext,
    opts: {
      isCurrent: boolean;
      isExpired: boolean;
      status?: FileStatus;
    }
  ) {
    super(filePath, vscode.TreeItemCollapsibleState.None);
    this.status = opts.status;

    const fileName = filePath.split('/').pop() ?? filePath;
    this.label = fileName;
    const dirName = filePath.includes('/')
      ? filePath.slice(0, filePath.lastIndexOf('/'))
      : '';

    // Pointing resourceUri at the actual local file lets VS Code's built-in
    // SCM file decorations paint the filename in the standard "modified"
    // colour and overlay the M/U/A badge — the same treatment users know
    // from the Explorer. This survives long filenames because the colour is
    // on the label itself, not a trailing description.
    if (opts.status?.exists && repoContext.rootPath) {
      const absPath = path.join(
        repoContext.rootPath,
        ...filePath.split('/')
      );
      this.resourceUri = vscode.Uri.file(absPath);
    }

    // Status indicators: ● unsaved, ◆ uncommitted, ↑ unpushed.
    const statusBits: string[] = [];
    if (opts.status?.unsaved) { statusBits.push('● unsaved'); }
    if (opts.status?.uncommitted) { statusBits.push('◆ uncommitted'); }
    if (opts.status?.unpushed) { statusBits.push('↑ unpushed'); }
    const statusLabel = statusBits.join('  ');

    // Description pattern: "<dir>   <status>"
    this.description =
      dirName && statusLabel
        ? `${dirName}   ${statusLabel}`
        : statusLabel
          ? statusLabel
          : dirName || undefined;

    const modeLabel =
      doc.mode === 'anyone_with_link'
        ? 'Anyone with link'
        : `${doc.users?.length ?? 0} user${
            doc.users?.length === 1 ? '' : 's'
          }`;
    const permLabel = doc.allowEditing ? 'edit' : 'view/comment';
    const expiry = doc.expiresAt
      ? opts.isExpired
        ? `expired ${new Date(doc.expiresAt).toLocaleDateString()}`
        : `expires ${new Date(doc.expiresAt).toLocaleDateString()}`
      : 'no expiry';

    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${filePath}**\n\n`);
    tooltip.appendMarkdown(`- Mode: ${modeLabel}\n`);
    tooltip.appendMarkdown(`- Permission: ${permLabel}\n`);
    tooltip.appendMarkdown(`- ${expiry}\n`);
    if (doc.sharedBy) {
      tooltip.appendMarkdown(`- Shared by: @${doc.sharedBy}\n`);
    }
    if (opts.status) {
      if (!opts.status.exists) {
        tooltip.appendMarkdown(`- Status: not in local clone\n`);
      } else if (statusBits.length > 0) {
        tooltip.appendMarkdown(`- Status: **${statusBits.join(', ')}**\n`);
        tooltip.appendMarkdown(`\n_Action required: click ☁ to save & push_\n`);
      } else {
        tooltip.appendMarkdown(`- Status: clean (saved, committed, pushed)\n`);
      }
    }
    this.tooltip = tooltip;

    // Dirty files get a prominent warning-triangle icon in the theme's
    // warning colour. That overrides the mode glyph so it's impossible to
    // miss, even when the filename is long and the description is
    // truncated. Current-file purple tint takes precedence for clean files
    // so the user can still see which one is active.
    const isDirty =
      !!opts.status &&
      (opts.status.unsaved || opts.status.uncommitted || opts.status.unpushed);

    let icon: vscode.ThemeIcon;
    if (opts.isExpired) {
      icon = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('charts.red')
      );
    } else if (isDirty) {
      icon = new vscode.ThemeIcon(
        'circle-large-filled',
        new vscode.ThemeColor('editorWarning.foreground')
      );
    } else {
      icon = new vscode.ThemeIcon(
        doc.mode === 'anyone_with_link' ? 'globe' : 'lock'
      );
    }
    this.iconPath = icon;

    // contextValue drives which inline buttons show in view/item/context.
    // `sharedFileDirty` adds the "save and push" icon; others remain.
    const base = opts.isExpired ? 'sharedFileExpired' : 'sharedFile';
    this.contextValue = isDirty && opts.status?.exists ? `${base}Dirty` : base;

    this.command = {
      command: 'mdcolab.openSharedFile',
      title: 'Open',
      arguments: [this],
    };
  }
}

export class InfoItem extends vscode.TreeItem {
  constructor(label: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}
