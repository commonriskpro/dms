/**
 * Vehicle API response shape. Used by GET /api/inventory and GET /api/inventory/[id].
 * BigInt cents as source of truth.
 * @deprecated Aliases listPriceCents, purchasePriceCents, reconditioningCostCents, otherCostsCents — scheduled for removal after UI Step 3.
 */
import { projectedGrossCents } from "./service/vehicle";

export type VehicleResponseInput = {
  id: string;
  dealershipId: string;
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

export function toVehicleResponse(v: VehicleResponseInput): Record<string, unknown> {
  const projectedGross = projectedGrossCents(v);
  const salePriceCents = String(v.salePriceCents);
  const auctionCostCents = String(v.auctionCostCents);
  const reconCostCents = String(v.reconCostCents);
  const miscCostCents = String(v.miscCostCents);
  return {
    id: v.id,
    dealershipId: v.dealershipId,
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
