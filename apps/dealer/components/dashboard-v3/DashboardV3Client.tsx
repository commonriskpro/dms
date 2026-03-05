"use client";

import { useRouter } from "next/navigation";
import type { DashboardV3Data } from "./types";
import { RefreshIcon } from "./RefreshIcon";
import { MetricCard } from "./MetricCard";
import { CustomerTasksCard } from "./CustomerTasksCard";
import { InventoryAlertsCard } from "./InventoryAlertsCard";
import { FloorplanLendingCard } from "./FloorplanLendingCard";
import { DealPipelineCard } from "./DealPipelineCard";
import { UpcomingAppointmentsCard } from "./UpcomingAppointmentsCard";
import { FinanceNoticesCard } from "./FinanceNoticesCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { RecommendedActionsCard } from "./RecommendedActionsCard";

export type DashboardV3ClientProps = {
  initialData: DashboardV3Data;
  permissions: string[];
  activeDealershipId?: string | null;
};

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

function lastUpdatedLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Last updated just now";
  if (diffMins === 1) return "Last updated 1 minute ago";
  if (diffMins < 60) return `Last updated ${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "Last updated 1 hour ago";
  return `Last updated ${diffHours} hours ago`;
}

export function DashboardV3Client({ initialData, permissions }: DashboardV3ClientProps) {
  const router = useRouter();
  const { metrics, customerTasks, inventoryAlerts, floorplan, dealPipeline, appointments, financeNotices, dashboardGeneratedAt } =
    initialData;

  const canInventory = hasPermission(permissions, "inventory.read");
  const canCrm = hasPermission(permissions, "crm.read");
  const canCustomers = hasPermission(permissions, "customers.read");
  const canDeals = hasPermission(permissions, "deals.read");
  const canLenders = hasPermission(permissions, "lenders.read");

  return (
    <div className="space-y-[var(--dash-gap)]">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-semibold text-[var(--text)]">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--muted-text)]" title={dashboardGeneratedAt}>
            {lastUpdatedLabel(dashboardGeneratedAt)}
          </span>
          <button
            type="button"
            onClick={() => typeof window !== "undefined" && window.location.reload()}
            aria-label="Refresh dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <RefreshIcon className="h-4 w-4 shrink-0" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric cards: content-wrapping grid, no forced heights */}
      <div className="grid gap-[var(--dash-gap)] md:grid-cols-2 lg:grid-cols-4 items-start">
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
      <div className="mt-4 grid gap-[var(--dash-gap)] md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* Column 1 */}
        <div className="flex flex-col gap-[var(--dash-gap)] min-w-0">
          {(canCustomers || canCrm) && <CustomerTasksCard rows={customerTasks} />}
          {canLenders && <FloorplanLendingCard floorplan={floorplan} />}
          <FinanceNoticesCard financeNotices={financeNotices} />
        </div>

        {/* Column 2 */}
        <div className="flex flex-col gap-[var(--dash-gap)] min-w-0">
          {canInventory && <InventoryAlertsCard rows={inventoryAlerts} />}
          {canDeals && <DealPipelineCard rows={dealPipeline} />}
        </div>

        {/* Column 3 */}
        <div className="flex flex-col gap-[var(--dash-gap)] min-w-0">
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
    </div>
  );
}
