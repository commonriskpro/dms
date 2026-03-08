"use client";

import Link from "next/link";
import { summaryGrid } from "@/lib/ui/recipes/layout";
import { widgetTokens, widgetRowSurface } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import type { InventoryPageKpis, InventoryPageAlerts, InventoryPageHealth } from "@/modules/inventory/service/inventory-page";
import { InventoryQuickActionsCard } from "./InventoryQuickActionsCard";

/** Matches dashboard MetricCard label style exactly */
const cardLabelClass = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]";

export type InventoryKpisProps = {
  kpis: InventoryPageKpis;
  alerts: InventoryPageAlerts;
  health: InventoryPageHealth;
  canWrite?: boolean;
  className?: string;
};

export function InventoryKpis({ kpis, alerts, health, canWrite = false, className }: InventoryKpisProps) {
  const totalHealth = health.lt30 + health.d30to60 + health.d60to90 + health.gt90;
  const barWidth = (count: number) => (totalHealth <= 0 ? 0 : Math.min(100, (count / totalHealth) * 100));

  return (
    <div className={cn(summaryGrid, className)} role="region" aria-label="Inventory summary">
      {/* 1. Inventory Value */}
      <section className={cn(widgetTokens.widgetCompactKpi, "relative overflow-hidden h-full")}>
        <p className={cn(cardLabelClass, "mb-2")}>Inventory Value</p>
        <div className="tabular-nums font-bold text-[40px] leading-none text-[var(--text)]">
          {kpis.inventoryValueCents > 0 ? formatCents(String(kpis.inventoryValueCents)) : "$0"}
        </div>
        <p className="mt-1.5 text-xs font-medium text-[var(--muted-text)]">
          Avg {kpis.totalUnits > 0 ? formatCents(String(kpis.avgValuePerVehicleCents)) : "$0"} / vehicle
        </p>
      </section>

      {/* 2. Inventory Alerts */}
      <section className={cn(widgetTokens.widgetCompactKpi, "relative overflow-hidden h-full")}>
        <p className={cn(cardLabelClass, "mb-2")}>Inventory Alerts</p>
        <ul role="list">
          {[
            { href: "/inventory?alertType=MISSING_PHOTOS", label: "Missing Photos", count: alerts.missingPhotos, sev: alerts.missingPhotos > 0 ? "warning" : "success" },
            { href: "/inventory/aging",                    label: "Units > 90 Days", count: alerts.over90Days,   sev: alerts.over90Days > 0   ? "danger"  : "success" },
            { href: "/inventory?alertType=RECON_OVERDUE",  label: "Units Need Recon", count: alerts.needsRecon,   sev: alerts.needsRecon > 0   ? "warning" : "success" },
          ].map(({ href, label, count, sev }) => (
            <li key={label}>
              <Link
                href={href}
                className={cn(widgetRowSurface, "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", {
                      "bg-[var(--danger)]":  sev === "danger",
                      "bg-[var(--warning)]": sev === "warning",
                      "bg-[var(--success)]": sev === "success",
                    })}
                    aria-hidden
                  />
                  <span className="truncate text-sm text-[var(--text)]">{label}</span>
                </div>
                <span
                  className={cn("shrink-0 text-sm font-semibold tabular-nums", {
                    "text-[var(--danger)]":  sev === "danger"  && count > 0,
                    "text-[var(--warning)]": sev === "warning" && count > 0,
                    "text-[var(--muted-text)]": count === 0,
                  })}
                >
                  {count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Inventory Health */}
      <section className={cn(widgetTokens.widgetCompactKpi, "relative overflow-hidden h-full")}>
        <p className={cn(cardLabelClass, "mb-3")}>Inventory Health</p>
        <div className="space-y-2.5" role="list" aria-label="Aging buckets">
          {[
            { key: "lt30"    as const, label: "<30 Days" },
            { key: "d30to60" as const, label: "30–60 Days" },
            { key: "d60to90" as const, label: "60–90 Days" },
            { key: "gt90"    as const, label: ">90 Days" },
          ].map(({ key, label }) => {
            const count = health[key];
            const width = barWidth(count);
            const isGt90 = key === "gt90" && count > 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className={cn("w-20 shrink-0 text-sm text-[var(--text)]", isGt90 && "font-medium text-[var(--danger)]")}>
                  {label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]" role="presentation">
                    <div
                      className={cn("h-full rounded-full transition-all", isGt90 ? "bg-[var(--danger)]" : "bg-[var(--accent)]")}
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
      </section>

      {/* 4. Quick Actions */}
      <InventoryQuickActionsCard canWrite={canWrite} className="h-full" />
    </div>
  );
}
