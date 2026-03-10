import * as React from "react";
import { cn } from "@/lib/utils";
import { KpiCard, type KpiCardColor } from "@/components/ui-system/widgets";

type QueueKpiItem = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** When true, show colored border (glowline). Use when this KPI has a recent update. */
  hasUpdate?: boolean;
  /** Trend data for sparkline (at least 2 points). Omit for a flat baseline. */
  trend?: number[];
};

const STRIP_COLORS: KpiCardColor[] = ["blue", "violet", "amber", "green", "cyan"];

export function QueueKpiStrip({
  items,
  className,
}: {
  items: QueueKpiItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, i) => {
        const numVal = typeof item.value === "number" ? item.value : 0;
        return (
          <KpiCard
            key={item.label}
            label={item.label}
            value={
              typeof item.value === "number"
                ? item.value
                : typeof item.value === "string"
                  ? item.value
                  : String(item.value)
            }
            sub={item.hint}
            color={STRIP_COLORS[i % STRIP_COLORS.length]}
            hasUpdate={item.hasUpdate}
            trend={item.trend ?? [numVal, numVal]}
          />
        );
      })}
    </section>
  );
}
