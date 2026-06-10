import type { Octokit } from "@octokit/rest";
import type { SharingConfig } from "@/lib/sharing-types";
import { resolveStorageTarget } from "@/lib/central-storage";

export async function checkSharingAccess(
  installationOctokit: Octokit,
  owner: string,
  repo: string,
  filePath: string,
  userLogin: string | null | undefined
): Promise<{ authorized: boolean; allowEditing: boolean; sharing: SharingConfig | null }> {
  try {
    const target = await resolveStorageTarget(installationOctokit, owner, repo);
    const response = await installationOctokit.repos.getContent({
      owner: target.owner,
      repo: target.repo,
      path: target.sharingPath,
    });

    const data = response.data;
    if (Array.isArray(data) || data.type !== "file") {
      return { authorized: false, allowEditing: false, sharing: null };
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const sharing: SharingConfig = JSON.parse(content);
    // Try exact match first, then decoded/encoded variants to handle
    // URL-encoded paths like "Azure%20MCP" vs decoded "Azure MCP"
    const doc =
      sharing.documents[filePath] ??
      sharing.documents[decodeURIComponent(filePath)] ??
      sharing.documents[encodeURIComponent(filePath).replace(/%2F/gi, "/")] ??
      null;

    if (!doc) {
      return { authorized: false, allowEditing: false, sharing };
    }

    // Reject expired shares
    if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
      return { authorized: false, allowEditing: false, sharing };
    }

    const allowEditing = doc.allowEditing === true;

    if (doc.mode === "anyone_with_link") {
      return { authorized: true, allowEditing, sharing };
    }

    if (
      doc.mode === "specific_people" &&
      userLogin &&
      doc.users?.some((u) => u.toLowerCase() === userLogin.toLowerCase())
    ) {
      return { authorized: true, allowEditing, sharing };
    }

    return { authorized: false, allowEditing: false, sharing };
  } catch {
    return { authorized: false, allowEditing: false, sharing: null };
  }
}

/**
 * Check if ANY document in the repo is shared with the given user.
 */
export async function checkAnySharingAccess(
  installationOctokit: Octokit,
  owner: string,
  repo: string,
  userLogin: string | null | undefined
): Promise<{ authorized: boolean; sharing: SharingConfig | null }> {
  try {
    const target = await resolveStorageTarget(installationOctokit, owner, repo);
    const response = await installationOctokit.repos.getContent({
      owner: target.owner,
      repo: target.repo,
      path: target.sharingPath,
    });

    const data = response.data;
    if (Array.isArray(data) || data.type !== "file") {
      return { authorized: false, sharing: null };
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const sharing: SharingConfig = JSON.parse(content);

    for (const doc of Object.values(sharing.documents)) {
      // Skip expired shares
      if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
        continue;
      }
      if (doc.mode === "anyone_with_link") {
        return { authorized: true, sharing };
      }
      if (
        doc.mode === "specific_people" &&
        userLogin &&
        doc.users?.some((u) => u.toLowerCase() === userLogin.toLowerCase())
      ) {
        return { authorized: true, sharing };
      }
    }

    return { authorized: false, sharing };
  } catch {
    return { authorized: false, sharing: null };
  }
}
