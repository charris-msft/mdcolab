import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  rootPath: string;
}

export interface FileStatus {
  exists: boolean;
  unsaved: boolean;    // open in editor with unsaved changes
  uncommitted: boolean; // working tree or index differs from HEAD
  unpushed: boolean;   // commit touching this file is ahead of remote tracking branch
}

export function getFileStatus(
  repoRoot: string,
  relativePath: string
): FileStatus {
  const absPath = path.join(repoRoot, ...relativePath.split('/'));
  if (!fs.existsSync(absPath)) {
    return { exists: false, unsaved: false, uncommitted: false, unpushed: false };
  }
  const absNorm = absPath.toLowerCase();
  const unsaved = vscode.workspace.textDocuments.some(
    (d) =>
      d.uri.scheme === 'file' &&
      d.uri.fsPath.toLowerCase() === absNorm &&
      d.isDirty
  );

  let uncommitted = false;
  try {
    const out = execSync(
      `git status --porcelain -- "${relativePath}"`,
      { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    uncommitted = out.trim().length > 0;
  } catch {
    /* not a git repo */
  }

  let unpushed = false;
  try {
    // `git log @{u}..HEAD -- <path>` lists commits ahead of the upstream
    // that touch this file. Empty output = already pushed (or no upstream).
    const out = execSync(
      `git log "@{u}..HEAD" --oneline -- "${relativePath}"`,
      { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    unpushed = out.trim().length > 0;
  } catch {
    /* no upstream configured — treat as not unpushed */
  }

  return { exists: true, unsaved, uncommitted, unpushed };
}

export function getRepoInfo(fileUri: vscode.Uri): RepoInfo | null {
  try {
    const dir = path.dirname(fileUri.fsPath);

    // Get remote URL
    const remoteUrl = execSync('git remote get-url origin', { cwd: dir, encoding: 'utf-8' }).trim();

    // Parse owner/repo from remote URL
    // Handles: https://github.com/owner/repo.git, git@github.com:owner/repo.git
    let owner = '', repo = '';
    const httpsMatch = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      owner = httpsMatch[1];
      repo = httpsMatch[2];
    } else {
      return null; // Not a GitHub repo
    }

    // Get current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir, encoding: 'utf-8' }).trim();

    // Get repo root
    const rootPath = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf-8' }).trim();

    return { owner, repo, branch, rootPath };
  } catch {
    return null;
  }
}

export function getRelativeFilePath(fileUri: vscode.Uri, repoRoot: string): string {
  return path.relative(repoRoot, fileUri.fsPath).replace(/\\/g, '/');
}

export function buildMdcolabUrl(repoInfo: RepoInfo, relativePath: string, baseUrl: string): string {
  return `${baseUrl}/d/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/${relativePath}`;
}
