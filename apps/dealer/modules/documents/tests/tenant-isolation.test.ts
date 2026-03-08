/** @jest-environment node */
/**
 * Tenant isolation: Dealer A cannot access Dealer B documents.
 * Cross-tenant documentId returns NOT_FOUND (never 403).
 */
import { prisma } from "@/lib/db";
import * as documentDb from "../db/documents";
import * as documentService from "../service/documents";


const dealerAId = "d1000000-0000-0000-0000-000000000001";
const dealerBId = "d2000000-0000-0000-0000-000000000002";
const userAId = "d3000000-0000-0000-0000-000000000003";
const userBId = "d4000000-0000-0000-0000-000000000004";
const dealBId = "d6000000-0000-0000-0000-000000000006";

async function ensureTestData(): Promise<{ documentBId: string }> {
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
    create: { id: userAId, email: "tenant-doc-a@test.local" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userBId },
    create: { id: userBId, email: "tenant-doc-b@test.local" },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "d5000000-0000-0000-0000-000000000005" },
    create: {
      id: "d5000000-0000-0000-0000-000000000005",
      dealershipId: dealerBId,
      name: "Customer B",
      status: "LEAD",
    },
    update: {},
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: "d5500000-0000-0000-0000-000000000055" },
    create: {
      id: "d5500000-0000-0000-0000-000000000055",
      dealershipId: dealerBId,
      stockNumber: "DOC-B-001",
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

  const doc = await documentDb.createDocumentMetadata(dealerBId, {
    bucket: "deal-documents",
    path: `${dealerBId}/DEAL/${dealBId}/uuid-b.pdf`,
    filename: "b.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    uploadedBy: userBId,
    entityType: "DEAL",
    entityId: dealBId,
    docType: "OTHER",
    title: "B Doc",
    tags: [],
  });
  return { documentBId: doc.id };
}

describe("Documents tenant isolation", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("listDocuments for Dealer A with B entityId returns only A-scoped results (empty when no A docs)", async () => {
    const { data } = await documentService.listDocuments(dealerAId, "DEAL", dealBId, {
      limit: 25,
      offset: 0,
    });
    expect(data).toHaveLength(0);
  });

  it("getDocumentById with wrong dealership returns null", async () => {
    const { documentBId } = await ensureTestData();
    const found = await documentDb.getDocumentById(dealerAId, documentBId);
    expect(found).toBeNull();
  });

  it("getSignedUrl with cross-tenant documentId throws NOT_FOUND", async () => {
    const { documentBId } = await ensureTestData();
    await expect(
      documentService.getSignedUrl(dealerAId, documentBId, userAId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleteDocument with cross-tenant documentId throws NOT_FOUND", async () => {
    const { documentBId } = await ensureTestData();
    await expect(
      documentService.deleteDocument(dealerAId, documentBId, userAId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateDocumentMetadata with cross-tenant documentId throws NOT_FOUND", async () => {
    const { documentBId } = await ensureTestData();
    await expect(
      documentService.updateDocumentMetadata(
        dealerAId,
        documentBId,
        { title: "Hacked" },
        userAId
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

/**
 * Soft delete: deleted documents hidden from list and signed-url; delete idempotency.
 */
describe("Documents soft delete", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("listDocuments excludes soft-deleted documents", async () => {
    const { documentBId } = await ensureTestData();
    await documentService.deleteDocument(dealerBId, documentBId, userBId);
    const { data } = await documentService.listDocuments(
      dealerBId,
      "DEAL",
      dealBId,
      { limit: 25, offset: 0 }
    );
    expect(data.find((d) => d.id === documentBId)).toBeUndefined();
  });

  it("getSignedUrl for soft-deleted document returns NOT_FOUND", async () => {
    const doc = await documentDb.createDocumentMetadata(dealerBId, {
      bucket: "deal-documents",
      path: `${dealerBId}/DEAL/${dealBId}/soft-del.pdf`,
      filename: "soft-del.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: userBId,
      entityType: "DEAL",
      entityId: dealBId,
      docType: "OTHER",
      title: null,
      tags: [],
    });
    await documentService.deleteDocument(dealerBId, doc.id, userBId);
    await expect(
      documentService.getSignedUrl(dealerBId, doc.id, userBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleteDocument on already-deleted document returns NOT_FOUND", async () => {
    const doc = await documentDb.createDocumentMetadata(dealerBId, {
      bucket: "deal-documents",
      path: `${dealerBId}/DEAL/${dealBId}/idem-del.pdf`,
      filename: "idem-del.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: userBId,
      entityType: "DEAL",
      entityId: dealBId,
      docType: "OTHER",
      title: null,
      tags: [],
    });
    await documentService.deleteDocument(dealerBId, doc.id, userBId);
    await expect(
      documentService.deleteDocument(dealerBId, doc.id, userBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
