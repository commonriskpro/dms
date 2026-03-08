"use client";

import * as React from "react";
import type { DashboardV3Data, DashboardLayoutItem } from "./types";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useRefreshSignal } from "@/lib/ui/refresh-signal";
import { CustomerTasksCard } from "./CustomerTasksCard";
import { FloorplanLendingCard } from "./FloorplanLendingCard";
import { DealPipelineCard } from "./DealPipelineCard";
import { UpcomingAppointmentsCard } from "./UpcomingAppointmentsCard";
import { FinanceNoticesCard } from "./FinanceNoticesCard";
import { MetricCard } from "./MetricCard";
import { DashboardCustomizePanel } from "./DashboardCustomizePanel";
import { SlidersHorizontal } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { typography } from "@/lib/ui/tokens";
import { MetricCard as UIMetricCard } from "@/components/ui-system/widgets";
import { InventoryWorkbenchCard } from "./InventoryWorkbenchCard";
import { InventorySummaryClusterCard } from "./InventorySummaryClusterCard";
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
  const [customizeOpen, setCustomizeOpen] = React.useState(false);

  const {
    metrics,
    customerTasks,
    inventoryAlerts,
    floorplan,
    dealPipeline,
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
      <PageHeader
        title={<h1 className={typography.pageTitle}>Dashboard</h1>}
        actions={
          layout.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomizeOpen(true)}
              className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              <SlidersHorizontal size={16} className="shrink-0" aria-hidden />
              <span>Customize dashboard</span>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        {canInventory && isVisible("metrics-inventory") ? (
          <MetricCard
            title="Inventory"
            value={metrics.inventoryCount}
            delta7d={metrics.inventoryDelta7d}
            delta30d={metrics.inventoryDelta30d}
            href="/inventory"
            className="min-h-[148px]"
          />
        ) : null}
        {canDeals && isVisible("metrics-deals") ? (
          <MetricCard
            title="Active Deals"
            value={metrics.dealsCount}
            delta7d={metrics.dealsDelta7d}
            delta30d={metrics.dealsDelta30d}
            href="/deals"
            className="min-h-[148px]"
          />
        ) : null}
        {canCrm && isVisible("metrics-leads") ? (
          <MetricCard
            title="New Leads"
            value={metrics.leadsCount}
            delta7d={metrics.leadsDelta7d}
            delta30d={metrics.leadsDelta30d}
            href="/crm/opportunities"
            className="min-h-[148px]"
          />
        ) : null}
        {canLenders && isVisible("metrics-bhph") ? (
          <MetricCard
            title="Gross Profit"
            value={metrics.bhphCount}
            delta7d={metrics.bhphDelta7d}
            delta30d={metrics.bhphDelta30d}
            href="/lenders"
            className="min-h-[148px]"
          />
        ) : null}
        <UIMetricCard
          label="Health / Ops Score"
          value={`${operationsScore}%`}
          delta={`${unresolvedOpsCount} unresolved`}
          className="min-h-[148px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
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
          {canDeals && isVisible("deal-pipeline") ? (
            <DealPipelineCard rows={dealPipeline} refreshToken={refreshToken} />
          ) : (
            <FinanceNoticesCard
              financeNotices={financeNotices}
              refreshToken={refreshToken}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="xl:col-span-5">
          {canInventory && isVisible("inventory-alerts") ? (
            <InventorySummaryClusterCard rows={inventoryAlerts} />
          ) : (
            <FloorplanLendingCard floorplan={floorplan} />
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
