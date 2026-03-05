"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { summaryGrid } from "@/lib/ui/recipes/layout";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import type { InventoryPageKpis, InventoryPageAlerts, InventoryPageHealth } from "@/modules/inventory/service/inventory-page";

const TREND_CHIP_CLASS =
  "inline-flex items-center rounded-[var(--radius-input)] px-2 py-0.5 text-xs font-medium bg-[var(--surface-2)] text-[var(--muted-text)]";

export type InventoryKpisProps = {
  kpis: InventoryPageKpis;
  alerts: InventoryPageAlerts;
  health: InventoryPageHealth;
  className?: string;
};

export function InventoryKpis({ kpis, alerts, health, className }: InventoryKpisProps) {
  const totalHealth = health.lt30 + health.d30to60 + health.d60to90 + health.gt90;
  const barWidth = (count: number) => (totalHealth <= 0 ? 0 : Math.min(100, (count / totalHealth) * 100));

  return (
    <div className={cn(summaryGrid, className)} role="region" aria-label="Inventory summary">
      {/* 1. Total Units */}
      <Link
        href="/inventory"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
          <DMSCardContent className="pb-4 pt-1">
            <div className="text-left text-sm font-semibold text-[var(--text)]">Total Units</div>
            <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">
              {kpis.totalUnits.toLocaleString()}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={TREND_CHIP_CLASS}>+{kpis.addedThisWeek} added this week</span>
            </div>
          </DMSCardContent>
        </DMSCard>
      </Link>

      {/* 2. Inventory Value */}
      <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardContent className="pb-4 pt-1">
          <div className="text-left text-sm font-semibold text-[var(--text)]">Inventory Value</div>
          <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">
            {kpis.inventoryValueCents > 0 ? formatCents(String(kpis.inventoryValueCents)) : "$0"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={TREND_CHIP_CLASS}>
              Avg {kpis.totalUnits > 0 ? formatCents(String(kpis.avgValuePerVehicleCents)) : "$0"} / vehicle
            </span>
          </div>
        </DMSCardContent>
      </DMSCard>

      {/* 3. Inventory Alerts */}
      <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardHeader className="gap-2 mb-0">
          <DMSCardTitle>Inventory Alerts</DMSCardTitle>
        </DMSCardHeader>
        <DMSCardContent className="pt-0">
          <ul className="space-y-1" role="list">
            <li>
              <Link
                href="/inventory?alertType=MISSING_PHOTOS"
                className="flex items-center justify-between gap-2 rounded-[var(--radius-input)] px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span>Missing Photos {alerts.missingPhotos}</span>
                {alerts.missingPhotos > 0 && (
                  <span className="rounded-full bg-[var(--accent-warning)]/20 px-2 py-0.5 text-xs font-medium text-[var(--text)]">
                    {alerts.missingPhotos}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/inventory/aging"
                className="flex items-center justify-between gap-2 rounded-[var(--radius-input)] px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span>Units &gt; 90 Days {alerts.over90Days}</span>
              </Link>
            </li>
            <li>
              <Link
                href="/inventory?alertType=RECON_OVERDUE"
                className="flex items-center justify-between gap-2 rounded-[var(--radius-input)] px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span>Units Need Recon {alerts.needsRecon}</span>
              </Link>
            </li>
          </ul>
        </DMSCardContent>
      </DMSCard>

      {/* 4. Inventory Health */}
      <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardHeader className="gap-2 mb-0">
          <DMSCardTitle>Inventory Health</DMSCardTitle>
        </DMSCardHeader>
        <DMSCardContent className="pt-0">
          <div className="space-y-3" role="list" aria-label="Aging buckets">
            {[
              { key: "lt30" as const, label: "<30 Days" },
              { key: "d30to60" as const, label: "30-60 Days" },
              { key: "d60to90" as const, label: "60-90 Days" },
              { key: "gt90" as const, label: ">90 Days" },
            ].map(({ key, label }) => {
              const count = health[key];
              const width = barWidth(count);
              const isGt90 = key === "gt90" && count > 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className={cn("w-20 shrink-0 text-sm text-[var(--text)]", isGt90 && "font-medium")}>
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
                          isGt90 ? "bg-[var(--accent)]" : "bg-[var(--accent-inventory)]"
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
    </div>
  );
}
