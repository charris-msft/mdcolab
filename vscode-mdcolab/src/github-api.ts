import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';

const LABEL = 'mdcolab';

export interface CommentAnchor {
  type: 'text-range' | 'document';
  selectedText: string;
  context: { before: string; after: string };
}

export interface IssueMetadata {
  file: string;
  anchor: CommentAnchor;
}

export interface CommentThread {
  issueNumber: number;
  title: string;
  state: 'open' | 'closed';
  anchor: CommentAnchor;
  filePath: string;
  author: string;
  body: string;
  createdAt: string;
  replies: CommentReply[];
}

export interface CommentReply {
  id: number;
  author: string;
  body: string;
  createdAt: string;
}

async function getOctokit(): Promise<Octokit> {
  const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
  if (!session) {
    throw new Error('GitHub authentication required');
  }
  return new Octokit({ auth: session.accessToken });
}

/** @internal exported for unit testing */
export function parseMetadata(body: string): IssueMetadata | null {
  const match = body.match(/<!--\s*mdcolab-metadata\s*\n([\s\S]*?)\n\s*-->/);
  if (!match) { return null; }
  try {
    return JSON.parse(match[1]) as IssueMetadata;
  } catch {
    return null;
  }
}

/** @internal exported for unit testing */
export function extractCommentBody(body: string): string {
  return body.replace(/<!--\s*mdcolab-metadata\s*\n[\s\S]*?\n\s*-->\s*\n*/, '').trim();
}

/** @internal exported for unit testing */
export function buildIssueBody(anchor: CommentAnchor, commentBody: string, filePath: string): string {
  const meta: IssueMetadata = { file: filePath, anchor };
  return `<!-- mdcolab-metadata\n${JSON.stringify(meta, null, 2)}\n-->\n\n${commentBody}`;
}

export async function fetchCommentThreads(owner: string, repo: string, filePath: string): Promise<CommentThread[]> {
  const octokit = await getOctokit();
  const threads: CommentThread[] = [];

  // Try fetching by mdcolab label, then filter by file path in metadata
  try {
    const allIssues: any[] = [];
    for (const state of ['open', 'closed'] as const) {
      let page = 1;
      while (true) {
        const { data } = await octokit.issues.listForRepo({
          owner, repo, labels: LABEL, state, per_page: 100, page,
        });
        if (data.length === 0) { break; }
        allIssues.push(...data);
        if (data.length < 100) { break; }
        page++;
      }
    }

    // Filter by file path using metadata
    const fileIssues = allIssues.filter(issue => {
      const meta = parseMetadata(issue.body ?? '');
      return meta?.file === filePath;
    });

    // Fetch comments for each issue
    for (const issue of fileIssues) {
      const meta = parseMetadata(issue.body ?? '');
      if (!meta) { continue; }

      const { data: comments } = await octokit.issues.listComments({
        owner, repo, issue_number: issue.number, per_page: 100,
      });

      threads.push({
        issueNumber: issue.number,
        title: issue.title,
        state: issue.state === 'open' ? 'open' : 'closed',
        anchor: meta.anchor,
        filePath: meta.file,
        author: issue.user?.login ?? 'unknown',
        body: extractCommentBody(issue.body ?? ''),
        createdAt: issue.created_at,
        replies: comments.map(c => ({
          id: c.id,
          author: c.user?.login ?? 'unknown',
          body: c.body ?? '',
          createdAt: c.created_at,
        })),
      });
    }
  } catch (err) {
    console.error('Failed to fetch mdcolab comments:', err);
  }

  // If no results by label, try search API
  if (threads.length === 0) {
    try {
      const searchOctokit = await getOctokit();
      const { data } = await searchOctokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:issue "[mdcolab]" in:title`,
        per_page: 100,
      });
      for (const item of data.items) {
        const meta = parseMetadata(item.body ?? '');
        if (!meta || meta.file !== filePath) { continue; }

        const { data: comments } = await searchOctokit.issues.listComments({
          owner, repo, issue_number: item.number, per_page: 100,
        });

        threads.push({
          issueNumber: item.number,
          title: item.title,
          state: item.state === 'open' ? 'open' : 'closed',
          anchor: meta.anchor,
          filePath: meta.file,
          author: item.user?.login ?? 'unknown',
          body: extractCommentBody(item.body ?? ''),
          createdAt: item.created_at,
          replies: comments.map(c => ({
            id: c.id,
            author: c.user?.login ?? 'unknown',
            body: c.body ?? '',
            createdAt: c.created_at,
          })),
        });
      }
    } catch {
      // Search failed — no comments available
    }
  }

  return threads;
}

export async function createCommentThread(
  owner: string, repo: string, filePath: string, anchor: CommentAnchor, body: string
): Promise<CommentThread | null> {
  const octokit = await getOctokit();

  // Best-effort label creation
  const labels: string[] = [];
  try {
    await octokit.issues.getLabel({ owner, repo, name: LABEL }).catch(async () => {
      await octokit.issues.createLabel({ owner, repo, name: LABEL, color: '7B61FF', description: 'mdcolab comment threads' });
    });
    labels.push(LABEL);
  } catch { /* skip */ }

  const pathLabel = `path:${filePath}`;
  try {
    await octokit.issues.getLabel({ owner, repo, name: pathLabel }).catch(async () => {
      await octokit.issues.createLabel({ owner, repo, name: pathLabel, color: '0E8A16', description: `mdcolab path ${filePath}` });
    });
    labels.push(pathLabel);
  } catch { /* skip */ }

  const selectedText = anchor.selectedText || 'General comment';
  const truncated = selectedText.length > 50 ? selectedText.slice(0, 50) + '…' : selectedText;
  const title = `[mdcolab] "${truncated}" — ${filePath}`;

  const { data: issue } = await octokit.issues.create({
    owner, repo, title,
    body: buildIssueBody(anchor, body, filePath),
    labels: labels.length > 0 ? labels : undefined,
  });

  return {
    issueNumber: issue.number,
    title: issue.title,
    state: 'open',
    anchor,
    filePath,
    author: issue.user?.login ?? 'unknown',
    body,
    createdAt: issue.created_at,
    replies: [],
  };
}

export async function replyToThread(owner: string, repo: string, issueNumber: number, body: string): Promise<CommentReply | null> {
  const octokit = await getOctokit();
  const { data } = await octokit.issues.createComment({
    owner, repo, issue_number: issueNumber, body,
  });
  return {
    id: data.id,
    author: data.user?.login ?? 'unknown',
    body: data.body ?? '',
    createdAt: data.created_at,
  };
}

export async function resolveThread(owner: string, repo: string, issueNumber: number): Promise<void> {
  const octokit = await getOctokit();
  await octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' });
}

export async function reopenThread(owner: string, repo: string, issueNumber: number): Promise<void> {
  const octokit = await getOctokit();
  await octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'open' });
}
