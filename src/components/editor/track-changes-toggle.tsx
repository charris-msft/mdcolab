"use client";

import { useEditorStore } from "@/stores/editor-store";
import { useCommentStore } from "@/stores/comment-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-react";

export function TrackChangesToggle() {
  const { showTrackChanges, setShowTrackChanges } = useEditorStore();
  const { threads } = useCommentStore();

  const pendingCount = threads.reduce(
    (acc, t) =>
      acc +
      t.comments.filter((c) => c.suggestedEdit?.status === "pending").length,
    0
  );

  return (
    <Button
      variant={showTrackChanges ? "default" : "ghost"}
      size="sm"
      className="gap-1.5"
      onClick={() => setShowTrackChanges(!showTrackChanges)}
    >
      <GitCompare className="h-3.5 w-3.5" />
      Changes
      {pendingCount > 0 && (
        <Badge variant="secondary" className="px-1.5 py-0 text-xs">
          {pendingCount}
        </Badge>
      )}
    </Button>
  );
}
