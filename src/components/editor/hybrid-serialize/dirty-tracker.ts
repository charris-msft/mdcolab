import type { Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { ReplaceStep, ReplaceAroundStep } from "@tiptap/pm/transform";

/**
 * Tracks which top-level blocks have been modified by the user.
 * Blocks are identified by their `blockId` attr (stable across transactions).
 */
export class DirtyTracker {
  private dirtyIds = new Set<string>();

  /**
   * Process a transaction and mark any affected top-level blocks as dirty.
   */
  onTransaction(tr: Transaction): void {
    if (!tr.docChanged) return;

    const newDoc = tr.doc;

    for (const step of tr.steps) {
      const stepMap = step.getMap();
      // Collect all affected ranges in the new document
      const affectedRanges: Array<{ from: number; to: number }> = [];

      stepMap.forEach((oldFrom, oldTo, newFrom, newTo) => {
        affectedRanges.push({ from: newFrom, to: newTo });
      });

      // Also handle ReplaceAroundStep gap ranges
      const replaceAround = step as unknown as ReplaceAroundStep;
      if (replaceAround.gapFrom !== undefined && replaceAround.gapTo !== undefined) {
        const replaceStep = step as ReplaceStep | ReplaceAroundStep;
        // The gap is the preserved content; the areas outside the gap are modified
        affectedRanges.push({ from: replaceStep.from, to: replaceAround.gapFrom });
        affectedRanges.push({ from: replaceAround.gapTo, to: replaceStep.to });
      }

      // Map affected ranges to top-level block IDs
      for (const range of affectedRanges) {
        this.markBlocksInRange(newDoc, range.from, range.to);
      }
    }

    // Also mark any new blocks (those without a blockId) as dirty
    newDoc.forEach((node) => {
      if (!node.attrs.blockId) {
        // Will get an ID from the appendTransaction plugin,
        // but mark it dirty once it does
        this.dirtyIds.add("__pending__");
      }
    });
  }

  /**
   * After blockId assignment (appendTransaction), update dirty tracking
   * for any blocks that were pending.
   */
  syncNewBlockIds(doc: PMNode): void {
    if (!this.dirtyIds.has("__pending__")) return;
    this.dirtyIds.delete("__pending__");

    // Mark all blocks that don't have a source mapping as dirty
    doc.forEach((node) => {
      const id = node.attrs.blockId;
      if (id && !this.knownCleanIds.has(id)) {
        this.dirtyIds.add(id);
      }
    });
  }

  private knownCleanIds = new Set<string>();

  /**
   * Register the initial set of block IDs as "clean" (from source mapping).
   */
  setInitialCleanIds(ids: string[]): void {
    this.knownCleanIds = new Set(ids);
  }

  private markBlocksInRange(doc: PMNode, from: number, to: number): void {
    // Clamp to valid range
    const docSize = doc.content.size;
    const clampedFrom = Math.max(0, Math.min(from, docSize));
    const clampedTo = Math.max(0, Math.min(to, docSize));

    doc.forEach((node, pos) => {
      const blockEnd = pos + node.nodeSize;
      // Check if this block overlaps with the affected range
      if (pos < clampedTo && blockEnd > clampedFrom) {
        const id = node.attrs.blockId;
        if (id) {
          this.dirtyIds.add(id);
        }
      }
    });
  }

  isDirty(blockId: string): boolean {
    return this.dirtyIds.has(blockId);
  }

  /**
   * Reset dirty tracking (called after save).
   * All current block IDs become the new "clean" baseline.
   */
  reset(doc: PMNode): void {
    this.dirtyIds.clear();
    const ids: string[] = [];
    doc.forEach((node) => {
      if (node.attrs.blockId) {
        ids.push(node.attrs.blockId);
      }
    });
    this.knownCleanIds = new Set(ids);
  }
}
