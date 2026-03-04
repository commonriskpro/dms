"use client";

import { useRouter } from "next/navigation";
import type { DashboardV3Data } from "./types";
import { Button } from "@/components/ui/button";
import { RefreshIcon } from "./RefreshIcon";
import { MetricCard } from "./MetricCard";
import { CustomerTasksCard } from "./CustomerTasksCard";
import { InventoryAlertsCard } from "./InventoryAlertsCard";
import { CrmPromoCard } from "./CrmPromoCard";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-soft)]" title={dashboardGeneratedAt}>
            {lastUpdatedLabel(dashboardGeneratedAt)}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.refresh()}
            aria-label="Refresh dashboard"
            className="gap-1.5"
          >
            <RefreshIcon className="h-4 w-4 shrink-0" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Row 1: 4 metric cards */}
      <div className="grid grid-cols-12 gap-4">
        {canInventory && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard
              title="Inventory"
              value={metrics.inventoryCount}
              delta7d={metrics.inventoryDelta7d}
              delta30d={metrics.inventoryDelta30d}
              href="/inventory"
            />
          </div>
        )}
        {canCrm && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard
              title="Leads"
              value={metrics.leadsCount}
              delta7d={metrics.leadsDelta7d}
              delta30d={metrics.leadsDelta30d}
              href="/crm/opportunities"
            />
          </div>
        )}
        {canDeals && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard
              title="Deals"
              value={metrics.dealsCount}
              delta7d={metrics.dealsDelta7d}
              delta30d={metrics.dealsDelta30d}
              href="/deals"
            />
          </div>
        )}
        {canLenders && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard
              title="BHPH"
              value={metrics.bhphCount}
              delta7d={metrics.bhphDelta7d}
              delta30d={metrics.bhphDelta30d}
              href="/lenders"
            />
          </div>
        )}
      </div>

      {/* Row 2: Customer Tasks, Inventory Alerts, CRM promo */}
      <div className="grid grid-cols-12 gap-4">
        {(canCustomers || canCrm) && (
          <div className="col-span-12 lg:col-span-5">
            <CustomerTasksCard rows={customerTasks} />
          </div>
        )}
        {canInventory && (
          <div className="col-span-12 lg:col-span-4">
            <InventoryAlertsCard rows={inventoryAlerts} />
          </div>
        )}
        {canCrm && (
          <div className="col-span-12 lg:col-span-3">
            <CrmPromoCard />
          </div>
        )}
      </div>

      {/* Row 3: Floorplan, Deal Pipeline, Appointments */}
      <div className="grid grid-cols-12 gap-4">
        {canLenders && (
          <div className="col-span-12 lg:col-span-5">
            <FloorplanLendingCard floorplan={floorplan} />
          </div>
        )}
        {canDeals && (
          <div className="col-span-12 lg:col-span-4">
            <DealPipelineCard rows={dealPipeline} />
          </div>
        )}
        {canCrm && (
          <div className="col-span-12 lg:col-span-3">
            <UpcomingAppointmentsCard appointments={appointments} />
          </div>
        )}
      </div>

      {/* Row 4: Finance Notices, Recommended Actions, Quick Actions */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6">
          <FinanceNoticesCard financeNotices={financeNotices} />
        </div>
        <div className="col-span-12 lg:col-span-3">
          <RecommendedActionsCard
            customerTasks={customerTasks}
            inventoryAlerts={inventoryAlerts}
            dealPipeline={dealPipeline}
          />
        </div>
        <div className="col-span-12 lg:col-span-3">
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
