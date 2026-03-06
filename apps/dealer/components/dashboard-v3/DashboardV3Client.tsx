"use client";

import type { DashboardV3Data } from "./types";
import { PageShell } from "@/components/ui/page-shell";
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

export type DashboardV3ClientProps = {
  initialData: DashboardV3Data;
  permissions: string[];
  activeDealershipId?: string | null;
};

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

export function DashboardV3Client({ initialData, permissions }: DashboardV3ClientProps) {
  const { token: refreshToken } = useRefreshSignal();

  const { metrics, customerTasks, inventoryAlerts, floorplan, dealPipeline, appointments, financeNotices } = initialData;

  const canInventory = hasPermission(permissions, "inventory.read");
  const canCrm = hasPermission(permissions, "crm.read");
  const canCustomers = hasPermission(permissions, "customers.read");
  const canDeals = hasPermission(permissions, "deals.read");
  const canLenders = hasPermission(permissions, "lenders.read");

  return (
    <PageShell className="space-y-2">
      {/* Top row: 4 metric cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
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
      </div>
      {/* 3-column masonry: independent stacks, no row stretching */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* Column 1 */}
        <div className="flex flex-col gap-3 min-w-0">
          {(canCustomers || canCrm) && (
            <CustomerTasksCard rows={customerTasks} refreshToken={refreshToken} />
          )}
          {canLenders && <FloorplanLendingCard floorplan={floorplan} />}
          <FinanceNoticesCard financeNotices={financeNotices} />
        </div>

        {/* Column 2 */}
        <div className="flex flex-col gap-3 min-w-0">
          {canInventory && (
            <InventoryAlertsCard rows={inventoryAlerts} refreshToken={refreshToken} />
          )}
          {canDeals && <DealPipelineCard rows={dealPipeline} />}
        </div>

        {/* Column 3 */}
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
      </div>
    </PageShell>
  );
}
