const STORAGE_PREFIX = "mdcolab:recent-docs";
const MAX_RECENT = 10;

function storageKey(login?: string): string {
  return login ? `${STORAGE_PREFIX}:${login}` : STORAGE_PREFIX;
}

export interface RecentDoc {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  fileName: string;
  accessedAt: string;
}

export function getRecentDocs(login?: string): RecentDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(login));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentDoc(doc: Omit<RecentDoc, "accessedAt">, login?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(login);
    const docs = getRecentDocs(login);
    // Remove existing entry for same file
    const filtered = docs.filter(
      (d) => !(d.owner === doc.owner && d.repo === doc.repo && d.branch === doc.branch && d.path === doc.path)
    );
    // Add to front
    filtered.unshift({ ...doc, accessedAt: new Date().toISOString() });
    // Cap at MAX_RECENT
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch {
    // localStorage may be full or unavailable
  }
}
