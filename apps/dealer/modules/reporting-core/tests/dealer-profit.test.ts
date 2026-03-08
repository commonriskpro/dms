/** @jest-environment node */
/**
 * Dealer profit report: aggregates CONTRACTED deals with front + back gross.
 */
import { prisma } from "@/lib/db";
import * as dealerProfit from "../service/dealer-profit";


const dealerId = "a1000000-0000-0000-0000-000000000001";
const customerId = "a2000000-0000-0000-0000-000000000002";
const vehicleId = "a3000000-0000-0000-0000-000000000003";
const dealId = "a4000000-0000-0000-0000-000000000004";

async function ensureDeal() {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Report Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: "a5000000-0000-0000-0000-000000000005" },
    create: { id: "a5000000-0000-0000-0000-000000000005", email: "rep@test.local" },
    update: {},
  });
  await prisma.customer.upsert({
    where: { id: customerId },
    create: { id: customerId, dealershipId: dealerId, name: "C", status: "LEAD" },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { id: vehicleId },
    create: { id: vehicleId, dealershipId: dealerId, stockNumber: "R-1", status: "AVAILABLE" },
    update: {},
  });
  const deal = await prisma.deal.upsert({
    where: { id: dealId },
    create: {
      id: dealId,
      dealershipId: dealerId,
      customerId,
      vehicleId,
      salePriceCents: BigInt(30000),
      purchasePriceCents: BigInt(25000),
      taxRateBps: 700,
      taxCents: BigInt(210),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(30710),
      frontGrossCents: BigInt(3000),
      status: "CONTRACTED",
      createdAt: new Date("2025-02-15"),
    },
    update: { status: "CONTRACTED", frontGrossCents: BigInt(3000) },
  });
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
      productsTotalCents: BigInt(0),
      backendGrossCents: BigInt(500),
    },
    update: { backendGrossCents: BigInt(500) },
  });
  return deal;
}

describe("Dealer profit report", () => {
  beforeAll(async () => {
    await ensureDeal();
  });

  it("getDealerProfitReport returns summary and rows", async () => {
    const report = await dealerProfit.getDealerProfitReport(dealerId, {
      from: "2025-02-01",
      to: "2025-02-28",
    });
    expect(report.summary.dealCount).toBeGreaterThanOrEqual(1);
    expect(BigInt(report.summary.totalGrossCents)).toBeGreaterThanOrEqual(BigInt(3500));
    expect(report.rows.length).toBeGreaterThanOrEqual(1);
  });
});
