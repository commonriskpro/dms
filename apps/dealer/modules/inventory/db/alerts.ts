import { prisma } from "@/lib/db";
import type { InventoryAlertType } from "@prisma/client";

const STALE_DAYS_THRESHOLD = 90;
const BUCKET = "inventory-photos";
const ENTITY_TYPE = "Vehicle";

/** Vehicles with zero non-deleted photos (via VehiclePhoto count). */
export async function listVehicleIdsWithMissingPhotos(
  dealershipId: string
): Promise<string[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null },
    select: { id: true },
  });
  const withPhotos = await prisma.vehiclePhoto.groupBy({
    by: ["vehicleId"],
    where: {
      dealershipId,
      fileObject: { deletedAt: null },
    },
  });
  const withPhotoIds = new Set(withPhotos.map((p) => p.vehicleId));
  return vehicles.map((v) => v.id).filter((id) => !withPhotoIds.has(id));
}

/** Count vehicles with zero non-deleted photos (via VehiclePhoto relation). */
export async function countVehiclesWithMissingPhotos(
  dealershipId: string,
  excludedVehicleIds: string[] = []
): Promise<number> {
  return prisma.vehicle.count({
    where: {
      dealershipId,
      deletedAt: null,
      ...(excludedVehicleIds.length > 0 ? { id: { notIn: excludedVehicleIds } } : {}),
      vehiclePhotos: { none: { fileObject: { deletedAt: null } } },
    },
  });
}

/** Vehicle ids where days in stock > threshold (createdAt to now). */
export async function listVehicleIdsStale(
  dealershipId: string,
  daysThreshold: number = STALE_DAYS_THRESHOLD
): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  const rows = await prisma.vehicle.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Count vehicles where days in stock > threshold (createdAt before cutoff). */
export async function countVehiclesStale(
  dealershipId: string,
  daysThreshold: number = STALE_DAYS_THRESHOLD,
  excludedVehicleIds: string[] = []
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  return prisma.vehicle.count({
    where: {
      dealershipId,
      deletedAt: null,
      createdAt: { lt: cutoff },
      ...(excludedVehicleIds.length > 0 ? { id: { notIn: excludedVehicleIds } } : {}),
    },
  });
}

/** Vehicle ids that have a VehicleRecon with status IN_PROGRESS or NOT_STARTED and dueDate < start of today (or dueDate not null and past). */
export async function listVehicleIdsReconOverdue(dealershipId: string): Promise<string[]> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.vehicleRecon.findMany({
    where: {
      dealershipId,
      status: { in: ["IN_PROGRESS", "NOT_STARTED"] },
      dueDate: { not: null, lt: startOfToday },
    },
    select: { vehicleId: true },
  });
  return rows.map((r) => r.vehicleId);
}

/** Count overdue recon vehicles (IN_PROGRESS|NOT_STARTED with dueDate before start of today). */
export async function countVehiclesReconOverdue(
  dealershipId: string,
  excludedVehicleIds: string[] = []
): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return prisma.vehicleRecon.count({
    where: {
      dealershipId,
      status: { in: ["IN_PROGRESS", "NOT_STARTED"] },
      dueDate: { not: null, lt: startOfToday },
      ...(excludedVehicleIds.length > 0 ? { vehicleId: { notIn: excludedVehicleIds } } : {}),
    },
  });
}

/** Dismissals for user (and still "active": DISMISSED or SNOOZED with snoozedUntil > now). */
export async function listActiveDismissalVehicleAlertPairs(
  dealershipId: string,
  userId: string
): Promise<Array<{ vehicleId: string; alertType: InventoryAlertType }>> {
  const now = new Date();
  const rows = await prisma.inventoryAlertDismissal.findMany({
    where: {
      dealershipId,
      userId,
      OR: [
        { action: "DISMISSED" },
        { action: "SNOOZED", snoozedUntil: { gt: now } },
      ],
    },
    select: { vehicleId: true, alertType: true },
  });
  return rows;
}

export async function createDismissal(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  alertType: InventoryAlertType,
  action: "DISMISSED" | "SNOOZED",
  snoozedUntil?: Date | null
) {
  return prisma.inventoryAlertDismissal.upsert({
    where: {
      dealershipId_userId_vehicleId_alertType: {
        dealershipId,
        userId,
        vehicleId,
        alertType,
      },
    },
    create: {
      dealershipId,
      userId,
      vehicleId,
      alertType,
      action: action as "DISMISSED" | "SNOOZED",
      snoozedUntil: snoozedUntil ?? null,
    },
    update: {
      action: action as "DISMISSED" | "SNOOZED",
      snoozedUntil: snoozedUntil ?? null,
    },
  });
}

export async function getDismissalById(dealershipId: string, id: string) {
  return prisma.inventoryAlertDismissal.findFirst({
    where: { id, dealershipId },
  });
}

export async function deleteDismissal(dealershipId: string, id: string) {
  return prisma.inventoryAlertDismissal.deleteMany({
    where: { id, dealershipId },
  });
}
