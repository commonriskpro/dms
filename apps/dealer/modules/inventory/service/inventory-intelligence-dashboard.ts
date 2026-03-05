/**
 * Inventory Intelligence Dashboard: single service returning KPIs, intelligence metrics,
 * alert center, and paginated list. RBAC: inventory.read required. Tenant-isolated.
 * Service validates query and throws INVALID_QUERY on invalid input. Aggregates cached briefly (list not cached).
 */
import { z } from "zod";
import * as vehicleDb from "../db/vehicle";
import * as bookValuesDb from "../db/book-values";
import * as floorplanLoanDb from "../db/floorplan-loan";
import * as alerts from "./alerts";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import {
  createTtlCache,
  INVENTORY_DASHBOARD_AGGREGATE_TTL_MS,
} from "@/modules/core/cache/ttl-cache";
import type { VehicleListItem } from "./inventory-page";

const DAYS_TO_TURN_TARGET = 45;
const PRICE_TO_MARKET_THRESHOLD_PCT = 0.02;
const PRICE_OVER_MARKET_ALERT_PCT = 0.05;

const SEVERITY_RANK: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const inventoryDashboardQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    status: z
      .enum(["AVAILABLE", "HOLD", "SOLD", "WHOLESALE", "REPAIR", "ARCHIVED"])
      .optional(),
    search: z.string().optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    locationId: z.string().uuid().optional(),
    sortBy: z
      .enum(["createdAt", "salePriceCents", "mileage", "stockNumber", "updatedAt"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    alertType: z
      .enum([
        "MISSING_PHOTOS",
        "STALE",
        "RECON_OVERDUE",
        "PRICE_OVER_MARKET",
        "FLOORPLAN_OVERDUE",
      ])
      .optional(),
    floorplanOverdue: z.coerce.number().int().min(0).max(1).optional(),
  })
  .refine(
    (q) => q.minPrice == null || q.maxPrice == null || q.minPrice <= q.maxPrice,
    { message: "minPrice must be less than or equal to maxPrice", path: ["maxPrice"] }
  );

export type InventoryDashboardQuery = z.infer<typeof inventoryDashboardQuerySchema>;

export type InventoryIntelligenceDashboardContext = {
  dealershipId: string;
  userId: string;
  permissions: string[];
};

export type DaysToTurnKpi = {
  valueDays: number | null;
  targetDays: number;
  status: "good" | "warn" | "bad" | "na";
};

export type DemandScoreKpi = {
  score: number | null;
  label: "High" | "Medium" | "Low" | "NA";
  supplyLabel?: string;
};

export type PriceToMarket = {
  vehiclePriceCents: number | null;
  marketAvgCents: number | null;
  deltaPct: number | null;
  label: "Below Market" | "At Market" | "Above Market" | "NA";
};

export type TurnPerformance = {
  avgDaysToSell: number | null;
  agingBucketsPct: {
    lt30: number;
    d30to60: number;
    d60to90: number;
    gt90: number;
  };
};

export type AlertCenterItem = {
  key:
    | "price_over_market"
    | "aged_vehicle"
    | "missing_photos"
    | "recon_needed"
    | "floorplan_overdue"
    | "none";
  title: string;
  recommendation?: string;
  count: number;
  severity: "low" | "medium" | "high";
  hrefQuery: Record<string, string>;
};

export type InventoryIntelligenceDashboardResult = {
  kpis: {
    totalUnits: number;
    inventoryValueCents: number;
    avgValuePerVehicleCents: number;
    daysToTurn: DaysToTurnKpi;
    demandScore: DemandScoreKpi;
  };
  intelligence: {
    priceToMarket: PriceToMarket;
    turnPerformance: TurnPerformance;
    alertCenter: AlertCenterItem[];
  };
  list: {
    items: VehicleListItem[];
    page: number;
    pageSize: number;
    total: number;
  };
};

type CachedAggregates = {
  kpis: InventoryIntelligenceDashboardResult["kpis"];
  intelligence: Omit<InventoryIntelligenceDashboardResult["intelligence"], "alertCenter"> & {
    alertCenter: AlertCenterItem[];
  };
};

const aggregateCache = createTtlCache<CachedAggregates>({
  ttlMs: INVENTORY_DASHBOARD_AGGREGATE_TTL_MS,
  maxEntries: 500,
});

function computeDaysToTurnStatus(
  valueDays: number | null,
  targetDays: number
): DaysToTurnKpi["status"] {
  if (valueDays == null) return "na";
  if (valueDays <= targetDays) return "good";
  if (valueDays <= targetDays * 1.5) return "warn";
  return "bad";
}

function priceToMarketLabel(deltaPct: number | null): PriceToMarket["label"] {
  if (deltaPct == null) return "NA";
  if (deltaPct < -PRICE_TO_MARKET_THRESHOLD_PCT) return "Below Market";
  if (deltaPct <= PRICE_TO_MARKET_THRESHOLD_PCT) return "At Market";
  return "Above Market";
}

function buildAlertCenter(
  alertCounts: { missingPhotos: number; stale: number; reconOverdue: number },
  floorplanOverdueCount: number,
  totalUnitsCount: number,
  priceDeltaPct: number | null
): AlertCenterItem[] {
  const raw: AlertCenterItem[] = [
    {
      key: "missing_photos",
      title: "Missing Photos",
      recommendation: "Add photos to improve listing visibility.",
      count: alertCounts.missingPhotos,
      severity: alertCounts.missingPhotos > 0 ? "medium" : "low",
      hrefQuery: { alertType: "MISSING_PHOTOS" },
    },
    {
      key: "aged_vehicle",
      title: "Units > 90 Days",
      recommendation: "Review pricing or promote aged inventory.",
      count: alertCounts.stale,
      severity: alertCounts.stale > 0 ? "high" : "low",
      hrefQuery: { alertType: "STALE" },
    },
    {
      key: "recon_needed",
      title: "Units Need Recon",
      recommendation: "Complete recon to list vehicles.",
      count: alertCounts.reconOverdue,
      severity: alertCounts.reconOverdue > 0 ? "medium" : "low",
      hrefQuery: { alertType: "RECON_OVERDUE" },
    },
    {
      key: "floorplan_overdue",
      title: "Floor Plan Overdue",
      recommendation: "Review curtailment dates and pay down if needed.",
      count: floorplanOverdueCount,
      severity: floorplanOverdueCount > 0 ? "high" : "low",
      hrefQuery: { floorplanOverdue: "1" },
    },
  ];

  if (
    priceDeltaPct != null &&
    priceDeltaPct > PRICE_OVER_MARKET_ALERT_PCT &&
    totalUnitsCount > 0
  ) {
    raw.push({
      key: "price_over_market",
      title: "Price Above Market",
      recommendation: "Consider reducing price to align with market.",
      count: totalUnitsCount,
      severity: "medium",
      hrefQuery: { alertType: "PRICE_OVER_MARKET" },
    });
  }

  const withCount = raw.filter((a) => a.count > 0);
  if (withCount.length === 0) {
    return [
      {
        key: "none",
        title: "No active alerts",
        count: 0,
        severity: "low",
        hrefQuery: {},
      },
    ];
  }
  withCount.sort((a, b) => {
    const rankA = SEVERITY_RANK[a.severity];
    const rankB = SEVERITY_RANK[b.severity];
    if (rankA !== rankB) return rankA - rankB;
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });
  return withCount;
}

/**
 * Returns full dashboard payload. Enforces inventory.read; all data scoped by ctx.dealershipId.
 * Validates query in service; throws ApiError("INVALID_QUERY", ...) on invalid input.
 * Aggregates (kpis + intelligence) are cached per dealership; list is never cached.
 */
export async function getInventoryIntelligenceDashboard(
  ctx: InventoryIntelligenceDashboardContext,
  rawQuery: unknown
): Promise<InventoryIntelligenceDashboardResult> {
  if (!ctx.permissions.includes("inventory.read")) {
    throw new ApiError("FORBIDDEN", "inventory.read required");
  }
  await requireTenantActiveForRead(ctx.dealershipId);

  const parsed = inventoryDashboardQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    throw new ApiError("INVALID_QUERY", "Invalid query", { fieldErrors });
  }
  const query = parsed.data;
  const offset = (query.page - 1) * query.pageSize;

  const cacheKey = `inventory:intel-dashboard:${ctx.dealershipId}`;
  let cached = aggregateCache.get(cacheKey);

  if (cached) {
    const listResult = await vehicleDb.listVehicles(ctx.dealershipId, {
      limit: query.pageSize,
      offset,
      filters: buildListFilters(query),
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeFloorplan: true,
    });
    const items = mapListToItems(listResult.data);
    return {
      kpis: cached.kpis,
      intelligence: cached.intelligence,
      list: {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total: listResult.total,
      },
    };
  }

  const [
    kpiAggregates,
    agingBuckets,
    vehicleCosts,
    retailMap,
    alertCounts,
    floorplanOverdueCount,
    listResult,
    totalUnitsCount,
    internalCompsAvgCents,
  ] = await Promise.all([
    vehicleDb.getVehicleKpiAggregates(ctx.dealershipId),
    vehicleDb.countByAgingBuckets(ctx.dealershipId),
    vehicleDb.getNonSoldVehicleCosts(ctx.dealershipId),
    bookValuesDb.getRetailCentsMap(ctx.dealershipId),
    alerts.getAlertCounts(ctx.dealershipId, ctx.userId, true),
    floorplanLoanDb.countOverdue(ctx.dealershipId),
    vehicleDb.listVehicles(ctx.dealershipId, {
      limit: query.pageSize,
      offset,
      filters: buildListFilters(query),
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeFloorplan: true,
    }),
    vehicleDb.countVehicles(ctx.dealershipId),
    vehicleDb.getFleetInternalCompsAvgCents(ctx.dealershipId),
  ]);

  const inventoryValueCents = computeInventoryValueCents(vehicleCosts, retailMap);
  const avgValuePerVehicleCents =
    totalUnitsCount > 0 ? Math.round(inventoryValueCents / totalUnitsCount) : 0;

  let bookValueBaseline: number | null = null;
  if (retailMap.size > 0) {
    let sum = 0;
    for (const v of retailMap.values()) sum += v;
    bookValueBaseline = Math.round(sum / retailMap.size);
  }
  const avgCostFallback =
    totalUnitsCount > 0 ? Math.round(inventoryValueCents / totalUnitsCount) : null;
  const marketAvgCents =
    internalCompsAvgCents ?? bookValueBaseline ?? avgCostFallback ?? null;

  const fleetSalePriceCents =
    kpiAggregates.inventoryValueCents > 0
      ? Number(kpiAggregates.inventoryValueCents)
      : null;
  const priceDeltaPct =
    marketAvgCents != null &&
    marketAvgCents > 0 &&
    fleetSalePriceCents != null
      ? (fleetSalePriceCents - marketAvgCents) / marketAvgCents
      : null;

  const totalAging =
    agingBuckets.lt30 + agingBuckets.d30to60 + agingBuckets.d60to90 + agingBuckets.gt90;
  const agingBucketsPct =
    totalAging > 0
      ? {
          lt30: Math.round((agingBuckets.lt30 / totalAging) * 1000) / 10,
          d30to60: Math.round((agingBuckets.d30to60 / totalAging) * 1000) / 10,
          d60to90: Math.round((agingBuckets.d60to90 / totalAging) * 1000) / 10,
          gt90: Math.round((agingBuckets.gt90 / totalAging) * 1000) / 10,
        }
      : { lt30: 0, d30to60: 0, d60to90: 0, gt90: 0 };

  const daysToTurnValueDays = null;
  const daysToTurn: DaysToTurnKpi = {
    valueDays: daysToTurnValueDays,
    targetDays: DAYS_TO_TURN_TARGET,
    status: computeDaysToTurnStatus(daysToTurnValueDays, DAYS_TO_TURN_TARGET),
  };

  const demandScore: DemandScoreKpi = {
    score: null,
    label: "NA",
  };

  const alertCenter = buildAlertCenter(
    alertCounts,
    floorplanOverdueCount,
    totalUnitsCount,
    priceDeltaPct
  );

  const kpis: InventoryIntelligenceDashboardResult["kpis"] = {
    totalUnits: kpiAggregates.totalUnits,
    inventoryValueCents,
    avgValuePerVehicleCents,
    daysToTurn,
    demandScore,
  };
  const intelligence: InventoryIntelligenceDashboardResult["intelligence"] = {
    priceToMarket: {
      vehiclePriceCents: fleetSalePriceCents,
      marketAvgCents,
      deltaPct: priceDeltaPct,
      label: priceToMarketLabel(priceDeltaPct),
    },
    turnPerformance: {
      avgDaysToSell: null,
      agingBucketsPct,
    },
    alertCenter,
  };

  aggregateCache.set(cacheKey, { kpis, intelligence });

  const items = mapListToItems(listResult.data);

  return {
    kpis,
    intelligence,
    list: {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: listResult.total,
    },
  };
}

type RowWithFloorplan = (Awaited<ReturnType<typeof vehicleDb.listVehicles>>["data"][number]) & {
  floorplan?: { lender: { name: string } } | null;
};

function mapListToItems(
  data: Awaited<ReturnType<typeof vehicleDb.listVehicles>>["data"]
): VehicleListItem[] {
  return (data as RowWithFloorplan[]).map((row) => {
    const totalCost =
      Number(row.auctionCostCents) +
      Number(row.transportCostCents) +
      Number(row.reconCostCents) +
      Number(row.miscCostCents);
    const floorPlanLenderName = row.floorplan?.lender?.name ?? null;
    return {
      id: row.id,
      stockNumber: row.stockNumber,
      year: row.year,
      make: row.make,
      model: row.model,
      status: row.status,
      salePriceCents: Number(row.salePriceCents),
      costCents: totalCost,
      floorPlanLenderName,
      createdAt: row.createdAt.toISOString(),
      source: null,
    };
  });
}

function computeInventoryValueCents(
  vehicleCosts: { vehicleId: string; costCents: number }[],
  retailMap: Map<string, number>
): number {
  let sum = 0;
  for (const v of vehicleCosts) {
    sum += retailMap.get(v.vehicleId) ?? v.costCents;
  }
  return sum;
}

function buildListFilters(
  query: InventoryDashboardQuery
): vehicleDb.VehicleListFilters {
  const filters: vehicleDb.VehicleListFilters = {};
  if (query.status) filters.status = query.status;
  if (query.locationId) filters.locationId = query.locationId;
  if (query.search?.trim()) filters.search = query.search.trim();
  if (query.minPrice != null) filters.minPrice = BigInt(query.minPrice);
  if (query.maxPrice != null) filters.maxPrice = BigInt(query.maxPrice);
  if (query.alertType === "STALE") {
    const now = new Date();
    const t90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    (filters as { createdAtLte?: Date }).createdAtLte = t90;
  }
  return filters;
}

/** Only for tests: clear aggregate cache. */
export function clearDashboardAggregateCacheForTesting(): void {
  aggregateCache.clear();
}
