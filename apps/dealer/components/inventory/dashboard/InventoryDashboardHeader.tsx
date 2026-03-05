"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "@/lib/ui/icons";
import { ICON_SIZES } from "@/lib/ui/icons";

export type InventoryDashboardHeaderProps = {
  lastUpdatedMs: number;
};

function formatLastUpdated(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function InventoryDashboardHeader({ lastUpdatedMs }: InventoryDashboardHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-[var(--muted-text)]">
        Last updated: {formatLastUpdated(lastUpdatedMs)}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-2)]/80 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        onClick={() => router.refresh()}
        aria-label="Refresh dashboard"
      >
        <RefreshCw size={ICON_SIZES.button} className="mr-1.5 shrink-0" aria-hidden />
        Refresh
      </Button>
    </div>
  );
}
