import * as costEntryDb from "../db/cost-entry";
import * as costDocumentDb from "../db/cost-document";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export type VehicleCostTotals = costEntryDb.VehicleCostTotals;
export type CreateCostEntryInput = Omit<
  costEntryDb.CreateCostEntryInput,
  "dealershipId" | "vehicleId" | "createdByUserId"
>;
export type UpdateCostEntryInput = costEntryDb.UpdateCostEntryInput;

/** Map ledger totals to legacy cost breakdown shape (for vehicle response / projected gross). */
export function ledgerTotalsToCostBreakdown(t: VehicleCostTotals): {
  auctionCostCents: bigint;
  transportCostCents: bigint;
  reconCostCents: bigint;
  miscCostCents: bigint;
  totalCostCents: bigint;
} {
  const miscCents = t.feesSubtotalCents + t.miscCents;
  return {
    auctionCostCents: t.acquisitionSubtotalCents,
    transportCostCents: t.transportCents,
    reconCostCents: t.reconSubtotalCents,
    miscCostCents: miscCents,
    totalCostCents: t.totalInvestedCents,
  };
}

export async function getCostTotals(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  return costEntryDb.getCostTotalsByVehicleId(dealershipId, vehicleId);
}

export async function getCostTotalsForVehicles(
  dealershipId: string,
  vehicleIds: string[]
): Promise<Map<string, VehicleCostTotals>> {
  await requireTenantActiveForRead(dealershipId);
  return costEntryDb.getCostTotalsByVehicleIds(dealershipId, vehicleIds);
}

export async function listCostEntries(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  return costEntryDb.listCostEntriesByVehicleId(dealershipId, vehicleId);
}

/** List cost entries for a vendor (for vendor detail page). Limit 25. */
export async function listCostEntriesByVendor(
  dealershipId: string,
  vendorId: string,
  limit = 25
) {
  await requireTenantActiveForRead(dealershipId);
  return costEntryDb.listCostEntriesByVendorId(dealershipId, vendorId, limit);
}

export async function getCostEntry(dealershipId: string, entryId: string) {
  await requireTenantActiveForRead(dealershipId);
  const entry = await costEntryDb.getCostEntryById(dealershipId, entryId);
  if (!entry) throw new ApiError("NOT_FOUND", "Cost entry not found");
  return entry;
}

export async function createCostEntry(
  dealershipId: string,
  vehicleId: string,
  userId: string,
  data: CreateCostEntryInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const entry = await costEntryDb.createCostEntry({
    dealershipId,
    vehicleId,
    createdByUserId: userId,
    description: data.description ?? null,
    category: data.category,
    amountCents: data.amountCents,
    vendorId: data.vendorId ?? null,
    vendorName: data.vendorName ?? null,
    occurredAt: data.occurredAt,
    memo: data.memo ?? null,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_cost_entry.created",
    entity: "VehicleCostEntry",
    entityId: entry.id,
    metadata: { vehicleId, category: data.category },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return entry;
}

export async function updateCostEntry(
  dealershipId: string,
  entryId: string,
  data: UpdateCostEntryInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const entry = await costEntryDb.getCostEntryById(dealershipId, entryId);
  if (!entry) throw new ApiError("NOT_FOUND", "Cost entry not found");
  await costEntryDb.updateCostEntry(dealershipId, entryId, data);
  await auditLog({
    dealershipId,
    actorUserId: entry.createdByUserId,
    action: "vehicle_cost_entry.updated",
    entity: "VehicleCostEntry",
    entityId: entryId,
    metadata: { vehicleId: entry.vehicleId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return costEntryDb.getCostEntryById(dealershipId, entryId);
}

export async function deleteCostEntry(
  dealershipId: string,
  entryId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const entry = await costEntryDb.getCostEntryById(dealershipId, entryId);
  if (!entry) throw new ApiError("NOT_FOUND", "Cost entry not found");
  await costEntryDb.deleteCostEntry(dealershipId, entryId, userId);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_cost_entry.deleted",
    entity: "VehicleCostEntry",
    entityId: entryId,
    metadata: { vehicleId: entry.vehicleId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

export async function listCostDocuments(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  return costDocumentDb.listCostDocumentsByVehicleId(dealershipId, vehicleId);
}

export async function createCostDocument(
  dealershipId: string,
  vehicleId: string,
  data: {
    costEntryId?: string | null;
    fileObjectId: string;
    kind: costDocumentDb.CreateCostDocumentInput["kind"];
    createdByUserId?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const doc = await costDocumentDb.createCostDocument({
    dealershipId,
    vehicleId,
    costEntryId: data.costEntryId ?? null,
    fileObjectId: data.fileObjectId,
    kind: data.kind,
    createdByUserId: data.createdByUserId ?? null,
  });
  await auditLog({
    dealershipId,
    actorUserId: data.createdByUserId ?? null,
    action: "vehicle_cost_document.created",
    entity: "VehicleCostDocument",
    entityId: doc.id,
    metadata: { vehicleId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return doc;
}

export async function getCostDocument(dealershipId: string, documentId: string) {
  await requireTenantActiveForRead(dealershipId);
  const doc = await costDocumentDb.getCostDocumentById(dealershipId, documentId);
  if (!doc) throw new ApiError("NOT_FOUND", "Cost document not found");
  return doc;
}

export async function deleteCostDocument(
  dealershipId: string,
  documentId: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const doc = await costDocumentDb.getCostDocumentById(dealershipId, documentId);
  if (!doc) throw new ApiError("NOT_FOUND", "Cost document not found");
  await costDocumentDb.deleteCostDocument(dealershipId, documentId);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_cost_document.deleted",
    entity: "VehicleCostDocument",
    entityId: documentId,
    metadata: { vehicleId: doc.vehicleId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
