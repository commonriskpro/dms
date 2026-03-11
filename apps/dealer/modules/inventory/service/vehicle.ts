import * as vehicleDb from "../db/vehicle";
import * as vehiclePhotoDb from "../db/vehicle-photo";
import * as vinDecodeDb from "../db/vin-decode";
import * as vinDecodeCacheDb from "../db/vin-decode-cache";
import * as locationDb from "@/modules/core-platform/db/location";
import * as fileService from "@/modules/core-platform/service/file";
import { decodeVin as decodeVinApi } from "./vin";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { VehicleStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type VehicleListOptions = vehicleDb.VehicleListOptions;
export type VehicleCreateInput = vehicleDb.VehicleCreateInput;
export type VehicleUpdateInput = vehicleDb.VehicleUpdateInput;
export type AgingListOptions = vehicleDb.AgingListOptions;

/** Sum of cost fields (BigInt). */
export function totalCostCents(v: {
  auctionCostCents: bigint;
  transportCostCents: bigint;
  reconCostCents: bigint;
  miscCostCents: bigint;
}): bigint {
  return (
    v.auctionCostCents +
    v.transportCostCents +
    v.reconCostCents +
    v.miscCostCents
  );
}

/** projectedGrossCents = salePriceCents - totalCostCents. */
export function projectedGrossCents(v: {
  salePriceCents: bigint;
  auctionCostCents: bigint;
  transportCostCents: bigint;
  reconCostCents: bigint;
  miscCostCents: bigint;
}): bigint {
  return v.salePriceCents - totalCostCents(v);
}

export type VehicleCostBreakdown = {
  auctionCostCents: bigint;
  transportCostCents: bigint;
  reconCostCents: bigint;
  miscCostCents: bigint;
  totalCostCents: bigint;
};

/** Cost breakdown for a vehicle (purchase, transport, recon, misc, total). */
export function calculateVehicleCost(v: {
  auctionCostCents: bigint;
  transportCostCents: bigint;
  reconCostCents: bigint;
  miscCostCents: bigint;
}): VehicleCostBreakdown {
  return {
    auctionCostCents: v.auctionCostCents,
    transportCostCents: v.transportCostCents,
    reconCostCents: v.reconCostCents,
    miscCostCents: v.miscCostCents,
    totalCostCents: totalCostCents(v),
  };
}

export async function listVehicles(dealershipId: string, options: VehicleListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return vehicleDb.listVehicles(dealershipId, options);
}

/** List vehicles for marketplace feed (AVAILABLE, with photos). Used by integrations/marketplace. */
export async function getFeedVehicles(dealershipId: string, limit: number) {
  await requireTenantActiveForRead(dealershipId);
  return vehicleDb.listVehiclesForFeed(dealershipId, limit);
}

export async function getVehicle(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, id);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  return vehicle;
}

export async function createVehicle(
  dealershipId: string,
  userId: string,
  data: VehicleCreateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  if (data.locationId) {
    const loc = await locationDb.getLocationById(dealershipId, data.locationId);
    if (!loc) throw new ApiError("VALIDATION_ERROR", "Location does not belong to dealership");
  }
  const existingStock = await vehicleDb.findActiveVehicleByStockNumber(dealershipId, data.stockNumber);
  if (existingStock) throw new ApiError("CONFLICT", "Stock number already in use");
  if (data.vin != null && data.vin.trim()) {
    const existingVin = await vehicleDb.findActiveVehicleByVin(dealershipId, data.vin);
    if (existingVin) throw new ApiError("CONFLICT", "VIN already in use for this dealership");
  }
  const created = await vehicleDb.createVehicle(dealershipId, data);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle.created",
    entity: "Vehicle",
    entityId: created.id,
    metadata: { vehicleId: created.id, status: created.status, stockNumber: created.stockNumber },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emitEvent("vehicle.created", {
    vehicleId: created.id,
    dealershipId,
    vin: created.vin ?? undefined,
  });

  if (created.vin) {
    const cacheTtl = new Date();
    cacheTtl.setDate(cacheTtl.getDate() - 30);
    const cached = await vinDecodeCacheDb.findCached(dealershipId, created.vin.trim().toUpperCase(), cacheTtl);
    if (cached) {
      await vinDecodeDb.createVinDecode({
        dealershipId,
        vehicleId: created.id,
        vin: cached.vin,
        make: cached.make,
        model: cached.model,
        year: cached.year,
        trim: cached.trim,
        bodyStyle: cached.bodyStyle,
        engine: cached.engine,
        drivetrain: cached.driveType,
        transmission: cached.transmission,
        fuelType: cached.fuelType,
        manufacturedIn: null,
        rawJson: cached.rawJson,
      });
    }
  }

  return created;
}

async function allocateDraftStockNumber(dealershipId: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = `DRAFT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const existing = await vehicleDb.findActiveVehicleByStockNumber(
      dealershipId,
      candidate
    );
    if (!existing) return candidate;
  }
  throw new ApiError("CONFLICT", "Could not allocate a draft stock number");
}

export async function createVehicleDraft(
  dealershipId: string,
  userId: string,
  data: Omit<VehicleCreateInput, "stockNumber"> & { stockNumber?: string },
  meta?: { ip?: string; userAgent?: string }
) {
  const stockNumber = data.stockNumber?.trim() || (await allocateDraftStockNumber(dealershipId));
  return createVehicle(
    dealershipId,
    userId,
    {
      ...data,
      stockNumber,
      isDraft: true,
    },
    meta
  );
}

export async function updateVehicle(
  dealershipId: string,
  userId: string,
  id: string,
  data: VehicleUpdateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await vehicleDb.getVehicleById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Vehicle not found");
  if (data.locationId != null) {
    const loc = await locationDb.getLocationById(dealershipId, data.locationId);
    if (!loc) throw new ApiError("VALIDATION_ERROR", "Location does not belong to dealership");
  }
  if (data.stockNumber !== undefined) {
    const conflict = await vehicleDb.findActiveVehicleByStockNumber(
      dealershipId,
      data.stockNumber,
      id
    );
    if (conflict) throw new ApiError("CONFLICT", "Stock number already in use");
  }
  if (data.vin !== undefined && data.vin != null && data.vin.trim()) {
    const conflictVin = await vehicleDb.findActiveVehicleByVin(dealershipId, data.vin, id);
    if (conflictVin) throw new ApiError("CONFLICT", "VIN already in use for this dealership");
  }
  const previousStatus = existing.status;
  const updated = await vehicleDb.updateVehicle(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Vehicle not found");
  if (data.status !== undefined && data.status !== previousStatus) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "vehicle.status_changed",
      entity: "Vehicle",
      entityId: id,
      metadata: { previousStatus, newStatus: data.status },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle.updated",
    entity: "Vehicle",
    entityId: id,
    metadata: { vehicleId: id, stockNumber: updated.stockNumber },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  emitEvent("vehicle.updated", {
    vehicleId: id,
    dealershipId,
    fields: Object.keys(data),
  });
  return updated;
}

export async function deleteVehicle(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await vehicleDb.getVehicleById(dealershipId, id);
  if (!existing) return null;
  const updated = await vehicleDb.softDeleteVehicle(dealershipId, id, userId);
  if (!updated) return null;
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle.deleted",
    entity: "Vehicle",
    entityId: id,
    metadata: { vehicleId: id, stockNumber: existing.stockNumber },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

const MAX_PHOTOS_PER_VEHICLE = 20;

export type VehiclePhotoItem = {
  id: string;
  fileObjectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
};

export async function listVehiclePhotos(
  dealershipId: string,
  vehicleId: string
): Promise<VehiclePhotoItem[]> {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const withOrder = await vehiclePhotoDb.listVehiclePhotosWithOrder(dealershipId, vehicleId);
  return withOrder.map((r) => ({
    id: r.fileObjectId,
    fileObjectId: r.fileObjectId,
    filename: r.filename,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    sortOrder: r.sortOrder,
    isPrimary: r.isPrimary,
    createdAt: r.createdAt,
  }));
}

export async function getAgingReport(dealershipId: string, options: AgingListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return vehicleDb.listAging(dealershipId, options);
}

const INVENTORY_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function uploadVehiclePhoto(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const count = await vehiclePhotoDb.countVehiclePhotos(dealershipId, vehicleId);
  if (count >= MAX_PHOTOS_PER_VEHICLE) {
    throw new ApiError("VALIDATION_ERROR", `Max ${MAX_PHOTOS_PER_VEHICLE} photos per vehicle`);
  }
  if (!INVENTORY_PHOTO_MIME.has(file.type)) {
    throw new ApiError("VALIDATION_ERROR", "Allowed types: image/jpeg, image/png, image/webp");
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new ApiError("VALIDATION_ERROR", "File too large (max 10MB)");
  }
  const fileObject = await fileService.uploadFile(
    dealershipId,
    userId,
    {
      bucket: "inventory-photos",
      pathPrefix: vehicleId,
      entityType: "Vehicle",
      entityId: vehicleId,
      allowVehiclePhotoLink: true,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        arrayBuffer: file.arrayBuffer,
      },
    },
    meta
  );
  const isFirst = count === 0;
  await vehiclePhotoDb.createVehiclePhoto(
    dealershipId,
    vehicleId,
    fileObject.id,
    count,
    isFirst
  );
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_photo.added",
    entity: "Vehicle",
    entityId: vehicleId,
    metadata: { fileId: fileObject.id, sortOrder: count, isPrimary: isFirst },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return {
    ...fileObject,
    sortOrder: count,
    isPrimary: isFirst,
  };
}

export async function deleteVehiclePhoto(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  fileId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const link = await vehiclePhotoDb.getVehiclePhotoByFileId(dealershipId, vehicleId, fileId);
  if (!link) throw new ApiError("NOT_FOUND", "Photo not found for this vehicle");
  const wasPrimary = link.isPrimary;
  await vehiclePhotoDb.deleteVehiclePhotoByFileId(dealershipId, vehicleId, fileId);
  if (wasPrimary) {
    const remaining = await vehiclePhotoDb.listVehiclePhotosWithOrder(dealershipId, vehicleId);
    const nextPrimary = remaining[0];
    if (nextPrimary) {
      await vehiclePhotoDb.setPrimaryByFileId(
        dealershipId,
        vehicleId,
        nextPrimary.fileObjectId
      );
    }
  }
  const updated = await fileService.softDeleteFile(dealershipId, fileId, userId, meta);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_photo.removed",
    entity: "Vehicle",
    entityId: vehicleId,
    metadata: { fileId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function reorderVehiclePhotos(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  fileIds: string[],
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const existing = await vehiclePhotoDb.listVehiclePhotosWithOrder(dealershipId, vehicleId);
  const existingSet = new Set(existing.map((e) => e.fileObjectId));
  for (const fid of fileIds) {
    if (!existingSet.has(fid)) throw new ApiError("VALIDATION_ERROR", "All fileIds must be photos of this vehicle");
  }
  if (fileIds.length !== existing.length) {
    throw new ApiError("VALIDATION_ERROR", "fileIds must include exactly all photos of this vehicle");
  }
  await vehiclePhotoDb.reorderVehiclePhotos(dealershipId, vehicleId, fileIds);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_photo.reordered",
    entity: "Vehicle",
    entityId: vehicleId,
    metadata: { fileIds },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

export async function setPrimaryVehiclePhoto(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  fileId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const link = await vehiclePhotoDb.getVehiclePhotoByFileId(dealershipId, vehicleId, fileId);
  if (!link) throw new ApiError("NOT_FOUND", "Photo not found for this vehicle");
  await vehiclePhotoDb.setPrimaryByFileId(dealershipId, vehicleId, fileId);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_photo.primary_set",
    entity: "Vehicle",
    entityId: vehicleId,
    metadata: { fileId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

export async function decodeVin(
  dealershipId: string,
  userId: string,
  vin: string,
  meta?: { ip?: string; userAgent?: string }
) {
  const result = await decodeVinApi(vin);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vin.decode.requested",
    entity: "Vehicle",
    metadata: { vinLength: vin.length },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return result;
}
