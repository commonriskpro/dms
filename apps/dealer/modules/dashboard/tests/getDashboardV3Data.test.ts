/**
 * getDashboardV3Data: return shape, RBAC, tenant isolation, query limits, deltas, logging safety.
 */
jest.mock("@/lib/db", () => ({
  prisma: {
    vehicle: { count: jest.fn() },
    opportunity: { count: jest.fn() },
    deal: { count: jest.fn(), groupBy: jest.fn() },
    financeSubmission: { count: jest.fn() },
    financeApplication: { count: jest.fn() },
    financeStipulation: { count: jest.fn() },
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
}));
jest.mock("@/modules/customers/db/tasks", () => ({
  listMyTasks: jest.fn(),
}));
jest.mock("@/modules/dashboard/service/floorplan-cache", () => ({
  getCachedFloorplan: jest.fn(),
}));

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";
import { getCachedFloorplan } from "@/modules/dashboard/service/floorplan-cache";
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
    (customersDb.listNewProspects as jest.Mock).mockResolvedValue([]);
    (tasksDb.listMyTasks as jest.Mock).mockResolvedValue([]);
    (getCachedFloorplan as jest.Mock).mockResolvedValue([]);
  });

  it("returns full DashboardV3Data shape with dashboardGeneratedAt, metrics (with deltas), WidgetRow arrays, floorplan, appointments, financeNotices", async () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    const data = await getDashboardV3Data(dealershipId, userId, permissions);

    expect(data).toHaveProperty("dashboardGeneratedAt");
    expect(typeof data.dashboardGeneratedAt).toBe("string");
    expect(data).toHaveProperty("metrics");
    expect(data.metrics.inventoryCount).toBe(10);
    expect(data.metrics.leadsCount).toBe(5);
    expect(data.metrics.dealsCount).toBe(3);
    expect(data.metrics.bhphCount).toBe(0);
    expect(data.metrics.inventoryDelta7d).toBeNull();
    expect(data.metrics.inventoryDelta30d).toBeNull();
    expect(data.metrics.leadsDelta7d).toBeNull();
    expect(data.metrics.leadsDelta30d).toBeNull();
    expect(data.metrics.dealsDelta7d).toBeNull();
    expect(data.metrics.dealsDelta30d).toBeNull();
    expect(data.metrics.bhphDelta7d).toBeNull();
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
    expect(data.metrics.bhphCount).toBe(0);
    expect(data.customerTasks).toEqual([]);
    expect(data.inventoryAlerts).toEqual([]);
    expect(data.dealPipeline).toEqual([]);
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

  it("metric deltas are null when not computed", async () => {
    const permissions = ["inventory.read", "crm.read", "deals.read", "lenders.read"];
    const data = await getDashboardV3Data(dealershipId, userId, permissions);
    expect(data.metrics.inventoryDelta7d).toBeNull();
    expect(data.metrics.inventoryDelta30d).toBeNull();
    expect(data.metrics.leadsDelta7d).toBeNull();
    expect(data.metrics.leadsDelta30d).toBeNull();
    expect(data.metrics.dealsDelta7d).toBeNull();
    expect(data.metrics.dealsDelta30d).toBeNull();
    expect(data.metrics.bhphDelta7d).toBeNull();
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
});
