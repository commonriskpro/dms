/**
 * Dashboard V3: server-side data for enterprise layout.
 * All queries scoped by dealership_id. RBAC: empty widgets when no permission.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";
import { getCachedFloorplan } from "./floorplan-cache";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { dashboardKpisKey, permissionsHash } from "@/lib/infrastructure/cache/cacheKeys";

export type WidgetRow = {
  key: string;
  label: string;
  count: number;
  severity?: "info" | "success" | "warning" | "danger";
  href?: string;
};

export type DashboardV3Metrics = {
  inventoryCount: number;
  inventoryDelta7d: number | null;
  inventoryDelta30d: number | null;
  leadsCount: number;
  leadsDelta7d: number | null;
  leadsDelta30d: number | null;
  dealsCount: number;
  dealsDelta7d: number | null;
  dealsDelta30d: number | null;
  bhphCount: number;
  bhphDelta7d: number | null;
  bhphDelta30d: number | null;
};

export type DashboardV3FloorplanLine = {
  name: string;
  utilizedCents: number;
  limitCents: number;
  statusLabel?: string;
};

export type DashboardV3Appointment = {
  id: string;
  name: string;
  meta?: string;
  timeLabel?: string;
};

export type DashboardV3FinanceNotice = {
  id: string;
  title: string;
  subtitle?: string;
  dateLabel?: string;
  severity: "info" | "success" | "warning" | "danger";
};

export type DashboardV3Data = {
  dashboardGeneratedAt: string;
  metrics: DashboardV3Metrics;
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  dealPipeline: WidgetRow[];
  floorplan: DashboardV3FloorplanLine[];
  appointments: DashboardV3Appointment[];
  financeNotices: DashboardV3FinanceNotice[];
};

const WIDGET_ROW_LIMIT = 5;
const FINANCE_NOTICES_LIMIT = 5;
const APPOINTMENTS_LIMIT = 5;

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

function tail(id: string): string {
  return id.length >= 4 ? id.slice(-4) : "****";
}

/**
 * Returns dashboard v3 data for the enterprise layout.
 * Scoped by dealershipId; respects RBAC (empty rows when no permission).
 */
export async function getDashboardV3Data(
  dealershipId: string,
  userId: string,
  permissions: string[]
): Promise<DashboardV3Data> {
  const requestId = `dash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startMs = Date.now();

  logger.info("dashboard_v3_load_start", {
    requestId,
    dealershipIdTail: tail(dealershipId),
    userIdTail: tail(userId),
  });

  try {
    const permHash = permissionsHash(permissions);
    const cacheKey = dashboardKpisKey(dealershipId, permHash);
    return await withCache(cacheKey, 20, () =>
      loadDashboardV3Data(dealershipId, userId, permissions, requestId, startMs)
    );
  } catch (err) {
    const loadTimeMs = Date.now() - startMs;
    logger.error("dashboard_v3_load_error", {
      requestId,
      dealershipIdTail: tail(dealershipId),
      userIdTail: tail(userId),
      loadTimeMs,
      errorCode: err instanceof Error ? err.name : "Unknown",
    });
    throw err;
  }
}

async function loadDashboardV3Data(
  dealershipId: string,
  userId: string,
  permissions: string[],
  requestId: string,
  startMs: number
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
    floorplanLines,
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
    canCustomers ? customersDb.listNewProspects(dealershipId, WIDGET_ROW_LIMIT).then((r) => r.length) : 0,
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
    canLenders
      ? getCachedFloorplan(dealershipId, async () => [])
      : Promise.resolve([]),
  ]);

  const statusMap = Object.fromEntries(
    Array.isArray(dealStatusCounts)
      ? dealStatusCounts.map((g) => [g.status, Number(g._count.id)])
      : []
  );
  const pendingDeals = (statusMap.DRAFT ?? 0) + (statusMap.STRUCTURED ?? 0);
  const submittedDeals = statusMap.APPROVED ?? 0;
  const contractsToReview = statusMap.CONTRACTED ?? 0;

  const metrics: DashboardV3Metrics = {
    inventoryCount: typeof inventoryCount === "number" ? inventoryCount : 0,
    inventoryDelta7d: null,
    inventoryDelta30d: null,
    leadsCount: typeof leadsCount === "number" ? leadsCount : 0,
    leadsDelta7d: null,
    leadsDelta30d: null,
    dealsCount: typeof dealsCount === "number" ? dealsCount : 0,
    dealsDelta7d: null,
    dealsDelta30d: null,
    bhphCount: typeof bhphCount === "number" ? bhphCount : 0,
    bhphDelta7d: null,
    bhphDelta30d: null,
  };

  const customerTasksRows: WidgetRow[] = [];
  if (canCustomers || canCrm) {
    const appointments = 0;
    const newProspects = typeof newProspectsCount === "number" ? newProspectsCount : 0;
    const inbox = 0;
    const followUps = typeof myTasksCount === "number" ? myTasksCount : 0;
    const creditApps = typeof creditAppsCount === "number" ? creditAppsCount : 0;
    [
      { key: "appointments", label: "Appointments", count: appointments },
      { key: "newProspects", label: "New Prospects", count: newProspects },
      { key: "inbox", label: "Inbox", count: inbox },
      { key: "followUps", label: "Follow-ups", count: followUps },
      { key: "creditApps", label: "Credit Apps", count: creditApps },
    ].forEach((r) => customerTasksRows.push({ ...r }));
  }
  const customerTasks = customerTasksRows.slice(0, WIDGET_ROW_LIMIT);

  const inventoryAlertsRows: WidgetRow[] = [];
  if (canInventory) {
    const carsInReconN = typeof carsInRecon === "number" ? carsInRecon : 0;
    [
      { key: "carsInRecon", label: "Cars in recon", count: carsInReconN, ...(carsInReconN > 0 ? { severity: "warning" as const } : {}) },
      { key: "pendingTasks", label: "Pending tasks", count: 0 },
      { key: "notPostedOnline", label: "Not posted online", count: 0 },
      { key: "missingDocs", label: "Missing docs", count: 0 },
      { key: "lowStock", label: "Low stock", count: 0 },
    ].forEach((r) => inventoryAlertsRows.push(r));
  }
  const inventoryAlerts = inventoryAlertsRows.slice(0, WIDGET_ROW_LIMIT);

  const dealPipelineRows: WidgetRow[] = [];
  if (canDeals) {
    [
      { key: "pendingDeals", label: "Pending deals", count: pendingDeals },
      { key: "submittedDeals", label: "Submitted", count: submittedDeals },
      { key: "contractsToReview", label: "Contracts to review", count: contractsToReview },
      { key: "fundingIssues", label: "Funding issues", count: typeof fundingIssuesCount === "number" ? fundingIssuesCount : 0, ...(typeof fundingIssuesCount === "number" && fundingIssuesCount > 0 ? { severity: "danger" as const } : {}) },
    ].forEach((r) => dealPipelineRows.push(r));
  }
  const dealPipeline = dealPipelineRows.slice(0, WIDGET_ROW_LIMIT);

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
  const financeNoticesCapped = financeNotices.slice(0, FINANCE_NOTICES_LIMIT);

  const appointments: DashboardV3Appointment[] = [];

  const dashboardGeneratedAt = new Date().toISOString();
  const payload: DashboardV3Data = {
    dashboardGeneratedAt,
    metrics,
    customerTasks,
    inventoryAlerts,
    dealPipeline,
    floorplan: Array.isArray(floorplanLines) ? floorplanLines : [],
    appointments: appointments.slice(0, APPOINTMENTS_LIMIT),
    financeNotices: financeNoticesCapped,
  };

  const loadTimeMs = Date.now() - startMs;
  const widgetCounts = {
    customerTasks: payload.customerTasks.length,
    inventoryAlerts: payload.inventoryAlerts.length,
    dealPipeline: payload.dealPipeline.length,
    floorplan: payload.floorplan.length,
    appointments: payload.appointments.length,
    financeNotices: payload.financeNotices.length,
  };
  logger.info("dashboard_v3_load_complete", {
    requestId,
    dealershipIdTail: tail(dealershipId),
    userIdTail: tail(userId),
    loadTimeMs,
    widgetCounts,
  });

  return payload;
}

/**
 * Returns only customer tasks widget rows. Used by dashboard refresh (widget refetch).
 */
export async function getDashboardV3CustomerTasks(
  dealershipId: string,
  userId: string,
  permissions: string[]
): Promise<WidgetRow[]> {
  const canCustomers = hasPermission(permissions, "customers.read");
  const canCrm = hasPermission(permissions, "crm.read");
  if (!canCustomers && !canCrm) return [];

  const [newProspectsCount, myTasksCount, creditAppsCount] = await Promise.all([
    canCustomers ? customersDb.listNewProspects(dealershipId, WIDGET_ROW_LIMIT).then((r) => r.length) : 0,
    tasksDb.listMyTasks(dealershipId, userId, 100).then((r) => r.length),
    hasPermission(permissions, "lenders.read")
      ? prisma.financeApplication.count({
          where: { dealershipId, status: "DRAFT" },
        })
      : 0,
  ]);

  const appointments = 0;
  const inbox = 0;
  const followUps = typeof myTasksCount === "number" ? myTasksCount : 0;
  const newProspects = typeof newProspectsCount === "number" ? newProspectsCount : 0;
  const creditApps = typeof creditAppsCount === "number" ? creditAppsCount : 0;
  const rows: WidgetRow[] = [
    { key: "appointments", label: "Appointments", count: appointments },
    { key: "newProspects", label: "New Prospects", count: newProspects },
    { key: "inbox", label: "Inbox", count: inbox },
    { key: "followUps", label: "Follow-ups", count: followUps },
    { key: "creditApps", label: "Credit Apps", count: creditApps },
  ];
  return rows.slice(0, WIDGET_ROW_LIMIT);
}

/**
 * Returns only inventory alerts widget rows. Used by dashboard refresh (widget refetch).
 */
export async function getDashboardV3InventoryAlerts(
  dealershipId: string,
  permissions: string[]
): Promise<WidgetRow[]> {
  if (!hasPermission(permissions, "inventory.read")) return [];

  const vehicleWhere = { dealershipId, deletedAt: null };
  const carsInRecon = await prisma.vehicle.count({
    where: { ...vehicleWhere, status: "REPAIR" },
  });
  const carsInReconN = typeof carsInRecon === "number" ? carsInRecon : 0;
  return [
    {
      key: "carsInRecon",
      label: "Cars in recon",
      count: carsInReconN,
      ...(carsInReconN > 0 ? { severity: "warning" as const } : {}),
    },
    { key: "pendingTasks", label: "Pending tasks", count: 0 },
    { key: "notPostedOnline", label: "Not posted online", count: 0 },
    { key: "missingDocs", label: "Missing docs", count: 0 },
    { key: "lowStock", label: "Low stock", count: 0 },
  ].slice(0, WIDGET_ROW_LIMIT);
}
