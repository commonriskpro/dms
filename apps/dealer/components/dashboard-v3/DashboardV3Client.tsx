"use client";

import * as React from "react";
import type { DashboardV3Data, DashboardLayoutItem } from "./types";
import { PageShell } from "@/components/ui/page-shell";
import { useRefreshSignal } from "@/lib/ui/refresh-signal";
import { useSearchParams } from "next/navigation";
import { CustomerTasksCard } from "./CustomerTasksCard";
import { FloorplanLendingCard } from "./FloorplanLendingCard";
import { DealPipelineCard } from "./DealPipelineCard";
import { UpcomingAppointmentsCard } from "./UpcomingAppointmentsCard";
import { FinanceNoticesCard } from "./FinanceNoticesCard";
import { MetricCard } from "./MetricCard";
import { DashboardCustomizePanel } from "./DashboardCustomizePanel";
import { InventoryWorkbenchCard } from "./InventoryWorkbenchCard";
import { InventorySummaryClusterCard } from "./InventorySummaryClusterCard"; // kept for easy revert
import { InventorySignalListCard } from "./InventorySignalListCard";
import { AcquisitionInsightsCard } from "./AcquisitionInsightsCard";
import { ActivityFeedCard } from "./ActivityFeedCard";
import { WidgetCard } from "./WidgetCard";

export type DashboardV3ClientProps = {
  initialData: DashboardV3Data;
  permissions: string[];
  activeDealershipId?: string | null;
  /** Server-computed layout (all widgets with visibility). When present, rendering is layout-driven. */
  layout?: DashboardLayoutItem[];
};

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

/** Area sparkline wired to real daily ops-score data (7 points, oldest → newest). */
function OpsScoreGraphic({ data }: { data: number[] }) {
  const W = 88;
  const H = 36;
  if (data.length < 2) return <svg width={W} height={H} aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data, min + 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / (max - min)) * (H - 4),
  ] as [number, number]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden fill="none">
      <defs>
        <linearGradient id="ops-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#ops-area-grad)" />
      <path d={linePath} stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Visible layout items sorted by zone then order */
function getVisibleSorted(layout: DashboardLayoutItem[]): DashboardLayoutItem[] {
  return layout
    .filter((w) => w.visible)
    .sort((a, b) => {
      const z = a.zone === "topRow" ? 0 : 1;
      const zb = b.zone === "topRow" ? 0 : 1;
      if (z !== zb) return z - zb;
      return a.order - b.order;
    });
}

export function DashboardV3Client({
  initialData,
  permissions,
  layout: serverLayout,
}: DashboardV3ClientProps) {
  const { token: refreshToken } = useRefreshSignal();
  const searchParams = useSearchParams();
  const [customizeOpen, setCustomizeOpen] = React.useState(
    () => searchParams.get("customize") === "true"
  );

  const {
    metrics,
    customerTasks,
    inventoryAlerts,
    floorplan,
    dealPipeline,
    dealStageCounts,
    appointments,
    financeNotices,
  } = initialData;

  const canInventory = hasPermission(permissions, "inventory.read");
  const canCrm = hasPermission(permissions, "crm.read");
  const canCustomers = hasPermission(permissions, "customers.read");
  const canDeals = hasPermission(permissions, "deals.read");
  const canLenders = hasPermission(permissions, "lenders.read");
  const canAcquisitionRead =
    hasPermission(permissions, "inventory.acquisition.read") || canInventory;
  const canWriteInventory = canInventory && hasPermission(permissions, "inventory.write");
  const canWriteCustomers = canCustomers && hasPermission(permissions, "customers.write");
  const canWriteDeals = canDeals && hasPermission(permissions, "deals.write");

  const layout = serverLayout ?? [];
  const useLayout = layout.length > 0;
  const visibleIds = React.useMemo(() => {
    if (!useLayout) return null;
    return new Set(getVisibleSorted(layout).map((item) => item.widgetId));
  }, [useLayout, layout]);
  const isVisible = React.useCallback(
    (widgetId: DashboardLayoutItem["widgetId"]) => {
      if (!visibleIds) return true;
      return visibleIds.has(widgetId);
    },
    [visibleIds]
  );

  const unresolvedOpsCount = React.useMemo(() => {
    const inventorySignalCount = canInventory
      ? inventoryAlerts.filter(
          (row) => row.severity === "warning" || row.severity === "danger"
        ).length
      : 0;
    const dealSignalCount = canDeals
      ? dealPipeline.filter(
          (row) => row.severity === "warning" || row.severity === "danger"
        ).length
      : 0;
    const operationsCount = canLenders ? financeNotices.length : 0;
    return Math.max(0, operationsCount + inventorySignalCount + dealSignalCount);
  }, [canDeals, canInventory, canLenders, financeNotices, inventoryAlerts, dealPipeline]);

  const operationsScore = Math.max(0, Math.min(99, 99 - unresolvedOpsCount * 4));

  return (
    <PageShell className="space-y-2">

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        {canInventory && isVisible("metrics-inventory") ? (
          <MetricCard
            title="Inventory"
            value={metrics.inventoryCount}
            delta7d={metrics.inventoryDelta7d}
            delta30d={metrics.inventoryDelta30d}
            trend={metrics.inventoryTrend}
            href="/inventory"
            color="green"
            refreshKey={refreshToken}
            className="max-h-[120px] overflow-hidden"
          />
        ) : null}
        {canDeals && isVisible("metrics-deals") ? (
          <MetricCard
            title="Active Deals"
            value={metrics.dealsCount}
            delta7d={metrics.dealsDelta7d}
            delta30d={metrics.dealsDelta30d}
            trend={metrics.dealsTrend}
            href="/deals"
            color="blue"
            refreshKey={refreshToken}
            className="max-h-[120px] overflow-hidden"
          />
        ) : null}
        {canCrm && isVisible("metrics-leads") ? (
          <MetricCard
            title="New Leads"
            value={metrics.leadsCount}
            delta7d={metrics.leadsDelta7d}
            delta30d={metrics.leadsDelta30d}
            trend={metrics.leadsTrend}
            href="/crm/opportunities"
            color="violet"
            refreshKey={refreshToken}
            className="max-h-[120px] overflow-hidden"
          />
        ) : null}
        {canLenders && isVisible("metrics-bhph") ? (
          <MetricCard
            title="Gross Profit"
            value={metrics.bhphCount}
            delta7d={metrics.bhphDelta7d}
            delta30d={metrics.bhphDelta30d}
            trend={metrics.bhphTrend}
            href="/lenders"
            color="amber"
            refreshKey={refreshToken}
            className="max-h-[120px] overflow-hidden"
          />
        ) : null}
        <section className="kpi-noise max-h-[120px] overflow-hidden rounded-[var(--radius-card)] border border-cyan-500/30 bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E"), linear-gradient(to bottom, transparent 40%, rgba(34,211,238,0.05) 100%)`, backgroundSize: "180px 180px, 100% 100%", backgroundRepeat: "repeat, no-repeat" }}>
          <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full opacity-70" style={{ background: "#22d3ee" }} aria-hidden />
          <p className="mb-2 pl-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
            Health / Ops Score
          </p>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="pl-1 tabular-nums text-[40px] font-bold leading-none text-[var(--text)]">
                {operationsScore}%
              </div>
              <p className="mt-1.5 pl-1 text-xs font-medium text-[var(--muted-text)]">
                <span className={unresolvedOpsCount === 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                  {unresolvedOpsCount}
                </span>
                {" unresolved"}
              </p>
            </div>
            <div className="shrink-0 pb-0.5">
              <OpsScoreGraphic data={metrics.opsTrend} />
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {canInventory && isVisible("inventory-alerts") ? (
            <InventoryWorkbenchCard
              canReadInventory={canInventory}
              canAddVehicle={canWriteInventory}
              canAddLead={canWriteCustomers}
              canStartDeal={canWriteDeals}
              refreshToken={refreshToken}
            />
          ) : (
            <WidgetCard title="Quick Actions">
              <p className="text-sm text-[var(--muted-text)]">
                Inventory workbench is unavailable for your current permissions.
              </p>
            </WidgetCard>
          )}
        </div>
        <div className="xl:col-span-4">
          {canInventory && isVisible("inventory-alerts") ? (
                  <InventorySignalListCard rows={inventoryAlerts} />
          ) : (
            <FloorplanLendingCard floorplan={floorplan} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-12">
        <div className="xl:col-span-5">
          {canDeals && isVisible("deal-pipeline") ? (
            <DealPipelineCard rows={dealPipeline} stageCounts={dealStageCounts} refreshToken={refreshToken} />
          ) : (
            <FinanceNoticesCard
              financeNotices={financeNotices}
              refreshToken={refreshToken}
            />
          )}
        </div>
        <div className="space-y-3 xl:col-span-4">
          {canCrm && isVisible("upcoming-appointments") ? (
            <UpcomingAppointmentsCard
              appointments={appointments}
              title="Messaging"
            />
          ) : null}
          {canAcquisitionRead ? (
            <AcquisitionInsightsCard
              refreshToken={refreshToken}
              canRead={canAcquisitionRead}
            />
          ) : null}
        </div>
        <div className="space-y-3 xl:col-span-3">
          {canCrm && canDeals && isVisible("recommended-actions") ? (
            <ActivityFeedCard rows={dealPipeline} />
          ) : null}
          {(canCustomers || canCrm) && isVisible("customer-tasks") ? (
            <CustomerTasksCard
              rows={customerTasks}
              refreshToken={refreshToken}
              title="Tasks"
            />
          ) : null}
        </div>
      </div>

      {layout.length > 0 && (
        <DashboardCustomizePanel
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          layout={layout}
        />
      )}
    </PageShell>
  );
}
