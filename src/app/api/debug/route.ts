import { NextResponse } from "next/server";
import { getOctokit, getSession } from "@/lib/github";

type SessionWithLogin = { login?: string };

interface InstallationSummary {
  id: number;
  account?: string;
  account_type?: string;
  app_slug?: string;
  repository_selection?: string;
  permissions?: unknown;
  error?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getAccountName(account: unknown): string | undefined {
  if (!account || typeof account !== "object") return undefined;
  if ("login" in account && typeof account.login === "string") return account.login;
  if ("name" in account && typeof account.name === "string") return account.name;
  return undefined;
}

function getAccountType(account: unknown): string | undefined {
  if (!account || typeof account !== "object") return undefined;
  if ("type" in account && typeof account.type === "string") return account.type;
  return undefined;
}

export async function GET() {
  try {
    const octokit = await getOctokit();
    const session = await getSession();
    const login = (session as SessionWithLogin | null)?.login;

    // 1. Check installations
    let installations: InstallationSummary[] = [];
    try {
      const { data } = await octokit.request("GET /user/installations", {
        per_page: 100,
      });
      installations = data.installations.map((i) => ({
        id: i.id,
        account: getAccountName(i.account),
        account_type: getAccountType(i.account),
        app_slug: i.app_slug,
        repository_selection: i.repository_selection,
        permissions: i.permissions,
      }));
    } catch (e: unknown) {
      installations = [{ id: 0, error: getErrorMessage(e) }];
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
          (r) => r.full_name
        );
      } catch (e: unknown) {
        installationRepos[`${inst.account} (${inst.id})`] = [`error: ${getErrorMessage(e)}`];
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
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
