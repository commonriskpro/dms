"use client";

import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { BarChart3 } from "@/lib/ui/icons";
import { ICON_SIZES } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type DaysToTurnCardProps = {
  valueDays: number | null;
  targetDays: number;
  status: "good" | "warn" | "bad" | "na";
};

export function DaysToTurnCard({
  valueDays,
  targetDays,
  status,
}: DaysToTurnCardProps) {
  const valueDisplay = valueDays != null ? `${valueDays} days` : "—";
  const statusLabel =
    status === "good"
      ? "On target"
      : status === "warn"
        ? "Above target"
        : status === "bad"
          ? "Needs attention"
          : "N/A";

  const indicatorClass =
    status === "good"
      ? "bg-[var(--success-muted)] text-[var(--success-text)]"
      : status === "warn"
        ? "bg-[var(--warning-muted)] text-[var(--warning-text)]"
        : status === "bad"
          ? "bg-[var(--danger-muted)] text-[var(--danger-text)]"
          : "bg-[var(--surface-2)] text-[var(--muted-text)]";

  return (
    <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
      <DMSCardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <DMSCardTitle className="text-sm font-medium text-[var(--text)]">
          Days to Turn
        </DMSCardTitle>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)]"
          aria-hidden
        >
          <BarChart3 size={ICON_SIZES.card} className="text-[var(--muted-text)]" />
        </span>
      </DMSCardHeader>
      <DMSCardContent className="pt-0">
        <div className="text-lg font-semibold text-[var(--text)]">
          {valueDisplay}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[var(--muted-text)]">
            Target: {targetDays} days
          </span>
          <span
            className={cn(
              "rounded-[var(--radius-input)] px-2 py-0.5 text-xs font-medium",
              indicatorClass
            )}
          >
            {statusLabel}
          </span>
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}
