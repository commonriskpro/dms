/** @jest-environment node */
/**
 * Deal document vault: tenant isolation.
 * Dealer A cannot list/get/delete Dealer B's deal documents; cross-tenant returns NOT_FOUND.
 */
import { prisma } from "@/lib/db";
import * as dealDocumentDb from "../db/deal-document";
import * as vaultService from "../service/documents";


const dealerAId = "a1000000-0000-0000-0000-000000000001";
const dealerBId = "a2000000-0000-0000-0000-000000000002";
const userBId = "a4000000-0000-0000-0000-000000000004";
const dealBId = "a6000000-0000-0000-0000-000000000006";

async function ensureTestData(): Promise<{ dealDocumentBId: string }> {
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
    where: { id: userBId },
    create: { id: userBId, email: "vault-b@test.local" },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "a5000000-0000-0000-0000-000000000005" },
    create: {
      id: "a5000000-0000-0000-0000-000000000005",
      dealershipId: dealerBId,
      name: "Customer B",
      status: "LEAD",
    },
    update: {},
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: "a5500000-0000-0000-0000-000000000055" },
    create: {
      id: "a5500000-0000-0000-0000-000000000055",
      dealershipId: dealerBId,
      stockNumber: "VAULT-B-001",
      status: "AVAILABLE",
    },
    update: {},
  });
  await prisma.deal.upsert({
    where: { id: dealBId },
    create: {
      id: dealBId,
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
    },
    update: {},
  });

  const fileObj = await prisma.fileObject.upsert({
    where: { id: "a7000000-0000-0000-0000-000000000007" },
    create: {
      id: "a7000000-0000-0000-0000-000000000007",
      dealershipId: dealerBId,
      bucket: "deal-documents",
      path: `${dealerBId}/deal-documents/${dealBId}/uuid-b.pdf`,
      filename: "b.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: userBId,
    },
    update: {},
  });

  const existing = await prisma.dealDocument.findFirst({
    where: { dealershipId: dealerBId, dealId: dealBId },
    select: { id: true },
  });
  if (existing) return { dealDocumentBId: existing.id };

  const dealDoc = await dealDocumentDb.createDealDocument({
    dealershipId: dealerBId,
    dealId: dealBId,
    category: "OTHER",
    title: "B Doc",
    fileObjectId: fileObj.id,
    mimeType: "application/pdf",
    sizeBytes: 100,
    uploadedByUserId: userBId,
  });

  return { dealDocumentBId: dealDoc.id };
}

describe("Deal documents tenant isolation", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("listDealDocuments for Dealer A with B dealId throws NOT_FOUND", async () => {
    await expect(
      vaultService.listDealDocuments(dealerAId, {
        dealId: dealBId,
        limit: 25,
        offset: 0,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getDealDocument with cross-tenant documentId throws NOT_FOUND", async () => {
    const { dealDocumentBId } = await ensureTestData();
    await expect(vaultService.getDealDocument(dealerAId, dealDocumentBId)).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
  });

  it("getDealDocumentById for wrong dealership returns null", async () => {
    const { dealDocumentBId } = await ensureTestData();
    const found = await dealDocumentDb.getDealDocumentById(dealerAId, dealDocumentBId);
    expect(found).toBeNull();
  });

  it("deleteDealDocument with cross-tenant documentId throws NOT_FOUND", async () => {
    const { dealDocumentBId } = await ensureTestData();
    await expect(
      vaultService.deleteDealDocument(dealerAId, "user-a-id", dealDocumentBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
