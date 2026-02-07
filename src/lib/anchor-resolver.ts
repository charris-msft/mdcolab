import type { CommentThread } from "@/types";

export interface AnchorResult {
  threadId: string;
  status: "exact" | "fuzzy" | "orphaned";
  newOffset?: { start: number; end: number };
}

/**
 * Re-anchor comment threads to the current document content.
 * Called when loading a document that may have been edited outside mdcolab.
 */
export function resolveAnchors(
  threads: CommentThread[],
  currentContent: string
): AnchorResult[] {
  return threads.map((thread) => {
    if (thread.anchor.type !== "text-range") {
      return { threadId: thread.id, status: "exact" as const };
    }

    const { selectedText, context, markdownOffset } = thread.anchor;

    // 1. Try exact offset match
    if (markdownOffset) {
      const textAtOffset = currentContent.slice(
        markdownOffset.start,
        markdownOffset.end
      );
      if (textAtOffset === selectedText) {
        return { threadId: thread.id, status: "exact" as const };
      }
    }

    // 2. Try exact text search
    const exactIndex = currentContent.indexOf(selectedText);
    if (exactIndex !== -1) {
      return {
        threadId: thread.id,
        status: "fuzzy" as const,
        newOffset: { start: exactIndex, end: exactIndex + selectedText.length },
      };
    }

    // 3. Try fuzzy search with context
    if (context.before || context.after) {
      const searchPattern = context.before + selectedText + context.after;
      const patternIndex = currentContent.indexOf(searchPattern);
      if (patternIndex !== -1) {
        const start = patternIndex + context.before.length;
        return {
          threadId: thread.id,
          status: "fuzzy" as const,
          newOffset: { start, end: start + selectedText.length },
        };
      }

      // Try with just context.before
      if (context.before) {
        const beforeIndex = currentContent.indexOf(context.before);
        if (beforeIndex !== -1) {
          const possibleStart = beforeIndex + context.before.length;
          const possibleText = currentContent.slice(
            possibleStart,
            possibleStart + selectedText.length + 20
          );
          if (
            similarity(
              possibleText.slice(0, selectedText.length),
              selectedText
            ) > 0.6
          ) {
            return {
              threadId: thread.id,
              status: "fuzzy" as const,
              newOffset: {
                start: possibleStart,
                end: possibleStart + selectedText.length,
              },
            };
          }
        }
      }
    }

    // 4. Orphaned
    return { threadId: thread.id, status: "orphaned" as const };
  });
}

/** Simple string similarity (Dice coefficient) */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const aBigrams = getBigrams(a.toLowerCase());
  const bBigrams = getBigrams(b.toLowerCase());
  let intersection = 0;
  for (const bigram of aBigrams) {
    if (bBigrams.has(bigram)) intersection++;
  }
  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}
