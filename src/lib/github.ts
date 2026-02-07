import { Octokit } from "@octokit/rest";
import { auth } from "@/lib/auth";

export async function getOctokit() {
  const session = await auth();
  if (!session || !(session as unknown as Record<string, unknown>).accessToken) {
    throw new Error("Not authenticated");
  }
  return new Octokit({
    auth: (session as unknown as Record<string, unknown>).accessToken as string,
  });
}

export async function getSession() {
  return await auth();
}
