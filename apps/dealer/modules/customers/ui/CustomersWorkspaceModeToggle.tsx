"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type CustomersWorkspaceMode = "overview" | "list";

type CustomersWorkspaceModeToggleProps = {
  mode: CustomersWorkspaceMode;
  className?: string;
};

/**
 * Explicit Overview vs List mode switcher for the Customers workspace.
 * Overview = relationship health, fresh/stale leads, follow-up due. List = execution, search, table/cards.
 */
export function CustomersWorkspaceModeToggle({ mode, className }: CustomersWorkspaceModeToggleProps) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors";
  const active = "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]";
  const inactive =
    "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-text)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5",
        className
      )}
      role="tablist"
      aria-label="Customers workspace mode"
    >
      <Link
        href="/customers"
        role="tab"
        aria-selected={mode === "overview"}
        className={cn(base, mode === "overview" ? active : inactive)}
      >
        Overview
      </Link>
      <Link
        href="/customers/list"
        role="tab"
        aria-selected={mode === "list"}
        className={cn(base, mode === "list" ? active : inactive)}
      >
        List
      </Link>
    </div>
  );
}
