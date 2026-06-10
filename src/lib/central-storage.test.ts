import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  centralSharingPath,
  sourceRepoLabel,
  decideCentral,
  inRepoTarget,
  centralTarget,
  resolveStorageTarget,
  resolveTargetForPrivacy,
  clearStorageCache,
  CENTRAL_REPO_NAME,
  IN_REPO_SHARING_PATH,
} from "./central-storage";
import type { Octokit } from "@octokit/rest";

function makeOctokit(opts: {
  repos?: Record<string, { private?: boolean } | "missing">;
}): Octokit {
  const get = vi.fn(async ({ owner, repo }: { owner: string; repo: string }) => {
    const entry = opts.repos?.[`${owner}/${repo}`];
    if (!entry || entry === "missing") {
      const err = new Error("Not Found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    return { data: { private: entry.private === true } };
  });
  return { repos: { get } } as unknown as Octokit;
}

describe("central-storage pure helpers", () => {
  it("centralSharingPath builds a per-source-repo path", () => {
    expect(centralSharingPath("acme", "docs")).toBe("shares/acme/docs/sharing.json");
  });

  it("sourceRepoLabel builds a source-scoped label", () => {
    expect(sourceRepoLabel("acme", "docs")).toBe("source:acme/docs");
  });

  it("decideCentral requires private AND an existing central repo", () => {
    expect(decideCentral(true, true)).toBe(true);
    expect(decideCentral(true, false)).toBe(false);
    expect(decideCentral(false, true)).toBe(false);
  });

  it("inRepoTarget points at the source repo", () => {
    expect(inRepoTarget("acme", "docs")).toEqual({
      mode: "in-repo",
      owner: "acme",
      repo: "docs",
      sharingPath: IN_REPO_SHARING_PATH,
      source: { owner: "acme", repo: "docs" },
    });
  });

  it("centralTarget points at <owner>/mdcolab", () => {
    expect(centralTarget("acme", "private-docs")).toEqual({
      mode: "central",
      owner: "acme",
      repo: CENTRAL_REPO_NAME,
      sharingPath: "shares/acme/private-docs/sharing.json",
      source: { owner: "acme", repo: "private-docs" },
    });
  });
});

describe("resolveStorageTarget", () => {
  beforeEach(() => clearStorageCache());

  it("routes a private repo to central when the central repo exists", async () => {
    const octokit = makeOctokit({
      repos: { "acme/private-docs": { private: true }, "acme/mdcolab": { private: true } },
    });
    const t = await resolveStorageTarget(octokit, "acme", "private-docs");
    expect(t.mode).toBe("central");
    expect(t.owner).toBe("acme");
    expect(t.repo).toBe("mdcolab");
    expect(t.sharingPath).toBe("shares/acme/private-docs/sharing.json");
  });

  it("keeps a public repo in-repo even when a central repo exists", async () => {
    const octokit = makeOctokit({
      repos: { "acme/public-docs": { private: false }, "acme/mdcolab": { private: true } },
    });
    const t = await resolveStorageTarget(octokit, "acme", "public-docs");
    expect(t.mode).toBe("in-repo");
    expect(t.sharingPath).toBe(IN_REPO_SHARING_PATH);
  });

  it("keeps a private repo in-repo when no central repo exists", async () => {
    const octokit = makeOctokit({
      repos: { "acme/private-docs": { private: true }, "acme/mdcolab": "missing" },
    });
    const t = await resolveStorageTarget(octokit, "acme", "private-docs");
    expect(t.mode).toBe("in-repo");
  });

  it("never routes the central repo itself to a recursive central repo", async () => {
    const octokit = makeOctokit({ repos: { "acme/mdcolab": { private: true } } });
    const t = await resolveStorageTarget(octokit, "acme", "mdcolab");
    expect(t.mode).toBe("in-repo");
  });

  it("does not cache an in-repo fallback when repo metadata is unreadable", async () => {
    const unreadable = makeOctokit({ repos: { "acme/mdcolab": { private: true } } });
    const first = await resolveStorageTarget(unreadable, "acme", "private-docs");
    expect(first.mode).toBe("in-repo");

    // A later, privileged client can still discover the central route.
    const privileged = makeOctokit({
      repos: { "acme/private-docs": { private: true }, "acme/mdcolab": { private: true } },
    });
    const second = await resolveStorageTarget(privileged, "acme", "private-docs");
    expect(second.mode).toBe("central");
  });
});

describe("resolveTargetForPrivacy", () => {
  beforeEach(() => clearStorageCache());

  it("avoids a source repos.get and uses the supplied privacy flag", async () => {
    const octokit = makeOctokit({ repos: { "acme/mdcolab": { private: true } } });
    const t = await resolveTargetForPrivacy(octokit, "acme", "private-docs", true);
    expect(t.mode).toBe("central");
    // Only the central-existence check should hit repos.get.
    expect((octokit.repos.get as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });
});
