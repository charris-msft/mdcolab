import type { Octokit } from "@octokit/rest";

/**
 * Name of the per-org central repository that holds mdcolab collaboration
 * metadata (sharing config + comment issues) for repositories that cannot
 * safely host that metadata themselves (e.g. private/branch-protected repos).
 *
 * Resolved by convention as `<owner>/mdcolab`.
 */
export const CENTRAL_REPO_NAME = "mdcolab";

/** Path to the in-repo sharing config (current/default behaviour). */
export const IN_REPO_SHARING_PATH = ".mdcolab/sharing.json";

/** Label applied to every mdcolab comment issue. */
export const MDCOLAB_LABEL = "mdcolab";

export type StorageMode = "in-repo" | "central";

export interface StorageTarget {
  mode: StorageMode;
  /** Owner of the repository that physically stores the metadata. */
  owner: string;
  /** Name of the repository that physically stores the metadata. */
  repo: string;
  /** Path to sharing.json within the metadata repository. */
  sharingPath: string;
  /** The original document's repository. */
  source: { owner: string; repo: string };
}

/** Build the sharing.json path used inside a central repo for a source repo. */
export function centralSharingPath(sourceOwner: string, sourceRepo: string): string {
  return `shares/${sourceOwner}/${sourceRepo}/sharing.json`;
}

/**
 * Label used to scope comment issues in the central repo to a single source
 * repository. GitHub labels permit `/` and `:`, mirroring the existing
 * `path:<file>` label convention.
 */
export function sourceRepoLabel(sourceOwner: string, sourceRepo: string): string {
  return `source:${sourceOwner}/${sourceRepo}`;
}

/**
 * Decide whether a repo should route its metadata to the central repo.
 * Public repos always keep the current in-repo behaviour; only private repos
 * with an accessible central repo opt into central storage.
 */
export function decideCentral(isPrivate: boolean, centralExists: boolean): boolean {
  return isPrivate && centralExists;
}

export function inRepoTarget(owner: string, repo: string): StorageTarget {
  return {
    mode: "in-repo",
    owner,
    repo,
    sharingPath: IN_REPO_SHARING_PATH,
    source: { owner, repo },
  };
}

export function centralTarget(sourceOwner: string, sourceRepo: string): StorageTarget {
  return {
    mode: "central",
    owner: sourceOwner,
    repo: CENTRAL_REPO_NAME,
    sharingPath: centralSharingPath(sourceOwner, sourceRepo),
    source: { owner: sourceOwner, repo: sourceRepo },
  };
}

const targetCache = new Map<string, StorageTarget>();
const centralExistsCache = new Map<string, boolean>();

/** Clear cached storage decisions (mainly for tests). */
export function clearStorageCache(): void {
  targetCache.clear();
  centralExistsCache.clear();
}

/**
 * Whether `<owner>/mdcolab` exists and is visible to the given client.
 * Only positive results are cached: a negative result may simply mean the
 * supplied token lacks access, and a later call with a more privileged token
 * (e.g. an installation token) should be able to discover it.
 */
export async function centralRepoExists(octokit: Octokit, owner: string): Promise<boolean> {
  const key = owner.toLowerCase();
  if (centralExistsCache.get(key)) {
    return true;
  }
  try {
    await octokit.repos.get({ owner, repo: CENTRAL_REPO_NAME });
    centralExistsCache.set(key, true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the metadata target for a source repo when its privacy is already
 * known (e.g. from a repo listing), avoiding an extra `repos.get` call.
 */
export async function resolveTargetForPrivacy(
  octokit: Octokit,
  owner: string,
  repo: string,
  isPrivate: boolean,
): Promise<StorageTarget> {
  if (repo.toLowerCase() === CENTRAL_REPO_NAME) {
    return inRepoTarget(owner, repo);
  }
  if (decideCentral(isPrivate, await centralRepoExists(octokit, owner))) {
    return centralTarget(owner, repo);
  }
  return inRepoTarget(owner, repo);
}

/**
 * Determine where collaboration metadata for `owner/repo` should live.
 * Only definitive decisions (those backed by a successful `repos.get`) are
 * cached, so a failed lookup with a low-privilege token does not poison the
 * cache for a later, more privileged caller.
 */
export async function resolveStorageTarget(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<StorageTarget> {
  const key = `${owner}/${repo}`.toLowerCase();
  const cached = targetCache.get(key);
  if (cached) {
    return cached;
  }

  // The central repo itself never routes to a (recursive) central repo.
  if (repo.toLowerCase() === CENTRAL_REPO_NAME) {
    const t = inRepoTarget(owner, repo);
    targetCache.set(key, t);
    return t;
  }

  try {
    const { data } = await octokit.repos.get({ owner, repo });
    const target = await resolveTargetForPrivacy(octokit, owner, repo, data.private === true);
    targetCache.set(key, target);
    return target;
  } catch {
    // Could not read repo metadata with this token — fall back to the safe
    // in-repo default without caching, so a better-privileged caller can retry.
    return inRepoTarget(owner, repo);
  }
}
