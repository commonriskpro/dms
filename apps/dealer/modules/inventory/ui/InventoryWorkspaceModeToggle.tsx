"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type InventoryWorkspaceMode = "overview" | "list";

type InventoryWorkspaceModeToggleProps = {
  mode: InventoryWorkspaceMode;
  className?: string;
};

/**
 * Explicit Overview vs List mode switcher for the Inventory workspace.
 * Overview = decision / supervision / exceptions. List = execution / speed work.
 */
export function InventoryWorkspaceModeToggle({ mode, className }: InventoryWorkspaceModeToggleProps) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors";
  const active = "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]";
  const inactive =
    "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-text)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]";

  return (
    <div
      className={cn("flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5", className)}
      role="tablist"
      aria-label="Inventory workspace mode"
    >
      <Link
        href="/inventory"
        role="tab"
        aria-selected={mode === "overview"}
        className={cn(base, mode === "overview" ? active : inactive)}
      >
        Overview
      </Link>
      <Link
        href="/inventory/list"
        role="tab"
        aria-selected={mode === "list"}
        className={cn(base, mode === "list" ? active : inactive)}
      >
        List
      </Link>
    </div>
  );
}
