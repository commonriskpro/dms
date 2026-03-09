/**
 * Inventory hardening: projectedGross, filter validation, pagination, VIN uniqueness, status filter, deprecated aliases, dedupe-vins.
 */
import { z } from "zod";
import * as vehicleDb from "../db/vehicle";
import * as inventoryService from "../service/vehicle";
import { toVehicleResponse } from "../api-response";
import { listQuerySchema, agingQuerySchema } from "@/app/api/inventory/schemas";


describe("Inventory: projected gross calculation", () => {
  it("totalCostCents sums all four cost fields", () => {
    const total = inventoryService.totalCostCents({
      auctionCostCents: BigInt(1000),
      transportCostCents: BigInt(200),
      reconCostCents: BigInt(300),
      miscCostCents: BigInt(50),
    });
    expect(total).toBe(BigInt(1550));
  });

  it("projectedGrossCents = salePriceCents - totalCostCents", () => {
    const gross = inventoryService.projectedGrossCents({
      salePriceCents: BigInt(10000),
      auctionCostCents: BigInt(5000),
      transportCostCents: BigInt(500),
      reconCostCents: BigInt(500),
      miscCostCents: BigInt(0),
    });
    expect(gross).toBe(BigInt(4000));
  });

  it("projectedGrossCents can be negative", () => {
    const gross = inventoryService.projectedGrossCents({
      salePriceCents: BigInt(1000),
      auctionCostCents: BigInt(2000),
      transportCostCents: BigInt(0),
      reconCostCents: BigInt(0),
      miscCostCents: BigInt(0),
    });
    expect(gross).toBe(BigInt(-1000));
  });
});

describe("Inventory: list query schema", () => {
  it("limit > 100 fails validation", () => {
    expect(() =>
      listQuerySchema.parse({ limit: 101, offset: 0 })
    ).toThrow();
    expect(() => listQuerySchema.parse({ limit: 200 })).toThrow();
  });

  it("accepts limit 1..100 and offset >= 0", () => {
    expect(listQuerySchema.parse({ limit: 25, offset: 0 }).limit).toBe(25);
    expect(listQuerySchema.parse({ limit: 100, offset: 50 }).offset).toBe(50);
  });

  it("accepts status, minPrice, maxPrice, search", () => {
    const q = listQuerySchema.parse({
      status: "AVAILABLE",
      minPrice: 1000,
      maxPrice: 50000,
      search: "Honda",
    });
    expect(q.status).toBe("AVAILABLE");
    expect(q.minPrice).toBe(1000);
    expect(q.maxPrice).toBe(50000);
    expect(q.search).toBe("Honda");
  });

  it("accepts new VehicleStatus values", () => {
    expect(listQuerySchema.parse({ status: "HOLD" }).status).toBe("HOLD");
    expect(listQuerySchema.parse({ status: "REPAIR" }).status).toBe("REPAIR");
    expect(listQuerySchema.parse({ status: "ARCHIVED" }).status).toBe("ARCHIVED");
  });

  it("offset < 0 fails validation", () => {
    expect(() => listQuerySchema.parse({ offset: -1 })).toThrow();
    expect(() => listQuerySchema.parse({ limit: 10, offset: -10 })).toThrow();
  });

  it("minPrice < 0 or maxPrice < 0 fails validation", () => {
    expect(() => listQuerySchema.parse({ minPrice: -1 })).toThrow();
    expect(() => listQuerySchema.parse({ maxPrice: -100 })).toThrow();
  });

  it("minPrice > maxPrice fails validation", () => {
    expect(() =>
      listQuerySchema.parse({ minPrice: 50000, maxPrice: 10000 })
    ).toThrow();
  });

  it("invalid status value fails validation", () => {
    expect(() => listQuerySchema.parse({ status: "INVALID" })).toThrow();
    expect(() => listQuerySchema.parse({ status: "PENDING" })).toThrow(); // not in enum
  });
});

describe("Inventory: aging query schema", () => {
  it("limit > 100 fails validation", () => {
    expect(() => agingQuerySchema.parse({ limit: 101, offset: 0 })).toThrow();
  });

  it("offset < 0 fails validation", () => {
    expect(() => agingQuerySchema.parse({ offset: -1 })).toThrow();
  });

  it("invalid status fails validation", () => {
    expect(() => agingQuerySchema.parse({ status: "INVALID" })).toThrow();
    expect(() => agingQuerySchema.parse({ status: "PENDING" })).toThrow();
  });

  it("accepts valid status and pagination", () => {
    expect(agingQuerySchema.parse({ status: "AVAILABLE", limit: 25, offset: 0 }).status).toBe("AVAILABLE");
    expect(agingQuerySchema.parse({ limit: 50 }).limit).toBe(50);
  });
});

describe("Inventory: pagination and filters", () => {
  const dealerId = "b1000000-0000-0000-0000-000000000001";

  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "Pagination Dealer" },
      update: {},
    });
  });

  it("listVehicles returns first page with correct size and total", async () => {
    const limit = 5;
    const { data, total } = await vehicleDb.listVehicles(dealerId, {
      limit,
      offset: 0,
    });
    expect(data.length).toBeLessThanOrEqual(limit);
    expect(total).toBeGreaterThanOrEqual(data.length);
  });

  it("status filter returns only matching status", async () => {
    const { data } = await vehicleDb.listVehicles(dealerId, {
      limit: 100,
      offset: 0,
      filters: { status: "AVAILABLE" },
    });
    expect(data.every((v) => v.status === "AVAILABLE")).toBe(true);
  });
});

describe("Inventory: API response deprecated aliases", () => {
  it("toVehicleResponse includes deprecated aliases (listPriceCents, purchasePriceCents, reconditioningCostCents, otherCostsCents)", () => {
    const v = {
      id: "id-1",
      dealershipId: "did-1",
      vin: "VIN123",
      year: 2022,
      make: "Honda",
      model: "Civic",
      trim: null,
      stockNumber: "STK1",
      mileage: 10000,
      color: "Black",
      status: "AVAILABLE",
      salePriceCents: BigInt(20000_00),
      auctionCostCents: BigInt(15000_00),
      transportCostCents: BigInt(500_00),
      reconCostCents: BigInt(1000_00),
      miscCostCents: BigInt(0),
      locationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = toVehicleResponse(v);
    expect(res.listPriceCents).toBe("2000000");
    expect(res.purchasePriceCents).toBe("1500000");
    expect(res.reconditioningCostCents).toBe("100000");
    expect(res.otherCostsCents).toBe("0");
    expect(res.salePriceCents).toBe("2000000");
    expect(res.auctionCostCents).toBe("1500000");
  });

  it("toVehicleResponse includes totalInvestedCents and projectedGrossCents (ledger-derived)", () => {
    const v = {
      id: "id-1",
      dealershipId: "did-1",
      vin: "VIN123",
      year: 2022,
      make: "Honda",
      model: "Civic",
      trim: null,
      stockNumber: "STK1",
      mileage: 10000,
      color: "Black",
      status: "AVAILABLE",
      salePriceCents: BigInt(20000_00),
      auctionCostCents: BigInt(15000_00),
      transportCostCents: BigInt(500_00),
      reconCostCents: BigInt(1000_00),
      miscCostCents: BigInt(0),
      locationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = toVehicleResponse(v);
    expect(res.totalInvestedCents).toBe("1650000"); // 15000+500+1000+0 = 16500.00
    expect(res.projectedGrossCents).toBe("350000"); // 20000 - 16500 = 3500.00
  });
});

describe("Inventory: VIN uniqueness per dealership", () => {
  const dealerId = "c1000000-0000-0000-0000-000000000001";
  const userId = "c2000000-0000-0000-0000-000000000002";

  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "VIN Test Dealer" },
      update: {},
    });
    await prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, email: "vin-test@test.local" },
      update: {},
    });
  });

  it("createVehicle with duplicate VIN for same dealership throws CONFLICT", async () => {
    const run = Math.random().toString(36).slice(2, 10);
    const stock1 = `VIN-U1-${run}`;
    const stock2 = `VIN-U2-${run}`;
    const vin = `1HGBH41JXMN${run.padStart(6, "0").slice(-6)}`;
    await inventoryService.createVehicle(dealerId, userId, {
      stockNumber: stock1,
      vin,
    });
    await expect(
      inventoryService.createVehicle(dealerId, userId, {
        stockNumber: stock2,
        vin,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("Inventory: dedupe-vins script", () => {
  const dealerId = "d1000000-0000-0000-0000-000000000001";

  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "Dedupe Test Dealer" },
      update: {},
    });
  });

  it("given duplicate VINs per dealership, runDedupe nulls older and keeps newest", async () => {
    const { runDedupe } = await import("@/scripts/dedupe-vins");
    const { prisma } = await import("@/lib/db");
    const vin = "DEDUPE" + Date.now().toString(36).padStart(10, "0").slice(-10);
    const older = await prisma.vehicle.create({
      data: {
        dealershipId: dealerId,
        stockNumber: "DEDUPE-OLD-" + Date.now(),
        vin,
        status: "AVAILABLE",
      },
    });
    let newer: { id: string };
    try {
      newer = await prisma.vehicle.create({
        data: {
          dealershipId: dealerId,
          stockNumber: "DEDUPE-NEW-" + Date.now(),
          vin,
          status: "AVAILABLE",
        },
      });
    } catch (e: unknown) {
      await prisma.vehicle.delete({ where: { id: older.id } }).catch(() => {});
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return; // unique constraint already applied (post-migration), skip
      }
      throw e;
    }
    await runDedupe();
    const olderAfter = await prisma.vehicle.findUnique({ where: { id: older.id } });
    const newerAfter = await prisma.vehicle.findUnique({ where: { id: newer.id } });
    expect(olderAfter?.vin).toBeNull();
    expect(newerAfter?.vin).toBe(vin);
    await prisma.vehicle.deleteMany({ where: { id: { in: [older.id, newer.id] } } });
  });
});
