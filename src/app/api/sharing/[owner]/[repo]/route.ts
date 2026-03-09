import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOctokit } from "@/lib/github";
import {
  getInstallationOctokit,
  isAppConfigured,
} from "@/lib/github-app";
import type { SharingConfig, SharingDocument } from "@/lib/sharing-types";

const SHARING_PATH = ".mdcolab/sharing.json";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { owner, repo } = await params;

  // Try with the user's own token first
  try {
    const octokit = await getOctokit();
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: SHARING_PATH,
    });

    const data = response.data;
    if (Array.isArray(data) || data.type !== "file") {
      return NextResponse.json({ sharing: null }, { status: 200 });
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const sharing: SharingConfig = JSON.parse(content);
    return NextResponse.json({ sharing, sha: data.sha });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;

    // File doesn't exist — no sharing config
    if (status === 404) {
      return NextResponse.json({ sharing: null }, { status: 200 });
    }

    // No access via user token — fall through to installation token
    if (status !== 403) {
      return NextResponse.json(
        { error: "Failed to fetch sharing config" },
        { status: 500 }
      );
    }
  }

  // Try with installation token
  if (!isAppConfigured()) {
    return NextResponse.json({ sharing: null }, { status: 200 });
  }

  try {
    const installationOctokit = await getInstallationOctokit(owner, repo);
    const response = await installationOctokit.repos.getContent({
      owner,
      repo,
      path: SHARING_PATH,
    });

    const data = response.data;
    if (Array.isArray(data) || data.type !== "file") {
      return NextResponse.json({ sharing: null }, { status: 200 });
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const sharing: SharingConfig = JSON.parse(content);
    return NextResponse.json({ sharing, sha: data.sha });
  } catch {
    return NextResponse.json({ sharing: null }, { status: 200 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { owner, repo } = await params;

  const body = await request.json();
  const { path, mode, users, sha: existingSha, allowEditing } = body as {
    path: string;
    mode: SharingDocument["mode"];
    users?: string[];
    sha?: string;
    allowEditing?: boolean;
  };

  if (!path || !mode) {
    return NextResponse.json(
      { error: "path and mode are required" },
      { status: 400 }
    );
  }

  // Allow empty users for specific_people — author can add users later

  // Permission check: user must have push access
  const octokit = await getOctokit();
  try {
    const repoResponse = await octokit.repos.get({ owner, repo });
    if (!repoResponse.data.permissions?.push) {
      return NextResponse.json(
        { error: "Write access required" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Write access required" },
      { status: 403 }
    );
  }

  // Read existing config
  let config: SharingConfig = { version: 1, documents: {} };
  let fileSha: string | undefined = existingSha;

  if (!fileSha) {
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: SHARING_PATH,
      });

      const data = response.data;
      if (!Array.isArray(data) && data.type === "file") {
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        config = JSON.parse(content);
        fileSha = data.sha;
      }
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      if (status === 403 && isAppConfigured()) {
        // Fallback to installation token for reading
        try {
          const installationOctokit = await getInstallationOctokit(owner, repo);
          const response = await installationOctokit.repos.getContent({
            owner,
            repo,
            path: SHARING_PATH,
          });

          const data = response.data;
          if (!Array.isArray(data) && data.type === "file") {
            const content = Buffer.from(data.content, "base64").toString("utf-8");
            config = JSON.parse(content);
            fileSha = data.sha;
          }
        } catch {
          // File doesn't exist — use empty config
        }
      }
      // 404 means file doesn't exist — use empty config
    }
  }

  // Update config
  config.documents[path] = {
    mode,
    users: mode === "specific_people" ? users : undefined,
    allowEditing: allowEditing === true ? true : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sharedBy: (session as any)?.login as string,
    sharedAt: new Date().toISOString(),
  };

  // Write back
  try {
    const writeResponse = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: SHARING_PATH,
      message: `docs: update sharing for ${path}`,
      content: Buffer.from(JSON.stringify(config, null, 2)).toString("base64"),
      ...(fileSha ? { sha: fileSha } : {}),
    });
    const newSha = writeResponse.data.content?.sha;
    return NextResponse.json({ success: true, sharing: config, sha: newSha });
  } catch {
    return NextResponse.json(
      { error: "Failed to update sharing config" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { owner, repo } = await params;

  const body = await request.json();
  const { path, sha: existingSha } = body as {
    path: string;
    sha?: string;
  };

  if (!path) {
    return NextResponse.json(
      { error: "path is required" },
      { status: 400 }
    );
  }

  // Permission check: user must have push access
  const octokit = await getOctokit();
  try {
    const repoResponse = await octokit.repos.get({ owner, repo });
    if (!repoResponse.data.permissions?.push) {
      return NextResponse.json(
        { error: "Write access required" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Write access required" },
      { status: 403 }
    );
  }

  // Read existing config
  let config: SharingConfig = { version: 1, documents: {} };
  let fileSha: string | undefined = existingSha;

  if (!fileSha) {
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: SHARING_PATH,
      });

      const data = response.data;
      if (!Array.isArray(data) && data.type === "file") {
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        config = JSON.parse(content);
        fileSha = data.sha;
      }
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      if (status === 404) {
        return NextResponse.json(
          { error: "No sharing config found" },
          { status: 404 }
        );
      }
      if (status === 403 && isAppConfigured()) {
        try {
          const installationOctokit = await getInstallationOctokit(owner, repo);
          const response = await installationOctokit.repos.getContent({
            owner,
            repo,
            path: SHARING_PATH,
          });

          const data = response.data;
          if (!Array.isArray(data) && data.type === "file") {
            const content = Buffer.from(data.content, "base64").toString("utf-8");
            config = JSON.parse(content);
            fileSha = data.sha;
          }
        } catch {
          return NextResponse.json(
            { error: "No sharing config found" },
            { status: 404 }
          );
        }
      }
    }
  }

  // Remove the document entry
  delete config.documents[path];

  try {
    const remainingDocs = Object.keys(config.documents).length;

    if (remainingDocs === 0 && fileSha) {
      // No documents left — delete the file entirely
      await octokit.repos.deleteFile({
        owner,
        repo,
        path: SHARING_PATH,
        message: "docs: remove sharing config",
        sha: fileSha,
      });
    } else if (fileSha) {
      // Update the file with the entry removed
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: SHARING_PATH,
        message: `docs: stop sharing ${path}`,
        content: Buffer.from(JSON.stringify(config, null, 2)).toString("base64"),
        sha: fileSha,
      });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to update sharing config" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
