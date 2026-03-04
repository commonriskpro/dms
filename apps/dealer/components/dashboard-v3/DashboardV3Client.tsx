"use client";

import { useRouter } from "next/navigation";
import type { DashboardV3Data } from "./types";
import { dashboardGrid } from "@/lib/ui/tokens";
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
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
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

      {/* Single 12-column grid (blueprint: grid grid-cols-12 gap-4) */}
      <div className={dashboardGrid}>
        {/* Row 1: 4 metric cards, each col-span-3 */}
        {canInventory && (
          <MetricCard
            className="col-span-12 md:col-span-6 xl:col-span-3"
            title="Inventory"
            value={metrics.inventoryCount}
            delta7d={metrics.inventoryDelta7d}
            delta30d={metrics.inventoryDelta30d}
            href="/inventory"
          />
        )}
        {canCrm && (
          <MetricCard
            className="col-span-12 md:col-span-6 xl:col-span-3"
            title="Leads"
            value={metrics.leadsCount}
            delta7d={metrics.leadsDelta7d}
            delta30d={metrics.leadsDelta30d}
            href="/crm/opportunities"
          />
        )}
        {canDeals && (
          <MetricCard
            className="col-span-12 md:col-span-6 xl:col-span-3"
            title="Deals"
            value={metrics.dealsCount}
            delta7d={metrics.dealsDelta7d}
            delta30d={metrics.dealsDelta30d}
            href="/deals"
          />
        )}
        {canLenders && (
          <MetricCard
            className="col-span-12 md:col-span-6 xl:col-span-3"
            title="BHPH"
            value={metrics.bhphCount}
            delta7d={metrics.bhphDelta7d}
            delta30d={metrics.bhphDelta30d}
            href="/lenders"
          />
        )}
        {/* Row 2: Customer Tasks 5, Inventory Alerts 4, Recommended Actions 3 */}
        {(canCustomers || canCrm) && (
          <div className="col-span-5">
            <CustomerTasksCard rows={customerTasks} />
          </div>
        )}
        {canInventory && (
          <div className="col-span-4">
            <InventoryAlertsCard rows={inventoryAlerts} />
          </div>
        )}
        {canCrm && (
          <div className="col-span-3">
            <RecommendedActionsCard
              customerTasks={customerTasks}
              inventoryAlerts={inventoryAlerts}
              dealPipeline={dealPipeline}
            />
          </div>
        )}
        {/* Row 3: Floorplan 5, Deal Pipeline 4, Upcoming Appointments 3 */}
        {canLenders && (
          <div className="col-span-5">
            <FloorplanLendingCard floorplan={floorplan} />
          </div>
        )}
        {canDeals && (
          <div className="col-span-4">
            <DealPipelineCard rows={dealPipeline} />
          </div>
        )}
        {canCrm && (
          <div className="col-span-3">
            <UpcomingAppointmentsCard appointments={appointments} />
          </div>
        )}
        {/* Row 4: Finance Notices 9, Quick Actions 3 */}
        <div className="col-span-9">
          <FinanceNoticesCard financeNotices={financeNotices} />
        </div>
        <div className="col-span-3">
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
