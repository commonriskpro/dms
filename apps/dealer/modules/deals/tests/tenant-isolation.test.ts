/** @jest-environment node */
/**
 * Tenant isolation: Dealer A cannot list/get/update/delete Dealer B deal;
 * cannot add/update/delete fee/trade or change status on Dealer B deal.
 * Finance: get/put finance and products with Dealer B dealId when called as Dealer A → NOT_FOUND (404).
 */
import { prisma } from "@/lib/db";
import * as dealDb from "../db/deal";
import * as dealService from "../service/deal";
import * as financeService from "@/modules/finance-shell/service";


const dealerAId = "f1000000-0000-0000-0000-000000000001";
const dealerBId = "f2000000-0000-0000-0000-000000000002";
const userAId = "f3000000-0000-0000-0000-000000000003";

async function ensureTestData(): Promise<{ dealBId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Dealer B" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userAId },
    create: { id: userAId, email: "tenant-deals-a@test.local" },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "f4000000-0000-0000-0000-000000000004" },
    create: {
      id: "f4000000-0000-0000-0000-000000000004",
      dealershipId: dealerBId,
      name: "Customer B",
      status: "LEAD",
    },
    update: {},
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: "f5000000-0000-0000-0000-000000000005" },
    create: {
      id: "f5000000-0000-0000-0000-000000000005",
      dealershipId: dealerBId,
      stockNumber: "FB-001",
      status: "AVAILABLE",
    },
    update: {},
  });
  const dealB = await prisma.deal.upsert({
    where: { id: "f6000000-0000-0000-0000-000000000006" },
    create: {
      id: "f6000000-0000-0000-0000-000000000006",
      dealershipId: dealerBId,
      customerId: customerB.id,
      vehicleId: vehicleB.id,
      salePriceCents: BigInt(20000),
      purchasePriceCents: BigInt(18000),
      taxRateBps: 700,
      taxCents: BigInt(140),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(20640),
      frontGrossCents: BigInt(1500),
      status: "DRAFT",
      deliveryStatus: null,
      deliveredAt: null,
    },
    update: {},
  });
  await prisma.dealFee.upsert({
    where: { id: "f7000000-0000-0000-0000-000000000007" },
    create: {
      id: "f7000000-0000-0000-0000-000000000007",
      dealershipId: dealerBId,
      dealId: dealB.id,
      label: "Fee B",
      amountCents: BigInt(100),
      taxable: false,
    },
    update: {},
  });
  await prisma.dealTrade.upsert({
    where: { id: "f8000000-0000-0000-0000-000000000008" },
    create: {
      id: "f8000000-0000-0000-0000-000000000008",
      dealershipId: dealerBId,
      dealId: dealB.id,
      vehicleDescription: "Trade B",
      allowanceCents: BigInt(5000),
      payoffCents: BigInt(0),
    },
    update: {},
  });
  return { dealBId: dealB.id };
}

describe("Deals tenant isolation", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("listDeals for Dealer A does not return Dealer B deals", async () => {
    const { data } = await dealDb.listDeals(dealerAId, { limit: 25, offset: 0 });
    const fromB = data.filter((d) => d.dealershipId === dealerBId);
    expect(fromB).toHaveLength(0);
  });

  it("getDealById with wrong dealership returns null", async () => {
    const { dealBId } = await ensureTestData();
    const found = await dealDb.getDealById(dealerAId, dealBId);
    expect(found).toBeNull();
  });

  it("getDeal (service) with wrong dealership throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(dealService.getDeal(dealerAId, dealBId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("updateDeal with wrong dealership throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      dealService.updateDeal(dealerAId, userAId, dealBId, { notes: "Hacked" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleteDeal with wrong dealership throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      dealService.deleteDeal(dealerAId, userAId, dealBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("addFee for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      dealService.addFee(dealerAId, userAId, dealBId, {
        label: "Fee",
        amountCents: BigInt(100),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateDealStatus for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      dealService.updateDealStatus(dealerAId, userAId, dealBId, "STRUCTURED")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listDealHistory for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      dealService.listDealHistory(dealerAId, dealBId, { limit: 10, offset: 0 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateFee for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    const feeBId = "f7000000-0000-0000-0000-000000000007";
    await expect(
      dealService.updateFee(dealerAId, userAId, dealBId, feeBId, {
        label: "Hacked",
        amountCents: BigInt(1),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleteFee for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    const feeBId = "f7000000-0000-0000-0000-000000000007";
    await expect(
      dealService.deleteFee(dealerAId, userAId, dealBId, feeBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateTrade for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    const tradeBId = "f8000000-0000-0000-0000-000000000008";
    await expect(
      dealService.updateTrade(dealerAId, userAId, dealBId, tradeBId, {
        allowanceCents: BigInt(1),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("addTrade for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      dealService.addTrade(dealerAId, userAId, dealBId, {
        vehicleDescription: "Hacked",
        allowanceCents: BigInt(100),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleteTrade for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    const tradeBId = "f8000000-0000-0000-0000-000000000008";
    await expect(
      dealService.deleteTrade(dealerAId, userAId, dealBId, tradeBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getFinanceByDealId for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      financeService.getFinanceByDealId(dealerAId, dealBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("putFinance for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      financeService.putFinance(dealerAId, userAId, dealBId, {
        financingMode: "CASH",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listProducts for Dealer B deal when called as Dealer A returns null (route returns 404)", async () => {
    const { dealBId } = await ensureTestData();
    const result = await financeService.listProducts(dealerAId, dealBId, {
      limit: 10,
      offset: 0,
    });
    expect(result).toBeNull();
  });

  it("addProduct for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    const { dealBId } = await ensureTestData();
    await expect(
      financeService.addProduct(dealerAId, userAId, dealBId, {
        productType: "GAP",
        name: "GAP",
        priceCents: BigInt(500),
        includedInAmountFinanced: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
