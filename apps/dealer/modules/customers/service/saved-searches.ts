import * as savedSearchesDb from "../db/saved-searches";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { SavedFilterVisibility } from "../db/saved-searches";
import type { SavedSearchState } from "../db/saved-searches";

export type SavedSearchRecord = savedSearchesDb.SavedSearchRecord;
export type { SavedSearchState };

export async function listSavedSearches(
  dealershipId: string,
  userId: string
): Promise<SavedSearchRecord[]> {
  await requireTenantActiveForRead(dealershipId);
  return savedSearchesDb.listSavedSearchesForUser(dealershipId, userId);
}

export async function createSavedSearch(
  dealershipId: string,
  userId: string,
  input: {
    name: string;
    visibility: SavedFilterVisibility;
    state: SavedSearchState;
    isDefault?: boolean;
  },
  permissions: string[],
  meta?: { ip?: string; userAgent?: string }
): Promise<SavedSearchRecord> {
  await requireTenantActiveForWrite(dealershipId);
  // Route handlers enforce customers.read. Shared search elevation stays here because
  // it depends on visibility and existing-record ownership semantics.
  if (input.visibility === "SHARED" && !permissions.includes("admin.settings.manage")) {
    throw new ApiError("FORBIDDEN", "Only users with admin.settings.manage can create shared saved searches");
  }
  const created = await savedSearchesDb.createSavedSearch(dealershipId, userId, input);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "saved_search.created",
    entity: "SavedSearch",
    entityId: created.id,
    metadata: { savedSearchId: created.id, visibility: created.visibility },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  if (input.isDefault) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "saved_search.set_default",
      entity: "SavedSearch",
      entityId: created.id,
      metadata: { savedSearchId: created.id },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return created;
}

export async function updateSavedSearch(
  dealershipId: string,
  userId: string,
  searchId: string,
  patch: { name?: string; visibility?: SavedFilterVisibility; state?: SavedSearchState; isDefault?: boolean },
  permissions: string[],
  meta?: { ip?: string; userAgent?: string }
): Promise<SavedSearchRecord> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await savedSearchesDb.getSavedSearchById(dealershipId, searchId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Saved search not found");
  }
  if (existing.visibility === "SHARED") {
    if (!permissions.includes("admin.settings.manage")) {
      throw new ApiError("FORBIDDEN", "Only users with admin.settings.manage can update shared saved searches");
    }
  } else {
    if (existing.ownerUserId !== userId) {
      throw new ApiError("FORBIDDEN", "You can only update your own personal saved searches");
    }
  }
  const updated = await savedSearchesDb.updateSavedSearch(dealershipId, searchId, patch);
  if (!updated) {
    throw new ApiError("NOT_FOUND", "Saved search not found");
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "saved_search.updated",
    entity: "SavedSearch",
    entityId: searchId,
    metadata: { savedSearchId: searchId, visibility: updated.visibility },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  if (patch.isDefault === true) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "saved_search.set_default",
      entity: "SavedSearch",
      entityId: searchId,
      metadata: { savedSearchId: searchId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}

export async function deleteSavedSearch(
  dealershipId: string,
  userId: string,
  searchId: string,
  permissions: string[],
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await savedSearchesDb.getSavedSearchById(dealershipId, searchId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Saved search not found");
  }
  if (existing.visibility === "SHARED") {
    if (!permissions.includes("admin.settings.manage")) {
      throw new ApiError("FORBIDDEN", "Only users with admin.settings.manage can delete shared saved searches");
    }
  } else {
    if (existing.ownerUserId !== userId) {
      throw new ApiError("FORBIDDEN", "You can only delete your own personal saved searches");
    }
  }
  const deleted = await savedSearchesDb.deleteSavedSearch(dealershipId, searchId);
  if (!deleted) {
    throw new ApiError("NOT_FOUND", "Saved search not found");
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "saved_search.deleted",
    entity: "SavedSearch",
    entityId: searchId,
    metadata: { savedSearchId: searchId, visibility: existing.visibility },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

export async function setDefaultSavedSearch(
  dealershipId: string,
  userId: string,
  searchId: string,
  permissions: string[],
  meta?: { ip?: string; userAgent?: string }
): Promise<SavedSearchRecord> {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await savedSearchesDb.getSavedSearchById(dealershipId, searchId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Saved search not found");
  }
  if (existing.visibility === "SHARED") {
    if (!permissions.includes("admin.settings.manage")) {
      throw new ApiError("FORBIDDEN", "Only users with admin.settings.manage can set shared saved search as default");
    }
  } else {
    if (existing.ownerUserId !== userId) {
      throw new ApiError("FORBIDDEN", "You can only set your own personal saved search as default");
    }
  }
  const updated = await savedSearchesDb.setDefaultSavedSearch(dealershipId, userId, searchId);
  if (!updated) {
    throw new ApiError("NOT_FOUND", "Saved search not found");
  }
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "saved_search.set_default",
    entity: "SavedSearch",
    entityId: searchId,
    metadata: { savedSearchId: searchId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}
