import type { Octokit } from "@octokit/rest";
import type { SharingConfig } from "@/lib/sharing-types";

const SHARING_PATH = ".mdcolab/sharing.json";

export async function checkSharingAccess(
  installationOctokit: Octokit,
  owner: string,
  repo: string,
  filePath: string,
  userLogin: string | null | undefined
): Promise<{ authorized: boolean; sharing: SharingConfig | null }> {
  try {
    const response = await installationOctokit.repos.getContent({
      owner,
      repo,
      path: SHARING_PATH,
    });

    const data = response.data;
    if (Array.isArray(data) || data.type !== "file") {
      return { authorized: false, sharing: null };
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const sharing: SharingConfig = JSON.parse(content);
    const doc = sharing.documents[filePath];

    if (!doc) {
      return { authorized: false, sharing };
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

    return { authorized: false, sharing };
  } catch {
    return { authorized: false, sharing: null };
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
    const response = await installationOctokit.repos.getContent({
      owner,
      repo,
      path: SHARING_PATH,
    });

    const data = response.data;
    if (Array.isArray(data) || data.type !== "file") {
      return { authorized: false, sharing: null };
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const sharing: SharingConfig = JSON.parse(content);

    for (const doc of Object.values(sharing.documents)) {
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
