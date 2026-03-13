import { createServiceClient } from "@/lib/supabase/service";
import * as fileDb from "../db/file";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { randomUUID } from "node:crypto";

/** Buckets must exist in Supabase Storage (Dashboard or API). */
const ALLOWED_BUCKETS = ["deal-documents", "inventory-photos", "vehicle-cost-docs"];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Control chars and path traversal; strip to safe chars, max length. */
const UNSAFE_FILENAME = /[\x00-\x1f\x7f\\/<>:"|?*]/g;
const UNSAFE_PATH_PREFIX = /[\x00-\x1f\x7f\\<>:"|?*]/g;

function safeFilename(name: string): string {
  const sanitized = name.replace(UNSAFE_FILENAME, "_").replace(/\.\./g, "_").trim();
  return (sanitized.slice(0, 200) || "file");
}

function safePathPrefix(prefix: string): string {
  return prefix
    .replace(UNSAFE_PATH_PREFIX, "_")
    .replace(/\.\./g, "")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 500);
}

function isMissingBucketError(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("bucket") && (
    normalized.includes("not found") ||
    normalized.includes("does not exist") ||
    normalized.includes("missing")
  );
}

async function ensureStorageBucket(bucket: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new ApiError("INTERNAL", "Failed to verify storage bucket");
  }
  if (data?.some((entry) => entry.name === bucket || entry.id === bucket)) {
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
  });
  if (createError && !isMissingBucketError(createError.message) && !createError.message?.toLowerCase().includes("already exists")) {
    throw new ApiError("INTERNAL", "Failed to initialize storage bucket");
  }
}

export async function uploadFile(
  dealershipId: string,
  userId: string,
  params: {
    bucket: string;
    pathPrefix?: string;
    entityType?: string;
    entityId?: string;
    file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
    /** Internal: true only when called from inventory vehicle photo flow. Ensures vehicle-linked FileObjects always have VehiclePhoto. */
    allowVehiclePhotoLink?: boolean;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  if (!ALLOWED_BUCKETS.includes(params.bucket)) {
    throw new ApiError("VALIDATION_ERROR", "Invalid bucket");
  }
  const isVehiclePhotoLink =
    params.bucket === "inventory-photos" &&
    params.entityType === "Vehicle" &&
    params.entityId != null;
  if (isVehiclePhotoLink && !params.allowVehiclePhotoLink) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Vehicle photos must be uploaded via the inventory vehicle photo API (POST /api/inventory/[id]/photos/upload or inventoryService.uploadVehiclePhoto)."
    );
  }
  if (!ALLOWED_MIME.has(params.file.type)) {
    throw new ApiError("VALIDATION_ERROR", "File type not allowed");
  }
  if (params.file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError("VALIDATION_ERROR", "File too large");
  }
  const pathPrefix = safePathPrefix(params.pathPrefix ?? "");
  const path = pathPrefix
    ? `${dealershipId}/${params.bucket}/${pathPrefix}/${randomUUID()}-${safeFilename(params.file.name)}`
    : `${dealershipId}/${params.bucket}/${randomUUID()}-${safeFilename(params.file.name)}`;
  let supabase;
  try {
    supabase = createServiceClient();
  } catch (createError) {
    const msg = createError instanceof Error ? createError.message : "Storage not configured";
    if (process.env.NODE_ENV !== "production") {
      console.error("[file.service] createServiceClient failed:", createError);
    }
    throw new ApiError("INTERNAL", msg);
  }
  const arrayBuffer = await params.file.arrayBuffer();
  let { error: uploadError } = await supabase.storage.from(params.bucket).upload(path, arrayBuffer, {
    contentType: params.file.type,
    upsert: false,
  });
  if (uploadError && isMissingBucketError(uploadError.message)) {
    await ensureStorageBucket(params.bucket);
    ({ error: uploadError } = await supabase.storage.from(params.bucket).upload(path, arrayBuffer, {
      contentType: params.file.type,
      upsert: false,
    }));
  }
  if (uploadError) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[file.service] Supabase storage upload failed:", uploadError.message, uploadError);
    }
    const hint = uploadError.message?.includes("Bucket") ? " Check that the storage bucket exists in Supabase." : "";
    throw new ApiError("INTERNAL", `Upload failed.${hint}`);
  }
  const fileObject = await fileDb.createFileObject({
    dealershipId,
    bucket: params.bucket,
    path,
    filename: params.file.name,
    mimeType: params.file.type,
    sizeBytes: params.file.size,
    uploadedBy: userId,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "file.uploaded",
    entity: "FileObject",
    entityId: fileObject.id,
    metadata: { bucket: params.bucket, path, sizeBytes: params.file.size },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return fileObject;
}

export async function getSignedUrl(
  dealershipId: string,
  fileId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ url: string; expiresAt: string }> {
  await requireTenantActiveForRead(dealershipId);
  const file = await fileDb.getFileObjectById(dealershipId, fileId);
  if (!file) throw new ApiError("NOT_FOUND", "File not found");
  const supabase = createServiceClient();
  const expiresIn = 60; // 1 minute
  const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new ApiError("INTERNAL", "Failed to create signed URL");
  }
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "file.accessed",
    entity: "FileObject",
    entityId: fileId,
    metadata: { bucket: file.bucket },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { url: data.signedUrl, expiresAt };
}

export async function listFilesByEntity(
  dealershipId: string,
  bucket: string,
  entityType: string,
  entityId: string
) {
  await requireTenantActiveForRead(dealershipId);
  return fileDb.listFileObjectsByEntity(dealershipId, bucket, entityType, entityId);
}

export async function softDeleteFile(
  dealershipId: string,
  fileId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const file = await fileDb.getFileObjectById(dealershipId, fileId);
  if (!file) return null;
  const updated = await fileDb.softDeleteFileObject(dealershipId, fileId, userId);
  if (updated) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "file.deleted",
      entity: "FileObject",
      entityId: fileId,
      metadata: { bucket: file.bucket },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}
