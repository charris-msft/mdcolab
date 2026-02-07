import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  rootPath: string;
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
