/**
 * Per-vehicle price-to-market intelligence.
 * Uses internal comps (same make/model) or book value retail; honest "No Market Data" when unavailable.
 * Internal comps-by-make-model result is cached per dealership (TTL 25s) for list performance.
 */
import * as vehicleDb from "../db/vehicle";
import * as bookValuesDb from "../db/book-values";
import * as vehicleMarketValuationDb from "../db/vehicle-market-valuation";
import { createTtlCache } from "@/modules/core/cache/ttl-cache";

const INTERNAL_COMPS_CACHE_TTL_MS = 25_000;
const internalCompsCache = createTtlCache<Map<string, number>>({
  ttlMs: INTERNAL_COMPS_CACHE_TTL_MS,
  maxEntries: 500,
});
const valuationPresenceCache = createTtlCache<boolean>({
  ttlMs: 60_000,
  maxEntries: 500,
});

const PRICE_TO_MARKET_THRESHOLD_PCT = 0.02;

export const DAYS_TO_TURN_TARGET = 45;

export type TurnRiskStatus = "good" | "warn" | "bad" | "na";

export type AgingBucket = "<30" | "30-60" | "60-90" | ">90";

export function computeDaysInStock(createdAt: Date | null): number | null {
  if (!createdAt) return null;
  return Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
}

export function agingBucketFromDays(days: number | null): AgingBucket | null {
  if (days == null) return null;
  if (days < 30) return "<30";
  if (days < 60) return "30-60";
  if (days < 90) return "60-90";
  return ">90";
}

export function turnRiskStatus(
  daysInStock: number | null,
  targetDays: number = DAYS_TO_TURN_TARGET
): TurnRiskStatus {
  if (daysInStock == null) return "na";
  if (daysInStock <= targetDays) return "good";
  if (daysInStock <= targetDays * 1.5) return "warn";
  return "bad";
}

export type MarketStatus =
  | "Below Market"
  | "At Market"
  | "Above Market"
  | "No Market Data";

export type PriceToMarketResult = {
  marketStatus: MarketStatus;
  marketDeltaCents: number | null;
  marketDeltaPercent: number | null;
  sourceLabel: string;
};

function statusFromDeltaPct(deltaPct: number | null): MarketStatus {
  if (deltaPct == null) return "No Market Data";
  if (deltaPct < -PRICE_TO_MARKET_THRESHOLD_PCT) return "Below Market";
  if (deltaPct <= PRICE_TO_MARKET_THRESHOLD_PCT) return "At Market";
  return "Above Market";
}

/**
 * Returns price-to-market for a single vehicle.
 * Baseline order: internal comps (same make/model) then book value retail; otherwise No Market Data.
 */
export async function getPriceToMarketForVehicle(
  dealershipId: string,
  vehicleId: string,
  vehicle: {
    make: string | null;
    model: string | null;
    salePriceCents: bigint | number;
  }
): Promise<PriceToMarketResult> {
  const priceCents = Number(vehicle.salePriceCents);
  if (priceCents <= 0) {
    return {
      marketStatus: "No Market Data",
      marketDeltaCents: null,
      marketDeltaPercent: null,
      sourceLabel: "No data",
    };
  }

  const internalAvg = await vehicleDb.getInternalCompsAvgCentsForMakeModel(
    dealershipId,
    vehicle.make,
    vehicle.model
  );
  if (internalAvg != null && internalAvg > 0) {
    const deltaCents = priceCents - internalAvg;
    const deltaPct = deltaCents / internalAvg;
    return {
      marketStatus: statusFromDeltaPct(deltaPct),
      marketDeltaCents: deltaCents,
      marketDeltaPercent: Math.round(deltaPct * 1000) / 10,
      sourceLabel: "Internal comps",
    };
  }

  const bookRow = await bookValuesDb.getByVehicleId(dealershipId, vehicleId);
  const retailCents = bookRow?.retailCents ?? null;
  if (retailCents != null && retailCents > 0) {
    const deltaCents = priceCents - retailCents;
    const deltaPct = deltaCents / retailCents;
    return {
      marketStatus: statusFromDeltaPct(deltaPct),
      marketDeltaCents: deltaCents,
      marketDeltaPercent: Math.round(deltaPct * 1000) / 10,
      sourceLabel: "Book value",
    };
  }

  return {
    marketStatus: "No Market Data",
    marketDeltaCents: null,
    marketDeltaPercent: null,
    sourceLabel: "No data",
  };
}

export type VehicleForPriceToMarket = {
  id: string;
  make: string | null;
  model: string | null;
  salePriceCents: bigint | number;
};

/**
 * Reads precomputed valuation snapshots and maps them to list price-to-market shape.
 * Returns both computed map and vehicles still missing snapshot-backed data.
 */
export async function getPriceToMarketFromValuationSnapshots(
  dealershipId: string,
  vehicles: VehicleForPriceToMarket[]
): Promise<{
  map: Map<string, PriceToMarketResult>;
  missingVehicles: VehicleForPriceToMarket[];
}> {
  const valuationPresenceKey = `inventory:valuation-presence:${dealershipId}`;
  let hasAnyValuation = valuationPresenceCache.get(valuationPresenceKey);
  if (hasAnyValuation === undefined) {
    hasAnyValuation = await vehicleMarketValuationDb.hasAnyVehicleMarketValuation(dealershipId);
    valuationPresenceCache.set(valuationPresenceKey, hasAnyValuation);
  }
  if (!hasAnyValuation) {
    return { map: new Map(), missingVehicles: vehicles };
  }
  const valuations =
    await vehicleMarketValuationDb.getLatestVehicleMarketValuationsForVehicles(
      dealershipId,
      vehicles.map((v) => v.id)
    );
  const map = new Map<string, PriceToMarketResult>();
  const missingVehicles: VehicleForPriceToMarket[] = [];
  for (const vehicle of vehicles) {
    const valuation = valuations.get(vehicle.id);
    const marketAverageCents = valuation?.marketAverageCents ?? null;
    const priceCents = Number(vehicle.salePriceCents);
    if (!valuation || marketAverageCents == null || marketAverageCents <= 0 || priceCents <= 0) {
      missingVehicles.push(vehicle);
      continue;
    }
    const deltaCents = priceCents - marketAverageCents;
    const deltaPctRaw = deltaCents / marketAverageCents;
    map.set(vehicle.id, {
      marketStatus: statusFromDeltaPct(deltaPctRaw),
      marketDeltaCents: deltaCents,
      marketDeltaPercent: Math.round(deltaPctRaw * 1000) / 10,
      sourceLabel: "Valuation snapshot",
    });
  }
  return { map, missingVehicles };
}

/**
 * Consolidated list helper: prefer snapshot-backed rows, then fill remaining rows from live compute.
 */
export async function getPriceToMarketForVehiclesWithSnapshots(
  dealershipId: string,
  vehicles: VehicleForPriceToMarket[]
): Promise<{
  map: Map<string, PriceToMarketResult>;
  snapshotCount: number;
  fallbackCount: number;
}> {
  const snapshotResult = await getPriceToMarketFromValuationSnapshots(dealershipId, vehicles);
  const fallbackMap =
    snapshotResult.missingVehicles.length > 0
      ? await getPriceToMarketForVehicles(dealershipId, snapshotResult.missingVehicles)
      : new Map<string, PriceToMarketResult>();
  return {
    map: new Map<string, PriceToMarketResult>([
      ...snapshotResult.map,
      ...fallbackMap,
    ]),
    snapshotCount: snapshotResult.map.size,
    fallbackCount: fallbackMap.size,
  };
}

/**
 * Batch price-to-market for list. Fetches retail map and internal comps by make/model once.
 * Internal comps result is cached per dealership (TTL 25s); cache key includes dealershipId for tenant safety.
 */
export async function getPriceToMarketForVehicles(
  dealershipId: string,
  vehicles: VehicleForPriceToMarket[]
): Promise<Map<string, PriceToMarketResult>> {
  const makeModelKeys = [
    ...new Set(
      vehicles
        .map((vehicle) => vehicleDb.makeModelKey(vehicle.make, vehicle.model))
        .filter((key) => key && key !== "|")
    ),
  ];
  const cacheKey = `inventory:comps:${dealershipId}:${makeModelKeys.slice().sort().join(",")}`;
  let compsByMakeModel = internalCompsCache.get(cacheKey);
  if (compsByMakeModel === undefined) {
    compsByMakeModel =
      makeModelKeys.length > 0
        ? await vehicleDb.getInternalCompsAvgCentsByMakeModelKeys(dealershipId, makeModelKeys)
        : new Map<string, number>();
    internalCompsCache.set(cacheKey, compsByMakeModel);
  }
  const retailMap = await bookValuesDb.getRetailCentsMapForVehicleIds(
    dealershipId,
    vehicles.map((vehicle) => vehicle.id)
  );
  const out = new Map<string, PriceToMarketResult>();
  for (const v of vehicles) {
    const priceCents = Number(v.salePriceCents);
    if (priceCents <= 0) {
      out.set(v.id, {
        marketStatus: "No Market Data",
        marketDeltaCents: null,
        marketDeltaPercent: null,
        sourceLabel: "No data",
      });
      continue;
    }
    const key = vehicleDb.makeModelKey(v.make, v.model);
    const internalAvg = key && key !== "|" ? compsByMakeModel.get(key) ?? null : null;
    if (internalAvg != null && internalAvg > 0) {
      const deltaCents = priceCents - internalAvg;
      const deltaPct = deltaCents / internalAvg;
      out.set(v.id, {
        marketStatus: statusFromDeltaPct(deltaPct),
        marketDeltaCents: deltaCents,
        marketDeltaPercent: Math.round(deltaPct * 1000) / 10,
        sourceLabel: "Internal comps",
      });
      continue;
    }
    const retailCents = retailMap.get(v.id) ?? null;
    if (retailCents != null && retailCents > 0) {
      const deltaCents = priceCents - retailCents;
      const deltaPct = deltaCents / retailCents;
      out.set(v.id, {
        marketStatus: statusFromDeltaPct(deltaPct),
        marketDeltaCents: deltaCents,
        marketDeltaPercent: Math.round(deltaPct * 1000) / 10,
        sourceLabel: "Book value",
      });
      continue;
    }
    out.set(v.id, {
      marketStatus: "No Market Data",
      marketDeltaCents: null,
      marketDeltaPercent: null,
      sourceLabel: "No data",
    });
  }
  return out;
}
