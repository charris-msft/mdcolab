import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { tryGetInstallationOctokit } from "@/lib/github-app";
import {
  resolveStorageTarget,
  sourceRepoLabel,
  inRepoTarget,
} from "@/lib/central-storage";

const LABEL = "mdcolab";
const ANON_TAG = "mdcolab-anon";
const META_RE = /<!--\s*mdcolab-metadata\s*\n([\s\S]*?)\n\s*-->/;
const ANON_INLINE_RE = new RegExp(`<!--\\s*${ANON_TAG}\\s+(\\{.*?\\})\\s*-->`);

interface IssueLite {
  number: number;
  body?: string | null;
}

interface CommentLite {
  id: number;
  body?: string | null;
}

/**
 * PATCH /api/comments/rename/[owner]/[repo]
 * Body: { anonId: string, newDisplayName: string }
 *
 * Cascade-rename all anonymous comments by the given anonId across all
 * mdcolab issues in this repo.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  try {
    const { owner, repo } = await params;
    const body = await request.json();
    const anonId: string = body.anonId;
    const newDisplayName: string = (body.newDisplayName || "").trim();

    if (!anonId || !newDisplayName) {
      return NextResponse.json({ error: "anonId and newDisplayName are required" }, { status: 400 });
    }

    // Prefer the signed-in user's own token. The cascade rename rewrites issue
    // and comment bodies, so it requires write (push) access. We pick the client
    // once, up front, so the rename runs exactly once and counts stay accurate.
    let octokit = null;
    let target = inRepoTarget(owner, repo);
    try {
      const userOctokit = await getOctokit();
      target = await resolveStorageTarget(userOctokit, owner, repo);
      const { data: repoData } = await userOctokit.repos.get({ owner: target.owner, repo: target.repo });
      if (repoData.permissions?.push) {
        octokit = userOctokit;
      }
    } catch {
      // Not authenticated or no access via the user token — fall back to the App.
    }

    // The App is an opportunistic helper: anonymous users (and signed-in users
    // without push access) rely on it, but its absence is transparent — we just
    // report a normal access error below instead of anything App-specific.
    if (!octokit) {
      octokit = await tryGetInstallationOctokit(target.owner, target.repo);
    }

    if (!octokit) {
      return NextResponse.json(
        { error: "You don't have access to rename comments in this repository." },
        { status: 403 },
      );
    }

    // In central mode, scope the cascade to the source repo's issues only.
    const renameLabels = target.mode === "central"
      ? `${LABEL},${sourceRepoLabel(target.source.owner, target.source.repo)}`
      : LABEL;

    // Find all mdcolab issues
    const issues: IssueLite[] = [];
    for (const state of ["open", "closed"] as const) {
      let page = 1;
      while (true) {
        const { data } = await octokit.issues.listForRepo({
          owner: target.owner,
          repo: target.repo,
          labels: renameLabels,
          state,
          per_page: 100,
          page,
        });
        if (data.length === 0) break;
        issues.push(...(data as unknown as IssueLite[]));
        if (data.length < 100) break;
        page++;
      }
    }

    let issuesUpdated = 0;
    let commentsUpdated = 0;

    for (const issue of issues) {
      // Check if the issue body has a matching anonId
      const issueBody = issue.body ?? "";
      const metaMatch = issueBody.match(META_RE);
      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1]);
          if (meta.anonymousAuthor?.anonId === anonId) {
            meta.anonymousAuthor.displayName = newDisplayName;
            const newBody = issueBody.replace(
              META_RE,
              `<!-- mdcolab-metadata\n${JSON.stringify(meta, null, 2)}\n-->`,
            );
            await octokit.issues.update({
              owner: target.owner,
              repo: target.repo,
              issue_number: issue.number,
              body: newBody,
            });
            issuesUpdated++;
          }
        } catch {
          // Ignore JSON parse failures
        }
      }

      // Check the issue comments (replies)
      const { data: comments } = await octokit.issues.listComments({
        owner: target.owner,
        repo: target.repo,
        issue_number: issue.number,
        per_page: 100,
      });

      for (const c of comments as unknown as CommentLite[]) {
        const cBody = c.body ?? "";
        const inlineMatch = cBody.match(ANON_INLINE_RE);
        if (!inlineMatch) continue;
        try {
          const data = JSON.parse(inlineMatch[1]);
          if (data.anonId === anonId) {
            data.displayName = newDisplayName;
            const newBody = cBody.replace(
              ANON_INLINE_RE,
              `<!-- ${ANON_TAG} ${JSON.stringify(data)} -->`,
            );
            await octokit.issues.updateComment({
              owner: target.owner,
              repo: target.repo,
              comment_id: c.id,
              body: newBody,
            });
            commentsUpdated++;
          }
        } catch {
          // Ignore JSON parse failures
        }
      }
    }

    return NextResponse.json({
      issuesUpdated,
      commentsUpdated,
      total: issuesUpdated + commentsUpdated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rename failed" },
      { status: 500 },
    );
  }
}
