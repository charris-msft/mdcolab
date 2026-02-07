const STORAGE_KEY = "mdcolab:recent-docs";
const MAX_RECENT = 10;

export interface RecentDoc {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  fileName: string;
  accessedAt: string;
}

export function getRecentDocs(): RecentDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentDoc(doc: Omit<RecentDoc, "accessedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const docs = getRecentDocs();
    // Remove existing entry for same file
    const filtered = docs.filter(
      (d) => !(d.owner === doc.owner && d.repo === doc.repo && d.branch === doc.branch && d.path === doc.path)
    );
    // Add to front
    filtered.unshift({ ...doc, accessedAt: new Date().toISOString() });
    // Cap at MAX_RECENT
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch {
    // localStorage may be full or unavailable
  }
}
