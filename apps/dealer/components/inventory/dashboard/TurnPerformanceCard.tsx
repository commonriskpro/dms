"use client";

import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { BarChart3 } from "@/lib/ui/icons";
import { ICON_SIZES } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type TurnPerformanceCardProps = {
  avgDaysToSell: number | null;
  agingBucketsPct: {
    lt30: number;
    d30to60: number;
    d60to90: number;
    gt90: number;
  };
};

export function TurnPerformanceCard({
  avgDaysToSell,
  agingBucketsPct,
}: TurnPerformanceCardProps) {
  const avgDisplay =
    avgDaysToSell != null ? `Avg ${avgDaysToSell} days to sell` : "—";
  const buckets = [
    { key: "lt30" as const, label: "<30 Days", pct: agingBucketsPct.lt30 },
    { key: "d30to60" as const, label: "30-60 Days", pct: agingBucketsPct.d30to60 },
    { key: "d60to90" as const, label: "60-90 Days", pct: agingBucketsPct.d60to90 },
    { key: "gt90" as const, label: ">90 Days", pct: agingBucketsPct.gt90 },
  ];

  return (
    <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
      <DMSCardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <DMSCardTitle className="text-sm font-medium text-[var(--text)]">
          Turn Performance
        </DMSCardTitle>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)]"
          aria-hidden
        >
          <BarChart3 size={ICON_SIZES.card} className="text-[var(--muted-text)]" />
        </span>
      </DMSCardHeader>
      <DMSCardContent className="pt-0">
        <div className="text-sm font-medium text-[var(--text)]">{avgDisplay}</div>
        <div className="mt-3 space-y-2" role="list" aria-label="Aging breakdown">
          {buckets.map(({ key, label, pct }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm text-[var(--text)]">
                {label}
              </span>
              <div className="min-w-0 flex-1 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    key === "gt90" && pct > 0
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--accent-inventory)]"
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-[var(--muted-text)]">
                {pct}%
              </span>
            </div>
          ))}
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}
