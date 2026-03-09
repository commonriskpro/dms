/**
 * Persistence for dashboard layout preferences.
 * All operations scoped by dealershipId and userId from auth context.
 */
import { prisma } from "@/lib/db";
import type { DashboardLayoutPayload } from "../schemas/dashboard-layout";

export type GetLayoutParams = {
  dealershipId: string;
  userId: string;
};

/** Get saved layout raw JSON or null if none/invalid */
export async function getSavedLayout(params: GetLayoutParams): Promise<unknown> {
  const row = await prisma.dashboardLayoutPreference.findUnique({
    where: {
      dealershipId_userId: {
        dealershipId: params.dealershipId,
        userId: params.userId,
      },
    },
    select: { layoutJson: true },
  });
  if (!row) return null;
  return row.layoutJson;
}

export type SavedLayoutRow = {
  layoutJson: unknown;
  checksum: string | null;
};

/** Get saved layout and checksum for no-op comparison. */
export async function getSavedLayoutRow(params: GetLayoutParams): Promise<SavedLayoutRow | null> {
  const row = await prisma.dashboardLayoutPreference.findUnique({
    where: {
      dealershipId_userId: {
        dealershipId: params.dealershipId,
        userId: params.userId,
      },
    },
    select: { layoutJson: true, checksum: true },
  });
  if (!row) return null;
  return { layoutJson: row.layoutJson, checksum: row.checksum };
}

export type SaveLayoutParams = {
  dealershipId: string;
  userId: string;
  payload: DashboardLayoutPayload;
  checksum: string;
};

/**
 * Save layout; overwrites existing unless checksum matches (no-op).
 * Payload must be validated, normalized, and allowed by RBAC before calling.
 * Returns true if a write was performed, false if skipped (checksum match).
 */
export async function saveLayout(params: SaveLayoutParams): Promise<boolean> {
  const existing = await getSavedLayoutRow({
    dealershipId: params.dealershipId,
    userId: params.userId,
  });
  if (existing?.checksum != null && existing.checksum === params.checksum) {
    return false;
  }
  await prisma.dashboardLayoutPreference.upsert({
    where: {
      dealershipId_userId: {
        dealershipId: params.dealershipId,
        userId: params.userId,
      },
    },
    create: {
      dealershipId: params.dealershipId,
      userId: params.userId,
      layoutJson: params.payload as object,
      checksum: params.checksum,
    },
    update: {
      layoutJson: params.payload as object,
      checksum: params.checksum,
    },
  });
  return true;
}

export type ResetLayoutParams = {
  dealershipId: string;
  userId: string;
};

/** Remove saved layout so user gets default on next load */
export async function resetLayout(params: ResetLayoutParams): Promise<void> {
  await prisma.dashboardLayoutPreference.deleteMany({
    where: {
      dealershipId: params.dealershipId,
      userId: params.userId,
    },
  });
}
