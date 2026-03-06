/**
 * Persistence for dashboard layout preferences.
 * All operations scoped by dealershipId and userId from auth context.
 */
import { prisma } from "@/lib/db";
import type { DashboardLayoutPayload } from "../schemas/dashboard-layout";
import { parseLayoutJson } from "../schemas/dashboard-layout";

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

export type SaveLayoutParams = {
  dealershipId: string;
  userId: string;
  payload: DashboardLayoutPayload;
};

/** Save layout; overwrites existing. Payload must be validated and allowed by RBAC before calling. */
export async function saveLayout(params: SaveLayoutParams): Promise<void> {
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
    },
    update: {
      layoutJson: params.payload as object,
    },
  });
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
