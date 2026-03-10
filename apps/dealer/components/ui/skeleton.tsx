import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * shadcn-style Skeleton primitive. Token colors only (bg-[var(--surface-2)]).
 */
export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--surface-2)]", className)}
      {...props}
    />
  );
}

/** Card-shaped skeleton; use for summary cards or content blocks. */
export function SkeletonCard({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="px-4 pt-4 pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-8 w-16" />
        <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Table skeleton: header row + N body rows. */
export function SkeletonTable({
  rows = 8,
  columns = 5,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rows?: number; columns?: number }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 min-w-0 max-w-[120px]" />
        ))}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1 min-w-0 max-w-[100px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vertical list of skeleton lines (e.g. for lists or feeds). */
export function SkeletonList({
  lines = 5,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
