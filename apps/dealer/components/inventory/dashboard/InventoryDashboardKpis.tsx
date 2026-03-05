"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
import { summaryGrid } from "@/lib/ui/recipes/layout";
import { formatCents } from "@/lib/money";
import { Car, BarChart3, Star } from "@/lib/ui/icons";
import { ICON_SIZES } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type InventoryDashboardKpisProps = {
  totalUnits: number;
  inventoryValueCents: number;
  avgValuePerVehicleCents: number;
  daysToTurn: {
    valueDays: number | null;
    targetDays: number;
    status: "good" | "warn" | "bad" | "na";
  };
  demandScore: {
    score: number | null;
    label: string;
    supplyLabel?: string;
  };
};

function KpiCard({
  title,
  value,
  sub,
  href,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  sub?: React.ReactNode;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-medium text-[var(--text)]">{title}</span>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]"
            aria-hidden
          >
            <Icon size={ICON_SIZES.card} className="text-[var(--muted-text)]" />
          </span>
        </div>
        <DMSCardContent className="pt-0 pb-4">
          <div className="text-[28px] font-bold leading-[1] text-[var(--text)]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {sub != null && (
            <div className="mt-2 text-xs text-[var(--muted-text)]">{sub}</div>
          )}
        </DMSCardContent>
      </DMSCard>
    </Link>
  );
}

export function InventoryDashboardKpis({
  totalUnits,
  inventoryValueCents,
  avgValuePerVehicleCents,
  daysToTurn,
  demandScore,
}: InventoryDashboardKpisProps) {
  const daysDisplay =
    daysToTurn.valueDays != null
      ? `${daysToTurn.valueDays} days`
      : "—";
  const demandDisplay =
    demandScore.score != null ? `${demandScore.score}/10 ${demandScore.label}` : "N/A";

  return (
    <div
      className={cn(summaryGrid)}
      role="region"
      aria-label="Inventory dashboard KPIs"
    >
      <KpiCard
        title="Total Units"
        value={totalUnits}
        sub={totalUnits > 0 ? "Active inventory" : undefined}
        href="/inventory"
        icon={Car}
      />
      <KpiCard
        title="Inventory Value"
        value={
          inventoryValueCents > 0
            ? formatCents(String(inventoryValueCents))
            : "—"
        }
        sub={
          totalUnits > 0
            ? `Avg ${formatCents(String(avgValuePerVehicleCents))} / vehicle`
            : undefined
        }
        href="/inventory"
        icon={BarChart3}
      />
      <KpiCard
        title="Days to Turn"
        value={daysDisplay}
        sub={
          daysToTurn.status !== "na"
            ? `Target: ${daysToTurn.targetDays} days`
            : undefined
        }
        href="/inventory/dashboard"
        icon={BarChart3}
      />
      <KpiCard
        title="Demand Score"
        value={demandDisplay}
        sub={demandScore.supplyLabel}
        href="/inventory/dashboard"
        icon={Star}
      />
    </div>
  );
}
