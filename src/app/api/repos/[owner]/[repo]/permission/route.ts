import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";
import { auth } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params;
    const session = await auth();
    const sessionAny = session as unknown as Record<string, unknown>;
    let username = sessionAny?.login as string | undefined;

    if (!username) {
      // Fall back: get login from GitHub API
      try {
        const octokit = await getOctokit();
        const { data: user } = await octokit.users.getAuthenticated();
        username = user.login;
      } catch {
        return NextResponse.json({ permission: "read" as const, canEdit: false, hasIssues: true });
      }
    }

    if (!username) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const octokit = await getOctokit();

    try {
      const [{ data }, { data: repoData }] = await Promise.all([
        octokit.repos.getCollaboratorPermissionLevel({
          owner,
          repo,
          username,
        }),
        octokit.repos.get({ owner, repo }),
      ]);

      const permission = data.permission as "admin" | "write" | "read" | "none";
      return NextResponse.json({
        permission,
        canEdit: permission === "admin" || permission === "write",
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
