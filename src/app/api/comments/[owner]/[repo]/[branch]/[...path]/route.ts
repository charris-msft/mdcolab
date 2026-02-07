import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import type { CommentThread, CommentAnchor, Comment } from "@/types";

const LABEL = "mdcolab";
const LABEL_COLOR = "7B61FF";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface IssueMetadata {
  file: string;
  anchor: CommentAnchor;
}

function buildIssueBody(anchor: CommentAnchor, commentBody: string, filePath: string): string {
  const meta: IssueMetadata = { file: filePath, anchor };
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
}

interface GitHubComment {
  id: number;
  body?: string;
  user: GitHubUser | null;
  created_at: string;
  updated_at: string;
}

function toComment(src: { id: number; body: string; user: GitHubUser | null; created_at: string; updated_at: string }): Comment {
  return {
    id: String(src.id),
    author: {
      login: src.user?.login ?? "unknown",
      avatarUrl: src.user?.avatar_url ?? "",
    },
    body: src.body,
    mentions: [],
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
    }),
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

  return {
    id: String(issue.number),
    status: issue.state === "open" ? "open" : "resolved",
    anchor: meta.anchor,
    comments,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureLabel(octokit: any, owner: string, repo: string) {
  try {
    await octokit.issues.getLabel({ owner, repo, name: LABEL });
  } catch {
    await octokit.issues.createLabel({ owner, repo, name: LABEL, color: LABEL_COLOR, description: "mdcolab comment threads" });
  }
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

    // Fetch all mdcolab issues (open + closed)
    const issues: GitHubIssue[] = [];
    for (const state of ["open", "closed"] as const) {
      let page = 1;
      while (true) {
        const { data } = await octokit.issues.listForRepo({
          owner,
          repo,
          labels: LABEL,
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

    // Filter to issues for this file
    const fileIssues = issues.filter((issue) => {
      const meta = parseMetadata(issue.body ?? "");
      return meta?.file === filePath;
    });

    // Fetch comments for each issue in parallel
    const threads: CommentThread[] = [];
    await Promise.all(
      fileIssues.map(async (issue) => {
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

    // Sort by creation date
    threads.sort((a, b) => a.comments[0]?.createdAt.localeCompare(b.comments[0]?.createdAt ?? "") ?? 0);

    return NextResponse.json({ threads });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
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
  try {
    const { owner, repo, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");
    const octokit = await getOctokit();
    const body = await request.json();

    const action: string = body.action; // "create" | "reply" | "resolve" | "reopen"

    if (action === "create") {
      const anchor: CommentAnchor = body.anchor;
      const commentBody: string = body.body;

      await ensureLabel(octokit, owner, repo);

      // Ensure file-specific label exists
      const fileLabel = `file:${filePath}`;
      try {
        await octokit.issues.getLabel({ owner, repo, name: fileLabel });
      } catch {
        await octokit.issues.createLabel({ owner, repo, name: fileLabel, color: "0E8A16", description: `mdcolab comments for ${filePath}` });
      }

      const selectedText = anchor.selectedText || "General comment";
      const truncated = selectedText.length > 50 ? selectedText.slice(0, 50) + "…" : selectedText;
      const title = `[mdcolab] "${truncated}" — ${filePath}`;

      const { data: issue } = await octokit.issues.create({
        owner,
        repo,
        title,
        body: buildIssueBody(anchor, commentBody, filePath),
        labels: [LABEL, fileLabel],
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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("POST comments error:", error);
    return NextResponse.json({ error: "Failed to save comment" }, { status: 500 });
  }
}
