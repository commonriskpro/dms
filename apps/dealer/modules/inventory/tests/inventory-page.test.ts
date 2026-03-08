/**
 * Inventory page overview: RBAC, query validation, and tenant isolation.
 * getInventoryPageOverview requires inventory.read; pipeline requires deals.read or crm.read.
 */
import { getInventoryPageOverview, inventoryPageQuerySchema } from "../service/inventory-page";
import { ApiError } from "@/lib/auth";

describe("inventory-page query validation", () => {
  it("parses defaults", () => {
    const q = inventoryPageQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(25);
    expect(q.sortBy).toBe("createdAt");
    expect(q.sortOrder).toBe("desc");
  });

  it("parses page and pageSize", () => {
    const q = inventoryPageQuerySchema.parse({ page: "2", pageSize: "50" });
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(50);
  });

  it("rejects pageSize > 100", () => {
    expect(() => inventoryPageQuerySchema.parse({ pageSize: "200" })).toThrow();
  });

  it("rejects minPrice > maxPrice", () => {
    expect(() =>
      inventoryPageQuerySchema.parse({ minPrice: "10000", maxPrice: "5000" })
    ).toThrow();
  });

  it("accepts valid status", () => {
    const q = inventoryPageQuerySchema.parse({ status: "AVAILABLE" });
    expect(q.status).toBe("AVAILABLE");
  });

  it("accepts valid sortBy and sortOrder", () => {
    const q = inventoryPageQuerySchema.parse({
      sortBy: "salePriceCents",
      sortOrder: "asc",
    });
    expect(q.sortBy).toBe("salePriceCents");
    expect(q.sortOrder).toBe("asc");
  });
});

describe("getInventoryPageOverview RBAC", () => {
  const ctxNoRead = {
    dealershipId: "c1000000-0000-0000-0000-000000000001",
    userId: "c2000000-0000-0000-0000-000000000002",
    permissions: ["admin.dealership.read"],
  };

  it("throws FORBIDDEN when inventory.read is missing", async () => {
    await expect(getInventoryPageOverview(ctxNoRead, {})).rejects.toThrow(ApiError);
    await expect(getInventoryPageOverview(ctxNoRead, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "inventory.read required",
    });
  });
});

describe("getInventoryPageOverview tenant isolation and shape", () => {
  const dealerAId = "a1000000-0000-0000-0000-000000000001";
  const userId = "a3000000-0000-0000-0000-000000000003";
  const ctxWithRead = {
    dealershipId: dealerAId,
    userId,
    permissions: ["inventory.read"],
  };

  it("returns overview shape with list and filterChips", async () => {
    const overview = await getInventoryPageOverview(ctxWithRead, { page: 1, pageSize: 25 });
    expect(overview).toHaveProperty("kpis");
    expect(overview.kpis).toMatchObject({
      totalUnits: expect.any(Number),
      addedThisWeek: expect.any(Number),
      inventoryValueCents: expect.any(Number),
      avgValuePerVehicleCents: expect.any(Number),
    });
    expect(overview).toHaveProperty("alerts");
    expect(overview.alerts).toMatchObject({
      missingPhotos: expect.any(Number),
      over90Days: expect.any(Number),
      needsRecon: expect.any(Number),
    });
    expect(overview).toHaveProperty("health");
    expect(overview.health).toMatchObject({
      lt30: expect.any(Number),
      d30to60: expect.any(Number),
      d60to90: expect.any(Number),
      gt90: expect.any(Number),
    });
    expect(overview).toHaveProperty("pipeline");
    expect(overview).toHaveProperty("list");
    expect(overview.list).toHaveProperty("items");
    expect(Array.isArray(overview.list.items)).toBe(true);
    expect(overview.list.page).toBe(1);
    expect(overview.list.pageSize).toBe(25);
    expect(overview.list.total).toBeGreaterThanOrEqual(0);
    expect(overview).toHaveProperty("filterChips");
    expect(overview.filterChips).toMatchObject({
      floorPlannedCount: expect.any(Number),
      previouslySoldCount: expect.any(Number),
    });
    // Regression: list items must include intelligence fields (daysInStock, agingBucket, turnRiskStatus, priceToMarket)
    if (overview.list.items.length > 0) {
      const item = overview.list.items[0];
      expect(item).toHaveProperty("daysInStock");
      expect(item).toHaveProperty("agingBucket");
      expect(item).toHaveProperty("turnRiskStatus");
      expect(item).toHaveProperty("priceToMarket");
      expect(["good", "warn", "bad", "na"]).toContain(item.turnRiskStatus);
      if (item.priceToMarket != null) {
        expect(item.priceToMarket).toHaveProperty("marketStatus");
        expect(item.priceToMarket).toHaveProperty("sourceLabel");
      }
      if (item.daysInStock != null && item.agingBucket != null) {
        expect(["<30", "30-60", "60-90", ">90"]).toContain(item.agingBucket);
      }
    }
  });

  it("returns pipeline zeros when neither deals.read nor crm.read", async () => {
    const overview = await getInventoryPageOverview(ctxWithRead, {});
    expect(overview.pipeline).toEqual({
      leads: 0,
      appointments: 0,
      workingDeals: 0,
      pendingFunding: 0,
      soldToday: 0,
    });
  });
});
