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
  inventoryTrend: number[];
  leadsCount: number;
  leadsDelta7d: number | null;
  leadsDelta30d: number | null;
  leadsTrend: number[];
  dealsCount: number;
  dealsDelta7d: number | null;
  dealsDelta30d: number | null;
  dealsTrend: number[];
  bhphCount: number;
  bhphDelta7d: number | null;
  bhphDelta30d: number | null;
  bhphTrend: number[];
  opsTrend: number[];
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

export type DealStageCounts = {
  draft: number;
  structured: number;
  approved: number;
  contracted: number;
  funded: number;
};

export type DashboardV3Data = {
  dashboardGeneratedAt: string;
  metrics: DashboardV3Metrics;
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  dealPipeline: WidgetRow[];
  dealStageCounts?: DealStageCounts;
  floorplan: DashboardV3FloorplanLine[];
  appointments: DashboardV3Appointment[];
  financeNotices: DashboardV3FinanceNotice[];
};

const WIDGET_ROW_LIMIT = 5;
const FINANCE_NOTICES_LIMIT = 5;
const APPOINTMENTS_LIMIT = 5;
const TREND_DAYS = 7;

/** Aggregates an array of timestamps into daily counts (oldest → newest). */
function buildTrendArray(dates: Date[], days: number): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map = new Map<string, number>();
  for (const d of dates) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return map.get(d.toISOString()) ?? 0;
  });
}

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

  const dealStageCounts = canDeals
    ? {
        draft: statusMap.DRAFT ?? 0,
        structured: statusMap.STRUCTURED ?? 0,
        approved: statusMap.APPROVED ?? 0,
        contracted: statusMap.CONTRACTED ?? 0,
        funded: statusMap.FUNDED ?? 0,
      }
    : undefined;

  // 7-day trend queries (daily counts, oldest→newest)
  const trendStart = new Date();
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));
  trendStart.setHours(0, 0, 0, 0);

  const [inventoryTrendRaw, leadsTrendRaw, dealsTrendRaw, bhphTrendRaw] = await Promise.all([
    canInventory
      ? prisma.vehicle.findMany({
          where: { ...vehicleWhere, createdAt: { gte: trendStart } },
          select: { createdAt: true },
        })
      : [],
    canCrm
      ? prisma.opportunity.findMany({
          where: { dealershipId, createdAt: { gte: trendStart } },
          select: { createdAt: true },
        })
      : [],
    canDeals
      ? prisma.deal.findMany({
          where: { ...dealWhere, createdAt: { gte: trendStart } },
          select: { createdAt: true },
        })
      : [],
    canDeals && canLenders
      ? prisma.deal.findMany({
          where: { ...dealWhere, status: "CONTRACTED", createdAt: { gte: trendStart } },
          select: { createdAt: true },
        })
      : [],
  ]);

  const inventoryTrend = buildTrendArray(
    Array.isArray(inventoryTrendRaw) ? inventoryTrendRaw.map((r) => r.createdAt) : [],
    TREND_DAYS
  );
  const leadsTrend = buildTrendArray(
    Array.isArray(leadsTrendRaw) ? leadsTrendRaw.map((r) => r.createdAt) : [],
    TREND_DAYS
  );
  const dealsTrend = buildTrendArray(
    Array.isArray(dealsTrendRaw) ? dealsTrendRaw.map((r) => r.createdAt) : [],
    TREND_DAYS
  );
  const bhphTrend = buildTrendArray(
    Array.isArray(bhphTrendRaw) ? bhphTrendRaw.map((r) => r.createdAt) : [],
    TREND_DAYS
  );

  // Today-delta: today's count vs yesterday's
  const inventoryDeltaToday = inventoryTrend[TREND_DAYS - 1] - inventoryTrend[TREND_DAYS - 2];
  const leadsDeltaToday = leadsTrend[TREND_DAYS - 1] - leadsTrend[TREND_DAYS - 2];
  const dealsDeltaToday = dealsTrend[TREND_DAYS - 1] - dealsTrend[TREND_DAYS - 2];
  const bhphDeltaToday = bhphTrend[TREND_DAYS - 1] - bhphTrend[TREND_DAYS - 2];

  // Daily ops score: per-day sum of inventory + deal signal counts → score = max(0, 99 - load*4)
  // Uses the trend arrays already fetched — no additional DB queries needed.
  const opsTrend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const dailyLoad = (inventoryTrend[i] ?? 0) + (dealsTrend[i] ?? 0);
    return Math.max(0, Math.min(99, 99 - dailyLoad * 4));
  });

  const metrics: DashboardV3Metrics = {
    inventoryCount: typeof inventoryCount === "number" ? inventoryCount : 0,
    inventoryDelta7d: inventoryDeltaToday,
    inventoryDelta30d: null,
    inventoryTrend,
    leadsCount: typeof leadsCount === "number" ? leadsCount : 0,
    leadsDelta7d: leadsDeltaToday,
    leadsDelta30d: null,
    leadsTrend,
    dealsCount: typeof dealsCount === "number" ? dealsCount : 0,
    dealsDelta7d: dealsDeltaToday,
    dealsDelta30d: null,
    dealsTrend,
    bhphCount: typeof bhphCount === "number" ? bhphCount : 0,
    bhphDelta7d: bhphDeltaToday,
    bhphDelta30d: null,
    bhphTrend,
    opsTrend,
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
    dealStageCounts,
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
