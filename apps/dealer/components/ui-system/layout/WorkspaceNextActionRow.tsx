import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type WorkspaceNextActionRowProps = {
  title: string;
  /** Right-side meta: time, customer name, or short detail. */
  meta?: React.ReactNode;
  href: string;
  /** Visual emphasis for overdue/danger vs warning vs info. */
  severity?: "info" | "warning" | "danger";
  className?: string;
};

/**
 * Single row for "next action" / "do next" lists in workspace home pages.
 * Reusable across Sales, Inventory, and other workspaces for attention/follow-up lists.
 */
export function WorkspaceNextActionRow({
  title,
  meta,
  href,
  severity,
  className,
}: WorkspaceNextActionRowProps) {
  const dotColor =
    severity === "danger"
      ? "bg-[var(--danger)]"
      : severity === "warning"
        ? "bg-[var(--warning)]"
        : severity === "info"
          ? "bg-[var(--accent)]"
          : null;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {dotColor ? (
          <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} aria-hidden />
        ) : null}
        <span className="font-medium truncate">{title}</span>
      </div>
      {meta != null ? <span className="text-xs text-[var(--muted-text)] shrink-0">{meta}</span> : null}
    </Link>
  );
}
