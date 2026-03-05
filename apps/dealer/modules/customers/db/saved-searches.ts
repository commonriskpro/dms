import { prisma } from "@/lib/db";
import type { SavedFilterVisibility } from "@prisma/client";

export type { SavedFilterVisibility };

export type SavedSearchState = {
  q?: string;
  status?: string;
  leadSource?: string;
  assignedTo?: string;
  lastVisit?: string;
  callbacks?: 0 | 1;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  columns?: string[];
  density?: string;
};

export type SavedSearchRecord = {
  id: string;
  dealershipId: string;
  name: string;
  visibility: SavedFilterVisibility;
  ownerUserId: string | null;
  stateJson: SavedSearchState;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function listSavedSearchesForUser(
  dealershipId: string,
  userId: string
): Promise<SavedSearchRecord[]> {
  const rows = await prisma.savedSearch.findMany({
    where: {
      dealershipId,
      OR: [
        { visibility: "SHARED" },
        { visibility: "PERSONAL", ownerUserId: userId },
      ],
    },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    dealershipId: r.dealershipId,
    name: r.name,
    visibility: r.visibility,
    ownerUserId: r.ownerUserId,
    stateJson: r.stateJson as SavedSearchState,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getSavedSearchById(
  dealershipId: string,
  id: string
): Promise<SavedSearchRecord | null> {
  const row = await prisma.savedSearch.findFirst({
    where: { id, dealershipId },
  });
  if (!row) return null;
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    name: row.name,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    stateJson: row.stateJson as SavedSearchState,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type CreateSavedSearchInput = {
  name: string;
  visibility: SavedFilterVisibility;
  state: SavedSearchState;
  isDefault?: boolean;
};

export async function createSavedSearch(
  dealershipId: string,
  userId: string,
  input: CreateSavedSearchInput
): Promise<SavedSearchRecord> {
  const ownerUserId =
    input.visibility === "PERSONAL" ? userId : null;
  if (input.isDefault === true) {
    await prisma.savedSearch.updateMany({
      where: {
        dealershipId,
        ...(input.visibility === "PERSONAL" ? { ownerUserId: userId } : {}),
      },
      data: { isDefault: false },
    });
  }
  const row = await prisma.savedSearch.create({
    data: {
      dealershipId,
      name: input.name,
      visibility: input.visibility,
      ownerUserId,
      stateJson: input.state as object,
      isDefault: input.isDefault ?? false,
    },
  });
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    name: row.name,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    stateJson: row.stateJson as SavedSearchState,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type UpdateSavedSearchPatch = {
  name?: string;
  visibility?: SavedFilterVisibility;
  state?: SavedSearchState;
  isDefault?: boolean;
};

export async function updateSavedSearch(
  dealershipId: string,
  id: string,
  patch: UpdateSavedSearchPatch
): Promise<SavedSearchRecord | null> {
  const existing = await prisma.savedSearch.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  if (patch.isDefault === true) {
    await prisma.savedSearch.updateMany({
      where: {
        dealershipId,
        ...(existing.visibility === "PERSONAL" && existing.ownerUserId
          ? { ownerUserId: existing.ownerUserId }
          : {}),
      },
      data: { isDefault: false },
    });
  }
  const row = await prisma.savedSearch.update({
    where: { id },
    data: {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.visibility !== undefined && { visibility: patch.visibility }),
      ...(patch.state !== undefined && { stateJson: patch.state as object }),
      ...(patch.isDefault !== undefined && { isDefault: patch.isDefault }),
    },
  });
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    name: row.name,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    stateJson: row.stateJson as SavedSearchState,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function deleteSavedSearch(
  dealershipId: string,
  id: string
): Promise<boolean> {
  const result = await prisma.savedSearch.deleteMany({
    where: { id, dealershipId },
  });
  return result.count > 0;
}

export async function setDefaultSavedSearch(
  dealershipId: string,
  userId: string,
  id: string
): Promise<SavedSearchRecord | null> {
  const existing = await prisma.savedSearch.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  await prisma.savedSearch.updateMany({
    where: {
      dealershipId,
      ...(existing.visibility === "PERSONAL" && existing.ownerUserId
        ? { ownerUserId: existing.ownerUserId }
        : {}),
    },
    data: { isDefault: false },
  });
  const row = await prisma.savedSearch.update({
    where: { id },
    data: { isDefault: true },
  });
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    name: row.name,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    stateJson: row.stateJson as SavedSearchState,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
