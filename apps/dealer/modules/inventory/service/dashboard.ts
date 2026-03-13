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
  const summary = await vehicleDb.getInventoryOverviewVehicleSummary(dealershipId);
  const totalUnits = summary.totalUnits;
  const inReconPercent =
    totalUnits > 0 ? (summary.inReconUnits / totalUnits) * 100 : 0;
  const avgValueCents =
    totalUnits > 0
      ? Number(summary.inventoryValueCents / BigInt(totalUnits))
      : 0;
  return {
    totalUnits,
    delta7d: summary.addedThisWeek,
    inReconUnits: summary.inReconUnits,
    inReconPercent,
    salePendingUnits: summary.salePendingUnits,
    salePendingValueCents: summary.salePendingValueCents
      ? Number(summary.salePendingValueCents)
      : null,
    inventoryValueCents: Number(summary.inventoryValueCents),
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
  const summary = await vehicleDb.getInventoryOverviewVehicleSummary(dealershipId);
  return {
    lt30: summary.lt30,
    d30to60: summary.d30to60,
    d60to90: summary.d60to90,
    gt90: summary.gt90,
  };
}

/**
 * Dashboard uses the same alert counts as the inventory page.
 * Call alerts.getAlertCounts(dealershipId, userId) from the server component;
 * no separate dashboard API route is required.
 */
export { getAlertCounts } from "./alerts";
export type { AlertCounts } from "./alerts";
