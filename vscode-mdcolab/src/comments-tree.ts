import * as vscode from 'vscode';
import { CommentThread as MdcolabThread, CommentReply } from './github-api.js';

export class CommentsTreeProvider implements vscode.TreeDataProvider<CommentTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommentTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private threads: MdcolabThread[] = [];
  private _activeIssueNumber?: number;

  setThreads(threads: MdcolabThread[]) {
    this.threads = threads;
    this._onDidChangeTreeData.fire();
  }

  get activeIssueNumber() { return this._activeIssueNumber; }

  setActiveThread(issueNumber: number | undefined) {
    this._activeIssueNumber = issueNumber;
    this._onDidChangeTreeData.fire();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommentTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommentTreeItem): Thenable<CommentTreeItem[]> {
    if (!element) {
      // Root level — show threads grouped by status
      const openThreads = this.threads.filter(t => t.state === 'open');
      const resolvedThreads = this.threads.filter(t => t.state === 'closed');

      const items: CommentTreeItem[] = [];

      if (openThreads.length > 0) {
        items.push(new SectionItem(`Open (${openThreads.length})`, openThreads));
      }
      if (resolvedThreads.length > 0) {
        items.push(new SectionItem(`Resolved (${resolvedThreads.length})`, resolvedThreads));
      }

      if (items.length === 0) {
        items.push(new EmptyItem());
      }

      return Promise.resolve(items);
    }

    if (element instanceof SectionItem) {
      return Promise.resolve(
        element.threads.map(t => new ThreadItem(t, t.issueNumber === this._activeIssueNumber))
      );
    }

    if (element instanceof ThreadItem) {
      const items: CommentTreeItem[] = [];
      // Show the main comment body
      items.push(new CommentBodyItem(element.thread.author, element.thread.body));
      // Show replies
      for (const reply of element.thread.replies) {
        items.push(new ReplyItem(reply));
      }
      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }
}

export type CommentTreeItem = SectionItem | ThreadItem | CommentBodyItem | ReplyItem | EmptyItem;

export class SectionItem extends vscode.TreeItem {
  constructor(public override label: string, public threads: MdcolabThread[]) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
  }
}

export class ThreadItem extends vscode.TreeItem {
  constructor(public thread: MdcolabThread, isActive: boolean) {
    const anchorText = thread.anchor.selectedText
      ? (thread.anchor.selectedText.length > 40
          ? thread.anchor.selectedText.slice(0, 40) + '…'
          : thread.anchor.selectedText)
      : 'General comment';

    super(`"${anchorText}"`, vscode.TreeItemCollapsibleState.Collapsed);

    this.description = `@${thread.author}`;
    this.tooltip = new vscode.MarkdownString(`**${thread.author}**: ${thread.body}`);
    this.contextValue = thread.state === 'open' ? 'openThread' : 'resolvedThread';

    this.iconPath = new vscode.ThemeIcon(
      thread.state === 'open' ? 'comment' : 'pass',
      isActive ? new vscode.ThemeColor('charts.purple') : undefined
    );

    this.command = {
      command: 'mdcolab.selectThread',
      title: 'Select Thread',
      arguments: [thread.issueNumber],
    };
  }
}

export class CommentBodyItem extends vscode.TreeItem {
  constructor(author: string, body: string) {
    const preview = body.length > 80 ? body.slice(0, 80) + '…' : body;
    super(preview, vscode.TreeItemCollapsibleState.None);
    this.description = `@${author}`;
    this.iconPath = new vscode.ThemeIcon('comment');
  }
}

export class ReplyItem extends vscode.TreeItem {
  constructor(reply: CommentReply) {
    const preview = reply.body.length > 80 ? reply.body.slice(0, 80) + '…' : reply.body;
    super(preview, vscode.TreeItemCollapsibleState.None);
    this.description = `@${reply.author}`;
    this.iconPath = new vscode.ThemeIcon('reply');
  }
}

export class EmptyItem extends vscode.TreeItem {
  constructor() {
    super('No comments yet', vscode.TreeItemCollapsibleState.None);
    this.description = 'Select text and use Ctrl+Alt+M to add a comment';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}
