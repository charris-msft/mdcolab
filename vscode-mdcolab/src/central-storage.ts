import type { Octokit } from '@octokit/rest';

/**
 * Name of the per-org central repository that holds mdcolab collaboration
 * metadata (sharing config + comment issues) for repositories that cannot
 * safely host that metadata themselves (e.g. private/branch-protected repos).
 *
 * Resolved by convention as `<owner>/mdcolab`.
 */
export const CENTRAL_REPO_NAME = 'mdcolab';

/** Path to the in-repo sharing config (current/default behaviour). */
export const IN_REPO_SHARING_PATH = '.mdcolab/sharing.json';

/** Label applied to every mdcolab comment issue. */
export const MDCOLAB_LABEL = 'mdcolab';

export type StorageMode = 'in-repo' | 'central';

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
    mode: 'in-repo',
    owner,
    repo,
    sharingPath: IN_REPO_SHARING_PATH,
    source: { owner, repo },
  };
}

export function centralTarget(sourceOwner: string, sourceRepo: string): StorageTarget {
  return {
    mode: 'central',
    owner: sourceOwner,
    repo: CENTRAL_REPO_NAME,
    sharingPath: centralSharingPath(sourceOwner, sourceRepo),
    source: { owner: sourceOwner, repo: sourceRepo },
  };
}

const targetCache = new Map<string, StorageTarget>();
const centralExistsCache = new Map<string, boolean>();

/** Clear cached storage decisions (e.g. after auth/scope changes). */
export function clearStorageCache(): void {
  targetCache.clear();
  centralExistsCache.clear();
}

async function centralRepoExists(octokit: Octokit, owner: string): Promise<boolean> {
  const key = owner.toLowerCase();
  const cached = centralExistsCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  let exists = false;
  try {
    await octokit.repos.get({ owner, repo: CENTRAL_REPO_NAME });
    exists = true;
  } catch {
    exists = false;
  }
  centralExistsCache.set(key, exists);
  return exists;
}

/**
 * Determine where collaboration metadata for `owner/repo` should live.
 * Results are cached per source repo for the lifetime of the extension host.
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

  let target = inRepoTarget(owner, repo);
  try {
    const { data } = await octokit.repos.get({ owner, repo });
    const isPrivate = data.private === true;
    if (isPrivate && (await centralRepoExists(octokit, owner))) {
      target = centralTarget(owner, repo);
    }
  } catch {
    // If we cannot read repo metadata, keep the safe in-repo default.
  }

  targetCache.set(key, target);
  return target;
}
