/** @jest-environment node */
/**
 * Audit log: deal.created, deal.updated, deal.deleted, deal.status_changed,
 * deal.fee_added, deal.fee_updated, deal.fee_deleted, deal.trade_added, deal.trade_updated, deal.trade_deleted,
 * finance.created, finance.updated, finance.product_added, finance.product_updated, finance.product_deleted.
 * Uses unique vehicle per run so no "Vehicle already has an active deal" from shared state.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as dealService from "../service/deal";
import * as financeService from "@/modules/finance-shell/service";


const dealerId = "61000000-0000-0000-0000-000000000001";
const userId = "62000000-0000-0000-0000-000000000002";

async function ensureTestData(): Promise<{ customerId: string; vehicleId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Audit Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: `audit-deals-${randomUUID().slice(0, 8)}@test.local` },
    update: {},
  });
  const customer = await prisma.customer.upsert({
    where: { id: "63000000-0000-0000-0000-000000000003" },
    create: {
      id: "63000000-0000-0000-0000-000000000003",
      dealershipId: dealerId,
      name: "Audit Customer",
      status: "LEAD",
    },
    update: {},
  });
  const vehicleId = randomUUID();
  await prisma.vehicle.upsert({
    where: { id: vehicleId },
    create: {
      id: vehicleId,
      dealershipId: dealerId,
      stockNumber: `AUD-${vehicleId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });
  return { customerId: customer.id, vehicleId };
}

describe("Deals audit log", () => {
  jest.setTimeout(15000);
  let testData: { customerId: string; vehicleId: string };

  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("records deal.created, deal.fee_added, deal.updated, and deal.status_changed", async () => {
    const { customerId, vehicleId } = testData;
    const created = await dealService.createDeal(dealerId, userId, {
      customerId,
      vehicleId,
      salePriceCents: BigInt(18000),
      purchasePriceCents: BigInt(16000),
      taxRateBps: 700,
    });
    await dealService.addFee(dealerId, userId, created.id, {
      label: "Audit Fee",
      amountCents: BigInt(50),
      taxable: false,
    });
    await dealService.updateDeal(dealerId, userId, created.id, { notes: "Audit note" });
    await dealService.updateDealStatus(dealerId, userId, created.id, "STRUCTURED");

    const dealLogs = await prisma.auditLog.findMany({
      where: { dealershipId: dealerId, entity: "Deal", entityId: created.id },
      orderBy: { createdAt: "asc" },
    });
    const dealActions = dealLogs.map((l) => l.action);
    expect(dealActions).toContain("deal.created");
    expect(dealActions).toContain("deal.updated");
    expect(dealActions).toContain("deal.status_changed");
    // deal.fee_added is logged with entity "DealFee", not "Deal"; see addFee in deal service
    const feeAddedLog = await prisma.auditLog.findFirst({
      where: { dealershipId: dealerId, action: "deal.fee_added", entity: "DealFee" },
    });
    expect(feeAddedLog).not.toBeNull();
    dealLogs.forEach((log) => {
      expect(log.dealershipId).toBe(dealerId);
      expect(log.actorId).toBe(userId);
    });
  });

  it("records deal.fee_updated and deal.fee_deleted", async () => {
    const { customerId, vehicleId } = testData;
    const vehicleId2 = randomUUID();
    await prisma.vehicle.upsert({
      where: { id: vehicleId2 },
      create: {
        id: vehicleId2,
        dealershipId: dealerId,
        stockNumber: `AUD2-${vehicleId2.slice(0, 8)}`,
        status: "AVAILABLE",
      },
      update: {},
    });
    const created = await dealService.createDeal(dealerId, userId, {
      customerId,
      vehicleId: vehicleId2,
      salePriceCents: BigInt(19000),
      purchasePriceCents: BigInt(17000),
      taxRateBps: 700,
    });
    const fee = await dealService.addFee(dealerId, userId, created.id, {
      label: "Fee to update",
      amountCents: BigInt(100),
      taxable: false,
    });
    await dealService.updateFee(dealerId, userId, created.id, fee.id, {
      label: "Fee updated",
      amountCents: BigInt(150),
    });
    await dealService.deleteFee(dealerId, userId, created.id, fee.id);

    const feeLogs = await prisma.auditLog.findMany({
      where: { dealershipId: dealerId, entity: "DealFee", entityId: fee.id },
      orderBy: { createdAt: "asc" },
    });
    const feeActions = feeLogs.map((l) => l.action);
    expect(feeActions).toContain("deal.fee_added");
    expect(feeActions).toContain("deal.fee_updated");
    expect(feeActions).toContain("deal.fee_deleted");
  });

  it("records deal.trade_added, deal.trade_updated, deal.trade_deleted", async () => {
    const { customerId, vehicleId } = testData;
    const vehicleId3 = randomUUID();
    await prisma.vehicle.upsert({
      where: { id: vehicleId3 },
      create: {
        id: vehicleId3,
        dealershipId: dealerId,
        stockNumber: `AUD3-${vehicleId3.slice(0, 8)}`,
        status: "AVAILABLE",
      },
      update: {},
    });
    const created = await dealService.createDeal(dealerId, userId, {
      customerId,
      vehicleId: vehicleId3,
      salePriceCents: BigInt(20000),
      purchasePriceCents: BigInt(18000),
      taxRateBps: 700,
    });
    const trade = await dealService.addTrade(dealerId, userId, created.id, {
      vehicleDescription: "Trade 1",
      allowanceCents: BigInt(3000),
      payoffCents: BigInt(0),
    });
    await dealService.updateTrade(dealerId, userId, created.id, trade.id, {
      allowanceCents: BigInt(3500),
    });
    await dealService.deleteTrade(dealerId, userId, created.id, trade.id);

    const tradeLogs = await prisma.auditLog.findMany({
      where: { dealershipId: dealerId, entity: "DealTrade", entityId: trade.id },
      orderBy: { createdAt: "asc" },
    });
    const tradeActions = tradeLogs.map((l) => l.action);
    expect(tradeActions).toContain("deal.trade_added");
    expect(tradeActions).toContain("deal.trade_updated");
    expect(tradeActions).toContain("deal.trade_deleted");
  });

  it("records finance.created or finance.updated and finance.product_added, product_updated, product_deleted", async () => {
    const { customerId, vehicleId } = testData;
    const vehicleId4 = randomUUID();
    await prisma.vehicle.upsert({
      where: { id: vehicleId4 },
      create: {
        id: vehicleId4,
        dealershipId: dealerId,
        stockNumber: `AUD4-${vehicleId4.slice(0, 8)}`,
        status: "AVAILABLE",
      },
      update: {},
    });
    const created = await dealService.createDeal(dealerId, userId, {
      customerId,
      vehicleId: vehicleId4,
      salePriceCents: BigInt(21000),
      purchasePriceCents: BigInt(19000),
      taxRateBps: 700,
    });
    const { finance, created: financeCreated } = await financeService.putFinance(
      dealerId,
      userId,
      created.id,
      { financingMode: "CASH" }
    );
    const { product } = await financeService.addProduct(dealerId, userId, created.id, {
      productType: "GAP",
      name: "GAP",
      priceCents: BigInt(500),
      includedInAmountFinanced: true,
    });
    await financeService.updateProduct(dealerId, userId, created.id, product.id, {
      name: "GAP Updated",
      priceCents: BigInt(600),
    });
    await financeService.deleteProduct(dealerId, userId, created.id, product.id);

    const financeLogs = await prisma.auditLog.findMany({
      where: { dealershipId: dealerId, entity: "DealFinance", entityId: finance.id },
      orderBy: { createdAt: "asc" },
    });
    const financeActions = financeLogs.map((l) => l.action);
    expect(financeActions).toContain(financeCreated ? "finance.created" : "finance.updated");

    const productLogs = await prisma.auditLog.findMany({
      where: { dealershipId: dealerId, entity: "DealFinanceProduct", entityId: product.id },
      orderBy: { createdAt: "asc" },
    });
    const productActions = productLogs.map((l) => l.action);
    expect(productActions).toContain("finance.product_added");
    expect(productActions).toContain("finance.product_updated");
    expect(productActions).toContain("finance.product_deleted");
  });
});
