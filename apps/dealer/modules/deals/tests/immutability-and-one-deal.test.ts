/**
 * Immutability: editing financial fields after CONTRACTED -> CONFLICT.
 * One active deal: creating second active deal for same vehicle -> CONFLICT.
 * Financial: fee add/update recomputes deal totals deterministically.
 * Uses unique IDs per run to avoid (dealership_id, vehicle_id) collisions.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as dealService from "../service/deal";
import { computeDealTotals } from "../service/calculations";
import { ApiError } from "@/lib/auth";

const hasDb =
  process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL;

const dealerId = "91000000-0000-0000-0000-000000000001";
const userId = "92000000-0000-0000-0000-000000000002";

async function ensureTestData(): Promise<{
  customerId: string;
  vehicleId: string;
  dealId: string;
  vehicle2Id: string;
  feeId: string;
  tradeId: string;
}> {
  const runId = randomUUID().slice(0, 8);
  const vehicleId = randomUUID();
  const vehicle2Id = randomUUID();
  const dealId = randomUUID();
  const feeId = randomUUID();
  const tradeId = randomUUID();

  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Immutability Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: `immut-${runId}@test.local` },
    update: { email: `immut-${runId}@test.local` },
  });
  const customer = await prisma.customer.upsert({
    where: { id: "93000000-0000-0000-0000-000000000003" },
    create: {
      id: "93000000-0000-0000-0000-000000000003",
      dealershipId: dealerId,
      name: "Customer",
      status: "LEAD",
    },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { id: vehicleId },
    create: {
      id: vehicleId,
      dealershipId: dealerId,
      stockNumber: `H-${vehicleId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { id: vehicle2Id },
    create: {
      id: vehicle2Id,
      dealershipId: dealerId,
      stockNumber: `H2-${vehicle2Id.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });
  const deal = await prisma.deal.upsert({
    where: { id: dealId },
    create: {
      id: dealId,
      dealershipId: dealerId,
      customerId: customer.id,
      vehicleId,
      salePriceCents: BigInt(20000),
      purchasePriceCents: BigInt(18000),
      taxRateBps: 700,
      taxCents: BigInt(140),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(20640),
      frontGrossCents: BigInt(1500),
      status: "CONTRACTED",
    },
    update: { status: "CONTRACTED" as const },
  });
  await prisma.dealFee.upsert({
    where: { id: feeId },
    create: {
      id: feeId,
      dealershipId: dealerId,
      dealId: deal.id,
      label: "Test Fee",
      amountCents: BigInt(100),
      taxable: false,
    },
    update: {},
  });
  await prisma.dealTrade.upsert({
    where: { id: tradeId },
    create: {
      id: tradeId,
      dealershipId: dealerId,
      dealId: deal.id,
      vehicleDescription: "Trade",
      allowanceCents: BigInt(1000),
      payoffCents: BigInt(0),
    },
    update: {},
  });
  return {
    customerId: customer.id,
    vehicleId,
    dealId: deal.id,
    vehicle2Id,
    feeId,
    tradeId,
  };
}

describe.skipIf(!hasDb)("Deals immutability and one active deal", () => {
  let testData: {
    customerId: string;
    vehicleId: string;
    dealId: string;
    vehicle2Id: string;
    feeId: string;
    tradeId: string;
  };

  beforeAll(async () => {
    testData = (await ensureTestData()) as typeof testData;
  });

  it("updateDeal with financial field when status is CONTRACTED throws CONFLICT", async () => {
    await expect(
      dealService.updateDeal(dealerId, userId, testData.dealId, {
        salePriceCents: BigInt(21000),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("addFee when deal status is CONTRACTED throws CONFLICT", async () => {
    await expect(
      dealService.addFee(dealerId, userId, testData.dealId, {
        label: "Extra",
        amountCents: BigInt(100),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updateFee when deal status is CONTRACTED throws CONFLICT", async () => {
    await expect(
      dealService.updateFee(dealerId, userId, testData.dealId, testData.feeId, {
        amountCents: BigInt(200),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("deleteFee when deal status is CONTRACTED throws CONFLICT", async () => {
    await expect(
      dealService.deleteFee(dealerId, userId, testData.dealId, testData.feeId)
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updateTrade when deal status is CONTRACTED throws CONFLICT", async () => {
    await expect(
      dealService.updateTrade(dealerId, userId, testData.dealId, testData.tradeId, {
        allowanceCents: BigInt(2000),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updateDealStatus CONTRACTED -> APPROVED is denied", async () => {
    await expect(
      dealService.updateDealStatus(dealerId, userId, testData.dealId, "APPROVED")
    ).rejects.toMatchObject({ code: "DOMAIN_ERROR" });
  });

  it("creating second active deal for same vehicle throws CONFLICT", async () => {
    const err = await dealService
      .createDeal(dealerId, userId, {
        customerId: testData.customerId,
        vehicleId: testData.vehicleId,
        salePriceCents: BigInt(25000),
        purchasePriceCents: BigInt(20000),
        taxRateBps: 700,
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("CONFLICT");
  });

  it("updateDealStatus CONTRACTED -> CANCELED is allowed", async () => {
    const updated = await dealService.updateDealStatus(
      dealerId,
      userId,
      testData.dealId,
      "CANCELED"
    );
    expect(updated.status).toBe("CANCELED");
  });

  it("after deal is CANCELED, new deal for same vehicle succeeds", async () => {
    const created = await dealService.createDeal(dealerId, userId, {
      customerId: testData.customerId,
      vehicleId: testData.vehicleId,
      salePriceCents: BigInt(22000),
      purchasePriceCents: BigInt(19000),
      taxRateBps: 700,
    });
    expect(created.id).toBeDefined();
    expect(created.vehicleId).toBe(testData.vehicleId);
  });
});

describe.skipIf(!hasDb)("Deal totals after fee add/update", () => {
  const dealerId = "91000000-0000-0000-0000-000000000001";
  const userId = "92000000-0000-0000-0000-000000000002";

  it("when fee is added, deal totals (tax, totalFees, totalDue, frontGross) update deterministically", async () => {
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "Totals Dealer" },
      update: {},
    });
    await prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, email: `totals-${randomUUID().slice(0, 8)}@test.local` },
      update: {},
    });
    const customer = await prisma.customer.upsert({
      where: { id: "93000000-0000-0000-0000-000000000003" },
      create: {
        id: "93000000-0000-0000-0000-000000000003",
        dealershipId: dealerId,
        name: "Customer",
        status: "LEAD",
      },
      update: {},
    });
    const vehicleId = randomUUID();
    await prisma.vehicle.create({
      data: {
        id: vehicleId,
        dealershipId: dealerId,
        stockNumber: `TOT-${vehicleId.slice(0, 8)}`,
        status: "AVAILABLE",
      },
    });
    const created = await dealService.createDeal(dealerId, userId, {
      customerId: customer.id,
      vehicleId,
      salePriceCents: BigInt(30000),
      purchasePriceCents: BigInt(25000),
      taxRateBps: 700,
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
    });
    const afterAdd = await dealService.addFee(dealerId, userId, created!.id, {
      label: "Custom",
      amountCents: BigInt(200),
      taxable: true,
    });
    expect(afterAdd).toBeDefined();
    const deal = await dealService.getDeal(dealerId, created!.id);
    const expected = computeDealTotals({
      salePriceCents: BigInt(30000),
      purchasePriceCents: BigInt(25000),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      taxRateBps: 700,
      customFeesCents: BigInt(200),
      taxableCustomFeesCents: BigInt(200),
    });
    expect(deal.totalFeesCents).toBe(expected.totalFeesCents);
    expect(deal.taxCents).toBe(expected.taxCents);
    expect(deal.totalDueCents).toBe(expected.totalDueCents);
    expect(deal.frontGrossCents).toBe(expected.frontGrossCents);
  });
});
