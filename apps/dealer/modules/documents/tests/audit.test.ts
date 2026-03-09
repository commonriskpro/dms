/** @jest-environment node */
/**
 * Audit: document.uploaded, document.accessed, document.deleted, document.updated.
 */
import { prisma } from "@/lib/db";
import * as documentDb from "../db/documents";
import * as documentService from "../service/documents";


const dealerId = "a1000000-0000-0000-0000-000000000001";
const userId = "a2000000-0000-0000-0000-000000000002";
const dealId = "a3000000-0000-0000-0000-000000000003";

describe("Documents audit", () => {
  beforeAll(async () => {
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "Audit Dealer" },
      update: {},
    });
    await prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, email: "audit-doc@test.local" },
      update: {},
    });
    const customer = await prisma.customer.upsert({
      where: { id: "a4000000-0000-0000-0000-000000000004" },
      create: {
        id: "a4000000-0000-0000-0000-000000000004",
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
        stockNumber: "AUD-001",
        status: "AVAILABLE",
      },
      update: {},
    });
    await prisma.deal.upsert({
      where: { id: dealId },
      create: {
        id: dealId,
        dealershipId: dealerId,
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
  });

  it("getSignedUrl creates document.accessed audit log row on success", async () => {
    const doc = await documentDb.createDocumentMetadata(dealerId, {
      bucket: "deal-documents",
      path: `${dealerId}/DEAL/${dealId}/audit-signed.pdf`,
      filename: "audit-signed.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: userId,
      entityType: "DEAL",
      entityId: dealId,
      docType: "OTHER",
      title: null,
      tags: [],
    });
    try {
      await documentService.getSignedUrl(dealerId, doc.id, userId, { ip: "127.0.0.1" });
    } catch {
      // signed URL may fail if storage not configured; audit is still written before that
    }
    const accessed = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "FileObject",
        action: "document.accessed",
        entityId: doc.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(accessed).toBeDefined();
    expect(accessed?.actorId).toBe(userId);
  });

  it("getSignedUrl with NOT_FOUND does not write document.accessed audit", async () => {
    const countBefore = await prisma.auditLog.count({
      where: { action: "document.accessed" },
    });
    await expect(
      documentService.getSignedUrl(dealerId, "00000000-0000-0000-0000-000000000099", userId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const countAfter = await prisma.auditLog.count({
      where: { action: "document.accessed" },
    });
    expect(countAfter).toBe(countBefore);
  });

  it("deleteDocument creates document.deleted audit log row", async () => {
    const doc = await documentDb.createDocumentMetadata(dealerId, {
      bucket: "deal-documents",
      path: `${dealerId}/DEAL/${dealId}/audit-del.pdf`,
      filename: "audit-del.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: userId,
      entityType: "DEAL",
      entityId: dealId,
      docType: "OTHER",
      title: null,
      tags: [],
    });
    await documentService.deleteDocument(dealerId, doc.id, userId, { ip: "127.0.0.1" });
    const deleted = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "FileObject",
        action: "document.deleted",
        entityId: doc.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(deleted).toBeDefined();
    expect(deleted?.actorId).toBe(userId);
  });

  it("updateDocumentMetadata creates document.updated audit log row", async () => {
    const doc = await documentDb.createDocumentMetadata(dealerId, {
      bucket: "deal-documents",
      path: `${dealerId}/DEAL/${dealId}/audit-patch.pdf`,
      filename: "audit-patch.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: userId,
      entityType: "DEAL",
      entityId: dealId,
      docType: "OTHER",
      title: null,
      tags: [],
    });
    await documentService.updateDocumentMetadata(
      dealerId,
      doc.id,
      { title: "Updated Title" },
      userId,
      { ip: "127.0.0.1" }
    );
    const updated = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "FileObject",
        action: "document.updated",
        entityId: doc.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(updated).toBeDefined();
    expect(updated?.actorId).toBe(userId);
  });
});
