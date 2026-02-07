import * as vscode from 'vscode';
import { CommentThread as MdcolabThread } from './github-api.js';

// Decoration type for highlighted comment anchors
const commentHighlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(123, 97, 255, 0.1)',
  border: 'none none 2px solid rgba(123, 97, 255, 0.4) none',
  overviewRulerColor: 'rgba(123, 97, 255, 0.6)',
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

const activeCommentDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(123, 97, 255, 0.25)',
  border: 'none none 2px solid rgba(123, 97, 255, 0.8) none',
  overviewRulerColor: 'rgba(123, 97, 255, 1)',
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

export interface AnchorRange {
  thread: MdcolabThread;
  range: vscode.Range;
}

export function findAnchorRanges(document: vscode.TextDocument, threads: MdcolabThread[]): AnchorRange[] {
  const text = document.getText();
  const ranges: AnchorRange[] = [];

  for (const thread of threads) {
    if (thread.anchor.type !== 'text-range' || !thread.anchor.selectedText) {
      continue;
    }

    const searchText = thread.anchor.selectedText;
    const index = text.indexOf(searchText);
    if (index === -1) { continue; }

    const startPos = document.positionAt(index);
    const endPos = document.positionAt(index + searchText.length);
    ranges.push({ thread, range: new vscode.Range(startPos, endPos) });
  }

  return ranges;
}

export function applyDecorations(
  editor: vscode.TextEditor,
  anchorRanges: AnchorRange[],
  activeIssueNumber?: number
): void {
  const normalRanges: vscode.DecorationOptions[] = [];
  const activeRanges: vscode.DecorationOptions[] = [];

  for (const { thread, range } of anchorRanges) {
    const preview = thread.body.length > 60 ? thread.body.slice(0, 60) + '…' : thread.body;
    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.appendMarkdown(`**@${thread.author}**: ${preview}\n\n`);
    if (thread.replies.length > 0) {
      hoverMessage.appendMarkdown(`_${thread.replies.length} ${thread.replies.length === 1 ? 'reply' : 'replies'}_\n\n`);
    }
    hoverMessage.appendMarkdown(`[Open in mdcolab](command:mdcolab.openInMdcolab) · `);
    hoverMessage.appendMarkdown(thread.state === 'open' ? `[Resolve](command:mdcolab.resolveThread?${thread.issueNumber})` : `_Resolved_`);
    hoverMessage.isTrusted = true;

    const decoration: vscode.DecorationOptions = { range, hoverMessage };

    if (thread.issueNumber === activeIssueNumber) {
      activeRanges.push(decoration);
    } else {
      normalRanges.push(decoration);
    }
  }

  editor.setDecorations(commentHighlightDecoration, normalRanges);
  editor.setDecorations(activeCommentDecoration, activeRanges);
}

export function clearDecorations(editor: vscode.TextEditor): void {
  editor.setDecorations(commentHighlightDecoration, []);
  editor.setDecorations(activeCommentDecoration, []);
}
