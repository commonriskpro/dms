/**
 * Inventory Acquisition Engine: cost calculation, auction purchase tenant isolation.
 */
import * as inventoryService from "../service/vehicle";
import * as auctionPurchaseDb from "../db/auction-purchase";
import * as auctionPurchaseService from "../service/auction-purchase";
import { prisma } from "@/lib/db";

describe("Inventory: cost calculation", () => {
  it("calculateVehicleCost returns breakdown and total matching totalCostCents", () => {
    const v = {
      auctionCostCents: BigInt(5000),
      transportCostCents: BigInt(500),
      reconCostCents: BigInt(1000),
      miscCostCents: BigInt(200),
    };
    const breakdown = inventoryService.calculateVehicleCost(v);
    expect(breakdown.auctionCostCents).toBe(BigInt(5000));
    expect(breakdown.transportCostCents).toBe(BigInt(500));
    expect(breakdown.reconCostCents).toBe(BigInt(1000));
    expect(breakdown.miscCostCents).toBe(BigInt(200));
    expect(breakdown.totalCostCents).toBe(inventoryService.totalCostCents(v));
    expect(breakdown.totalCostCents).toBe(BigInt(6700));
  });

  it("calculateVehicleCost with zeros returns zero total", () => {
    const v = {
      auctionCostCents: BigInt(0),
      transportCostCents: BigInt(0),
      reconCostCents: BigInt(0),
      miscCostCents: BigInt(0),
    };
    const breakdown = inventoryService.calculateVehicleCost(v);
    expect(breakdown.totalCostCents).toBe(BigInt(0));
  });
});

describe("Auction purchase tenant isolation", () => {
  const dealerAId = "b1000000-0000-0000-0000-000000000001";
  const dealerBId = "b2000000-0000-0000-0000-000000000002";
  const userAId = "b3000000-0000-0000-0000-000000000003";

  let purchaseBId: string;

  async function ensureDealers() {
    await prisma.dealership.upsert({
      where: { id: dealerAId },
      create: { id: dealerAId, name: "Dealer A Acquisition" },
      update: {},
    });
    await prisma.dealership.upsert({
      where: { id: dealerBId },
      create: { id: dealerBId, name: "Dealer B Acquisition" },
      update: {},
    });
    await prisma.profile.upsert({
      where: { id: userAId },
      create: { id: userAId, email: "acq-a@test.local" },
      update: {},
    });
  }

  beforeAll(async () => {
    await ensureDealers();
    const created = await auctionPurchaseDb.createAuctionPurchase(dealerBId, {
      auctionName: "Test Auction B",
      lotNumber: "LOT-B-1",
      purchasePriceCents: BigInt(10000),
    });
    purchaseBId = created.id;
  });

  it("listAuctionPurchases for Dealer A does not return Dealer B purchases", async () => {
    const { data } = await auctionPurchaseDb.listAuctionPurchases(dealerAId, {
      limit: 25,
      offset: 0,
    });
    const fromB = data.filter((p) => p.dealershipId === dealerBId);
    expect(fromB).toHaveLength(0);
  });

  it("getAuctionPurchaseById with wrong dealership returns null", async () => {
    const found = await auctionPurchaseDb.getAuctionPurchaseById(dealerAId, purchaseBId);
    expect(found).toBeNull();
  });

  it("getAuctionPurchase (service) with wrong dealership throws NOT_FOUND", async () => {
    await expect(
      auctionPurchaseService.getAuctionPurchase(dealerAId, purchaseBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateAuctionPurchase with wrong dealership throws NOT_FOUND", async () => {
    await expect(
      auctionPurchaseService.updateAuctionPurchase(dealerAId, purchaseBId, {
        status: "RECEIVED",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
