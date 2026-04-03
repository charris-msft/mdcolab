export interface CommentAuthor {
  login: string | null;
  displayName?: string;
  avatarUrl: string | null;
  isAnonymous?: boolean;
}

export interface SuggestedEdit {
  replacement: string;
  status: "pending" | "accepted" | "rejected";
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  body: string;
  mentions: string[];
  suggestedEdit: SuggestedEdit | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CommentAnchor {
  type: "text-range" | "document";
  markdownOffset?: {
    start: number;
    end: number;
  };
  selectedText: string;
  context: {
    before: string;
    after: string;
  };
}

export interface CommentThread {
  id: string;
  status: "open" | "resolved";
  promoted?: "bug" | "feature";
  anchor: CommentAnchor;
  comments: Comment[];
}

export interface CommentsFile {
  version: string;
  documentHash: string;
  threads: CommentThread[];
}

export interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  size?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  private: boolean;
  default_branch: string;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
}
