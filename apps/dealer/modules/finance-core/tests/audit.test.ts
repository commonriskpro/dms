/**
 * Audit: credit_application and lender_application create/update/submit emit audit events.
 */
import { prisma } from "@/lib/db";


const dealerId = "a1000000-0000-0000-0000-000000000001";
const userId = "a2000000-0000-0000-0000-000000000002";
const customerId = "a3000000-0000-0000-0000-000000000003";
const dealId = "a4000000-0000-0000-0000-000000000004";

async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Audit Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "audit-user@test.local" },
    update: {},
  });
  await prisma.customer.upsert({
    where: { id: customerId },
    create: {
      id: customerId,
      dealershipId: dealerId,
      name: "Audit Customer",
      status: "LEAD",
    },
    update: {},
  });
  const vehicle = await prisma.vehicle.upsert({
    where: { id: "a5000000-0000-0000-0000-000000000005" },
    create: {
      id: "a5000000-0000-0000-0000-000000000005",
      dealershipId: dealerId,
      stockNumber: "AUDIT-001",
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
      vehicleId: vehicle.id,
      salePriceCents: BigInt(25000),
      purchasePriceCents: BigInt(22000),
      taxRateBps: 700,
      taxCents: BigInt(175),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(25675),
      frontGrossCents: BigInt(2000),
      status: "DRAFT",
    },
    update: {},
  });
}

describe("finance-core audit", () => {
  describe("credit_application created", () => {
    it("emits credit_application.created audit event", async () => {
      await ensureTestData();
      const creditApplicationService = await import("../service/credit-application");
      const created = await creditApplicationService.createCreditApplication(
        dealerId,
        userId,
        {
          customerId,
          dealId,
          applicantFirstName: "Audit",
          applicantLastName: "Applicant",
        }
      );
      const log = await prisma.auditLog.findFirst({
        where: {
          dealershipId: dealerId,
          entity: "CreditApplication",
          entityId: created.id,
          action: "credit_application.created",
        },
      });
      expect(log).not.toBeNull();
      expect(log?.metadata).toBeDefined();
      const meta = log?.metadata as Record<string, unknown>;
      expect(meta?.ssn).toBeUndefined();
      expect(meta?.email).toBeUndefined();
    });
  });
});
