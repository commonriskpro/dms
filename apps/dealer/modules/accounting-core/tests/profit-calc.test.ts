/** @jest-environment node */
/**
 * Deal profit: front + back gross, net. Uses deal + dealFinance from DB.
 */
import { prisma } from "@/lib/db";
import * as profitService from "../service/profit";


const dealerId = "f1000000-0000-0000-0000-000000000001";
const userId = "f2000000-0000-0000-0000-000000000002";
const customerId = "f3000000-0000-0000-0000-000000000003";
const vehicleId = "f4000000-0000-0000-0000-000000000004";
const dealId = "f5000000-0000-0000-0000-000000000005";

async function ensureDeal() {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Profit Test Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "profit@test.local" },
    update: {},
  });
  await prisma.customer.upsert({
    where: { id: customerId },
    create: { id: customerId, dealershipId: dealerId, name: "Customer", status: "LEAD" },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { id: vehicleId },
    create: { id: vehicleId, dealershipId: dealerId, stockNumber: "PROFIT-1", status: "AVAILABLE" },
    update: {},
  });
  await prisma.deal.upsert({
    where: { id: dealId },
    create: {
      id: dealId,
      dealershipId: dealerId,
      customerId,
      vehicleId,
      salePriceCents: BigInt(25000),
      purchasePriceCents: BigInt(20000),
      taxRateBps: 700,
      taxCents: BigInt(175),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(26180),
      frontGrossCents: BigInt(2500),
      status: "DRAFT",
      deliveryStatus: null,
      deliveredAt: null,
    },
    update: {},
  });
}

describe("Deal profit calculation", () => {
  beforeAll(async () => {
    await ensureDeal();
    await prisma.dealFinance.deleteMany({ where: { dealId } });
  });

  it("calculateDealProfit returns front gross and net", async () => {
    const profit = await profitService.calculateDealProfit(dealerId, dealId);
    expect(profit.frontEndGrossCents).toBe(BigInt(2500));
    expect(profit.backEndGrossCents).toBe(BigInt(0));
    expect(profit.totalGrossCents).toBe(BigInt(2500));
    expect(profit.netProfitCents).toBe(BigInt(2500));
  });

  it("calculateDealProfit with dealFinance includes back gross", async () => {
    await prisma.dealFinance.upsert({
      where: { dealId },
      create: {
        dealershipId: dealerId,
        dealId,
        financingMode: "CASH",
        cashDownCents: BigInt(0),
        amountFinancedCents: BigInt(0),
        monthlyPaymentCents: BigInt(0),
        totalOfPaymentsCents: BigInt(0),
        financeChargeCents: BigInt(0),
        productsTotalCents: BigInt(500),
        backendGrossCents: BigInt(300),
      },
      update: { backendGrossCents: BigInt(300), productsTotalCents: BigInt(500) },
    });
    const profit = await profitService.calculateDealProfit(dealerId, dealId);
    expect(profit.backEndGrossCents).toBe(BigInt(300));
    expect(profit.totalGrossCents).toBe(BigInt(2800));
    expect(profit.productsCents).toBe(BigInt(500));
  });
});
