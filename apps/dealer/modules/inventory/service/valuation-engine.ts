/**
 * Vehicle valuation engine: book values, price-to-market, vehicle age, dealer margin.
 * Stores snapshot in VehicleMarketValuation.
 */
import * as vehicleDb from "../db/vehicle";
import * as bookValuesDb from "../db/book-values";
import * as vehicleMarketValuationDb from "../db/vehicle-market-valuation";
import { getPriceToMarketForVehicle } from "./price-to-market";
import { computeDaysInStock } from "./price-to-market";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export async function getVehicleValuation(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  return vehicleMarketValuationDb.getLatestVehicleMarketValuation(dealershipId, vehicleId);
}

/** Calculate and persist market valuation snapshot for a vehicle. */
export async function calculateVehicleValuation(dealershipId: string, vehicleId: string) {
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");

  const bookValue = await bookValuesDb.getByVehicleId(dealershipId, vehicleId);
  const retailCents = bookValue?.retailCents ?? null;
  const wholesaleCents = bookValue?.wholesaleCents ?? null;

  const ptm = await getPriceToMarketForVehicle(dealershipId, vehicleId, {
    make: vehicle.make,
    model: vehicle.model,
    salePriceCents: vehicle.salePriceCents,
  });

  const marketAverageCents = retailCents ?? Number(vehicle.salePriceCents);
  const marketLowestCents = Math.floor(marketAverageCents * 0.92);
  const marketHighestCents = Math.ceil(marketAverageCents * 1.08);
  const recommendedRetailCents = retailCents ?? marketAverageCents;
  const recommendedWholesaleCents = wholesaleCents ?? Math.floor(marketAverageCents * 0.88);

  const priceToMarketPercent =
    ptm.marketDeltaPercent != null ? (1 + ptm.marketDeltaPercent) * 100 : null;
  const daysInStock = computeDaysInStock(vehicle.createdAt);

  return vehicleMarketValuationDb.createVehicleMarketValuation(dealershipId, {
    vehicleId,
    marketAverageCents,
    marketLowestCents,
    marketHighestCents,
    recommendedRetailCents,
    recommendedWholesaleCents,
    priceToMarketPercent,
    marketDaysSupply: daysInStock,
  });
}

export async function recalculateVehicleValuation(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  return calculateVehicleValuation(dealershipId, vehicleId);
}
