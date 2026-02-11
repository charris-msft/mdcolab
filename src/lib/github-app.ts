import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

const CACHE_TTL_MS = 5 * 60 * 1000;

const installationCache = new Map<
  string,
  { id: number; expiresAt: number }
>();

export function isAppConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

export function getAppOctokit(): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error(
      "GitHub App not configured: GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required"
    );
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });
}

export async function getInstallationId(
  owner: string
): Promise<number | null> {
  const cached = installationCache.get(owner);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.id;
  }

  const appOctokit = getAppOctokit();
  const { data: installations } = await appOctokit.request(
    "GET /app/installations"
  );

  const installation = installations.find(
    (inst) =>
      inst.account &&
      "login" in inst.account &&
      inst.account.login?.toLowerCase() === owner.toLowerCase()
  );

  if (!installation) {
    return null;
  }

  installationCache.set(owner, {
    id: installation.id,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return installation.id;
}

export async function getInstallationOctokit(
  owner: string,
  repo: string
): Promise<Octokit> {
  const installationId = await getInstallationId(owner);
  if (!installationId) {
    throw new Error(
      `No GitHub App installation found for owner "${owner}". ` +
        `Install the app on the "${owner}" account to access ${owner}/${repo}.`
    );
  }

  const appId = process.env.GITHUB_APP_ID!;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY!;

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });
}
