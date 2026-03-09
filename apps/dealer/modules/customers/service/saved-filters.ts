import * as savedFiltersDb from "../db/saved-filters";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { SavedFilterVisibility, SavedFilterDefinition } from "../db/saved-filters";

export type SavedFilterRecord = savedFiltersDb.SavedFilterRecord;
export type { SavedFilterDefinition };

export async function listSavedFilters(
  dealershipId: string,
  userId: string
): Promise<SavedFilterRecord[]> {
  await requireTenantActiveForRead(dealershipId);
  return savedFiltersDb.listSavedFiltersForUser(dealershipId, userId);
}

export async function createSavedFilter(
  dealershipId: string,
  userId: string,
  input: {
    name: string;
    visibility: SavedFilterVisibility;
    definition: SavedFilterDefinition;
  },
  permissions: string[],
  meta?: { ip?: string; userAgent?: string }
): Promise<SavedFilterRecord> {
  await requireTenantActiveForWrite(dealershipId);
  // Route handlers enforce customers.read. Shared filter elevation stays here because
  // it depends on the requested visibility rather than the route shape alone.
  if (input.visibility === "SHARED" && !permissions.includes("admin.settings.manage")) {
    throw new ApiError("FORBIDDEN", "Only users with admin.settings.manage can create shared saved filters");
  }
  const created = await savedFiltersDb.createSavedFilter(dealershipId, userId, input);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "saved_filter.created",
    entity: "SavedFilter",
    entityId: created.id,
    metadata: { savedFilterId: created.id, visibility: created.visibility },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function deleteSavedFilter(
  dealershipId: string,
  userId: string,
  filterId: string,
  permissions: string[],
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await savedFiltersDb.getSavedFilterById(dealershipId, filterId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Saved filter not found");
  }
  if (existing.visibility === "SHARED") {
    if (!permissions.includes("admin.settings.manage")) {
      throw new ApiError("FORBIDDEN", "Only users with admin.settings.manage can delete shared saved filters");
    }
  } else {
    if (existing.ownerUserId !== userId) {
      throw new ApiError("FORBIDDEN", "You can only delete your own personal saved filters");
    }
  }
  const deleted = await savedFiltersDb.deleteSavedFilter(dealershipId, filterId);
  if (!deleted) {
    throw new ApiError("NOT_FOUND", "Saved filter not found");
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "saved_filter.deleted",
    entity: "SavedFilter",
    entityId: filterId,
    metadata: { savedFilterId: filterId, visibility: existing.visibility },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
