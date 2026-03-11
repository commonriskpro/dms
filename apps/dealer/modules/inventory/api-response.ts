/**
 * Vehicle API response shape. Used by GET /api/inventory and GET /api/inventory/[id].
 * BigInt cents as source of truth.
 * @deprecated Aliases listPriceCents, purchasePriceCents, reconditioningCostCents, otherCostsCents — scheduled for removal after UI Step 3.
 */
import { projectedGrossCents } from "./service/vehicle";
import {
  ledgerTotalsToCostBreakdown,
  type VehicleCostTotals,
} from "./service/cost-ledger";

export type VehicleResponseInput = {
  id: string;
  dealershipId: string;
  isDraft?: boolean;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string;
  mileage: number | null;
  color: string | null;
  status: string;
  salePriceCents: bigint;
  auctionCostCents: bigint;
  transportCostCents: bigint;
  reconCostCents: bigint;
  miscCostCents: bigint;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  location?: { id: string; name: string } | null;
};

export type { VehicleCostTotals };

/** Merge vehicle row with ledger-derived cost (ledger is sole source of truth). Use before toVehicleResponse when vehicle came from DB. */
export function mergeVehicleWithLedgerTotals(
  vehicle: VehicleResponseInput,
  totals: VehicleCostTotals
): VehicleResponseInput {
  const breakdown = ledgerTotalsToCostBreakdown(totals);
  return {
    ...vehicle,
    auctionCostCents: breakdown.auctionCostCents,
    transportCostCents: breakdown.transportCostCents,
    reconCostCents: breakdown.reconCostCents,
    miscCostCents: breakdown.miscCostCents,
  };
}

export function toVehicleResponse(v: VehicleResponseInput): Record<string, unknown> {
  const projectedGross = projectedGrossCents(v);
  const totalInvestedCents =
    v.auctionCostCents +
    v.transportCostCents +
    v.reconCostCents +
    v.miscCostCents;
  const salePriceCents = String(v.salePriceCents);
  const auctionCostCents = String(v.auctionCostCents);
  const reconCostCents = String(v.reconCostCents);
  const miscCostCents = String(v.miscCostCents);
  return {
    id: v.id,
    dealershipId: v.dealershipId,
    isDraft: v.isDraft ?? false,
    vin: v.vin,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    stockNumber: v.stockNumber,
    mileage: v.mileage,
    color: v.color,
    status: v.status,
    salePriceCents,
    totalInvestedCents: String(totalInvestedCents),
    auctionCostCents,
    transportCostCents: String(v.transportCostCents),
    reconCostCents,
    miscCostCents,
    projectedGrossCents: String(projectedGross),
    listPriceCents: salePriceCents,
    purchasePriceCents: auctionCostCents,
    reconditioningCostCents: reconCostCents,
    otherCostsCents: miscCostCents,
    locationId: v.locationId,
    location: v.location,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}
