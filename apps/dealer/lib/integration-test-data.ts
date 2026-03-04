import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Generate deterministic but unique IDs for integration tests to avoid
 * (dealership_id, vehicle_id) and other unique constraint collisions.
 * Each call returns new UUIDs so tests can create isolated data.
 */
export function uniqueTestIds(): {
  dealershipId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
  dealId: string;
  feeId: string;
  tradeId: string;
  extra: () => string;
} {
  const prefix = randomUUID().slice(0, 8);
  return {
    dealershipId: randomUUID(),
    userId: randomUUID(),
    customerId: randomUUID(),
    vehicleId: randomUUID(),
    dealId: randomUUID(),
    feeId: randomUUID(),
    tradeId: randomUUID(),
    extra: () => randomUUID(),
  };
}

/**
 * Create one dealership + user + customer + vehicle + deal (DRAFT) for integration tests.
 * Use uniqueTestIds() so each test or describe has no collisions.
 */
export async function createIsolatedDealFixture(ids: ReturnType<typeof uniqueTestIds>) {
  await prisma.dealership.upsert({
    where: { id: ids.dealershipId },
    create: { id: ids.dealershipId, name: "Test Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: ids.userId },
    create: { id: ids.userId, email: `test-${ids.userId.slice(0, 8)}@test.local` },
    update: {},
  });
  const customer = await prisma.customer.upsert({
    where: { id: ids.customerId },
    create: {
      id: ids.customerId,
      dealershipId: ids.dealershipId,
      name: "Test Customer",
      status: "LEAD",
    },
    update: {},
  });
  const vehicle = await prisma.vehicle.upsert({
    where: { id: ids.vehicleId },
    create: {
      id: ids.vehicleId,
      dealershipId: ids.dealershipId,
      stockNumber: `STK-${ids.vehicleId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });
  const deal = await prisma.deal.upsert({
    where: { id: ids.dealId },
    create: {
      id: ids.dealId,
      dealershipId: ids.dealershipId,
      customerId: customer.id,
      vehicleId: vehicle.id,
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
    },
    update: {},
  });
  return { deal, customer, vehicle };
}
