/**
 * Dashboard V3: server-side data for enterprise layout.
 * All queries scoped by dealership_id. RBAC: empty widgets when no permission.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { labelQueryFamily, setRequestContext } from "@/lib/request-context";
import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";
import { getTeamActivityToday } from "@/modules/customers/service/team-activity";
import { getSalespersonPerformance } from "@/modules/reporting-core/service/salesperson-performance";
import { getCachedFloorplan } from "./floorplan-cache";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { dashboardKpisKey, permissionsHash } from "@/lib/infrastructure/cache/cacheKeys";
import { customerDetailPath, inventoryDetailPath } from "@/lib/routes/detail-paths";

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
  grossProfitCents: number;
  grossProfitDelta7dCents: number | null;
  grossProfitDelta30dCents: number | null;
  grossProfitTrend: number[];
  frontGrossProfitCents: number;
  frontGrossProfitDelta7dCents: number | null;
  frontGrossProfitTrend: number[];
  backGrossProfitCents: number;
  backGrossProfitDelta7dCents: number | null;
  backGrossProfitTrend: number[];
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

export type DashboardV3OpsQueues = {
  titleQueueCount: number;
  titleQueueOldestAgeDays: number | null;
  deliveryQueueCount: number;
  deliveryQueueOldestAgeDays: number | null;
  fundingQueueCount: number;
  fundingQueueOldestAgeDays: number | null;
};

export type DashboardV3MaterialChange = {
  id: string;
  domain: "inventory" | "deals" | "customers";
  title: string;
  detail: string;
  severity: "info" | "success" | "warning" | "danger";
  actorLabel?: string;
  timestamp: string;
  href: string;
};

export type DashboardV3SalesManager = {
  topCloserName: string | null;
  topCloserDealsClosed: number;
  topGrossRepName: string | null;
  topGrossRepCents: number;
  averageGrossPerDealCents: number;
  rankedRepCount: number;
  staleLeadCount: number;
  oldestStaleLeadAgeDays: number | null;
  overdueFollowUpCount: number;
  appointmentsSetToday: number;
  callbacksScheduledToday: number;
  rangeLabel: string;
};

export type DashboardV3Data = {
  dashboardGeneratedAt: string;
  metrics: DashboardV3Metrics;
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  dealPipeline: WidgetRow[];
  dealStageCounts?: DealStageCounts;
  opsQueues: DashboardV3OpsQueues;
  materialChanges: DashboardV3MaterialChange[];
  salesManager: DashboardV3SalesManager;
  floorplan: DashboardV3FloorplanLine[];
  appointments: DashboardV3Appointment[];
  financeNotices: DashboardV3FinanceNotice[];
};

const WIDGET_ROW_LIMIT = 5;
const FINANCE_NOTICES_LIMIT = 5;
const APPOINTMENTS_LIMIT = 5;
const TREND_DAYS = 7;
const MATERIAL_CHANGES_LIMIT = 6;
const SALES_MANAGER_WINDOW_DAYS = 30;
const SALES_STALE_LEAD_DAYS = 7;

type DailyCountRow = {
  day: string;
  count: bigint | number | string;
};

type DailyGrossRow = {
  day: string;
  frontGross: bigint | number | string;
  backGross: bigint | number | string;
};

function normalizeCount(value: bigint | number | string): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Converts grouped day counts into a fixed daily trend array (oldest → newest). */
function buildTrendArray(rows: DailyCountRow[], days: number): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyCounts = new Map<string, number>();
  for (const row of rows) {
    dailyCounts.set(row.day, normalizeCount(row.count));
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const dayKey = d.toISOString().slice(0, 10);
    return dailyCounts.get(dayKey) ?? 0;
  });
}

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

function tail(id: string): string {
  return id.length >= 4 ? id.slice(-4) : "****";
}

function formatStatusLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatActivityTypeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  const fixed = {
    sms_sent: "SMS sent",
    email_sent: "Email sent",
    note_added: "Note added",
    task_created: "Task created",
    task_completed: "Task completed",
    call_logged: "Call logged",
    appointment_created: "Appointment created",
    appointment_scheduled: "Appointment scheduled",
  } as const;
  if (normalized in fixed) return fixed[normalized as keyof typeof fixed];
  return formatStatusLabel(value);
}

function getAgeDays(value: Date | null | undefined): number | null {
  if (!value) return null;
  const diffMs = Date.now() - value.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getDealHistorySeverity(toStatus: string, fromStatus: string | null): "info" | "success" | "warning" | "danger" {
  if (toStatus === "FUNDED" || toStatus === "CONTRACTED") return "success";
  if (toStatus === "APPROVED") return "info";
  if (toStatus === "STRUCTURED" || toStatus === "DRAFT") return "warning";
  if (toStatus === "CANCELED") return "danger";
  if (fromStatus && fromStatus !== toStatus) return "info";
  return "info";
}

function getCustomerActivitySeverity(activityType: string): "info" | "success" | "warning" | "danger" {
  const normalized = activityType.trim().toLowerCase();
  if (normalized.includes("appointment")) return "info";
  if (normalized.includes("task_completed")) return "success";
  if (normalized.includes("task_created")) return "warning";
  if (normalized.includes("sms") || normalized.includes("email") || normalized.includes("call")) return "info";
  return "info";
}

function getInventoryChangeSeverity(wasUpdated: boolean): "info" | "success" | "warning" | "danger" {
  return wasUpdated ? "info" : "success";
}

function getDateDaysAgo(daysAgo: number): string {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

function getStartOfToday(): Date {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
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
  labelQueryFamily("dashboard.v3");
  setRequestContext({ dealershipId });
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
  labelQueryFamily("dashboard.v3.load");
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
    titleQueueOldest,
    titleQueueCount,
    deliveryQueueOldest,
    deliveryQueueCount,
    fundingQueueOldest,
    fundingQueueCount,
    newProspectsCount,
    myTasksCount,
    creditAppsCount,
    pendingStipsCount,
    recentInventoryChangesRaw,
    recentDealChangesRaw,
    recentCustomerChangesRaw,
    salespersonPerformance,
    staleLeadStats,
    salesActivityToday,
    overdueFollowUpCount,
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
    canDeals
      ? prisma.dealTitle.findFirst({
          where: {
            dealershipId,
            titleStatus: { not: "TITLE_COMPLETED" },
            deal: {
              status: "CONTRACTED",
              deletedAt: null,
            },
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        })
      : null,
    canDeals
      ? prisma.deal.count({
          where: {
            dealershipId,
            deletedAt: null,
            status: "CONTRACTED",
            dealTitle: {
              is: { titleStatus: { not: "TITLE_COMPLETED" } },
            },
          },
        })
      : 0,
    canDeals
      ? prisma.deal.findFirst({
          where: {
            dealershipId,
            deletedAt: null,
            status: "CONTRACTED",
            deliveryStatus: "READY_FOR_DELIVERY",
          },
          orderBy: { updatedAt: "asc" },
          select: { updatedAt: true },
        })
      : null,
    canDeals
      ? prisma.deal.count({
          where: {
            dealershipId,
            deletedAt: null,
            status: "CONTRACTED",
            deliveryStatus: "READY_FOR_DELIVERY",
          },
        })
      : 0,
    canDeals
      ? prisma.dealFunding.findFirst({
          where: {
            dealershipId,
            fundingStatus: { in: ["PENDING", "APPROVED"] },
            deal: {
              status: "CONTRACTED",
              deletedAt: null,
            },
          },
          orderBy: { updatedAt: "asc" },
          select: { updatedAt: true },
        })
      : null,
    canDeals
      ? prisma.deal.count({
          where: {
            dealershipId,
            deletedAt: null,
            status: "CONTRACTED",
            dealFundings: {
              some: { fundingStatus: { in: ["PENDING", "APPROVED"] } },
            },
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
    canInventory
      ? prisma.vehicle.findMany({
          where: { ...vehicleWhere },
          orderBy: { updatedAt: "desc" },
          take: MATERIAL_CHANGES_LIMIT,
          select: {
            id: true,
            stockNumber: true,
            year: true,
            make: true,
            model: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : [],
    canDeals
      ? prisma.dealHistory.findMany({
          where: { dealershipId },
          orderBy: { createdAt: "desc" },
          take: MATERIAL_CHANGES_LIMIT,
          select: {
            id: true,
            dealId: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            changedByProfile: { select: { fullName: true } },
            deal: {
              select: {
                id: true,
                customer: { select: { name: true } },
                vehicle: {
                  select: { year: true, make: true, model: true, stockNumber: true },
                },
              },
            },
          },
        })
      : [],
    canCustomers || canCrm
      ? prisma.customerActivity.findMany({
          where: { dealershipId },
          orderBy: { createdAt: "desc" },
          take: MATERIAL_CHANGES_LIMIT,
          select: {
            id: true,
            customerId: true,
            activityType: true,
            createdAt: true,
            actor: { select: { fullName: true } },
            customer: { select: { id: true, name: true } },
          },
        })
      : [],
    canDeals
      ? getSalespersonPerformance(dealershipId, {
          from: getDateDaysAgo(SALES_MANAGER_WINDOW_DAYS - 1),
          to: getDateDaysAgo(0),
          limit: 100,
          offset: 0,
        })
      : Promise.resolve({ data: [], meta: { total: 0, limit: 100, offset: 0 } }),
    canCustomers || canCrm
      ? customersDb.getStaleLeadStats(dealershipId, SALES_STALE_LEAD_DAYS)
      : Promise.resolve({ staleLeadCount: 0, oldestStaleLeadAgeDays: null }),
    canCrm
      ? getTeamActivityToday(dealershipId)
      : Promise.resolve({
          callsLogged: 0,
          appointmentsSet: 0,
          notesAdded: 0,
          callbacksScheduled: 0,
          dealsStarted: 0,
        }),
    canCustomers || canCrm
      ? prisma.customerTask.count({
          where: {
            dealershipId,
            deletedAt: null,
            completedAt: null,
            dueAt: { lt: getStartOfToday() },
          },
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

  // 7-day trend queries (grouped daily counts, oldest→newest)
  const trendStart = new Date();
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));
  trendStart.setHours(0, 0, 0, 0);

  const [inventoryTrendRaw, leadsTrendRaw, dealsTrendRaw, grossProfitTrendRaw, bhphTrendRaw] = await Promise.all([
    canInventory
      ? prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            count(*)::bigint AS count
          FROM "Vehicle"
          WHERE "dealership_id" = ${dealershipId}::uuid
            AND "deleted_at" IS NULL
            AND "created_at" >= ${trendStart}::timestamptz
          GROUP BY 1
          ORDER BY 1
        `)
      : [],
    canCrm
      ? prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            count(*)::bigint AS count
          FROM "Opportunity"
          WHERE "dealership_id" = ${dealershipId}::uuid
            AND "created_at" >= ${trendStart}::timestamptz
          GROUP BY 1
          ORDER BY 1
        `)
      : [],
    canDeals
      ? prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            count(*)::bigint AS count
          FROM "Deal"
          WHERE "dealership_id" = ${dealershipId}::uuid
            AND "deleted_at" IS NULL
            AND "created_at" >= ${trendStart}::timestamptz
          GROUP BY 1
          ORDER BY 1
        `)
      : [],
    canDeals
      ? prisma.$queryRaw<DailyGrossRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', d."created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            COALESCE(SUM(d."front_gross_cents"), 0)::bigint AS "frontGross",
            COALESCE(SUM(COALESCE(df."backend_gross_cents", 0)), 0)::bigint AS "backGross"
          FROM "Deal" d
          LEFT JOIN "DealFinance" df
            ON df."deal_id" = d."id"
            AND df."deleted_at" IS NULL
          WHERE d."dealership_id" = ${dealershipId}::uuid
            AND d."deleted_at" IS NULL
            AND d."status" = 'CONTRACTED'
            AND d."created_at" >= ${trendStart}::timestamptz
          GROUP BY 1
          ORDER BY 1
        `)
      : [],
    canDeals && canLenders
      ? prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            count(*)::bigint AS count
          FROM "Deal"
          WHERE "dealership_id" = ${dealershipId}::uuid
            AND "deleted_at" IS NULL
            AND status = 'CONTRACTED'
            AND "created_at" >= ${trendStart}::timestamptz
          GROUP BY 1
          ORDER BY 1
        `)
      : [],
  ]);

  const inventoryTrend = buildTrendArray(Array.isArray(inventoryTrendRaw) ? inventoryTrendRaw : [], TREND_DAYS);
  const leadsTrend = buildTrendArray(Array.isArray(leadsTrendRaw) ? leadsTrendRaw : [], TREND_DAYS);
  const dealsTrend = buildTrendArray(Array.isArray(dealsTrendRaw) ? dealsTrendRaw : [], TREND_DAYS);
  const grossProfitRows = Array.isArray(grossProfitTrendRaw) ? (grossProfitTrendRaw as DailyGrossRow[]) : [];
  const frontGrossProfitTrend = buildTrendArray(
    grossProfitRows.map((row) => ({ day: row.day, count: row.frontGross })),
    TREND_DAYS
  );
  const backGrossProfitTrend = buildTrendArray(
    grossProfitRows.map((row) => ({ day: row.day, count: row.backGross })),
    TREND_DAYS
  );
  const grossProfitTrend = frontGrossProfitTrend.map(
    (value, index) => value + (backGrossProfitTrend[index] ?? 0)
  );
  const bhphTrend = buildTrendArray(Array.isArray(bhphTrendRaw) ? bhphTrendRaw : [], TREND_DAYS);

  // Today-delta: today's count vs yesterday's
  const inventoryDeltaToday = inventoryTrend[TREND_DAYS - 1] - inventoryTrend[TREND_DAYS - 2];
  const leadsDeltaToday = leadsTrend[TREND_DAYS - 1] - leadsTrend[TREND_DAYS - 2];
  const dealsDeltaToday = dealsTrend[TREND_DAYS - 1] - dealsTrend[TREND_DAYS - 2];
  const grossProfitDeltaToday = grossProfitTrend[TREND_DAYS - 1] - grossProfitTrend[TREND_DAYS - 2];
  const frontGrossProfitDeltaToday =
    frontGrossProfitTrend[TREND_DAYS - 1] - frontGrossProfitTrend[TREND_DAYS - 2];
  const backGrossProfitDeltaToday =
    backGrossProfitTrend[TREND_DAYS - 1] - backGrossProfitTrend[TREND_DAYS - 2];
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
    grossProfitCents: grossProfitTrend.reduce((sum, value) => sum + value, 0),
    grossProfitDelta7dCents: grossProfitDeltaToday,
    grossProfitDelta30dCents: null,
    grossProfitTrend,
    frontGrossProfitCents: frontGrossProfitTrend.reduce((sum, value) => sum + value, 0),
    frontGrossProfitDelta7dCents: frontGrossProfitDeltaToday,
    frontGrossProfitTrend,
    backGrossProfitCents: backGrossProfitTrend.reduce((sum, value) => sum + value, 0),
    backGrossProfitDelta7dCents: backGrossProfitDeltaToday,
    backGrossProfitTrend,
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

  const recentInventoryChanges: DashboardV3MaterialChange[] = Array.isArray(recentInventoryChangesRaw)
    ? recentInventoryChangesRaw.map((row) => {
        const vehicleLabel = [row.year, row.make, row.model].filter(Boolean).join(" ") || "Vehicle";
        const stockLabel = row.stockNumber ? ` · ${row.stockNumber}` : "";
        const wasUpdated = row.updatedAt.getTime() - row.createdAt.getTime() > 1000;
        return {
          id: `inventory-${row.id}-${row.updatedAt.toISOString()}`,
          domain: "inventory",
          title: wasUpdated ? "Inventory updated" : "Vehicle added",
          detail: `${vehicleLabel}${stockLabel}`,
          severity: getInventoryChangeSeverity(wasUpdated),
          timestamp: row.updatedAt.toISOString(),
          href: inventoryDetailPath(row.id),
        };
      })
    : [];

  const recentDealChanges: DashboardV3MaterialChange[] = Array.isArray(recentDealChangesRaw)
    ? recentDealChangesRaw.map((row) => {
        const vehicleLabel = row.deal.vehicle
          ? [row.deal.vehicle.year, row.deal.vehicle.make, row.deal.vehicle.model].filter(Boolean).join(" ")
          : "Deal";
        const detailParts = [
          row.deal.customer?.name ?? null,
          vehicleLabel !== "Deal" ? vehicleLabel : null,
          row.fromStatus ? `${formatStatusLabel(row.fromStatus)} → ${formatStatusLabel(row.toStatus)}` : `Moved to ${formatStatusLabel(row.toStatus)}`,
        ].filter(Boolean);
        return {
          id: `deal-${row.id}`,
          domain: "deals",
          title: row.fromStatus
            ? `Deal moved to ${formatStatusLabel(row.toStatus)}`
            : `Deal entered ${formatStatusLabel(row.toStatus)}`,
          detail: detailParts.join(" · "),
          severity: getDealHistorySeverity(row.toStatus, row.fromStatus),
          actorLabel: row.changedByProfile?.fullName ?? undefined,
          timestamp: row.createdAt.toISOString(),
          href: `/deals/${row.dealId}`,
        };
      })
    : [];

  const recentCustomerChanges: DashboardV3MaterialChange[] = Array.isArray(recentCustomerChangesRaw)
    ? recentCustomerChangesRaw.map((row) => ({
        id: `customer-${row.id}`,
        domain: "customers",
        title: formatActivityTypeLabel(row.activityType),
        detail: row.customer?.name ?? "Customer activity",
        severity: getCustomerActivitySeverity(row.activityType),
        actorLabel: row.actor?.fullName ?? undefined,
        timestamp: row.createdAt.toISOString(),
        href: customerDetailPath(row.customerId),
      }))
    : [];

  const materialChanges = [...recentDealChanges, ...recentInventoryChanges, ...recentCustomerChanges]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MATERIAL_CHANGES_LIMIT);

  const rankedSalesRows = Array.isArray(salespersonPerformance.data)
    ? salespersonPerformance.data
        .map((row) => ({
          ...row,
          grossProfitCentsNumber: Number(row.grossProfitCents),
          averageProfitPerDealCentsNumber: Number(row.averageProfitPerDealCents),
        }))
        .filter((row) => Number.isFinite(row.grossProfitCentsNumber) && Number.isFinite(row.averageProfitPerDealCentsNumber))
    : [];

  const topCloserRow = [...rankedSalesRows].sort((a, b) => {
    if (b.dealsClosed !== a.dealsClosed) return b.dealsClosed - a.dealsClosed;
    return b.grossProfitCentsNumber - a.grossProfitCentsNumber;
  })[0];

  const topGrossRow = [...rankedSalesRows].sort((a, b) => {
    if (b.grossProfitCentsNumber !== a.grossProfitCentsNumber) return b.grossProfitCentsNumber - a.grossProfitCentsNumber;
    return b.dealsClosed - a.dealsClosed;
  })[0];

  const salesTeamDealCount = rankedSalesRows.reduce((sum, row) => sum + row.dealsClosed, 0);
  const salesTeamGrossCents = rankedSalesRows.reduce((sum, row) => sum + row.grossProfitCentsNumber, 0);

  const dashboardGeneratedAt = new Date().toISOString();
  const payload: DashboardV3Data = {
    dashboardGeneratedAt,
    metrics,
    customerTasks,
    inventoryAlerts,
    dealPipeline,
    dealStageCounts,
    opsQueues: {
      titleQueueCount: typeof titleQueueCount === "number" ? titleQueueCount : 0,
      titleQueueOldestAgeDays: getAgeDays(titleQueueOldest?.createdAt),
      deliveryQueueCount: typeof deliveryQueueCount === "number" ? deliveryQueueCount : 0,
      deliveryQueueOldestAgeDays: getAgeDays(deliveryQueueOldest?.updatedAt),
      fundingQueueCount: typeof fundingQueueCount === "number" ? fundingQueueCount : 0,
      fundingQueueOldestAgeDays: getAgeDays(fundingQueueOldest?.updatedAt),
    },
    materialChanges,
    salesManager: {
      topCloserName: topCloserRow?.salespersonName ?? null,
      topCloserDealsClosed: topCloserRow?.dealsClosed ?? 0,
      topGrossRepName: topGrossRow?.salespersonName ?? null,
      topGrossRepCents: topGrossRow?.grossProfitCentsNumber ?? 0,
      averageGrossPerDealCents:
        salesTeamDealCount > 0 ? Math.round(salesTeamGrossCents / salesTeamDealCount) : 0,
      rankedRepCount: salespersonPerformance.meta.total ?? 0,
      staleLeadCount: staleLeadStats.staleLeadCount,
      oldestStaleLeadAgeDays: staleLeadStats.oldestStaleLeadAgeDays,
      overdueFollowUpCount: typeof overdueFollowUpCount === "number" ? overdueFollowUpCount : 0,
      appointmentsSetToday: salesActivityToday.appointmentsSet,
      callbacksScheduledToday: salesActivityToday.callbacksScheduled,
      rangeLabel: "Last 30 days",
    },
    floorplan: Array.isArray(floorplanLines) ? floorplanLines : [],
    appointments: appointments.slice(0, APPOINTMENTS_LIMIT),
    financeNotices: financeNoticesCapped,
  };

  const loadTimeMs = Date.now() - startMs;
  const widgetCounts = {
    customerTasks: payload.customerTasks.length,
    inventoryAlerts: payload.inventoryAlerts.length,
    dealPipeline: payload.dealPipeline.length,
    materialChanges: payload.materialChanges.length,
    salesManagerRankedReps: payload.salesManager.rankedRepCount,
    salesManagerStaleLeads: payload.salesManager.staleLeadCount,
    salesManagerOverdueFollowUps: payload.salesManager.overdueFollowUpCount,
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
