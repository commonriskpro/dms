/** @jest-environment node */
/**
 * Compliance forms: tenant isolation, form generation, status update, alert triggers.
 */
import { prisma } from "@/lib/db";
import * as complianceFormDb from "../db/compliance-form";
import * as complianceService from "../service/compliance";


const dealerAId = "c1000000-0000-0000-0000-000000000001";
const dealerBId = "c2000000-0000-0000-0000-000000000002";
const userAId = "c3000000-0000-0000-0000-000000000003";
const dealAId = "c6000000-0000-0000-0000-000000000006";
const dealBId = "c7000000-0000-0000-0000-000000000007";

async function ensureDealerAndDeal(
  dealerId: string,
  dealId: string,
  customerId: string,
  vehicleId: string,
  status: "DRAFT" | "CONTRACTED" = "DRAFT"
) {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: dealerId === dealerAId ? "Dealer A" : "Dealer B" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userAId },
    create: { id: userAId, email: "compliance@test.local" },
    update: {},
  });
  await prisma.customer.upsert({
    where: { id: customerId },
    create: {
      id: customerId,
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
      stockNumber: `STK-${dealId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
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
      purchasePriceCents: BigInt(22000),
      taxRateBps: 700,
      taxCents: BigInt(175),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(26180),
      frontGrossCents: BigInt(2000),
      status,
    },
    update: { status },
  });
}

describe("Compliance tenant isolation", () => {
  beforeAll(async () => {
    const customerAId = "c5000000-0000-0000-0000-000000000005";
    const vehicleAId = "c5500000-0000-0000-0000-000000000055";
    const customerBId = "c5000000-0000-0000-0000-000000000008";
    const vehicleBId = "c5500000-0000-0000-0000-000000000058";
    await ensureDealerAndDeal(dealerAId, dealAId, customerAId, vehicleAId);
    await ensureDealerAndDeal(dealerBId, dealBId, customerBId, vehicleBId);
  });

  it("listComplianceForms for Dealer A with B dealId throws NOT_FOUND", async () => {
    await expect(
      complianceService.listComplianceForms(dealerAId, dealBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getComplianceFormInstance with cross-tenant id throws NOT_FOUND", async () => {
    const instance = await complianceFormDb.createComplianceFormInstance({
      dealershipId: dealerBId,
      dealId: dealBId,
      formType: "PRIVACY_NOTICE",
      status: "GENERATED",
    });
    await expect(
      complianceService.getComplianceFormInstance(dealerAId, instance.id)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getComplianceAlerts for Dealer A with B dealId returns empty list (deal not in A's tenant)", async () => {
    const alerts = await complianceService.getComplianceAlerts(dealerAId, {
      dealId: dealBId,
    });
    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts).toHaveLength(0);
  });
});

describe("Compliance form generation and status", () => {
  beforeAll(async () => {
    const customerAId = "c5000000-0000-0000-0000-000000000005";
    const vehicleAId = "c5500000-0000-0000-0000-000000000055";
    await ensureDealerAndDeal(dealerAId, dealAId, customerAId, vehicleAId);
  });

  it("generateComplianceForm creates instance with GENERATED status and payload", async () => {
    const instance = await complianceService.generateComplianceForm(
      dealerAId,
      userAId,
      dealAId,
      "ODOMETER_DISCLOSURE"
    );
    expect(instance.dealId).toBe(dealAId);
    expect(instance.formType).toBe("ODOMETER_DISCLOSURE");
    expect(instance.status).toBe("GENERATED");
    expect(instance.generatedPayloadJson).toBeDefined();
    const payload = instance.generatedPayloadJson as Record<string, unknown>;
    expect(payload.dealId).toBe(dealAId);
    expect(typeof payload.salePriceCents).toBe("string");
  });

  it("updateComplianceFormInstance updates status and completedAt", async () => {
    const instance = await complianceService.generateComplianceForm(
      dealerAId,
      userAId,
      dealAId,
      "BUYERS_GUIDE"
    );
    const updated = await complianceService.updateComplianceFormInstance(
      dealerAId,
      userAId,
      instance.id,
      { status: "COMPLETED", completedAt: new Date().toISOString() },
      {}
    );
    expect(updated?.status).toBe("COMPLETED");
    expect(updated?.completedAt).toBeDefined();
  });
});

describe("Compliance alerts", () => {
  it("getComplianceAlerts returns array", async () => {
    const alerts = await complianceService.getComplianceAlerts(dealerAId, {});
    expect(Array.isArray(alerts)).toBe(true);
  });

  it("getComplianceAlerts with dealId filters by deal", async () => {
    const customerAId = "c5000000-0000-0000-0000-000000000005";
    const vehicleAId = "c5500000-0000-0000-0000-000000000055";
    await ensureDealerAndDeal(dealerAId, dealAId, customerAId, vehicleAId);
    const alerts = await complianceService.getComplianceAlerts(dealerAId, {
      dealId: dealAId,
    });
    expect(Array.isArray(alerts)).toBe(true);
    alerts.forEach((a) => expect(a.dealId).toBe(dealAId));
  });
});
