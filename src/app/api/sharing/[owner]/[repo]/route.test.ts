import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SharingConfig } from "@/lib/sharing-types";

// --- Mocks -------------------------------------------------------------
const authMock = vi.fn();
const getOctokitMock = vi.fn();
const getInstallationOctokitMock = vi.fn();
const isAppConfiguredMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/github", () => ({
  getOctokit: () => getOctokitMock(),
}));

vi.mock("@/lib/github-app", () => ({
  getInstallationOctokit: (...args: unknown[]) => getInstallationOctokitMock(...args),
  isAppConfigured: () => isAppConfiguredMock(),
}));

// Import AFTER vi.mock so the mocks are picked up.
import { PUT, DELETE } from "./route";

// --- Helpers -----------------------------------------------------------
interface FakeRemote {
  config: SharingConfig | null;
  sha: string;
}

function makeOctokit(remote: FakeRemote, opts?: { pushAccess?: boolean }) {
  return {
    repos: {
      get: vi.fn().mockResolvedValue({
        data: { permissions: { push: opts?.pushAccess ?? true } },
      }),
      getContent: vi.fn().mockImplementation(async () => {
        if (!remote.config) {
          const err = new Error("Not Found") as Error & { status: number };
          err.status = 404;
          throw err;
        }
        return {
          data: {
            type: "file",
            sha: remote.sha,
            content: Buffer.from(
              JSON.stringify(remote.config, null, 2)
            ).toString("base64"),
          },
        };
      }),
      createOrUpdateFileContents: vi
        .fn()
        .mockImplementation(async ({ content, sha }: { content: string; sha?: string }) => {
          // Enforce sha matching GitHub-style concurrency control.
          if (remote.config && sha !== remote.sha) {
            const err = new Error("sha mismatch") as Error & { status: number };
            err.status = 409;
            throw err;
          }
          const decoded = Buffer.from(content, "base64").toString("utf-8");
          remote.config = JSON.parse(decoded);
          remote.sha = remote.sha + "-new";
          return { data: { content: { sha: remote.sha } } };
        }),
      deleteFile: vi.fn().mockImplementation(async () => {
        remote.config = null;
        remote.sha = "";
        return { data: {} };
      }),
    },
  };
}

function makeParams(owner: string, repo: string) {
  return { params: Promise.resolve({ owner, repo }) };
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/sharing/o/r", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Tests -------------------------------------------------------------
describe("PUT /api/sharing/[owner]/[repo]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ login: "alice" });
    isAppConfiguredMock.mockReturnValue(false);
  });

  it("preserves existing documents when sharing a new one (regression: clobbered config)", async () => {
    const remote: FakeRemote = {
      sha: "sha-1",
      config: {
        version: 1,
        documents: {
          "docs/existing.md": {
            mode: "anyone_with_link",
            sharedBy: "bob",
            sharedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    };
    getOctokitMock.mockResolvedValue(makeOctokit(remote));

    const res = await PUT(
      makeReq({
        path: "docs/new.md",
        mode: "anyone_with_link",
        // Client supplies a SHA — must NOT be allowed to short-circuit the read.
        sha: "sha-1",
      }),
      makeParams("o", "r")
    );

    expect(res.status).toBe(200);
    expect(Object.keys(remote.config!.documents).sort()).toEqual([
      "docs/existing.md",
      "docs/new.md",
    ]);
    expect(remote.config!.documents["docs/existing.md"].sharedBy).toBe("bob");
    expect(remote.config!.documents["docs/new.md"].mode).toBe("anyone_with_link");
  });

  it("creates a new config when none exists", async () => {
    const remote: FakeRemote = { sha: "", config: null };
    getOctokitMock.mockResolvedValue(makeOctokit(remote));

    const res = await PUT(
      makeReq({ path: "docs/first.md", mode: "anyone_with_link" }),
      makeParams("o", "r")
    );

    expect(res.status).toBe(200);
    expect(remote.config!.documents["docs/first.md"].mode).toBe("anyone_with_link");
  });

  it("decodes URL-encoded paths when writing", async () => {
    const remote: FakeRemote = { sha: "", config: null };
    getOctokitMock.mockResolvedValue(makeOctokit(remote));

    await PUT(
      makeReq({ path: "Plugin/Azure%20MCP/doc.md", mode: "anyone_with_link" }),
      makeParams("o", "r")
    );

    expect(Object.keys(remote.config!.documents)).toEqual([
      "Plugin/Azure MCP/doc.md",
    ]);
  });

  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);
    const res = await PUT(
      makeReq({ path: "a.md", mode: "anyone_with_link" }),
      makeParams("o", "r")
    );
    expect(res.status).toBe(401);
  });

  it("rejects users without push access", async () => {
    const remote: FakeRemote = { sha: "", config: null };
    getOctokitMock.mockResolvedValue(makeOctokit(remote, { pushAccess: false }));
    const res = await PUT(
      makeReq({ path: "a.md", mode: "anyone_with_link" }),
      makeParams("o", "r")
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/sharing/[owner]/[repo]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ login: "alice" });
    isAppConfiguredMock.mockReturnValue(false);
  });

  function makeDelReq(body: unknown): Request {
    return new Request("http://localhost/api/sharing/o/r", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("preserves other documents when unsharing one (regression: clobbered config)", async () => {
    const remote: FakeRemote = {
      sha: "sha-1",
      config: {
        version: 1,
        documents: {
          "docs/keep.md": {
            mode: "anyone_with_link",
            sharedBy: "bob",
            sharedAt: "2026-01-01T00:00:00.000Z",
          },
          "docs/remove.md": {
            mode: "anyone_with_link",
            sharedBy: "alice",
            sharedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      },
    };
    getOctokitMock.mockResolvedValue(makeOctokit(remote));

    const res = await DELETE(
      makeDelReq({ path: "docs/remove.md", sha: "sha-1" }),
      makeParams("o", "r")
    );

    expect(res.status).toBe(200);
    expect(Object.keys(remote.config!.documents)).toEqual(["docs/keep.md"]);
  });

  it("deletes sharing.json entirely when last entry is removed", async () => {
    const remote: FakeRemote = {
      sha: "sha-1",
      config: {
        version: 1,
        documents: {
          "only.md": {
            mode: "anyone_with_link",
            sharedBy: "alice",
            sharedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    };
    getOctokitMock.mockResolvedValue(makeOctokit(remote));

    const res = await DELETE(
      makeDelReq({ path: "only.md" }),
      makeParams("o", "r")
    );

    expect(res.status).toBe(200);
    expect(remote.config).toBeNull();
  });
});
