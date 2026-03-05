"use client";

import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { BarChart3 } from "@/lib/ui/icons";
import { ICON_SIZES } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type PriceToMarketCardProps = {
  vehiclePriceCents: number | null;
  marketAvgCents: number | null;
  deltaPct: number | null;
  label: "Below Market" | "At Market" | "Above Market" | "NA";
};

function formatPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${(pct * 100).toFixed(1)}%`;
}

export function PriceToMarketCard({
  vehiclePriceCents,
  marketAvgCents,
  deltaPct,
  label,
}: PriceToMarketCardProps) {
  const isNa = label === "NA";
  const display =
    !isNa && deltaPct != null
      ? `${formatPct(deltaPct)} ${label}`
      : "—";

  const segmentClass =
    label === "Below Market"
      ? "bg-[var(--success-muted)]"
      : label === "Above Market"
        ? "bg-[var(--warning-muted)]"
        : "bg-[var(--surface-2)]";

  return (
    <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
      <DMSCardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <DMSCardTitle className="text-sm font-medium text-[var(--text)]">
          Price to Market
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
          {display}
        </div>
        {!isNa && deltaPct != null && (
          <div
            className={cn(
              "mt-2 h-2 w-full overflow-hidden rounded-full",
              "bg-[var(--surface-2)]"
            )}
            role="presentation"
          >
            <div
              className={cn("h-full rounded-full", segmentClass)}
              style={{
                width: `${Math.min(100, Math.max(0, 50 + deltaPct * 500))}%`,
              }}
            />
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
