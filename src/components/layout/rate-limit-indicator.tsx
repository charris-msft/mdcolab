"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface RateLimitData {
  limit: number;
  remaining: number;
  reset: number;
}

export function RateLimitIndicator() {
  const { data } = useQuery<RateLimitData>({
    queryKey: ["rate-limit"],
    queryFn: async () => {
      const res = await fetch("/api/rate-limit");
      if (!res.ok) throw new Error("Failed to fetch rate limit");
      return res.json();
    },
    refetchInterval: 60 * 1000,
  });

  if (!data) return null;

  const { remaining, limit } = data;
  const isWarning = remaining < 500;
  const isDanger = remaining < 100;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        isWarning && !isDanger && "text-amber-500",
        isDanger && "text-red-500"
      )}
    >
      <Activity className="h-3 w-3" />
      <span>
        API: {remaining.toLocaleString()} / {limit.toLocaleString()}
      </span>
    </div>
  );
}
