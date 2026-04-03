import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { auth } from "@/lib/auth";
import { isAppConfigured, getInstallationOctokit } from "@/lib/github-app";
import { checkSharingAccess } from "@/lib/sharing-utils";
import type { CommentThread, CommentAnchor, Comment } from "@/types";

const LABEL = "mdcolab";
const LABEL_COLOR = "7B61FF";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface IssueMetadata {
  file: string;
  anchor: CommentAnchor;
  anonymousAuthor?: { displayName: string };
  proxyAuthor?: { login: string; avatarUrl: string };
}

function buildIssueBody(anchor: CommentAnchor, commentBody: string, filePath: string, anonymousAuthor?: { displayName: string }, proxyAuthor?: { login: string; avatarUrl: string }): string {
  const meta: IssueMetadata = { file: filePath, anchor, ...(anonymousAuthor && { anonymousAuthor }), ...(proxyAuthor && { proxyAuthor }) };
  return `<!-- mdcolab-metadata\n${JSON.stringify(meta, null, 2)}\n-->\n\n${commentBody}`;
}

function parseMetadata(body: string): IssueMetadata | null {
  const match = body.match(/<!--\s*mdcolab-metadata\s*\n([\s\S]*?)\n\s*-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as IssueMetadata;
  } catch {
    return null;
  }
}

function extractCommentBody(body: string): string {
  return body.replace(/<!--\s*mdcolab-metadata\s*\n[\s\S]*?\n\s*-->\s*\n*/, "").trim();
}

// Anonymous/proxy author metadata embedded in reply comment bodies
const ANON_TAG = "mdcolab-anon";
const PROXY_TAG = "mdcolab-proxy";

function buildAnonCommentBody(body: string, displayName: string): string {
  return `<!-- ${ANON_TAG} ${JSON.stringify({ displayName })} -->\n\n${body}`;
}

function buildProxyCommentBody(body: string, login: string, avatarUrl: string): string {
  return `<!-- ${PROXY_TAG} ${JSON.stringify({ login, avatarUrl })} -->\n\n${body}`;
}

function parseAnonAuthor(body: string): { displayName: string } | null {
  const match = body.match(new RegExp(`<!--\\s*${ANON_TAG}\\s+(\\{.*?\\})\\s*-->`));
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function parseProxyAuthor(body: string): { login: string; avatarUrl: string } | null {
  const match = body.match(new RegExp(`<!--\\s*${PROXY_TAG}\\s+(\\{.*?\\})\\s*-->`));
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function stripAnonAuthor(body: string): string {
  return body
    .replace(new RegExp(`<!--\\s*${ANON_TAG}\\s+\\{.*?\\}\\s*-->\\s*\\n*`), "")
    .replace(new RegExp(`<!--\\s*${PROXY_TAG}\\s+\\{.*?\\}\\s*-->\\s*\\n*`), "")
    .trim();
}

interface GitHubUser {
  login: string;
  avatar_url: string;
}

interface GitHubIssue {
  number: number;
  id: number;
  state: string;
  body: string | null;
  user: GitHubUser | null;
  created_at: string;
  updated_at: string;
  labels: Array<{ name?: string }>;
}

interface GitHubComment {
  id: number;
  body?: string;
  user: GitHubUser | null;
  created_at: string;
  updated_at: string;
}

function extractMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9_-]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

function toComment(src: { id: number; body: string; user: GitHubUser | null; created_at: string; updated_at: string }, anonOverride?: { displayName: string }, proxyOverride?: { login: string; avatarUrl: string }): Comment {
  // Check for inline anonymous/proxy author metadata in the body (for replies)
  const inlineAnon = !anonOverride ? parseAnonAuthor(src.body) : null;
  const inlineProxy = !proxyOverride && !inlineAnon ? parseProxyAuthor(src.body) : null;
  const anon = anonOverride ?? inlineAnon;
  const proxy = proxyOverride ?? inlineProxy;
  const cleanBody = (inlineAnon || inlineProxy) ? stripAnonAuthor(src.body) : src.body;

  if (anon) {
    return {
      id: String(src.id),
      author: {
        login: null,
        displayName: anon.displayName,
        avatarUrl: null,
        isAnonymous: true,
      },
      body: cleanBody,
      mentions: extractMentions(cleanBody),
      suggestedEdit: null,
      createdAt: src.created_at,
      updatedAt: src.updated_at,
    };
  }

  if (proxy) {
    return {
      id: String(src.id),
      author: {
        login: proxy.login,
        avatarUrl: proxy.avatarUrl,
      },
      body: cleanBody,
      mentions: extractMentions(cleanBody),
      suggestedEdit: null,
      createdAt: src.created_at,
      updatedAt: src.updated_at,
    };
  }

  return {
    id: String(src.id),
    author: {
      login: src.user?.login ?? "unknown",
      avatarUrl: src.user?.avatar_url ?? "",
    },
    body: cleanBody,
    mentions: extractMentions(cleanBody),
    suggestedEdit: null,
    createdAt: src.created_at,
    updatedAt: src.updated_at,
  };
}

function issueToThread(issue: GitHubIssue, issueComments: GitHubComment[]): CommentThread | null {
  const meta = parseMetadata(issue.body ?? "");
  if (!meta) return null;

  const firstBody = extractCommentBody(issue.body ?? "");

  const comments: Comment[] = [
    toComment({
      id: issue.id,
      body: firstBody,
      user: issue.user,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }, meta.anonymousAuthor, meta.proxyAuthor),
    ...issueComments.map((c) =>
      toComment({
        id: c.id,
        body: c.body ?? "",
        user: c.user,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })
    ),
  ];

  const labelNames = issue.labels.map(l => l.name ?? "").filter(Boolean);
  const promoted = labelNames.includes("bug") ? "bug" as const
    : labelNames.includes("enhancement") ? "feature" as const
    : undefined;

  return {
    id: String(issue.number),
    status: issue.state === "open" ? "open" : "resolved",
    promoted,
    anchor: meta.anchor,
    comments,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureLabelSafe(octokit: any, owner: string, repo: string, name: string, color: string, description: string): Promise<boolean> {
  try {
    await octokit.issues.getLabel({ owner, repo, name });
    return true; // Label already exists
  } catch (getErr: unknown) {
    const status = typeof getErr === "object" && getErr !== null && "status" in getErr ? (getErr as { status: number }).status : 0;
    if (status === 404) {
      try {
        await octokit.issues.createLabel({ owner, repo, name, color, description });
        return true;
      } catch {
        return false; // Can't create (403 for non-write users)
      }
    }
    return false; // Can't read label (unexpected)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchIssuesWithLabels(
  octokit: any,
  owner: string,
  repo: string,
  labels: string
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  for (const state of ["open", "closed"] as const) {
    let page = 1;
    while (true) {
      const { data } = await octokit.issues.listForRepo({
        owner,
        repo,
        labels,
        state,
        per_page: 100,
        page,
      });
      if (data.length === 0) break;
      issues.push(...(data as unknown as GitHubIssue[]));
      if (data.length < 100) break;
      page++;
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// GET — load all comment threads for a file
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; branch: string; path: string[] }> }
) {
  try {
    const { owner, repo, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");
    const octokit = await getOctokit();

    // Strategy: Try path-specific label first, fall back to mdcolab-only label, then search.
    // Track whether any attempt threw an access error so we can fall through to the
    // sharing-access path instead of returning an empty list.
    let issues: GitHubIssue[] = [];
    let hadAccessError = false;
    const pathLabel = `path:${filePath}`;

    // Attempt 1: Filter by both mdcolab + path label (most efficient)
    try {
      issues = await fetchIssuesWithLabels(octokit, owner, repo, `${LABEL},${pathLabel}`);
      console.log(`[comments GET] Attempt 1 (path label): found ${issues.length} issues for ${filePath}`);
    } catch (err) {
      console.log(`[comments GET] Attempt 1 failed:`, err instanceof Error ? err.message : err);
      const status = (err as { status?: number })?.status;
      if (status === 403 || status === 404) hadAccessError = true;
    }

    // Attempt 2: If no results, try mdcolab label only and filter by metadata
    if (issues.length === 0 && !hadAccessError) {
      try {
        const allMdcolabIssues = await fetchIssuesWithLabels(octokit, owner, repo, LABEL);
        console.log(`[comments GET] Attempt 2 (mdcolab label): found ${allMdcolabIssues.length} total mdcolab issues`);
        issues = allMdcolabIssues.filter((issue) => {
          const meta = parseMetadata(issue.body ?? "");
          return meta?.file === filePath;
        });
        console.log(`[comments GET] Attempt 2: ${issues.length} issues matched file ${filePath}`);
      } catch (err) {
        console.log(`[comments GET] Attempt 2 failed:`, err instanceof Error ? err.message : err);
        const status = (err as { status?: number })?.status;
        if (status === 403 || status === 404) hadAccessError = true;
      }
    }

    // Attempt 3: If still nothing, search all issues by title pattern
    if (issues.length === 0 && !hadAccessError) {
      try {
        const searchQuery = `repo:${owner}/${repo} is:issue "[mdcolab]" in:title`;
        const { data } = await octokit.search.issuesAndPullRequests({
          q: searchQuery,
          per_page: 100,
        });
        console.log(`[comments GET] Attempt 3 (search): found ${data.total_count} issues via search`);
        issues = data.items.filter((item) => {
          const meta = parseMetadata(item.body ?? "");
          return meta?.file === filePath;
        }) as unknown as GitHubIssue[];
        console.log(`[comments GET] Attempt 3: ${issues.length} issues matched file ${filePath}`);
      } catch (err) {
        console.log(`[comments GET] Attempt 3 failed:`, err instanceof Error ? err.message : err);
        const status = (err as { status?: number })?.status;
        if (status === 403 || status === 404) hadAccessError = true;
      }
    }

    // If user's token couldn't access the repo, fall through to the sharing-access
    // path so authenticated users without repo access can still see all comments.
    if (hadAccessError && issues.length === 0) {
      throw Object.assign(new Error("Repo access denied"), { status: 403 });
    }

    console.log(`[comments GET] Final: ${issues.length} issues for ${owner}/${repo}/${filePath}`);

    // Deduplicate issues by number
    const seen = new Set<number>();
    issues = issues.filter((issue) => {
      if (seen.has(issue.number)) return false;
      seen.add(issue.number);
      return true;
    });

    // Fetch comments for each issue in parallel
    const threads: CommentThread[] = [];
    await Promise.all(
      issues.map(async (issue) => {
        const { data: comments } = await octokit.issues.listComments({
          owner,
          repo,
          issue_number: issue.number,
          per_page: 100,
        });
        const thread = issueToThread(issue, comments as unknown as GitHubComment[]);
        if (thread) threads.push(thread);
      })
    );

    threads.sort((a, b) => a.comments[0]?.createdAt.localeCompare(b.comments[0]?.createdAt ?? "") ?? 0);

    return NextResponse.json({ threads });
  } catch (error) {
    const isNotAuth = error instanceof Error && error.message === "Not authenticated";
    const errStatus = (error as { status?: number })?.status;
    const isAccessError = errStatus === 403 || errStatus === 404;

    if ((isNotAuth || isAccessError) && isAppConfigured()) {
      try {
        const session = await auth().catch(() => null);
        const login = (session as any)?.login ?? null;
        const { owner, repo, path: pathSegments } = await params;
        const filePath = pathSegments.join("/");
        const installationOctokit = await getInstallationOctokit(owner, repo);
        const { authorized } = await checkSharingAccess(installationOctokit, owner, repo, filePath, login);
        if (authorized) {
          let issues: GitHubIssue[] = [];
          const pathLabel = `path:${filePath}`;
          try {
            issues = await fetchIssuesWithLabels(installationOctokit, owner, repo, `${LABEL},${pathLabel}`);
          } catch { /* ignore */ }
          if (issues.length === 0) {
            try {
              const allIssues = await fetchIssuesWithLabels(installationOctokit, owner, repo, LABEL);
              issues = allIssues.filter((issue) => {
                const meta = parseMetadata(issue.body ?? "");
                return meta?.file === filePath;
              });
            } catch { /* ignore */ }
          }
          const seen = new Set<number>();
          issues = issues.filter((issue) => {
            if (seen.has(issue.number)) return false;
            seen.add(issue.number);
            return true;
          });
          const threads: CommentThread[] = [];
          await Promise.all(
            issues.map(async (issue) => {
              const { data: comments } = await installationOctokit.issues.listComments({
                owner,
                repo,
                issue_number: issue.number,
                per_page: 100,
              });
              const thread = issueToThread(issue, comments as unknown as GitHubComment[]);
              if (thread) threads.push(thread);
            })
          );
          threads.sort((a, b) => a.comments[0]?.createdAt.localeCompare(b.comments[0]?.createdAt ?? "") ?? 0);
          return NextResponse.json({ threads });
        }
      } catch {
        // Fall through to error
      }
    }

    if (isNotAuth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET comments error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new comment thread (Issue) or reply / resolve
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; branch: string; path: string[] }> }
) {
  const body = await request.json();
  try {
    const { owner, repo, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");
    let octokit;
    try {
      octokit = await getOctokit();
    } catch (authErr) {
      // Anonymous user — try installation token fallback
      if (isAppConfigured()) {
        try {
          const session = await auth().catch(() => null);
          const login = (session as any)?.login ?? null;
          const isAnonymous = !login;
          const installationOctokit = await getInstallationOctokit(owner, repo);
          const { authorized } = await checkSharingAccess(installationOctokit, owner, repo, filePath, login);
          if (authorized) {
            const action: string = body.action;
            const displayName: string = body.displayName || "Anonymous";

            if (action === "create") {
              const anchor: CommentAnchor = body.anchor;
              const commentBody: string = body.body;
              const labels: string[] = [];
              const fileLabel = `file:${filePath.split("/").pop() ?? filePath}`;
              const pathLabel = `path:${filePath}`;
              if (await ensureLabelSafe(installationOctokit, owner, repo, LABEL, LABEL_COLOR, "mdcolab comment threads")) labels.push(LABEL);
              if (await ensureLabelSafe(installationOctokit, owner, repo, fileLabel, "0E8A16", `mdcolab comments for ${filePath}`)) labels.push(fileLabel);
              if (await ensureLabelSafe(installationOctokit, owner, repo, pathLabel, "0E8A16", `mdcolab path ${filePath}`)) labels.push(pathLabel);
              const selectedText = anchor.selectedText || "General comment";
              const truncated = selectedText.length > 50 ? selectedText.slice(0, 50) + "…" : selectedText;
              const title = `[mdcolab] "${truncated}" — ${filePath}`;
              const anonAuthor = isAnonymous ? { displayName } : undefined;
              const { data: issue } = await installationOctokit.issues.create({
                owner,
                repo,
                title,
                body: buildIssueBody(anchor, commentBody, filePath, anonAuthor),
                labels: labels.length > 0 ? labels : undefined,
              });
              const thread: CommentThread = {
                id: String(issue.number),
                status: "open",
                anchor,
                comments: [
                  toComment({ id: issue.id, body: commentBody, user: issue.user as GitHubUser | null, created_at: issue.created_at, updated_at: issue.updated_at }, anonAuthor),
                ],
              };
              return NextResponse.json({ thread });
            }

            if (action === "reply") {
              const issueNumber: number = body.issueNumber;
              const commentBody: string = body.body;
              const finalBody = isAnonymous ? buildAnonCommentBody(commentBody, displayName) : commentBody;
              const { data: comment } = await installationOctokit.issues.createComment({
                owner,
                repo,
                issue_number: issueNumber,
                body: finalBody,
              });
              const anonOverride = isAnonymous ? { displayName } : undefined;
              return NextResponse.json({
                comment: toComment({ id: comment.id, body: commentBody, user: comment.user as GitHubUser | null, created_at: comment.created_at, updated_at: comment.updated_at }, anonOverride),
              });
            }

            if (action === "resolve" || action === "reopen") {
              const issueNumber: number = body.issueNumber;
              await installationOctokit.issues.update({
                owner,
                repo,
                issue_number: issueNumber,
                state: action === "resolve" ? "closed" : "open",
              });
              return NextResponse.json({ ok: true });
            }
          }
        } catch (fallbackErr) {
          console.error("POST anonymous comment fallback error:", fallbackErr);
        }
      }
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const action: string = body.action; // "create" | "reply" | "resolve" | "reopen"

    if (action === "create") {
      const anchor: CommentAnchor = body.anchor;
      const commentBody: string = body.body;

      // Best-effort label creation (may fail for non-write users)
      const labels: string[] = [];
      const fileLabel = `file:${filePath.split("/").pop() ?? filePath}`;
      const pathLabel = `path:${filePath}`;

      if (await ensureLabelSafe(octokit, owner, repo, LABEL, LABEL_COLOR, "mdcolab comment threads")) {
        labels.push(LABEL);
      }
      if (await ensureLabelSafe(octokit, owner, repo, fileLabel, "0E8A16", `mdcolab comments for ${filePath}`)) {
        labels.push(fileLabel);
      }
      if (await ensureLabelSafe(octokit, owner, repo, pathLabel, "0E8A16", `mdcolab path ${filePath}`)) {
        labels.push(pathLabel);
      }

      const selectedText = anchor.selectedText || "General comment";
      const truncated = selectedText.length > 50 ? selectedText.slice(0, 50) + "…" : selectedText;
      const title = `[mdcolab] "${truncated}" — ${filePath}`;

      const { data: issue } = await octokit.issues.create({
        owner,
        repo,
        title,
        body: buildIssueBody(anchor, commentBody, filePath),
        labels: labels.length > 0 ? labels : undefined,
      });

      const thread: CommentThread = {
        id: String(issue.number),
        status: "open",
        anchor,
        comments: [
          toComment({
            id: issue.id,
            body: commentBody,
            user: issue.user as GitHubUser | null,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
          }),
        ],
      };

      return NextResponse.json({ thread });
    }

    if (action === "reply") {
      const issueNumber: number = body.issueNumber;
      const commentBody: string = body.body;

      const { data: comment } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: commentBody,
      });

      return NextResponse.json({
        comment: toComment({
          id: comment.id,
          body: comment.body ?? "",
          user: comment.user as GitHubUser | null,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        }),
      });
    }

    if (action === "resolve" || action === "reopen") {
      const issueNumber: number = body.issueNumber;
      await octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: action === "resolve" ? "closed" : "open",
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "promote") {
      const issueNumber: number = body.issueNumber;
      const issueType: "bug" | "feature" = body.issueType;

      // Check write permission
      const { data: repoData } = await octokit.repos.get({ owner, repo });
      if (!repoData.permissions?.push) {
        return NextResponse.json({ error: "Write access required to promote" }, { status: 403 });
      }

      // Fetch the issue
      let issueData;
      try {
        const resp = await octokit.issues.get({ owner, repo, issue_number: issueNumber });
        issueData = resp.data;
      } catch (getErr: unknown) {
        const getStatus = typeof getErr === "object" && getErr !== null && "status" in getErr ? (getErr as { status: number }).status : 0;
        if (getStatus === 404) {
          return NextResponse.json({ error: "Issue not found" }, { status: 404 });
        }
        throw getErr;
      }

      // Clean up the title: extract quoted text from `[mdcolab] "quoted text" — filepath`
      const currentTitle: string = issueData.title ?? "";
      const titleMatch = currentTitle.match(/^\[mdcolab\]\s*"(.+?)"\s*—\s*.+$/);
      const newTitle = titleMatch ? titleMatch[1] : currentTitle.replace(/^\[mdcolab\]\s*/, "");

      // Identify mdcolab-related labels to remove
      const currentLabels: Array<{ name?: string }> = (issueData.labels ?? []) as Array<{ name?: string }>;
      const labelsToRemove = currentLabels
        .map((l) => l.name ?? "")
        .filter((n) => n.startsWith("path:") || n.startsWith("file:"));

      // Remove mdcolab labels
      for (const labelName of labelsToRemove) {
        try {
          await octokit.issues.removeLabel({ owner, repo, issue_number: issueNumber, name: labelName });
        } catch {
          // Label may already be removed; ignore
        }
      }

      // Add the appropriate label
      const newLabel = issueType === "bug" ? "bug" : "enhancement";
      const newLabelColor = issueType === "bug" ? "d73a4a" : "a2eeef";
      const newLabelDesc = issueType === "bug" ? "Something isn't working" : "New feature or request";
      await ensureLabelSafe(octokit, owner, repo, newLabel, newLabelColor, newLabelDesc);
      await octokit.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [newLabel] });

      // Update the title
      await octokit.issues.update({ owner, repo, issue_number: issueNumber, title: newTitle });

      // Add promotion comment
      const promoteMsg = `🔄 Promoted from mdcolab comment thread to ${issueType === "bug" ? "bug report" : "feature request"}.`;
      await octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body: promoteMsg });

      return NextResponse.json({ ok: true, issueUrl: `https://github.com/${owner}/${repo}/issues/${issueNumber}` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const isNotAuth = error instanceof Error && error.message === "Not authenticated";
    if (typeof error === "object" && error !== null && "status" in error && (error as { status: number }).status === 410) {
      return NextResponse.json({
        error: "Issues are disabled for this repository. Enable them in Settings → Features → Issues.",
      }, { status: 410 });
    }
    const errStatus = (error as { status?: number })?.status;
    const isAccessError = errStatus === 403 || errStatus === 404;

    if ((isNotAuth || isAccessError) && isAppConfigured()) {
      try {
        const session = await auth().catch(() => null);
        const login = (session as any)?.login ?? null;
        const avatarUrl = (session as any)?.user?.image ?? "";
        const isAnonymous = !login;
        const { owner, repo, path: pathSegments } = await params;
        const filePath = pathSegments.join("/");
        const installationOctokit = await getInstallationOctokit(owner, repo);
        const { authorized } = await checkSharingAccess(installationOctokit, owner, repo, filePath, login);
        if (authorized) {
          const action: string = body.action;
          const displayName: string = body.displayName || "Anonymous";
          const proxyAuthor = !isAnonymous ? { login, avatarUrl } : undefined;

          if (action === "create") {
            const anchor: CommentAnchor = body.anchor;
            const commentBody: string = body.body;
            const labels: string[] = [];
            const fileLabel = `file:${filePath.split("/").pop() ?? filePath}`;
            const pathLabel = `path:${filePath}`;
            if (await ensureLabelSafe(installationOctokit, owner, repo, LABEL, LABEL_COLOR, "mdcolab comment threads")) labels.push(LABEL);
            if (await ensureLabelSafe(installationOctokit, owner, repo, fileLabel, "0E8A16", `mdcolab comments for ${filePath}`)) labels.push(fileLabel);
            if (await ensureLabelSafe(installationOctokit, owner, repo, pathLabel, "0E8A16", `mdcolab path ${filePath}`)) labels.push(pathLabel);
            const selectedText = anchor.selectedText || "General comment";
            const truncated = selectedText.length > 50 ? selectedText.slice(0, 50) + "…" : selectedText;
            const title = `[mdcolab] "${truncated}" — ${filePath}`;
            const anonAuthor = isAnonymous ? { displayName } : undefined;
            const { data: issue } = await installationOctokit.issues.create({
              owner,
              repo,
              title,
              body: buildIssueBody(anchor, commentBody, filePath, anonAuthor, proxyAuthor),
              labels: labels.length > 0 ? labels : undefined,
            });
            const thread: CommentThread = {
              id: String(issue.number),
              status: "open",
              anchor,
              comments: [
                toComment({ id: issue.id, body: commentBody, user: issue.user as GitHubUser | null, created_at: issue.created_at, updated_at: issue.updated_at }, anonAuthor, proxyAuthor),
              ],
            };
            return NextResponse.json({ thread });
          }

          if (action === "reply") {
            const issueNumber: number = body.issueNumber;
            const commentBody: string = body.body;
            let finalBody: string;
            if (isAnonymous) {
              finalBody = buildAnonCommentBody(commentBody, displayName);
            } else {
              finalBody = buildProxyCommentBody(commentBody, login, avatarUrl);
            }
            const { data: comment } = await installationOctokit.issues.createComment({
              owner,
              repo,
              issue_number: issueNumber,
              body: finalBody,
            });
            const anonOverride = isAnonymous ? { displayName } : undefined;
            return NextResponse.json({
              comment: toComment({ id: comment.id, body: commentBody, user: comment.user as GitHubUser | null, created_at: comment.created_at, updated_at: comment.updated_at }, anonOverride, proxyAuthor),
            });
          }

          if (action === "resolve" || action === "reopen") {
            const issueNumber: number = body.issueNumber;
            await installationOctokit.issues.update({
              owner,
              repo,
              issue_number: issueNumber,
              state: action === "resolve" ? "closed" : "open",
            });
            return NextResponse.json({ ok: true });
          }
        }
      } catch (fallbackErr) {
        console.error("POST comments fallback error:", fallbackErr);
        // Fall through to error
      }
    }

    if (isNotAuth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("POST comments error:", error);
    return NextResponse.json({ error: "Failed to save comment" }, { status: 500 });
  }
}
