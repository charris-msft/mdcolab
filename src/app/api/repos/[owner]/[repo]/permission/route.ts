import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { isAppConfigured, getInstallationOctokit } from "@/lib/github-app";
import { checkAnySharingAccess } from "@/lib/sharing-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params;
    let octokit;
    try {
      octokit = await getOctokit();
    } catch {
      // Anonymous user — check if repo has "anyone_with_link" shared docs
      if (isAppConfigured()) {
        try {
          const installationOctokit = await getInstallationOctokit(owner, repo);
          const { authorized } = await checkAnySharingAccess(installationOctokit, owner, repo, null);
          if (authorized) {
            return NextResponse.json({ permission: "read" as const, canEdit: false, hasIssues: true, anonymous: true });
          }
        } catch {
          // Fall through to default
        }
      }
      return NextResponse.json({ permission: "read" as const, canEdit: false, hasIssues: true });
    }

    try {
      const { data: repoData } = await octokit.repos.get({ owner, repo });
      const perms = repoData.permissions;
      const canEdit = perms?.push === true || perms?.admin === true;
      const permission = perms?.admin ? "admin" : perms?.push ? "write" : "read";
      return NextResponse.json({
        permission,
        canEdit,
        hasIssues: repoData.has_issues,
      });
    } catch {
      // If we can't check permissions, assume read-only
      return NextResponse.json({ permission: "read" as const, canEdit: false, hasIssues: true });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to check permissions" }, { status: 500 });
  }
}
