"use client";

import * as React from "react";
import type { DashboardV3Data, DashboardLayoutItem } from "./types";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useRefreshSignal } from "@/lib/ui/refresh-signal";
import { CustomerTasksCard } from "./CustomerTasksCard";
import { InventoryAlertsCard } from "./InventoryAlertsCard";
import { FloorplanLendingCard } from "./FloorplanLendingCard";
import { DealPipelineCard } from "./DealPipelineCard";
import { UpcomingAppointmentsCard } from "./UpcomingAppointmentsCard";
import { FinanceNoticesCard } from "./FinanceNoticesCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { RecommendedActionsCard } from "./RecommendedActionsCard";
import { MetricCard } from "./MetricCard";
import { DashboardCustomizePanel } from "./DashboardCustomizePanel";
import { SlidersHorizontal } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { typography } from "@/lib/ui/tokens";

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

  const layout = serverLayout ?? [];
  const useLayout = layout.length > 0;
  const visibleItems = useLayout ? getVisibleSorted(layout) : [];

  const topRowItems = visibleItems.filter((w) => w.zone === "topRow");
  const mainItems = visibleItems.filter((w) => w.zone === "main");

  const metricProps: Record<string, { title: string; value: number; delta7d: number | null; delta30d: number | null; href: string }> = {
    "metrics-inventory": {
      title: "Inventory",
      value: metrics.inventoryCount,
      delta7d: metrics.inventoryDelta7d,
      delta30d: metrics.inventoryDelta30d,
      href: "/inventory",
    },
    "metrics-leads": {
      title: "Leads",
      value: metrics.leadsCount,
      delta7d: metrics.leadsDelta7d,
      delta30d: metrics.leadsDelta30d,
      href: "/crm/opportunities",
    },
    "metrics-deals": {
      title: "Deals",
      value: metrics.dealsCount,
      delta7d: metrics.dealsDelta7d,
      delta30d: metrics.dealsDelta30d,
      href: "/deals",
    },
    "metrics-bhph": {
      title: "BHPH",
      value: metrics.bhphCount,
      delta7d: metrics.bhphDelta7d,
      delta30d: metrics.bhphDelta30d,
      href: "/lenders",
    },
  };

  const renderTopRow = () => {
    if (useLayout && topRowItems.length > 0) {
      return topRowItems.map((item) => {
        const props = metricProps[item.widgetId];
        if (!props) return null;
        return (
          <MetricCard
            key={item.widgetId}
            title={props.title}
            value={props.value}
            delta7d={props.delta7d}
            delta30d={props.delta30d}
            href={props.href}
          />
        );
      });
    }
    return (
      <>
        {canInventory && (
          <MetricCard
            title="Inventory"
            value={metrics.inventoryCount}
            delta7d={metrics.inventoryDelta7d}
            delta30d={metrics.inventoryDelta30d}
            href="/inventory"
          />
        )}
        {canCrm && (
          <MetricCard
            title="Leads"
            value={metrics.leadsCount}
            delta7d={metrics.leadsDelta7d}
            delta30d={metrics.leadsDelta30d}
            href="/crm/opportunities"
          />
        )}
        {canDeals && (
          <MetricCard
            title="Deals"
            value={metrics.dealsCount}
            delta7d={metrics.dealsDelta7d}
            delta30d={metrics.dealsDelta30d}
            href="/deals"
          />
        )}
        {canLenders && (
          <MetricCard
            title="BHPH"
            value={metrics.bhphCount}
            delta7d={metrics.bhphDelta7d}
            delta30d={metrics.bhphDelta30d}
            href="/lenders"
          />
        )}
      </>
    );
  };

  const renderMainWidget = (widgetId: string): React.ReactNode => {
    if (widgetId === "customer-tasks")
      return (canCustomers || canCrm) && (
        <CustomerTasksCard rows={customerTasks} refreshToken={refreshToken} />
      );
    if (widgetId === "floorplan-lending") return canLenders && <FloorplanLendingCard floorplan={floorplan} />;
    if (widgetId === "finance-notices") return <FinanceNoticesCard financeNotices={financeNotices} />;
    if (widgetId === "inventory-alerts")
      return canInventory && (
        <InventoryAlertsCard rows={inventoryAlerts} refreshToken={refreshToken} />
      );
    if (widgetId === "deal-pipeline") return canDeals && <DealPipelineCard rows={dealPipeline} />;
    if (widgetId === "recommended-actions")
      return canCrm && (
        <RecommendedActionsCard
          customerTasks={customerTasks}
          inventoryAlerts={inventoryAlerts}
          dealPipeline={dealPipeline}
        />
      );
    if (widgetId === "upcoming-appointments")
      return canCrm && <UpcomingAppointmentsCard appointments={appointments} />;
    if (widgetId === "quick-actions")
      return (
        <QuickActionsCard
          canAddVehicle={canInventory && hasPermission(permissions, "inventory.write")}
          canAddLead={canCustomers && hasPermission(permissions, "customers.write")}
          canStartDeal={canDeals && hasPermission(permissions, "deals.write")}
        />
      );
    return null;
  };

  const renderMainColumn = () => {
    if (useLayout && mainItems.length > 0) {
      const cols: DashboardLayoutItem[][] = [[], [], []];
      mainItems.forEach((item, i) => cols[i % 3].push(item));
      return cols.map((columnItems, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-3 min-w-0">
          {columnItems.map((item) => {
            const node = renderMainWidget(item.widgetId);
            return node ? <React.Fragment key={item.widgetId}>{node}</React.Fragment> : null;
          })}
        </div>
      ));
    }
    return (
      <>
        <div className="flex flex-col gap-3 min-w-0">
          {(canCustomers || canCrm) && (
            <CustomerTasksCard rows={customerTasks} refreshToken={refreshToken} />
          )}
          {canLenders && <FloorplanLendingCard floorplan={floorplan} />}
          <FinanceNoticesCard financeNotices={financeNotices} />
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          {canInventory && (
            <InventoryAlertsCard rows={inventoryAlerts} refreshToken={refreshToken} />
          )}
          {canDeals && <DealPipelineCard rows={dealPipeline} />}
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          {canCrm && (
            <RecommendedActionsCard
              customerTasks={customerTasks}
              inventoryAlerts={inventoryAlerts}
              dealPipeline={dealPipeline}
            />
          )}
          {canCrm && <UpcomingAppointmentsCard appointments={appointments} />}
          <QuickActionsCard
            canAddVehicle={canInventory && hasPermission(permissions, "inventory.write")}
            canAddLead={canCustomers && hasPermission(permissions, "customers.write")}
            canStartDeal={canDeals && hasPermission(permissions, "deals.write")}
          />
        </div>
      </>
    );
  };

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
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
        {renderTopRow()}
      </div>
      {useLayout ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-start">
          {renderMainColumn()}
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-3 md:grid-cols-2 items-start">
            <div className="flex flex-col gap-3 min-w-0">
              {(canCustomers || canCrm) && (
                <CustomerTasksCard rows={customerTasks} refreshToken={refreshToken} />
              )}
              {canLenders && <FloorplanLendingCard floorplan={floorplan} />}
              <FinanceNoticesCard financeNotices={financeNotices} />
            </div>
            <div className="flex flex-col gap-3 min-w-0">
              {canInventory && (
                <InventoryAlertsCard rows={inventoryAlerts} refreshToken={refreshToken} />
              )}
              {canDeals && <DealPipelineCard rows={dealPipeline} />}
            </div>
          </div>
          <aside className="flex flex-col gap-3 min-w-0">
            {canCrm && (
              <RecommendedActionsCard
                customerTasks={customerTasks}
                inventoryAlerts={inventoryAlerts}
                dealPipeline={dealPipeline}
              />
            )}
            {canCrm && <UpcomingAppointmentsCard appointments={appointments} />}
            <QuickActionsCard
              canAddVehicle={canInventory && hasPermission(permissions, "inventory.write")}
              canAddLead={canCustomers && hasPermission(permissions, "customers.write")}
              canStartDeal={canDeals && hasPermission(permissions, "deals.write")}
            />
          </aside>
        </div>
      )}
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
