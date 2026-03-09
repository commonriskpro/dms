import { createServiceClient } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { randomUUID } from "node:crypto";
import * as documentDb from "../db/documents";
import * as dealService from "@/modules/deals/service/deal";
import * as customerService from "@/modules/customers/service/customer";
import * as vehicleService from "@/modules/inventory/service/vehicle";
import type { DocumentType } from "@prisma/client";

const BUCKET = "deal-documents";
const SIGNED_URL_TTL_SEC = 120;

const MIME_PDF = "application/pdf";
const MIME_JPEG = "image/jpeg";
const MIME_PNG = "image/png";
const MIME_WEBP = "image/webp";

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME = new Set<string>([MIME_PDF, MIME_JPEG, MIME_PNG, MIME_WEBP]);

function getMaxSizeBytes(mimeType: string): number {
  return mimeType === MIME_PDF ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

const UNSAFE_FILENAME = /[\x00-\x1f\x7f\\/<>:"|?*]/g;

/** Strip null bytes and non-printable characters before DB/storage. Exported for tests. */
export function sanitizeFilename(name: string): string {
  const sanitized = name.replace(UNSAFE_FILENAME, "_").replace(/\.\./g, "_").trim();
  return sanitized.slice(0, 200) || "file";
}

const ENTITY_TYPES = ["DEAL", "CUSTOMER", "VEHICLE"] as const;

async function validateEntityExists(
  dealershipId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  if (!ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
    throw new ApiError("VALIDATION_ERROR", "Invalid entityType");
  }
  try {
    if (entityType === "DEAL") {
      await dealService.getDeal(dealershipId, entityId);
    } else if (entityType === "CUSTOMER") {
      await customerService.getCustomer(dealershipId, entityId);
    } else {
      await vehicleService.getVehicle(dealershipId, entityId);
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") throw e;
    throw e;
  }
}

export type DocumentItem = {
  id: string;
  bucket: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  entityType: string | null;
  entityId: string | null;
  docType: DocumentType | null;
  title: string | null;
  tags: string[];
  uploadedBy: string;
  createdAt: Date;
};

function toDocumentItem(row: {
  id: string;
  bucket: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  entityType: string | null;
  entityId: string | null;
  docType: DocumentType | null;
  title: string | null;
  tags: string[];
  uploadedBy: string;
  createdAt: Date;
}): DocumentItem {
  return {
    id: row.id,
    bucket: row.bucket,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    entityType: row.entityType,
    entityId: row.entityId,
    docType: row.docType,
    title: row.title,
    tags: row.tags,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
  };
}

export type UploadDocumentParams = {
  entityType: string;
  entityId: string;
  docType: DocumentType;
  title?: string | null;
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
};

/**
 * Upload a document: validate entity, mime/size, upload to Supabase, create FileObject, audit and emit.
 */
export async function uploadDocument(
  dealershipId: string,
  userId: string,
  params: UploadDocumentParams,
  meta?: { ip?: string; userAgent?: string }
): Promise<DocumentItem> {
  await requireTenantActiveForWrite(dealershipId);
  if (!ALLOWED_MIME.has(params.file.type)) {
    throw new ApiError("VALIDATION_ERROR", "File type not allowed. Allowed: PDF, JPEG, PNG, WebP.");
  }
  const maxBytes = getMaxSizeBytes(params.file.type);
  if (params.file.size > maxBytes) {
    throw new ApiError(
      "VALIDATION_ERROR",
      params.file.type === MIME_PDF ? "PDF max size 25MB" : "Image max size 10MB"
    );
  }
  await validateEntityExists(dealershipId, params.entityType, params.entityId);

  const safeName = sanitizeFilename(params.file.name);
  const path = `${dealershipId}/${params.entityType}/${params.entityId}/${randomUUID()}-${safeName}`;

  const supabase = createServiceClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, await params.file.arrayBuffer(), {
      contentType: params.file.type,
      upsert: false,
    });
  if (uploadError) {
    throw new ApiError("INTERNAL", "Upload failed");
  }

  const title = params.title != null ? String(params.title).slice(0, 255) : null;
  const fileObject = await documentDb.createDocumentMetadata(dealershipId, {
    bucket: BUCKET,
    path,
    filename: safeName,
    mimeType: params.file.type,
    sizeBytes: params.file.size,
    uploadedBy: userId,
    entityType: params.entityType,
    entityId: params.entityId,
    docType: params.docType,
    title: title || null,
    tags: [],
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "document.uploaded",
    entity: "FileObject",
    entityId: fileObject.id,
    metadata: {
      bucket: BUCKET,
      entityType: params.entityType,
      entityId: params.entityId,
      docType: params.docType,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return toDocumentItem(fileObject);
}

/**
 * Get a short-TTL signed URL for download. Tenant-scoped; cross-tenant returns NOT_FOUND.
 * Writes audit document.accessed.
 */
export async function getSignedUrl(
  dealershipId: string,
  documentId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ url: string; expiresAt: string }> {
  await requireTenantActiveForRead(dealershipId);
  const doc = await documentDb.getDocumentById(dealershipId, documentId);
  if (!doc) throw new ApiError("NOT_FOUND", "Document not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "document.accessed",
    entity: "FileObject",
    entityId: documentId,
    metadata: { bucket: doc.bucket },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new ApiError("INTERNAL", "Failed to create signed URL");
  }
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString();
  return { url: data.signedUrl, expiresAt };
}

/**
 * Soft delete document. Does not remove blob in v1. Audit document.deleted.
 */
export async function deleteDocument(
  dealershipId: string,
  documentId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  await requireTenantActiveForWrite(dealershipId);
  const doc = await documentDb.getDocumentById(dealershipId, documentId);
  if (!doc) throw new ApiError("NOT_FOUND", "Document not found");

  const updated = await documentDb.softDeleteDocument(dealershipId, documentId, userId);
  if (!updated) return;

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "document.deleted",
    entity: "FileObject",
    entityId: documentId,
    metadata: { bucket: doc.bucket },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

/**
 * Update document metadata (title, docType, tags). Audit document.updated.
 */
export async function updateDocumentMetadata(
  dealershipId: string,
  documentId: string,
  data: { title?: string | null; docType?: DocumentType | null; tags?: string[] },
  userId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<DocumentItem> {
  await requireTenantActiveForWrite(dealershipId);
  const doc = await documentDb.getDocumentById(dealershipId, documentId);
  if (!doc) throw new ApiError("NOT_FOUND", "Document not found");

  const title = data.title !== undefined ? String(data.title).slice(0, 255) : undefined;
  const payload = {
    ...(title !== undefined && { title }),
    ...(data.docType !== undefined && { docType: data.docType }),
    ...(data.tags !== undefined && { tags: data.tags }),
  };
  const updated = await documentDb.updateDocumentMetadata(dealershipId, documentId, payload);
  if (!updated) throw new ApiError("NOT_FOUND", "Document not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "document.updated",
    entity: "FileObject",
    entityId: documentId,
    metadata: { updatedFields: Object.keys(payload) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return toDocumentItem(updated);
}

/**
 * List documents by entity with pagination and optional docType filter.
 */
export async function listDocuments(
  dealershipId: string,
  entityType: string,
  entityId: string,
  options: documentDb.DocumentListOptions
): Promise<{ data: DocumentItem[]; total: number }> {
  await requireTenantActiveForRead(dealershipId);
  const { data, total } = await documentDb.listDocumentsByEntity(
    dealershipId,
    entityType,
    entityId,
    options
  );
  return { data: data.map(toDocumentItem), total };
}
