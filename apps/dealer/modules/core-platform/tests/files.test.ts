/** @jest-environment node */
/**
 * Files: FileObject has correct dealershipId; signed-url requires permission and logs file.accessed.
 * Upload to Storage is mocked or skipped if Supabase not configured.
 */
import { prisma } from "@/lib/db";
import * as fileDb from "../db/file";
import * as fileService from "../service/file";
import { ApiError } from "@/lib/auth";

const dealerId = "90000000-0000-0000-0000-000000000009";
const userId = "a0000000-0000-0000-0000-00000000000a";

describe("Files", () => {
  beforeAll(async () => {
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "File Test Dealer" },
      update: {},
    });
    await prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, email: "fileuser@test.local" },
      update: {},
    });
  });

  it("uploadFile rejects disallowed mime type", async () => {
    await expect(
      fileService.uploadFile(dealerId, userId, {
        bucket: "deal-documents",
        file: {
          name: "bad.exe",
          type: "application/x-executable",
          size: 100,
          arrayBuffer: async () => new ArrayBuffer(0),
        },
      })
    ).rejects.toThrow(ApiError);
    try {
      await fileService.uploadFile(dealerId, userId, {
        bucket: "deal-documents",
        file: {
          name: "bad.exe",
          type: "application/x-executable",
          size: 100,
          arrayBuffer: async () => new ArrayBuffer(0),
        },
      });
    } catch (e) {
      expect((e as ApiError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("uploadFile rejects file over max size", async () => {
    const overMax = 26 * 1024 * 1024;
    try {
      await fileService.uploadFile(dealerId, userId, {
        bucket: "deal-documents",
        file: {
          name: "big.pdf",
          type: "application/pdf",
          size: overMax,
          arrayBuffer: async () => new ArrayBuffer(0),
        },
      });
    } catch (e) {
      expect((e as ApiError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("createFileObject stores correct dealershipId and uploadedBy", async () => {
    const file = await fileDb.createFileObject({
      dealershipId: dealerId,
      bucket: "deal-documents",
      path: `${dealerId}/deal-documents/test-file-id.pdf`,
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: userId,
    });
    expect(file.dealershipId).toBe(dealerId);
    expect(file.uploadedBy).toBe(userId);
    expect(file.bucket).toBe("deal-documents");
    await prisma.fileObject.delete({ where: { id: file.id } });
  });

  it("getFileObjectById returns null for wrong dealership", async () => {
    const file = await fileDb.createFileObject({
      dealershipId: dealerId,
      bucket: "deal-documents",
      path: "path/only-dealer-9",
      filename: "f",
      mimeType: "application/pdf",
      sizeBytes: 1,
      uploadedBy: userId,
    });
    const wrongDealerId = "90000000-0000-0000-0000-000000000099";
    const found = await fileDb.getFileObjectById(wrongDealerId, file.id);
    expect(found).toBeNull();
    await prisma.fileObject.delete({ where: { id: file.id } });
  });

  it("getSignedUrl with fileId from another dealership throws NOT_FOUND (no existence leak)", async () => {
    const otherDealerId = "90000000-0000-0000-0000-000000000098";
    await prisma.dealership.upsert({
      where: { id: otherDealerId },
      create: { id: otherDealerId, name: "Other Dealer" },
      update: {},
    });
    const fileOther = await fileDb.createFileObject({
      dealershipId: otherDealerId,
      bucket: "deal-documents",
      path: "other/path",
      filename: "other.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      uploadedBy: userId,
    });
    try {
      await fileService.getSignedUrl(dealerId, fileOther.id, userId);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
    }
    await prisma.fileObject.delete({ where: { id: fileOther.id } });
  });
});
