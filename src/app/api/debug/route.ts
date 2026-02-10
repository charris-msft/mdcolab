import { NextResponse } from "next/server";
import { getOctokit, getSession } from "@/lib/github";

export async function GET() {
  try {
    const octokit = await getOctokit();
    const session = await getSession();
    const login = (session as any)?.login as string;

    // 1. Check installations
    let installations: any[] = [];
    try {
      const { data } = await octokit.request("GET /user/installations", {
        per_page: 100,
      });
      installations = data.installations.map((i: any) => ({
        id: i.id,
        account: i.account?.login,
        account_type: i.account?.type,
        app_slug: i.app_slug,
        repository_selection: i.repository_selection,
        permissions: i.permissions,
      }));
    } catch (e: any) {
      installations = [{ error: e.message }];
    }

    // 2. For each installation, list repos
    const installationRepos: Record<string, string[]> = {};
    for (const inst of installations) {
      if (inst.error) continue;
      try {
        const { data } = await octokit.request(
          "GET /user/installations/{installation_id}/repositories",
          { installation_id: inst.id, per_page: 100 }
        );
        installationRepos[`${inst.account} (${inst.id})`] = data.repositories.map(
          (r: any) => r.full_name
        );
      } catch (e: any) {
        installationRepos[`${inst.account} (${inst.id})`] = [`error: ${e.message}`];
      }
    }

    // 3. Sample of repos from listForAuthenticatedUser
    const { data: userRepos } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      direction: "desc",
      per_page: 20,
    });

    const repoSample = userRepos.map((r) => ({
      full_name: r.full_name,
      private: r.private,
      owner_type: r.owner.type,
      permissions: r.permissions,
    }));

    // 4. Token scopes from response headers
    const { headers } = await octokit.request("GET /user");
    const scopes = headers["x-oauth-scopes"] || "none";
    const tokenType = headers["x-github-media-type"] || "unknown";

    return NextResponse.json({
      user: login,
      token_scopes: scopes,
      installations,
      installation_repos: installationRepos,
      repos_from_listForAuthenticatedUser: repoSample,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
