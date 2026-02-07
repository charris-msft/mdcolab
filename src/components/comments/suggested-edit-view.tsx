"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ArrowRight } from "lucide-react";

interface SuggestedEditViewProps {
  originalText: string;
  replacement: string;
  status: "pending" | "accepted" | "rejected";
  canResolve: boolean;
  onAccept: () => void;
  onReject: () => void;
  resolvedBy?: string | null;
}

export function SuggestedEditView({
  originalText,
  replacement,
  status,
  canResolve,
  onAccept,
  onReject,
  resolvedBy,
}: SuggestedEditViewProps) {
  return (
    <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
      <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground font-medium">
        <ArrowRight className="size-3" />
        Suggested edit
      </div>

      <div className="space-y-1">
        <div className="rounded bg-red-500/10 px-2 py-1 line-through text-red-400">
          {originalText}
        </div>
        <div className="rounded bg-green-500/10 px-2 py-1 text-green-400">
          {replacement}
        </div>
      </div>

      {status === "pending" && canResolve && (
        <div className="flex items-center gap-1.5 mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1 text-green-500 hover:text-green-400 hover:bg-green-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onAccept();
            }}
          >
            <Check className="size-3" />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1 text-red-500 hover:text-red-400 hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
          >
            <X className="size-3" />
            Reject
          </Button>
        </div>
      )}

      {status === "accepted" && (
        <Badge variant="secondary" className="mt-2 text-[10px] bg-green-500/15 text-green-500">
          Accepted{resolvedBy ? ` by @${resolvedBy}` : ""}
        </Badge>
      )}

      {status === "rejected" && (
        <Badge variant="secondary" className="mt-2 text-[10px] bg-red-500/15 text-red-500">
          Rejected
        </Badge>
      )}
    </div>
  );
}
