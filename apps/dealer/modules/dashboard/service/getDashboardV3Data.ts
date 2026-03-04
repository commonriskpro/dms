/**
 * Dashboard V3: server-side data for enterprise layout.
 * All queries scoped by dealership_id. No new business logic; aggregates from existing data.
 */
import { prisma } from "@/lib/db";
import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";

export type DashboardV3Metrics = {
  inventoryCount: number;
  leadsCount: number;
  dealsCount: number;
  bhphCount: number;
  deltas?: {
    inventory?: number;
    leads?: number;
    deals?: number;
    bhph?: number;
  };
};

export type DashboardV3CustomerTasks = {
  appointments: number;
  newProspects: number;
  inbox: number;
  followUps: number;
  creditApps: number;
};

export type DashboardV3InventoryAlerts = {
  carsInRecon: number;
  pendingTasks: number;
  notPostedOnline: number;
  missingDocs: number;
  lowStock: number;
};

export type DashboardV3FloorplanLine = {
  name: string;
  utilizedCents: number;
  limitCents: number;
  statusLabel: string;
};

export type DashboardV3DealPipeline = {
  pendingDeals: number;
  submittedDeals: number;
  contractsToReview: number;
  fundingIssues: number;
};

export type DashboardV3Appointment = {
  id: string;
  name: string;
  meta: string;
  timeLabel: string;
};

export type DashboardV3FinanceNotice = {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  severity: "info" | "warning" | "error";
};

export type DashboardV3Data = {
  metrics: DashboardV3Metrics;
  customerTasks: DashboardV3CustomerTasks;
  inventoryAlerts: DashboardV3InventoryAlerts;
  floorplan: DashboardV3FloorplanLine[];
  dealPipeline: DashboardV3DealPipeline;
  appointments: DashboardV3Appointment[];
  financeNotices: DashboardV3FinanceNotice[];
};

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

/**
 * Returns dashboard v3 data for the enterprise layout.
 * Scoped by dealershipId; respects RBAC (only includes data for permitted areas).
 */
export async function getDashboardV3Data(
  dealershipId: string,
  userId: string,
  permissions: string[]
): Promise<DashboardV3Data> {
  const canInventory = hasPermission(permissions, "inventory.read");
  const canCrm = hasPermission(permissions, "crm.read");
  const canCustomers = hasPermission(permissions, "customers.read");
  const canDeals = hasPermission(permissions, "deals.read");
  const canLenders = hasPermission(permissions, "lenders.read");

  const dealWhere = { dealershipId, deletedAt: null };
  const vehicleWhere = { dealershipId, deletedAt: null };

  const [
    inventoryCount,
    leadsCount,
    dealsCount,
    bhphCount,
    carsInRecon,
    dealStatusCounts,
    fundingIssuesCount,
    newProspectsCount,
    myTasksCount,
    creditAppsCount,
    pendingStipsCount,
  ] = await Promise.all([
    canInventory
      ? prisma.vehicle.count({
          where: {
            ...vehicleWhere,
            status: { in: ["AVAILABLE", "HOLD", "REPAIR"] },
          },
        })
      : 0,
    canCrm
      ? prisma.opportunity.count({
          where: { dealershipId, status: "OPEN" },
        })
      : 0,
    canDeals
      ? prisma.deal.count({
          where: { ...dealWhere, status: { not: "CANCELED" } },
        })
      : 0,
    canLenders ? 0 : 0,
    canInventory
      ? prisma.vehicle.count({
          where: { ...vehicleWhere, status: "REPAIR" },
        })
      : 0,
    canDeals
      ? prisma.deal.groupBy({
          by: ["status"],
          where: { ...dealWhere, status: { not: "CANCELED" } },
          _count: { id: true },
        })
      : [],
    canDeals && canLenders
      ? prisma.financeSubmission.count({
          where: {
            dealershipId,
            fundingStatus: "PENDING",
            status: { in: ["SUBMITTED", "DECISIONED"] },
          },
        })
      : 0,
    canCustomers ? customersDb.listNewProspects(dealershipId, 100).then((r) => r.length) : 0,
    canCustomers || canCrm
      ? tasksDb.listMyTasks(dealershipId, userId, 100).then((r) => r.length)
      : 0,
    canLenders
      ? prisma.financeApplication.count({
          where: { dealershipId, status: "DRAFT" },
        })
      : 0,
    canLenders
      ? prisma.financeStipulation.count({
          where: { dealershipId, status: "REQUESTED" },
        })
      : 0,
  ]);

  const statusMap = Object.fromEntries(
    Array.isArray(dealStatusCounts)
      ? dealStatusCounts.map((g) => [g.status, g._count.id])
      : []
  );
  const pendingDeals = (statusMap.DRAFT ?? 0) + (statusMap.STRUCTURED ?? 0);
  const submittedDeals = statusMap.APPROVED ?? 0;
  const contractsToReview = statusMap.CONTRACTED ?? 0;

  const metrics: DashboardV3Metrics = {
    inventoryCount: typeof inventoryCount === "number" ? inventoryCount : 0,
    leadsCount: typeof leadsCount === "number" ? leadsCount : 0,
    dealsCount: typeof dealsCount === "number" ? dealsCount : 0,
    bhphCount: typeof bhphCount === "number" ? bhphCount : 0,
  };

  const customerTasks: DashboardV3CustomerTasks = {
    appointments: 0,
    newProspects: typeof newProspectsCount === "number" ? newProspectsCount : 0,
    inbox: 0,
    followUps: typeof myTasksCount === "number" ? myTasksCount : 0,
    creditApps: typeof creditAppsCount === "number" ? creditAppsCount : 0,
  };

  const inventoryAlerts: DashboardV3InventoryAlerts = {
    carsInRecon: typeof carsInRecon === "number" ? carsInRecon : 0,
    pendingTasks: 0,
    notPostedOnline: 0,
    missingDocs: 0,
    lowStock: 0,
  };

  const dealPipeline: DashboardV3DealPipeline = {
    pendingDeals,
    submittedDeals,
    contractsToReview,
    fundingIssues: typeof fundingIssuesCount === "number" ? fundingIssuesCount : 0,
  };

  const financeNotices: DashboardV3FinanceNotice[] = [];
  if (canLenders && typeof pendingStipsCount === "number" && pendingStipsCount > 0) {
    financeNotices.push({
      id: "stips-pending",
      title: "Stipulations pending",
      subtitle: `${pendingStipsCount} item(s) requested`,
      dateLabel: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      severity: "warning",
    });
  }

  return {
    metrics,
    customerTasks,
    inventoryAlerts,
    floorplan: [],
    dealPipeline,
    appointments: [],
    financeNotices,
  };
}
