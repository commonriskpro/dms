"use client";

import type { DashboardV3Data } from "./types";
import { MetricCard } from "./MetricCard";
import { CustomerTasksCard } from "./CustomerTasksCard";
import { InventoryAlertsCard } from "./InventoryAlertsCard";
import { CrmPromoCard } from "./CrmPromoCard";
import { FloorplanLendingCard } from "./FloorplanLendingCard";
import { DealPipelineCard } from "./DealPipelineCard";
import { UpcomingAppointmentsCard } from "./UpcomingAppointmentsCard";
import { FinanceNoticesCard } from "./FinanceNoticesCard";
import { QuickActionsCard } from "./QuickActionsCard";

export type DashboardV3ClientProps = {
  initialData: DashboardV3Data;
  permissions: string[];
};

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

export function DashboardV3Client({ initialData, permissions }: DashboardV3ClientProps) {
  const { metrics, customerTasks, inventoryAlerts, floorplan, dealPipeline, appointments, financeNotices } =
    initialData;

  const canInventory = hasPermission(permissions, "inventory.read");
  const canCrm = hasPermission(permissions, "crm.read");
  const canCustomers = hasPermission(permissions, "customers.read");
  const canDeals = hasPermission(permissions, "deals.read");
  const canLenders = hasPermission(permissions, "lenders.read");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>

      {/* Row 1: 4 metric cards */}
      <div className="grid grid-cols-12 gap-4">
        {canInventory && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard
              title="Inventory"
              value={metrics.inventoryCount}
              href="/inventory"
            />
          </div>
        )}
        {canCrm && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard
              title="Leads"
              value={metrics.leadsCount}
              href="/crm/opportunities"
            />
          </div>
        )}
        {canDeals && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard title="Deals" value={metrics.dealsCount} href="/deals" />
          </div>
        )}
        {canLenders && (
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <MetricCard title="BHPH" value={metrics.bhphCount} href="/lenders" />
          </div>
        )}
      </div>

      {/* Row 2: Customer Tasks, Inventory Alerts, CRM promo */}
      <div className="grid grid-cols-12 gap-4">
        {(canCustomers || canCrm) && (
          <div className="col-span-12 lg:col-span-5">
            <CustomerTasksCard customerTasks={customerTasks} />
          </div>
        )}
        {canInventory && (
          <div className="col-span-12 lg:col-span-4">
            <InventoryAlertsCard inventoryAlerts={inventoryAlerts} />
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
            <DealPipelineCard dealPipeline={dealPipeline} />
          </div>
        )}
        {canCrm && (
          <div className="col-span-12 lg:col-span-3">
            <UpcomingAppointmentsCard appointments={appointments} />
          </div>
        )}
      </div>

      {/* Row 4: Finance Notices, Quick Actions */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-9">
          <FinanceNoticesCard financeNotices={financeNotices} />
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
