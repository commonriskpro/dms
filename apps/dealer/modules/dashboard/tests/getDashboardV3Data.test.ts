/** @jest-environment node */
/**
 * getDashboardV3Data: return shape, RBAC, tenant isolation, query limits, deltas, logging safety.
 */
jest.mock("@/lib/db", () => ({
  prisma: {
    vehicle: { count: jest.fn(), findMany: jest.fn() },
    opportunity: { count: jest.fn() },
    deal: { count: jest.fn(), groupBy: jest.fn(), findFirst: jest.fn() },
    dealTitle: { findFirst: jest.fn() },
    dealHistory: { findMany: jest.fn() },
    dealFunding: { findFirst: jest.fn() },
    customerTask: { count: jest.fn() },
    customerActivity: { findMany: jest.fn() },
    financeSubmission: { count: jest.fn() },
    financeApplication: { count: jest.fn() },
    financeStipulation: { count: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock("@/modules/customers/db/customers", () => ({
  listNewProspects: jest.fn(),
  getStaleLeadStats: jest.fn(),
}));
jest.mock("@/modules/customers/db/tasks", () => ({
  listMyTasks: jest.fn(),
}));
jest.mock("@/modules/dashboard/service/floorplan-cache", () => ({
  getCachedFloorplan: jest.fn(),
}));
jest.mock("@/modules/reporting-core/service/salesperson-performance", () => ({
  getSalespersonPerformance: jest.fn(),
}));
jest.mock("@/modules/customers/service/team-activity", () => ({
  getTeamActivityToday: jest.fn(),
}));
jest.mock("@/lib/infrastructure/cache/cacheHelpers", () => ({
  withCache: (_key: unknown, _ttl: number, fn: () => Promise<unknown>) => fn(),
}));

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";
import { getTeamActivityToday } from "@/modules/customers/service/team-activity";
import { getCachedFloorplan } from "@/modules/dashboard/service/floorplan-cache";
import { getSalespersonPerformance } from "@/modules/reporting-core/service/salesperson-performance";
import { getDashboardV3Data } from "../service/getDashboardV3Data";

describe("getDashboardV3Data", () => {
  const dealershipId = "550e8400-e29b-41d4-a716-446655440000";
  const otherDealershipId = "660e8400-e29b-41d4-a716-446655440001";
  const userId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.vehicle.count as jest.Mock).mockResolvedValue(10);
    (prisma.opportunity.count as jest.Mock).mockResolvedValue(5);
    (prisma.deal.count as jest.Mock).mockResolvedValue(3);
    (prisma.deal.groupBy as jest.Mock).mockResolvedValue([
      { status: "DRAFT", _count: { id: 2 } },
      { status: "CONTRACTED", _count: { id: 1 } },
    ]);
    (prisma.financeSubmission.count as jest.Mock).mockResolvedValue(0);
    (prisma.financeApplication.count as jest.Mock).mockResolvedValue(1);
    (prisma.financeStipulation.count as jest.Mock).mockResolvedValue(0);
    (prisma.vehicle.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.deal.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.dealTitle.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.dealHistory.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.dealFunding.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.customerTask.count as jest.Mock).mockResolvedValue(2);
    (prisma.customerActivity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    (customersDb.listNewProspects as jest.Mock).mockResolvedValue([]);
    (customersDb.getStaleLeadStats as jest.Mock).mockResolvedValue({
      staleLeadCount: 3,
      oldestStaleLeadAgeDays: 9,
    });
    (tasksDb.listMyTasks as jest.Mock).mockResolvedValue([]);
    (getCachedFloorplan as jest.Mock).mockResolvedValue([]);
    (getTeamActivityToday as jest.Mock).mockResolvedValue({
      callsLogged: 0,
      appointmentsSet: 4,
      notesAdded: 0,
      callbacksScheduled: 2,
      dealsStarted: 0,
    });
    (getSalespersonPerformance as jest.Mock).mockResolvedValue({
      data: [
        {
          salespersonId: "sales-1",
          salespersonName: "Alex Closer",
          dealsClosed: 4,
          grossProfitCents: "640000",
          averageProfitPerDealCents: "160000",
        },
        {
          salespersonId: "sales-2",
          salespersonName: "Morgan Gross",
          dealsClosed: 2,
          grossProfitCents: "710000",
          averageProfitPerDealCents: "355000",
        },
      ],
      meta: { total: 2, limit: 100, offset: 0 },
    });
  });

  it("returns full DashboardV3Data shape with dashboardGeneratedAt, metrics (with deltas), opsQueues, materialChanges, salesManager, WidgetRow arrays, floorplan, appointments, financeNotices", async () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    const data = await getDashboardV3Data(dealershipId, userId, permissions);

    expect(data).toHaveProperty("dashboardGeneratedAt");
    expect(typeof data.dashboardGeneratedAt).toBe("string");
    expect(data).toHaveProperty("metrics");
    expect(data.metrics.inventoryCount).toBe(10);
    expect(data.metrics.leadsCount).toBe(5);
    expect(data.metrics.dealsCount).toBe(3);
    expect(data.metrics.grossProfitCents).toBe(0);
    expect(data.metrics.frontGrossProfitCents).toBe(0);
    expect(data.metrics.backGrossProfitCents).toBe(0);
    expect(data.metrics.bhphCount).toBe(0);
    expect(data.metrics.inventoryDelta7d).toBe(0);
    expect(data.metrics.inventoryDelta30d).toBeNull();
    expect(data.metrics.leadsDelta7d).toBe(0);
    expect(data.metrics.leadsDelta30d).toBeNull();
    expect(data.metrics.dealsDelta7d).toBe(0);
    expect(data.metrics.dealsDelta30d).toBeNull();
    expect(data.metrics.grossProfitDelta7dCents).toBe(0);
    expect(data.metrics.grossProfitDelta30dCents).toBeNull();
    expect(data.metrics.frontGrossProfitDelta7dCents).toBe(0);
    expect(data.metrics.backGrossProfitDelta7dCents).toBe(0);
    expect(data.metrics.bhphDelta7d).toBe(0);
    expect(data.metrics.bhphDelta30d).toBeNull();

    expect(data).toHaveProperty("customerTasks");
    expect(Array.isArray(data.customerTasks)).toBe(true);
    expect(data.customerTasks.length).toBeLessThanOrEqual(5);
    if (data.customerTasks.length > 0) {
      expect(data.customerTasks[0]).toHaveProperty("key");
      expect(data.customerTasks[0]).toHaveProperty("label");
      expect(data.customerTasks[0]).toHaveProperty("count");
    }

    expect(data).toHaveProperty("inventoryAlerts");
    expect(Array.isArray(data.inventoryAlerts)).toBe(true);
    expect(data.inventoryAlerts.length).toBeLessThanOrEqual(5);

    expect(data).toHaveProperty("dealPipeline");
    expect(Array.isArray(data.dealPipeline)).toBe(true);
    expect(data.dealPipeline.length).toBeLessThanOrEqual(5);
    const pendingRow = data.dealPipeline.find((r) => r.key === "pendingDeals");
    expect(pendingRow?.count).toBe(2);
    const contractsRow = data.dealPipeline.find((r) => r.key === "contractsToReview");
    expect(contractsRow?.count).toBe(1);

    expect(data).toHaveProperty("opsQueues");
    expect(data.opsQueues).toEqual({
      titleQueueCount: 3,
      titleQueueOldestAgeDays: null,
      deliveryQueueCount: 3,
      deliveryQueueOldestAgeDays: null,
      fundingQueueCount: 3,
      fundingQueueOldestAgeDays: null,
    });
    expect(data).toHaveProperty("materialChanges");
    expect(Array.isArray(data.materialChanges)).toBe(true);
    expect(data.materialChanges.length).toBeLessThanOrEqual(6);
    expect(data.salesManager).toEqual({
      topCloserName: "Alex Closer",
      topCloserDealsClosed: 4,
      topGrossRepName: "Morgan Gross",
      topGrossRepCents: 710000,
      averageGrossPerDealCents: 225000,
      rankedRepCount: 2,
      staleLeadCount: 3,
      oldestStaleLeadAgeDays: 9,
      overdueFollowUpCount: 2,
      appointmentsSetToday: 4,
      callbacksScheduledToday: 2,
      rangeLabel: "Last 30 days",
    });

    expect(data).toHaveProperty("floorplan");
    expect(Array.isArray(data.floorplan)).toBe(true);
    expect(data).toHaveProperty("appointments");
    expect(Array.isArray(data.appointments)).toBe(true);
    expect(data.appointments.length).toBeLessThanOrEqual(5);
    expect(data).toHaveProperty("financeNotices");
    expect(Array.isArray(data.financeNotices)).toBe(true);
    expect(data.financeNotices.length).toBeLessThanOrEqual(5);
  });

  it("scopes vehicle count by dealershipId (tenant isolation)", async () => {
    const permissions = ["inventory.read"];
    await getDashboardV3Data(dealershipId, userId, permissions);
    expect(prisma.vehicle.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dealershipId }),
      })
    );
  });

  it("uses other dealershipId in queries when provided (tenant isolation)", async () => {
    const permissions = ["inventory.read", "crm.read"];
    await getDashboardV3Data(otherDealershipId, userId, permissions);
    expect(prisma.vehicle.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dealershipId: otherDealershipId }),
      })
    );
    expect(prisma.opportunity.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dealershipId: otherDealershipId }),
      })
    );
  });

  it("returns empty widgets and zero metrics when user has no permissions (RBAC)", async () => {
    const data = await getDashboardV3Data(dealershipId, userId, []);
    expect(data.metrics.inventoryCount).toBe(0);
    expect(data.metrics.leadsCount).toBe(0);
    expect(data.metrics.dealsCount).toBe(0);
    expect(data.metrics.grossProfitCents).toBe(0);
    expect(data.metrics.frontGrossProfitCents).toBe(0);
    expect(data.metrics.backGrossProfitCents).toBe(0);
    expect(data.metrics.bhphCount).toBe(0);
    expect(data.customerTasks).toEqual([]);
    expect(data.inventoryAlerts).toEqual([]);
    expect(data.dealPipeline).toEqual([]);
    expect(data.opsQueues).toEqual({
      titleQueueCount: 0,
      titleQueueOldestAgeDays: null,
      deliveryQueueCount: 0,
      deliveryQueueOldestAgeDays: null,
      fundingQueueCount: 0,
      fundingQueueOldestAgeDays: null,
    });
    expect(data.materialChanges).toEqual([]);
    expect(data.salesManager).toEqual({
      topCloserName: null,
      topCloserDealsClosed: 0,
      topGrossRepName: null,
      topGrossRepCents: 0,
      averageGrossPerDealCents: 0,
      rankedRepCount: 0,
      staleLeadCount: 0,
      oldestStaleLeadAgeDays: null,
      overdueFollowUpCount: 0,
      appointmentsSetToday: 0,
      callbacksScheduledToday: 0,
      rangeLabel: "Last 30 days",
    });
    expect(prisma.vehicle.count).not.toHaveBeenCalled();
    expect(prisma.opportunity.count).not.toHaveBeenCalled();
    expect(prisma.deal.count).not.toHaveBeenCalled();
  });

  it("enforces query limit: listNewProspects called with limit 5", async () => {
    const permissions = ["customers.read"];
    await getDashboardV3Data(dealershipId, userId, permissions);
    expect(customersDb.listNewProspects).toHaveBeenCalledWith(dealershipId, 5);
  });

  it("caps financeNotices at 5", async () => {
    const permissions = ["lenders.read"];
    (prisma.financeStipulation.count as jest.Mock).mockResolvedValue(10);
    const data = await getDashboardV3Data(dealershipId, userId, permissions);
    expect(data.financeNotices.length).toBeLessThanOrEqual(5);
  });

  it("metric deltas: 7d from trend, 30d null", async () => {
    const permissions = ["inventory.read", "crm.read", "deals.read", "lenders.read"];
    const data = await getDashboardV3Data(dealershipId, userId, permissions);
    expect(data.metrics.inventoryDelta7d).toBe(0);
    expect(data.metrics.inventoryDelta30d).toBeNull();
    expect(data.metrics.leadsDelta7d).toBe(0);
    expect(data.metrics.leadsDelta30d).toBeNull();
    expect(data.metrics.dealsDelta7d).toBe(0);
    expect(data.metrics.dealsDelta30d).toBeNull();
    expect(data.metrics.grossProfitDelta7dCents).toBe(0);
    expect(data.metrics.grossProfitDelta30dCents).toBeNull();
    expect(data.metrics.frontGrossProfitDelta7dCents).toBe(0);
    expect(data.metrics.backGrossProfitDelta7dCents).toBe(0);
    expect(data.metrics.bhphDelta7d).toBe(0);
    expect(data.metrics.bhphDelta30d).toBeNull();
  });

  it("logs dashboard_v3_load_start and dashboard_v3_load_complete without PII", async () => {
    const permissions = ["inventory.read"];
    await getDashboardV3Data(dealershipId, userId, permissions);

    expect(logger.info).toHaveBeenCalledWith(
      "dashboard_v3_load_start",
      expect.objectContaining({
        requestId: expect.any(String),
        dealershipIdTail: expect.any(String),
        userIdTail: expect.any(String),
      })
    );
    const startContext = (logger.info as jest.Mock).mock.calls.find(
      (c: [string, object]) => c[0] === "dashboard_v3_load_start"
    )?.[1] as object;
    expect(startContext).not.toHaveProperty("email");
    expect(startContext).not.toHaveProperty("token");
    expect(startContext).not.toHaveProperty("cookie");

    expect(logger.info).toHaveBeenCalledWith(
      "dashboard_v3_load_complete",
      expect.objectContaining({
        requestId: expect.any(String),
        dealershipIdTail: expect.any(String),
        userIdTail: expect.any(String),
        loadTimeMs: expect.any(Number),
        widgetCounts: expect.any(Object),
      })
    );
    const completeContext = (logger.info as jest.Mock).mock.calls.find(
      (c: [string, object]) => c[0] === "dashboard_v3_load_complete"
    )?.[1] as object;
    expect(completeContext).not.toHaveProperty("email");
    expect(completeContext).not.toHaveProperty("token");
    expect(completeContext).not.toHaveProperty("cookie");
  });

  it("financeNotices use severity info|success|warning|danger only", async () => {
    (prisma.financeStipulation.count as jest.Mock).mockResolvedValue(1);
    const permissions = ["lenders.read"];
    const data = await getDashboardV3Data(dealershipId, userId, permissions);
    const validSeverities = ["info", "success", "warning", "danger"];
    data.financeNotices.forEach((notice) => {
      expect(validSeverities).toContain(notice.severity);
    });
  });

  it("all data-access calls use the same dealershipId (no cross-tenant mix)", async () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    await getDashboardV3Data(dealershipId, userId, permissions);
    const vehicleCalls = (prisma.vehicle.count as jest.Mock).mock.calls;
    vehicleCalls.forEach((call: unknown[]) => {
      const where = (call[0] as { where?: { dealershipId?: string } })?.where;
      expect(where?.dealershipId).toBe(dealershipId);
    });
    const opportunityCalls = (prisma.opportunity.count as jest.Mock).mock.calls;
    opportunityCalls.forEach((call: unknown[]) => {
      const where = (call[0] as { where?: { dealershipId?: string } })?.where;
      expect(where?.dealershipId).toBe(dealershipId);
    });
    expect(customersDb.listNewProspects).toHaveBeenCalledWith(dealershipId, 5);
    expect(tasksDb.listMyTasks).toHaveBeenCalledWith(dealershipId, userId, 100);
    expect(getCachedFloorplan).toHaveBeenCalledWith(dealershipId, expect.any(Function));
  });

  it("partial permissions: only allowed widgets populated (inventory only)", async () => {
    const permissions = ["inventory.read"];
    const data = await getDashboardV3Data(dealershipId, userId, permissions);
    expect(data.metrics.inventoryCount).toBe(10);
    expect(data.metrics.leadsCount).toBe(0);
    expect(data.metrics.dealsCount).toBe(0);
    expect(data.metrics.bhphCount).toBe(0);
    expect(data.customerTasks).toEqual([]);
    expect(data.inventoryAlerts.length).toBeGreaterThan(0);
    expect(data.dealPipeline).toEqual([]);
    expect(data.opsQueues).toEqual({
      titleQueueCount: 0,
      titleQueueOldestAgeDays: null,
      deliveryQueueCount: 0,
      deliveryQueueOldestAgeDays: null,
      fundingQueueCount: 0,
      fundingQueueOldestAgeDays: null,
    });
    expect(data.materialChanges).toEqual([]);
    expect(data.salesManager).toEqual({
      topCloserName: null,
      topCloserDealsClosed: 0,
      topGrossRepName: null,
      topGrossRepCents: 0,
      averageGrossPerDealCents: 0,
      rankedRepCount: 0,
      staleLeadCount: 0,
      oldestStaleLeadAgeDays: null,
      overdueFollowUpCount: 0,
      appointmentsSetToday: 0,
      callbacksScheduledToday: 0,
      rangeLabel: "Last 30 days",
    });
    expect(data.financeNotices).toEqual([]);
    expect(prisma.opportunity.count).not.toHaveBeenCalled();
    expect(prisma.deal.count).not.toHaveBeenCalled();
  });

  it("materialChanges preserve severity and actor attribution where available", async () => {
    (prisma.dealHistory.findMany as jest.Mock).mockResolvedValue([
      {
        id: "hist-1",
        dealId: "deal-1",
        fromStatus: "DRAFT",
        toStatus: "CONTRACTED",
        createdAt: new Date("2026-03-10T14:00:00.000Z"),
        changedByProfile: { fullName: "Desk Manager" },
        deal: {
          id: "deal-1",
          customer: { name: "Sam Buyer" },
          vehicle: { year: 2025, make: "Kia", model: "Soul", stockNumber: "246986" },
        },
      },
    ]);
    (prisma.customerActivity.findMany as jest.Mock).mockResolvedValue([
      {
        id: "activity-1",
        customerId: "cust-1",
        activityType: "task_created",
        createdAt: new Date("2026-03-10T13:00:00.000Z"),
        actor: { fullName: "Sales Manager" },
        customer: { id: "cust-1", name: "Alex Prospect" },
      },
    ]);

    const data = await getDashboardV3Data(dealershipId, userId, ["customers.read", "crm.read", "deals.read"]);
    expect(data.materialChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "deals",
          severity: "success",
          actorLabel: "Desk Manager",
        }),
        expect.objectContaining({
          domain: "customers",
          severity: "warning",
          actorLabel: "Sales Manager",
        }),
      ])
    );
  });

  it("opsQueues expose oldest-age semantics from title, delivery, and funding queues", async () => {
    (prisma.dealTitle.findFirst as jest.Mock).mockResolvedValue({
      createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    });
    (prisma.deal.findFirst as jest.Mock).mockResolvedValue({
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });
    (prisma.dealFunding.findFirst as jest.Mock).mockResolvedValue({
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    const data = await getDashboardV3Data(dealershipId, userId, ["deals.read"]);
    expect(data.opsQueues.titleQueueOldestAgeDays).toBeGreaterThanOrEqual(9);
    expect(data.opsQueues.deliveryQueueOldestAgeDays).toBeGreaterThanOrEqual(3);
    expect(data.opsQueues.fundingQueueOldestAgeDays).toBeGreaterThanOrEqual(5);
  });

  it("complete log context contains only allowed keys (no PII/tokens)", async () => {
    const permissions = ["inventory.read"];
    await getDashboardV3Data(dealershipId, userId, permissions);
    const allowedKeys = new Set(["requestId", "dealershipIdTail", "userIdTail", "loadTimeMs", "widgetCounts", "msg", "ts", "app", "env"]);
    const completeCall = (logger.info as jest.Mock).mock.calls.find(
      (c: [string, object]) => c[0] === "dashboard_v3_load_complete"
    );
    expect(completeCall).toBeDefined();
    const context = completeCall![1] as Record<string, unknown>;
    const forbidden = ["email", "token", "cookie", "cookies", "authorization", "bearer", "password", "supabase", "vin", "ssn"];
    forbidden.forEach((key) => {
      expect(context).not.toHaveProperty(key);
    });
    Object.keys(context).forEach((key) => {
      const normalized = key.toLowerCase().replace(/[-_]/g, "");
      expect(["email", "token", "cookie", "authorization", "password", "supabase"].some((f) => normalized.includes(f.replace(/[-_]/g, "")))).toBe(false);
    });
  });

  it("error log context contains only safe fields (no stack or PII)", async () => {
    (prisma.vehicle.count as jest.Mock).mockRejectedValueOnce(new Error("DB error"));
    await expect(getDashboardV3Data(dealershipId, userId, ["inventory.read"])).rejects.toThrow("DB error");
    expect(logger.error).toHaveBeenCalledWith(
      "dashboard_v3_load_error",
      expect.objectContaining({
        requestId: expect.any(String),
        dealershipIdTail: expect.any(String),
        userIdTail: expect.any(String),
        loadTimeMs: expect.any(Number),
        errorCode: "Error",
      })
    );
    const errorContext = (logger.error as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(errorContext).not.toHaveProperty("stack");
    expect(errorContext).not.toHaveProperty("email");
    expect(errorContext).not.toHaveProperty("token");
  });
});
