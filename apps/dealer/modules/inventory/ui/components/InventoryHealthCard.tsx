"use client";

import type { InventoryAgingBuckets } from "@/modules/inventory/service/dashboard";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { cn } from "@/lib/utils";

export type InventoryHealthCardProps = {
  aging: InventoryAgingBuckets;
  className?: string;
};

const BUCKETS: { key: keyof InventoryAgingBuckets; label: string }[] = [
  { key: "lt30", label: "<30 days" },
  { key: "d30to60", label: "30–60" },
  { key: "d60to90", label: "60–90" },
  { key: "gt90", label: ">90 days" },
];

function barWidth(count: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (count / total) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function InventoryHealthCard({ aging, className }: InventoryHealthCardProps) {
  const total = aging.lt30 + aging.d30to60 + aging.d60to90 + aging.gt90;
  const hasGt90 = aging.gt90 > 0;

  return (
    <DMSCard
      className={cn(
        "transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]",
        hasGt90 && "ring-1 ring-[var(--border)]",
        className
      )}
    >
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Inventory Health</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="pt-0">
        <div className="space-y-3" role="list" aria-label="Aging buckets">
          {BUCKETS.map(({ key, label }) => {
            const count = aging[key];
            const width = barWidth(count, total);
            const isGt90 = key === "gt90" && count > 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-16 shrink-0 text-sm text-[var(--text)]",
                    isGt90 && "font-medium"
                  )}
                >
                  {label}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
                    role="presentation"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isGt90
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--accent-inventory)]"
                      )}
                      style={{ width: width ? `${Math.max(width, 2)}%` : "0%" }}
                    />
                  </div>
                </div>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-[var(--muted-text)]">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}
