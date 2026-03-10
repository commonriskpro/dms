/**
 * Inventory alerts: computed on read (missing photos, stale, recon overdue).
 * Per-user dismiss/snooze stored in InventoryAlertDismissal.
 */
import * as alertsDb from "../db/alerts";
import * as vehicleDb from "../db/vehicle";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { InventoryAlertType } from "@prisma/client";

export type AlertCounts = {
  missingPhotos: number;
  stale: number;
  reconOverdue: number;
};

export async function getAlertCounts(
  dealershipId: string,
  userId: string,
  excludeDismissedForUser: boolean = true,
  options?: { skipTenantCheck?: boolean }
): Promise<AlertCounts> {
  if (!options?.skipTenantCheck) {
    await requireTenantActiveForRead(dealershipId);
  }
  const excludedVehicleIdsByType: Record<InventoryAlertType, string[]> = {
    MISSING_PHOTOS: [],
    STALE: [],
    RECON_OVERDUE: [],
  };
  if (excludeDismissedForUser) {
    const pairs = await alertsDb.listActiveDismissalVehicleAlertPairs(dealershipId, userId);
    for (const pair of pairs) {
      excludedVehicleIdsByType[pair.alertType].push(pair.vehicleId);
    }
  }
  const [missingPhotos, stale, reconOverdue] = await Promise.all([
    alertsDb.countVehiclesWithMissingPhotos(
      dealershipId,
      excludedVehicleIdsByType.MISSING_PHOTOS
    ),
    alertsDb.countVehiclesStale(dealershipId, 90, excludedVehicleIdsByType.STALE),
    alertsDb.countVehiclesReconOverdue(
      dealershipId,
      excludedVehicleIdsByType.RECON_OVERDUE
    ),
  ]);
  return {
    missingPhotos,
    stale,
    reconOverdue,
  };
}

export type AlertListItem = {
  vehicleId: string;
  vehicleSummary?: string;
  alertType: InventoryAlertType;
  daysInStock?: number;
};

export async function listAlerts(
  dealershipId: string,
  userId: string,
  options: {
    limit: number;
    offset: number;
    alertType?: InventoryAlertType;
  }
): Promise<{ data: AlertListItem[]; total: number }> {
  await requireTenantActiveForRead(dealershipId);
  const pairs = await alertsDb.listActiveDismissalVehicleAlertPairs(dealershipId, userId);
  const excludedSet = new Set(pairs.map((p) => `${p.vehicleId}:${p.alertType}`));

  const [missingIds, staleIds, reconIds] = await Promise.all([
    options.alertType === "MISSING_PHOTOS" || !options.alertType
      ? alertsDb.listVehicleIdsWithMissingPhotos(dealershipId)
      : [],
    options.alertType === "STALE" || !options.alertType
      ? alertsDb.listVehicleIdsStale(dealershipId)
      : [],
    options.alertType === "RECON_OVERDUE" || !options.alertType
      ? alertsDb.listVehicleIdsReconOverdue(dealershipId)
      : [],
  ]);

  const items: AlertListItem[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  for (const id of missingIds) {
    if (!excludedSet.has(`${id}:MISSING_PHOTOS`)) items.push({ vehicleId: id, alertType: "MISSING_PHOTOS" });
  }
  for (const id of staleIds) {
    if (!excludedSet.has(`${id}:STALE`)) items.push({ vehicleId: id, alertType: "STALE" });
  }
  for (const id of reconIds) {
    if (!excludedSet.has(`${id}:RECON_OVERDUE`)) items.push({ vehicleId: id, alertType: "RECON_OVERDUE" });
  }

  const total = items.length;
  const paginated = items.slice(options.offset, options.offset + options.limit);

  const vehicleIds = [...new Set(paginated.map((p) => p.vehicleId))];
  const vehicles = await Promise.all(
    vehicleIds.map((id) => vehicleDb.getVehicleById(dealershipId, id))
  );
  const vehicleMap = new Map(vehicleIds.map((id, i) => [id, vehicles[i]]));

  for (const item of paginated) {
    const v = vehicleMap.get(item.vehicleId);
    if (v) {
      item.vehicleSummary = [v.year, v.make, v.model].filter(Boolean).join(" ") || v.stockNumber;
      if (item.alertType === "STALE" && v.createdAt) {
        item.daysInStock = Math.floor((now - v.createdAt.getTime()) / dayMs);
      }
    }
  }

  return {
    data: paginated,
    total,
  };
}

export async function dismissAlert(
  dealershipId: string,
  userId: string,
  params: {
    vehicleId: string;
    alertType: InventoryAlertType;
    action: "DISMISS" | "SNOOZE";
    snoozedUntil?: string;
  }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, params.vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  if (params.action === "SNOOZE") {
    if (!params.snoozedUntil) throw new ApiError("VALIDATION_ERROR", "snoozedUntil required for SNOOZE");
    const d = new Date(params.snoozedUntil);
    if (d.getTime() <= Date.now()) throw new ApiError("VALIDATION_ERROR", "snoozedUntil must be in the future");
  }
  const action = params.action === "DISMISS" ? "DISMISSED" : "SNOOZED";
  const snoozedUntil =
    params.action === "SNOOZE" && params.snoozedUntil ? new Date(params.snoozedUntil) : null;
  const row = await alertsDb.createDismissal(
    dealershipId,
    userId,
    params.vehicleId,
    params.alertType,
    action,
    snoozedUntil
  );
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    alertType: row.alertType,
    action: row.action,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
  };
}

export async function undoDismissal(dealershipId: string, userId: string, dismissalId: string) {
  await requireTenantActiveForWrite(dealershipId);
  const row = await alertsDb.getDismissalById(dealershipId, dismissalId);
  if (!row) throw new ApiError("NOT_FOUND", "Dismissal not found");
  if (row.userId !== userId) throw new ApiError("FORBIDDEN", "Not your dismissal");
  await alertsDb.deleteDismissal(dealershipId, dismissalId);
}
