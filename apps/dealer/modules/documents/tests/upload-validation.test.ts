/** @jest-environment node */
/**
 * Upload validation: disallowed mime, oversize, invalid entityId,
 * path traversal sanitization, bucket/path rules, and schema validation (docType, entityType, entityId).
 */
import { prisma } from "@/lib/db";
import * as documentService from "../service/documents";
import { sanitizeFilename } from "../service/documents";
import * as documentDb from "../db/documents";
import {
  listDocumentsQuerySchema,
  documentTypeSchema,
  entityTypeSchema,
} from "@/app/api/documents/schemas";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    },
  }),
}));


const dealerId = "41000000-0000-0000-0000-000000000001";
const userId = "42000000-0000-0000-0000-000000000002";
const dealId = "43000000-0000-0000-0000-000000000003";

function mockFile(name: string, type: string, size: number): { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } {
  return {
    name,
    type,
    size,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  };
}

describe("Documents upload validation", () => {
  beforeAll(async () => {
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "Upload Test Dealer" },
      update: {},
    });
    await prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, email: "upload-doc@test.local" },
      update: {},
    });
    const customer = await prisma.customer.upsert({
      where: { id: "44000000-0000-0000-0000-000000000004" },
      create: {
        id: "44000000-0000-0000-0000-000000000004",
        dealershipId: dealerId,
        name: "Upload Customer",
        status: "LEAD",
      },
      update: {},
    });
    const vehicle = await prisma.vehicle.upsert({
      where: { id: "45000000-0000-0000-0000-000000000005" },
      create: {
        id: "45000000-0000-0000-0000-000000000005",
        dealershipId: dealerId,
        stockNumber: "UPL-001",
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

  it("uploadDocument with disallowed mime returns VALIDATION_ERROR", async () => {
    await expect(
      documentService.uploadDocument(
        dealerId,
        userId,
        {
          entityType: "DEAL",
          entityId: dealId,
          docType: "OTHER",
          file: mockFile("x.txt", "text/plain", 100),
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("uploadDocument with PDF over 25MB returns VALIDATION_ERROR", async () => {
    const over25 = 25 * 1024 * 1024 + 1;
    await expect(
      documentService.uploadDocument(
        dealerId,
        userId,
        {
          entityType: "DEAL",
          entityId: dealId,
          docType: "OTHER",
          file: mockFile("big.pdf", "application/pdf", over25),
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("uploadDocument with image over 10MB returns VALIDATION_ERROR", async () => {
    const over10 = 10 * 1024 * 1024 + 1;
    await expect(
      documentService.uploadDocument(
        dealerId,
        userId,
        {
          entityType: "DEAL",
          entityId: dealId,
          docType: "OTHER",
          file: mockFile("big.jpg", "image/jpeg", over10),
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("uploadDocument with non-existent entityId returns NOT_FOUND", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000099";
    await expect(
      documentService.uploadDocument(
        dealerId,
        userId,
        {
          entityType: "DEAL",
          entityId: fakeId,
          docType: "OTHER",
          file: mockFile("a.pdf", "application/pdf", 100),
        }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uploadDocument with path traversal in filename stores path with sanitized segment and correct prefix", async () => {
    const item = await documentService.uploadDocument(
      dealerId,
      userId,
      {
        entityType: "DEAL",
        entityId: dealId,
        docType: "OTHER",
        file: mockFile("../../../etc/passwd.pdf", "application/pdf", 100),
      }
    );
    const row = await documentDb.getDocumentById(dealerId, item.id);
    expect(row).not.toBeNull();
    expect(row!.path).not.toMatch(/\.\./);
    expect(row!.path).not.toMatch(/\\/);
    expect(row!.path.startsWith(`${dealerId}/DEAL/${dealId}/`)).toBe(true);
    expect(row!.bucket).toBe("deal-documents");
  });

  it("uploadDocument with backslashes and control chars in filename sanitizes path", async () => {
    const item = await documentService.uploadDocument(
      dealerId,
      userId,
      {
        entityType: "DEAL",
        entityId: dealId,
        docType: "OTHER",
        file: mockFile("..\\..\\x\u0000.pdf", "application/pdf", 100),
      }
    );
    const row = await documentDb.getDocumentById(dealerId, item.id);
    expect(row).not.toBeNull();
    expect(row!.path).not.toMatch(/\.\./);
    expect(row!.path).not.toMatch(/\\/);
    expect(row!.path.startsWith(`${dealerId}/DEAL/${dealId}/`)).toBe(true);
  });
});

describe("Document filename sanitization", () => {
  it("sanitizeFilename removes null byte (\\0)", () => {
    expect(sanitizeFilename("a\u0000b.pdf")).not.toContain("\u0000");
    expect(sanitizeFilename("a\u0000b.pdf")).toBe("a_b.pdf");
  });

  it("sanitizeFilename strips other non-printable and path chars", () => {
    expect(sanitizeFilename("file\tname.pdf")).toBe("file_name.pdf");
    expect(sanitizeFilename("..\\..\\x.pdf")).not.toMatch(/\.\.|\\/);
  });
});

describe("Documents route schema validation", () => {
  it("documentTypeSchema rejects empty string", () => {
    expect(() => documentTypeSchema.parse("")).toThrow();
  });

  it("documentTypeSchema rejects invalid docType", () => {
    expect(() => documentTypeSchema.parse("INVALID_TYPE")).toThrow();
  });

  it("listDocumentsQuerySchema requires entityType and entityId", () => {
    expect(() =>
      listDocumentsQuerySchema.parse({
        entityId: "43000000-0000-0000-0000-000000000003",
        limit: 25,
        offset: 0,
      })
    ).toThrow();
    expect(() =>
      listDocumentsQuerySchema.parse({
        entityType: "DEAL",
        limit: 25,
        offset: 0,
      })
    ).toThrow();
  });

  it("entityTypeSchema rejects invalid entityType", () => {
    expect(() => entityTypeSchema.parse("INVALID")).toThrow();
  });
});
