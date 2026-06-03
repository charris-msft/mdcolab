import * as vscode from 'vscode';
import { getRepoInfo, getRelativeFilePath } from './git-utils.js';
import * as api from './github-api.js';
import { MdcolabEditorPanel } from './mdcolab-editor-panel.js';

/**
 * Resolve repo context from the active text editor or WYSIWYG panel.
 * Tries activeTextEditor first, then falls back to the focused WYSIWYG panel.
 */
function resolveContext(): {
  owner: string;
  repo: string;
  filePath: string;
  documentText: string;
} | null {
  // Try active text editor first
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.languageId === 'markdown') {
    const repoInfo = getRepoInfo(editor.document.uri);
    if (repoInfo) {
      return {
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        filePath: getRelativeFilePath(editor.document.uri, repoInfo.rootPath),
        documentText: editor.document.getText(),
      };
    }
  }

  // Fall back to active WYSIWYG panel
  const panelCtx = MdcolabEditorPanel.getActiveContext();
  if (panelCtx) {
    return {
      owner: panelCtx.owner,
      repo: panelCtx.repo,
      filePath: panelCtx.filePath,
      documentText: panelCtx.content,
    };
  }

  return null;
}

/**
 * Find selectedText in document content and build a CommentAnchor with context.
 */
function buildAnchor(
  documentText: string,
  selectedText: string,
): api.CommentAnchor | { error: string } {
  const firstIndex = documentText.indexOf(selectedText);
  if (firstIndex === -1) {
    return { error: `Text "${selectedText}" not found in the document.` };
  }

  const before = documentText.slice(Math.max(0, firstIndex - 100), firstIndex);
  const after = documentText.slice(
    firstIndex + selectedText.length,
    firstIndex + selectedText.length + 100,
  );

  return {
    type: 'text-range',
    selectedText,
    context: { before, after },
  };
}

// ─── Tool: Add Comment ─────────────────────────────────────────

interface AddCommentInput {
  selectedText: string;
  body: string;
}

class AddCommentTool implements vscode.LanguageModelTool<AddCommentInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AddCommentInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { selectedText, body } = options.input;
    const ctx = resolveContext();
    if (!ctx) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: No markdown file is open in a GitHub repository.',
        ),
      ]);
    }

    const anchor = buildAnchor(ctx.documentText, selectedText);
    if ('error' in anchor) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error: ${anchor.error}`),
      ]);
    }

    try {
      const thread = await api.createCommentThread(
        ctx.owner,
        ctx.repo,
        ctx.filePath,
        anchor,
        body,
      );
      if (thread) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Comment created (Issue #${thread.issueNumber}) anchored to "${selectedText}": ${body}`,
          ),
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Failed to create comment.'),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error creating comment: ${err instanceof Error ? err.message : err}`,
        ),
      ]);
    }
  }
}

// ─── Tool: Add General Comment ─────────────────────────────────

interface AddGeneralCommentInput {
  body: string;
}

class AddGeneralCommentTool
  implements vscode.LanguageModelTool<AddGeneralCommentInput>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AddGeneralCommentInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { body } = options.input;
    const ctx = resolveContext();
    if (!ctx) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: No markdown file is open in a GitHub repository.',
        ),
      ]);
    }

    const anchor: api.CommentAnchor = {
      type: 'document',
      selectedText: '',
      context: { before: '', after: '' },
    };

    try {
      const thread = await api.createCommentThread(
        ctx.owner,
        ctx.repo,
        ctx.filePath,
        anchor,
        body,
      );
      if (thread) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `General comment created (Issue #${thread.issueNumber}): ${body}`,
          ),
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Failed to create comment.'),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error: ${err instanceof Error ? err.message : err}`,
        ),
      ]);
    }
  }
}

// ─── Tool: List Comments ───────────────────────────────────────

interface ListCommentsInput {
  status?: 'open' | 'resolved' | 'all';
}

class ListCommentsTool
  implements vscode.LanguageModelTool<ListCommentsInput>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ListCommentsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const status = options.input.status ?? 'all';
    const ctx = resolveContext();
    if (!ctx) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: No markdown file is open in a GitHub repository.',
        ),
      ]);
    }

    try {
      const threads = await api.fetchCommentThreads(
        ctx.owner,
        ctx.repo,
        ctx.filePath,
      );

      const filtered = threads.filter((t) => {
        if (status === 'all') return true;
        if (status === 'open') return t.state === 'open';
        return t.state === 'closed';
      });

      if (filtered.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No ${status === 'all' ? '' : status + ' '}comments found on ${ctx.filePath}.`,
          ),
        ]);
      }

      const lines = filtered.map((t) => {
        const anchor =
          t.anchor.type !== 'document' && t.anchor.selectedText
            ? `"${t.anchor.selectedText.slice(0, 60)}${t.anchor.selectedText.length > 60 ? '…' : ''}"`
            : '(document-level)';
        const replies =
          t.replies.length > 0
            ? ` (${t.replies.length} ${t.replies.length === 1 ? 'reply' : 'replies'})`
            : '';
        return `- Issue #${t.issueNumber} [${t.state}] ${anchor}: ${t.body.slice(0, 100)}${t.body.length > 100 ? '…' : ''}${replies}`;
      });

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `${filtered.length} comment(s) on ${ctx.filePath}:\n${lines.join('\n')}`,
        ),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error listing comments: ${err instanceof Error ? err.message : err}`,
        ),
      ]);
    }
  }
}

// ─── Tool: Reply to Comment ────────────────────────────────────

interface ReplyToCommentInput {
  issueNumber: number;
  body: string;
}

class ReplyToCommentTool
  implements vscode.LanguageModelTool<ReplyToCommentInput>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ReplyToCommentInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { issueNumber, body } = options.input;
    const ctx = resolveContext();
    if (!ctx) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: No markdown file is open in a GitHub repository.',
        ),
      ]);
    }

    try {
      const reply = await api.replyToThread(
        ctx.owner,
        ctx.repo,
        issueNumber,
        body,
      );
      if (reply) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Reply added to Issue #${issueNumber}: ${body}`,
          ),
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Failed to add reply.'),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error: ${err instanceof Error ? err.message : err}`,
        ),
      ]);
    }
  }
}

// ─── Tool: Resolve Comment ─────────────────────────────────────

interface ResolveCommentInput {
  issueNumber: number;
}

class ResolveCommentTool
  implements vscode.LanguageModelTool<ResolveCommentInput>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ResolveCommentInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { issueNumber } = options.input;
    const ctx = resolveContext();
    if (!ctx) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: No markdown file is open in a GitHub repository.',
        ),
      ]);
    }

    try {
      await api.resolveThread(ctx.owner, ctx.repo, issueNumber);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Comment #${issueNumber} resolved.`,
        ),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error: ${err instanceof Error ? err.message : err}`,
        ),
      ]);
    }
  }
}

// ─── Registration ──────────────────────────────────────────────

export function registerCopilotTools(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.lm.registerTool('mdcolab_addComment', new AddCommentTool()),
    vscode.lm.registerTool('mdcolab_addGeneralComment', new AddGeneralCommentTool()),
    vscode.lm.registerTool('mdcolab_listComments', new ListCommentsTool()),
    vscode.lm.registerTool('mdcolab_replyToComment', new ReplyToCommentTool()),
    vscode.lm.registerTool('mdcolab_resolveComment', new ResolveCommentTool()),
  );
}
