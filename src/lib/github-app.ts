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

/**
 * Opportunistic variant of {@link getInstallationOctokit}. Returns an
 * installation-authenticated Octokit when the GitHub App is configured AND
 * installed for the owner, otherwise `null`. Never throws, so callers can treat
 * the App as a best-effort helper: try the user's own token first and only use
 * this as a fallback. A `null` result means "the App can't help here" and the
 * caller should report a normal access error to the user rather than anything
 * App-specific.
 */
export async function tryGetInstallationOctokit(
  owner: string,
  repo: string
): Promise<Octokit | null> {
  if (!isAppConfigured()) {
    return null;
  }
  let installationId: number | null;
  try {
    installationId = await getInstallationId(owner);
  } catch (err) {
    // Unexpected failure (bad key, GitHub outage, rate limit). The App can't
    // help right now, but log it so it isn't silently mistaken for "not installed".
    console.error(`tryGetInstallationOctokit: failed to resolve installation for "${owner}"`, err);
    return null;
  }
  if (!installationId) {
    return null;
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
