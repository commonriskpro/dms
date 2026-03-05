"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
import { summaryGrid } from "@/lib/ui/recipes/layout";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import type { InventoryKpis } from "@/modules/inventory/service/dashboard";

const CARD_ACCENT = "var(--accent-inventory)";

export type InventorySummaryCardsProps = {
  kpis: InventoryKpis;
  canWrite?: boolean;
  className?: string;
};

function TrendChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-input)] px-2 py-0.5 text-xs font-medium",
        "bg-[var(--surface-2)] text-[var(--muted-text)]",
        className
      )}
    >
      {children}
    </span>
  );
}

function KpiCard({
  title,
  value,
  chip,
  href,
  accentColor,
  className,
}: {
  title: string;
  value: string | number;
  chip: React.ReactNode;
  href: string;
  accentColor?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className
      )}
    >
      <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardContent className="pb-4 pt-1">
          <div className="text-left text-sm font-semibold text-[var(--text)]">{title}</div>
          <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {chip}
          </div>
        </DMSCardContent>
      </DMSCard>
    </Link>
  );
}

export function InventorySummaryCards({
  kpis,
  canWrite = false,
  className,
}: InventorySummaryCardsProps) {
  const totalUnitsChip =
    kpis.delta7d != null ? (
      <TrendChip>+{kpis.delta7d} this week</TrendChip>
    ) : (
      <TrendChip>—</TrendChip>
    );

  const inReconChip = (
    <TrendChip>{kpis.totalUnits > 0 ? `${kpis.inReconPercent.toFixed(0)}% of lot` : "—"}</TrendChip>
  );

  const salePendingChip = (
    <>
      {kpis.salePendingValueCents != null && kpis.salePendingValueCents > 0 && (
        <TrendChip>{formatCents(String(kpis.salePendingValueCents))}</TrendChip>
      )}
    </>
  );

  const inventoryValueChip = (
    <TrendChip>
      {kpis.totalUnits > 0 ? `Avg ${formatCents(String(kpis.avgValueCents))} / vehicle` : "—"}
    </TrendChip>
  );

  const inventoryValueDisplay =
    kpis.inventoryValueCents > 0
      ? formatCents(String(kpis.inventoryValueCents))
      : "—";

  return (
    <div
      className={cn(summaryGrid, className)}
      role="region"
      aria-label="Inventory summary"
    >
      <KpiCard
        title="Total Units"
        value={kpis.totalUnits}
        chip={totalUnitsChip}
        href="/inventory"
        accentColor={CARD_ACCENT}
      />
      <KpiCard
        title="In Recon"
        value={kpis.inReconUnits}
        chip={inReconChip}
        href="/inventory?status=REPAIR"
        accentColor={CARD_ACCENT}
      />
      <KpiCard
        title="Sale Pending"
        value={kpis.salePendingUnits}
        chip={salePendingChip}
        href="/inventory?status=HOLD"
        accentColor={CARD_ACCENT}
      />
      <DMSCard className="flex h-full flex-col transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardContent className="flex flex-1 flex-col pb-4 pt-1">
          <div className="text-left text-sm font-semibold text-[var(--text)]">
            Inventory Value
          </div>
          <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">
            {inventoryValueDisplay}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {inventoryValueChip}
          </div>
        </DMSCardContent>
      </DMSCard>
    </div>
  );
}
