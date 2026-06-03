import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';

const LABEL = 'mdcolab';
type GitHubIssue = Awaited<ReturnType<Octokit['issues']['listForRepo']>>['data'][number];

export interface CommentAnchor {
  type: 'text-range' | 'html-range' | 'document';
  selectedText: string;
  context: { before: string; after: string };
  html?: {
    domPath: string;
    textQuote: string;
    fileSha?: string;
    status?: 'exact' | 'moved' | 'orphaned';
  };
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

/**
 * Org → GitHub account mapping for multi-account support.
 * When the repo owner matches an org key, we request a session for that specific account.
 */
interface OrgAccountMapping {
  org: string;
  account: string;
}

function getOrgAccountMappings(): OrgAccountMapping[] {
  const config = vscode.workspace.getConfiguration('mdcolab');
  const mappings = config.get<Array<{ org: string; account: string }>>('orgAccountMappings', []);
  return mappings;
}

function getScopes(): string[] {
  const usePrivate = vscode.workspace.getConfiguration('mdcolab').get<boolean>('privateRepoAccess', false);
  return usePrivate ? ['repo'] : ['public_repo'];
}

/**
 * Per-owner override of the GitHub account to authenticate with. Populated when
 * the user resolves an access error by choosing a different account. Kept in
 * memory for the lifetime of the extension host so subsequent comment
 * operations on the same owner reuse the working account without re-prompting.
 */
const accountOverrides = new Map<string, vscode.AuthenticationSessionAccountInformation>();

function setAccountOverride(owner: string, account: vscode.AuthenticationSessionAccountInformation): void {
  accountOverrides.set(owner.toLowerCase(), account);
}

/**
 * True when an error represents a GitHub access/permission failure. GitHub
 * returns 404 (not 403) when the authenticated account lacks access to a repo,
 * so a "Not Found" on a write operation is treated as an access error.
 */
export function isAccessError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 401 || status === 403 || status === 404;
}

interface RepoAccessResult {
  ok: boolean;
  reason?: string;
}

/**
 * Checks whether the given account can create/manage issues in owner/repo.
 * Used both to verify a newly chosen account and to distinguish a true access
 * problem from an issue-specific 404 before prompting for an account switch.
 */
async function checkRepoIssueAccess(octokit: Octokit, owner: string, repo: string): Promise<RepoAccessResult> {
  try {
    const { data } = await octokit.repos.get({ owner, repo });
    if (data.has_issues === false) {
      return { ok: false, reason: 'Issues are disabled for this repository.' };
    }
    const p = data.permissions;
    // Issue creation/management requires more than read access. If GitHub
    // reports permissions and none grant write, this account can't comment.
    if (p && !(p.admin || p.maintain || p.push || p.triage)) {
      return { ok: false, reason: 'This account does not have permission to create or manage issues in this repository.' };
    }
    return { ok: true };
  } catch (err) {
    if (isAccessError(err)) {
      return { ok: false, reason: 'This account cannot access the repository.' };
    }
    // Non-access error (e.g. network): let the real operation surface it.
    return { ok: true };
  }
}

/**
 * Get an authenticated Octokit instance.
 * When `owner` is provided and matches an org-account mapping, requests a session
 * for the mapped GitHub account. Otherwise uses the default account.
 */
export async function getOctokit(owner?: string): Promise<Octokit> {
  const scopes = getScopes();

  // Check if this owner requires a specific account
  const sessionOptions: { createIfNone: true; account?: { id: string; label: string } } = { createIfNone: true };

  if (owner) {
    // A user-chosen account override (set after resolving an access error) wins.
    const override = accountOverrides.get(owner.toLowerCase());
    if (override) {
      try {
        const session = await vscode.authentication.getSession('github', scopes, {
          account: override,
          createIfNone: false,
        });
        if (session) {
          return new Octokit({ auth: session.accessToken });
        }
      } catch {
        /* fall through */
      }
      // Override can no longer produce a session (revoked/scope change): drop it.
      accountOverrides.delete(owner.toLowerCase());
    }

    const mappings = getOrgAccountMappings();
    const mapping = mappings.find((m) => m.org.toLowerCase() === owner.toLowerCase());
    if (mapping) {
      // Try to find an existing session for this account
      const existingSessions = await vscode.authentication.getSession('github', scopes, { createIfNone: false });
      if (existingSessions && existingSessions.account.label.toLowerCase() === mapping.account.toLowerCase()) {
        return new Octokit({ auth: existingSessions.accessToken });
      }

      // Prompt for the right account
      let session: vscode.AuthenticationSession | undefined;
      try {
        session = await vscode.authentication.getSession('github', scopes, {
          createIfNone: true,
          account: { id: mapping.account, label: mapping.account },
        });
      } catch {
        session = undefined;
      }

      if (session) {
        return new Octokit({ auth: session.accessToken });
      }

      // Fall back to prompting user
      const choice = await vscode.window.showWarningMessage(
        `The repo "${owner}" requires the "${mapping.account}" GitHub account. Please sign into VS Code with that account.`,
        'Sign In',
        'Continue Anyway',
      );
      if (choice === 'Sign In') {
        const newSession = await vscode.authentication.getSession('github', scopes, {
          createIfNone: true,
          forceNewSession: { detail: `Sign in with your "${mapping.account}" account for ${owner} org access.` },
        });
        if (newSession) {
          return new Octokit({ auth: newSession.accessToken });
        }
      }
    }
  }

  // Default: use whatever account is signed in
  const session = await vscode.authentication.getSession('github', scopes, sessionOptions);
  if (!session) {
    throw new Error('GitHub authentication required');
  }
  return new Octokit({ auth: session.accessToken });
}

type AccountQuickPickItem = vscode.QuickPickItem & {
  account?: vscode.AuthenticationSessionAccountInformation;
  signIn?: boolean;
};

/**
 * Prompts the user to pick a GitHub account that can create/manage issues in
 * owner/repo. They may choose any account already connected to VS Code, or sign
 * in with a new one. The chosen account is verified against the repo and
 * remembered for the owner. Returns an authenticated Octokit, or null if the
 * user cancels.
 */
export async function promptAccountForAccess(
  owner: string,
  repo: string,
  reason?: string,
): Promise<Octokit | null> {
  const scopes = getScopes();
  let detail = reason ?? `The signed-in GitHub account can't create comments (issues) in ${owner}/${repo}.`;

  while (true) {
    let accounts: readonly vscode.AuthenticationSessionAccountInformation[] = [];
    try {
      accounts = await vscode.authentication.getAccounts('github');
    } catch {
      accounts = [];
    }

    const seen = new Set<string>();
    const items: AccountQuickPickItem[] = [];
    for (const account of accounts) {
      if (seen.has(account.id)) { continue; }
      seen.add(account.id);
      items.push({ label: `$(account) ${account.label}`, account });
    }
    items.push({ label: '$(add) Sign in with a different GitHub account…', signIn: true });

    const pick = await vscode.window.showQuickPick(items, {
      title: `Select a GitHub account for ${owner}/${repo}`,
      placeHolder: detail,
      ignoreFocusOut: true,
    });
    if (!pick) {
      return null;
    }

    let session: vscode.AuthenticationSession | undefined;
    try {
      if (pick.signIn) {
        session = await vscode.authentication.getSession('github', scopes, {
          forceNewSession: { detail: `Sign in to an account with issue access to ${owner}/${repo}.` },
        });
      } else {
        // createIfNone lets VS Code mint a session for the requested scopes
        // even if the picked account had no session for them yet.
        session = await vscode.authentication.getSession('github', scopes, {
          account: pick.account,
          createIfNone: true,
        });
      }
    } catch {
      session = undefined;
    }
    if (!session) {
      continue;
    }

    const octokit = new Octokit({ auth: session.accessToken });
    const access = await checkRepoIssueAccess(octokit, owner, repo);
    if (access.ok) {
      setAccountOverride(owner, session.account);
      return octokit;
    }

    detail = `${session.account.label}: ${access.reason}`;
    const again = await vscode.window.showWarningMessage(detail, 'Choose Another Account', 'Cancel');
    if (again !== 'Choose Another Account') {
      return null;
    }
  }
}

/**
 * Runs a write operation against owner/repo, recovering from access errors by
 * letting the user switch GitHub accounts. On an access error we first confirm
 * the current account truly lacks repo access (so an issue-specific 404 isn't
 * misread as an auth problem), then prompt for a different account and retry
 * the operation once.
 */
async function withWriteAccess<T>(
  owner: string,
  repo: string,
  op: (octokit: Octokit) => Promise<T>,
): Promise<T> {
  const octokit = await getOctokit(owner);
  try {
    return await op(octokit);
  } catch (err) {
    if (!isAccessError(err)) {
      throw err;
    }

    // Distinguish a real access problem from an issue-specific 404.
    const probe = await checkRepoIssueAccess(octokit, owner, repo);
    if (probe.ok) {
      throw err;
    }

    const recovered = await promptAccountForAccess(owner, repo, probe.reason);
    if (!recovered) {
      throw new Error(
        `Unable to access comments in ${owner}/${repo}. ${probe.reason ?? ''} ` +
        'Choose a GitHub account with write access to the repository and try again.',
      );
    }
    // Let the retry's own error bubble so the real cause isn't masked.
    return await op(recovered);
  }
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
  const octokit = await getOctokit(owner);
  const threads: CommentThread[] = [];

  // Try fetching by mdcolab label, then filter by file path in metadata
  try {
    const allIssues: GitHubIssue[] = [];
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

  // If no results by label, try search API (still requiring the mdcolab label
  // so users can hide an issue from the extension by removing the label).
  if (threads.length === 0) {
    try {
      const searchOctokit = await getOctokit(owner);
      const { data } = await searchOctokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:issue label:${LABEL} "[mdcolab]" in:title`,
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
  return withWriteAccess(owner, repo, async (octokit) => {
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
  });
}

export async function replyToThread(owner: string, repo: string, issueNumber: number, body: string): Promise<CommentReply | null> {
  return withWriteAccess(owner, repo, async (octokit) => {
    const { data } = await octokit.issues.createComment({
      owner, repo, issue_number: issueNumber, body,
    });
    return {
      id: data.id,
      author: data.user?.login ?? 'unknown',
      body: data.body ?? '',
      createdAt: data.created_at,
    };
  });
}

export async function resolveThread(owner: string, repo: string, issueNumber: number): Promise<void> {
  await withWriteAccess(owner, repo, async (octokit) => {
    await octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' });
  });
}

export async function reopenThread(owner: string, repo: string, issueNumber: number): Promise<void> {
  await withWriteAccess(owner, repo, async (octokit) => {
    await octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'open' });
  });
}
