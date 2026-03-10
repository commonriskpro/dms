/**
 * Inventory dashboard: KPIs and aging buckets for the inventory page.
 * Alerts: reuse getAlertCounts from ./alerts (no new API route; server component calls services directly).
 */
import * as vehicleDb from "../db/vehicle";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

export type InventoryKpis = {
  totalUnits: number;
  delta7d: number | null;
  inReconUnits: number;
  inReconPercent: number;
  salePendingUnits: number;
  salePendingValueCents?: number | null;
  inventoryValueCents: number;
  avgValueCents: number;
};

export async function getKpis(
  dealershipId: string,
  options?: { skipTenantCheck?: boolean }
): Promise<InventoryKpis> {
  if (!options?.skipTenantCheck) {
    await requireTenantActiveForRead(dealershipId);
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [aggregates, delta7d] = await Promise.all([
    vehicleDb.getVehicleKpiAggregates(dealershipId),
    vehicleDb.countVehiclesCreatedSince(dealershipId, sevenDaysAgo),
  ]);
  const totalUnits = aggregates.totalUnits;
  const inReconPercent =
    totalUnits > 0 ? (aggregates.inReconUnits / totalUnits) * 100 : 0;
  const avgValueCents =
    totalUnits > 0
      ? Number(aggregates.inventoryValueCents / BigInt(totalUnits))
      : 0;
  return {
    totalUnits,
    delta7d,
    inReconUnits: aggregates.inReconUnits,
    inReconPercent,
    salePendingUnits: aggregates.salePendingUnits,
    salePendingValueCents: aggregates.salePendingValueCents
      ? Number(aggregates.salePendingValueCents)
      : null,
    inventoryValueCents: Number(aggregates.inventoryValueCents),
    avgValueCents,
  };
}

export type InventoryAgingBuckets = {
  lt30: number;
  d30to60: number;
  d60to90: number;
  gt90: number;
};

export async function getAgingBuckets(
  dealershipId: string,
  options?: { skipTenantCheck?: boolean }
): Promise<InventoryAgingBuckets> {
  if (!options?.skipTenantCheck) {
    await requireTenantActiveForRead(dealershipId);
  }
  return vehicleDb.countByAgingBuckets(dealershipId);
}

/**
 * Dashboard uses the same alert counts as the inventory page.
 * Call alerts.getAlertCounts(dealershipId, userId) from the server component;
 * no separate dashboard API route is required.
 */
export { getAlertCounts } from "./alerts";
export type { AlertCounts } from "./alerts";
