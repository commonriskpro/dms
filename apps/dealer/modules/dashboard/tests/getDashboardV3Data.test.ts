/**
 * getDashboardV3Data: return shape and permission gating (unit with mocks).
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
jest.mock("@/modules/customers/db/customers", () => ({
  listNewProspects: jest.fn(),
}));
jest.mock("@/modules/customers/db/tasks", () => ({
  listMyTasks: jest.fn(),
}));

import { prisma } from "@/lib/db";
import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";
import { getDashboardV3Data } from "../service/getDashboardV3Data";

describe("getDashboardV3Data", () => {
  const dealershipId = "550e8400-e29b-41d4-a716-446655440000";
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
  });

  it("returns full DashboardV3Data shape with metrics, customerTasks, inventoryAlerts, dealPipeline", async () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    const data = await getDashboardV3Data(dealershipId, userId, permissions);

    expect(data).toHaveProperty("metrics");
    expect(data.metrics).toEqual({
      inventoryCount: 10,
      leadsCount: 5,
      dealsCount: 3,
      bhphCount: 0,
    });
    expect(data).toHaveProperty("customerTasks");
    expect(data.customerTasks).toHaveProperty("newProspects");
    expect(data).toHaveProperty("inventoryAlerts");
    expect(data.inventoryAlerts.carsInRecon).toBeDefined();
    expect(data).toHaveProperty("floorplan");
    expect(Array.isArray(data.floorplan)).toBe(true);
    expect(data).toHaveProperty("dealPipeline");
    expect(data.dealPipeline.pendingDeals).toBe(2);
    expect(data.dealPipeline.contractsToReview).toBe(1);
    expect(data).toHaveProperty("appointments");
    expect(data).toHaveProperty("financeNotices");
  });

  it("scopes vehicle count by dealershipId", async () => {
    const permissions = ["inventory.read"];
    await getDashboardV3Data(dealershipId, userId, permissions);
    expect(prisma.vehicle.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dealershipId }),
      })
    );
  });

  it("returns zeros for metrics when user lacks permission", async () => {
    const data = await getDashboardV3Data(dealershipId, userId, []);
    expect(data.metrics.inventoryCount).toBe(0);
    expect(data.metrics.leadsCount).toBe(0);
    expect(data.metrics.dealsCount).toBe(0);
    expect(data.metrics.bhphCount).toBe(0);
    expect(prisma.vehicle.count).not.toHaveBeenCalled();
    expect(prisma.opportunity.count).not.toHaveBeenCalled();
    expect(prisma.deal.count).not.toHaveBeenCalled();
  });
});
