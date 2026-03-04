/**
 * Audit log: deal.created, deal.updated, deal.deleted, deal.status_changed,
 * deal.fee_added, deal.fee_updated, deal.fee_deleted, deal.trade_added, deal.trade_updated.
 * Uses unique vehicle per run so no "Vehicle already has an active deal" from shared state.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as dealService from "../service/deal";

const hasDb =
  process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL;

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

describe.skipIf(!hasDb)("Deals audit log", () => {
  let testData: { customerId: string; vehicleId: string };

  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("records deal.created, deal.fee_added, and deal.status_changed", async () => {
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
    await dealService.updateDealStatus(dealerId, userId, created.id, "STRUCTURED");

    const logs = await prisma.auditLog.findMany({
      where: { dealershipId: dealerId, entity: "Deal", entityId: created.id },
      orderBy: { createdAt: "asc" },
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("deal.created");
    expect(actions).toContain("deal.fee_added");
    expect(actions).toContain("deal.status_changed");
  });
});
