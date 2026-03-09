import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeletonSet({ kind = "table" }: { kind?: "page" | "widget" | "table" }) {
  if (kind === "page") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (kind === "widget") {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
