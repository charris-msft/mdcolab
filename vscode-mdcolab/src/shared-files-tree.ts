import * as vscode from 'vscode';
import * as api from './github-api.js';

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
    this.repoContext = repoContext;
    this.currentFilePath = currentFilePath;
    this._onDidChangeTreeData.fire();
    void this.load();
  }

  setCurrentFilePath(filePath: string | null) {
    this.currentFilePath = filePath;
    this._onDidChangeTreeData.fire();
  }

  getCurrentDocument(): SharingDocument | null {
    if (!this.currentFilePath || !this.config) { return null; }
    return this.config.documents[this.currentFilePath] ?? null;
  }

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
    this._onDidChangeTreeData.fire();
    try {
      const octokit = await api.getOctokit();
      const { data } = await octokit.repos.getContent({
        owner: this.repoContext.owner,
        repo: this.repoContext.repo,
        path: '.mdcolab/sharing.json',
        ref: this.repoContext.branch,
      });
      if (!Array.isArray(data) && data.type === 'file' && data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
        this.config = JSON.parse(decoded);
      } else {
        this.config = { documents: {} };
      }
    } catch (err: any) {
      if (err?.status === 404) {
        this.config = { documents: {} };
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
    const entries = Object.entries(this.config?.documents ?? {});
    if (entries.length === 0) {
      return [new InfoItem('No files shared yet', 'info')];
    }
    const now = Date.now();
    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([path, doc]) =>
          new SharedFileItem(path, doc, this.repoContext!, {
            isCurrent: path === this.currentFilePath,
            isExpired: !!(doc.expiresAt && new Date(doc.expiresAt).getTime() <= now),
          })
      );
  }
}

export type SharedFilesItem = SharedFileItem | InfoItem;

export class SharedFileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly doc: SharingDocument,
    public readonly repoContext: RepoContext,
    opts: { isCurrent: boolean; isExpired: boolean }
  ) {
    super(filePath, vscode.TreeItemCollapsibleState.None);

    const fileName = filePath.split('/').pop() ?? filePath;
    this.label = fileName;
    this.description = filePath.includes('/')
      ? filePath.slice(0, filePath.lastIndexOf('/'))
      : undefined;

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
    this.tooltip = tooltip;

    this.iconPath = new vscode.ThemeIcon(
      opts.isExpired
        ? 'warning'
        : doc.mode === 'anyone_with_link'
          ? 'globe'
          : 'lock',
      opts.isCurrent ? new vscode.ThemeColor('charts.purple') : undefined
    );

    this.contextValue = opts.isExpired ? 'sharedFileExpired' : 'sharedFile';

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
