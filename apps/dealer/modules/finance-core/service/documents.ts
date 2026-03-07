/**
 * Deal document vault: list, upload, get, delete, download (signed URL).
 * Uses FileObject storage (deal-documents bucket) + DealDocument row.
 */
import * as dealDocumentDb from "../db/deal-document";
import * as fileService from "@/modules/core-platform/service/file";
import * as fileDb from "@/modules/core-platform/db/file";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as dealService from "@/modules/deals/service/deal";
import type { DealDocumentCategory } from "@prisma/client";

const BUCKET = "deal-documents";

export async function listDealDocuments(
  dealershipId: string,
  options: dealDocumentDb.ListDealDocumentsOptions
) {
  await requireTenantActiveForRead(dealershipId);
  await dealService.getDeal(dealershipId, options.dealId);
  return dealDocumentDb.listDealDocuments(dealershipId, options);
}

export async function getDealDocument(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const doc = await dealDocumentDb.getDealDocumentById(dealershipId, id);
  if (!doc) throw new ApiError("NOT_FOUND", "Deal document not found");
  return doc;
}

export async function uploadDealDocument(
  dealershipId: string,
  userId: string,
  params: {
    dealId: string;
    creditApplicationId?: string | null;
    lenderApplicationId?: string | null;
    category: DealDocumentCategory;
    title: string;
    file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  await dealService.getDeal(dealershipId, params.dealId);

  const fileObject = await fileService.uploadFile(
    dealershipId,
    userId,
    {
      bucket: BUCKET,
      pathPrefix: params.dealId,
      entityType: "DEAL",
      entityId: params.dealId,
      file: {
        name: params.file.name,
        type: params.file.type,
        size: params.file.size,
        arrayBuffer: params.file.arrayBuffer,
      },
    },
    meta
  );

  const dealDoc = await dealDocumentDb.createDealDocument({
    dealershipId,
    dealId: params.dealId,
    creditApplicationId: params.creditApplicationId ?? null,
    lenderApplicationId: params.lenderApplicationId ?? null,
    category: params.category,
    title: params.title.slice(0, 255),
    fileObjectId: fileObject.id,
    mimeType: params.file.type,
    sizeBytes: params.file.size,
    uploadedByUserId: userId,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal_document.uploaded",
    entity: "DealDocument",
    entityId: dealDoc.id,
    metadata: { dealId: params.dealId, category: params.category },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return dealDoc;
}

export async function deleteDealDocument(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const doc = await getDealDocument(dealershipId, id);
  const deleted = await dealDocumentDb.deleteDealDocument(dealershipId, id);
  if (!deleted) return;

  await fileService.softDeleteFile(
    dealershipId,
    deleted.fileObjectId,
    userId,
    meta
  );

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "deal_document.deleted",
    entity: "DealDocument",
    entityId: id,
    metadata: { dealId: doc.dealId, fileObjectId: deleted.fileObjectId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

export async function getDealDocumentDownloadUrl(
  dealershipId: string,
  userId: string,
  dealDocumentId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ url: string; expiresAt: string }> {
  await requireTenantActiveForRead(dealershipId);
  const doc = await getDealDocument(dealershipId, dealDocumentId);
  return fileService.getSignedUrl(
    dealershipId,
    doc.fileObjectId,
    userId,
    meta
  );
}
