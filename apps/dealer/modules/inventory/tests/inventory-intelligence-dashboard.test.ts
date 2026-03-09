/**
 * Inventory Intelligence Dashboard: RBAC, validation, caching, alert ordering, comps, service INVALID_QUERY.
 */
import {
  getInventoryIntelligenceDashboard,
  inventoryDashboardQuerySchema,
  clearDashboardAggregateCacheForTesting,
} from "../service/inventory-intelligence-dashboard";
import { ApiError } from "@/lib/auth";

jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
}));

const dealerId = "a1000000-0000-0000-0000-000000000001";
const userId = "a2000000-0000-0000-0000-000000000002";

describe("Inventory Intelligence Dashboard — RBAC", () => {
  it("throws FORBIDDEN when ctx lacks inventory.read", async () => {
    const ctx = {
      dealershipId: dealerId,
      userId,
      permissions: ["inventory.write"],
    };
    await expect(
      getInventoryIntelligenceDashboard(ctx, { page: 1, pageSize: 25 })
    ).rejects.toThrow(ApiError);
    await expect(
      getInventoryIntelligenceDashboard(ctx, { page: 1, pageSize: 25 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Inventory Intelligence Dashboard — Service validation (INVALID_QUERY)", () => {
  it("throws INVALID_QUERY with fieldErrors when query is invalid", async () => {
    const ctx = {
      dealershipId: dealerId,
      userId,
      permissions: ["inventory.read"],
    };
    await expect(
      getInventoryIntelligenceDashboard(ctx, { minPrice: 10000, maxPrice: 5000 })
    ).rejects.toThrow(ApiError);
    await expect(
      getInventoryIntelligenceDashboard(ctx, { minPrice: 10000, maxPrice: 5000 })
    ).rejects.toMatchObject({ code: "INVALID_QUERY" });
    try {
      await getInventoryIntelligenceDashboard(ctx, { minPrice: 10000, maxPrice: 5000 });
    } catch (e) {
      expect((e as ApiError).details).toBeDefined();
      expect((e as ApiError).details).toHaveProperty("fieldErrors");
    }
  });
});

describe("Inventory Intelligence Dashboard — Validation (schema)", () => {
  it("accepts valid default query", () => {
    const result = inventoryDashboardQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(25);
      expect(result.data.sortBy).toBe("createdAt");
      expect(result.data.sortOrder).toBe("desc");
    }
  });

  it("rejects minPrice > maxPrice", () => {
    const result = inventoryDashboardQuerySchema.safeParse({
      minPrice: 10000,
      maxPrice: 5000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = inventoryDashboardQuerySchema.safeParse({
      status: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects pageSize > 100", () => {
    const result = inventoryDashboardQuerySchema.safeParse({
      pageSize: 101,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid alertType and floorplanOverdue", () => {
    const result = inventoryDashboardQuerySchema.safeParse({
      alertType: "STALE",
      floorplanOverdue: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alertType).toBe("STALE");
      expect(result.data.floorplanOverdue).toBe(1);
    }
  });
});

describe("Inventory Intelligence Dashboard — Cache", () => {
  it("clearDashboardAggregateCacheForTesting runs without error", () => {
    expect(() => clearDashboardAggregateCacheForTesting()).not.toThrow();
  });
});

describe("Inventory Intelligence Dashboard — response shape and alert ordering", () => {
  const ctx = {
    dealershipId: dealerId,
    userId,
    permissions: ["inventory.read"],
  };

  beforeAll(() => {
    clearDashboardAggregateCacheForTesting();
  });

  it("returns kpis, intelligence, and list with expected keys", async () => {
    const data = await getInventoryIntelligenceDashboard(ctx, { page: 1, pageSize: 25 });
    expect(data).toHaveProperty("kpis");
    expect(data).toHaveProperty("intelligence");
    expect(data).toHaveProperty("list");
    expect(data.kpis).toHaveProperty("totalUnits");
    expect(data.kpis).toHaveProperty("inventoryValueCents");
    expect(data.kpis).toHaveProperty("avgValuePerVehicleCents");
    expect(data.kpis).toHaveProperty("daysToTurn");
    expect(data.kpis).toHaveProperty("demandScore");
    expect(data.kpis.daysToTurn).toMatchObject({
      targetDays: expect.any(Number),
      status: expect.stringMatching(/^(good|warn|bad|na)$/),
    });
    expect(data.intelligence).toHaveProperty("priceToMarket");
    expect(data.intelligence).toHaveProperty("turnPerformance");
    expect(data.intelligence).toHaveProperty("alertCenter");
    expect(Array.isArray(data.intelligence.alertCenter)).toBe(true);
    expect(data.list).toMatchObject({
      items: expect.any(Array),
      page: 1,
      pageSize: 25,
      total: expect.any(Number),
    });
  });

  it("alertCenter is sorted by severity then count desc then title; or single 'No active alerts' when all zero", async () => {
    const data = await getInventoryIntelligenceDashboard(ctx, { page: 1, pageSize: 25 });
    const alerts = data.intelligence.alertCenter;
    const severityRank = { high: 0, medium: 1, low: 2 };
    if (alerts.length === 1 && alerts[0].key === "none") {
      expect(alerts[0].title).toBe("No active alerts");
      expect(alerts[0].count).toBe(0);
      return;
    }
    for (let i = 1; i < alerts.length; i++) {
      const a = alerts[i - 1];
      const b = alerts[i];
      const rankA = severityRank[a.severity];
      const rankB = severityRank[b.severity];
      expect(rankA <= rankB).toBe(true);
      if (rankA === rankB) {
        expect(b.count <= a.count).toBe(true);
        if (a.count === b.count) {
          expect(a.title <= b.title).toBe(true);
        }
      }
    }
  });
});
