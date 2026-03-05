import { prisma } from "@/lib/db";
import type { SavedFilterVisibility } from "@prisma/client";

export type { SavedFilterVisibility };

export type SavedFilterDefinition = {
  status?: string;
  leadSource?: string;
  assignedTo?: string;
  lastVisit?: string;
  callbacks?: 0 | 1;
};

export type SavedFilterRecord = {
  id: string;
  dealershipId: string;
  name: string;
  visibility: SavedFilterVisibility;
  ownerUserId: string | null;
  definitionJson: SavedFilterDefinition;
  createdAt: Date;
  updatedAt: Date;
};

export async function listSavedFiltersForUser(
  dealershipId: string,
  userId: string
): Promise<SavedFilterRecord[]> {
  const rows = await prisma.savedFilter.findMany({
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
    definitionJson: r.definitionJson as SavedFilterDefinition,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getSavedFilterById(
  dealershipId: string,
  id: string
): Promise<SavedFilterRecord | null> {
  const row = await prisma.savedFilter.findFirst({
    where: { id, dealershipId },
  });
  if (!row) return null;
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    name: row.name,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    definitionJson: row.definitionJson as SavedFilterDefinition,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type CreateSavedFilterInput = {
  name: string;
  visibility: SavedFilterVisibility;
  definition: SavedFilterDefinition;
};

export async function createSavedFilter(
  dealershipId: string,
  userId: string,
  input: CreateSavedFilterInput
): Promise<SavedFilterRecord> {
  const ownerUserId =
    input.visibility === "PERSONAL" ? userId : null;
  const row = await prisma.savedFilter.create({
    data: {
      dealershipId,
      name: input.name,
      visibility: input.visibility,
      ownerUserId,
      definitionJson: input.definition as object,
    },
  });
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    name: row.name,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    definitionJson: row.definitionJson as SavedFilterDefinition,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function deleteSavedFilter(
  dealershipId: string,
  id: string
): Promise<boolean> {
  const result = await prisma.savedFilter.deleteMany({
    where: { id, dealershipId },
  });
  return result.count > 0;
}
