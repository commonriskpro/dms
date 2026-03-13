/**
 * Inventory page overview: single service to load KPIs, alerts, health, pipeline, and list.
 * Used by the Inventory page RSC. RBAC: inventory.read required; pipeline requires deals.read or crm.read.
 */
import { z } from "zod";
import * as vehicleDb from "../db/vehicle";
import * as costLedger from "./cost-ledger";
import * as alerts from "./alerts";
import * as dealPipeline from "@/modules/deals/service/deal-pipeline";
import * as priceToMarket from "./price-to-market";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import { logger } from "@/lib/logger";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { enqueueAnalytics } from "@/lib/infrastructure/jobs/enqueueAnalytics";
import * as summarySnapshotDb from "../db/summary-snapshot";

const inventoryOverviewProfileEnabled = process.env.INVENTORY_OVERVIEW_PROFILE === "1";

export const inventoryPageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(["AVAILABLE", "HOLD", "SOLD", "WHOLESALE", "REPAIR", "ARCHIVED"]).optional(),
    search: z.string().optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    locationId: z.string().uuid().optional(),
    sortBy: z
      .enum(["createdAt", "salePriceCents", "mileage", "stockNumber", "updatedAt"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    over90Only: z.coerce.boolean().optional(),
    missingPhotosOnly: z.coerce.boolean().optional(),
    floorPlannedOnly: z.coerce.boolean().optional(),
  })
  .refine(
    (q) => q.minPrice == null || q.maxPrice == null || q.minPrice <= q.maxPrice,
    { message: "minPrice must be less than or equal to maxPrice", path: ["maxPrice"] }
  );

export type InventoryPageQuery = z.infer<typeof inventoryPageQuerySchema>;

export type InventoryPageContext = {
  dealershipId: string;
  userId: string;
  permissions: string[];
};

export type InventoryPageKpis = {
  totalUnits: number;
  addedThisWeek: number;
  inventoryValueCents: number;
  avgValuePerVehicleCents: number;
};

export type InventoryPageAlerts = {
  missingPhotos: number;
  over90Days: number;
  needsRecon: number;
};

export type InventoryPageHealth = {
  lt30: number;
  d30to60: number;
  d60to90: number;
  gt90: number;
};

export type InventoryPagePipeline = {
  leads: number;
  appointments: number;
  workingDeals: number;
  pendingFunding: number;
  soldToday: number;
};

export type VehicleListPriceToMarket = {
  marketStatus: string;
  marketDeltaCents: number | null;
  marketDeltaPercent: number | null;
  sourceLabel: string;
};

export type VehicleListItem = {
  id: string;
  stockNumber: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  status: string;
  salePriceCents: number;
  costCents: number;
  floorPlanLenderName: string | null;
  createdAt: string;
  source: string | null;
  daysInStock: number | null;
  agingBucket: string | null;
  turnRiskStatus: string;
  priceToMarket: VehicleListPriceToMarket | null;
  primaryPhotoFileId: string | null;
};

export type InventoryPageOverview = {
  kpis: InventoryPageKpis;
  alerts: InventoryPageAlerts;
  health: InventoryPageHealth;
  pipeline: InventoryPagePipeline;
  list: {
    items: VehicleListItem[];
    page: number;
    pageSize: number;
    total: number;
  };
  filterChips: {
    floorPlannedCount: number;
    previouslySoldCount: number;
  };
};

const DEFAULT_KPIS: InventoryPageKpis = {
  totalUnits: 0,
  addedThisWeek: 0,
  inventoryValueCents: 0,
  avgValuePerVehicleCents: 0,
};

const DEFAULT_ALERTS: InventoryPageAlerts = {
  missingPhotos: 0,
  over90Days: 0,
  needsRecon: 0,
};

const DEFAULT_HEALTH: InventoryPageHealth = {
  lt30: 0,
  d30to60: 0,
  d60to90: 0,
  gt90: 0,
};

const DEFAULT_PIPELINE: InventoryPagePipeline = {
  leads: 0,
  appointments: 0,
  workingDeals: 0,
  pendingFunding: 0,
  soldToday: 0,
};

type InventoryOverviewSummary = {
  kpis: InventoryPageKpis;
  alerts: InventoryPageAlerts;
  health: InventoryPageHealth;
  pipeline: InventoryPagePipeline;
  filterChips: {
    floorPlannedCount: number;
    previouslySoldCount: number;
  };
};

type InventoryListWarmCacheDto = {
  total: number;
  items: VehicleListItem[];
};

type InventoryListLiveResult = InventoryListWarmCacheDto & {
  enrichmentMs: number;
  vehicleListQueryBreakdownMs?: {
    findManyMs: number;
    countMs: number;
  };
};

const INVENTORY_OVERVIEW_SUMMARY_TTL_SECONDS = 30;
const INVENTORY_OVERVIEW_SNAPSHOT_FRESH_MS = 30_000;
const INVENTORY_OVERVIEW_SNAPSHOT_MAX_STALE_MS = 5 * 60_000;
const INVENTORY_DEFAULT_LIST_WARM_CACHE_TTL_SECONDS = 10;

function inventoryOverviewSummaryKey(
  dealershipId: string,
  userId: string,
  hasPipeline: boolean
): string {
  return `inventory:overview:summary:${dealershipId}:${userId}:pipeline:${hasPipeline ? "1" : "0"}`;
}

function inventoryDefaultListWarmCacheKey(
  dealershipId: string,
  userId: string
): string {
  return `inventory:overview:default-list:v2:${dealershipId}:${userId}`;
}

function isDefaultFirstPageInventoryQuery(query: InventoryPageQuery): boolean {
  return (
    query.page === 1 &&
    query.pageSize === 25 &&
    query.sortBy === "createdAt" &&
    query.sortOrder === "desc" &&
    query.status == null &&
    !query.search?.trim() &&
    query.minPrice == null &&
    query.maxPrice == null &&
    query.locationId == null &&
    query.over90Only !== true &&
    query.missingPhotosOnly !== true &&
    query.floorPlannedOnly !== true
  );
}

function coerceInventoryListWarmCache(value: unknown): InventoryListWarmCacheDto | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<InventoryListWarmCacheDto>;
  if (typeof candidate.total !== "number" || !Array.isArray(candidate.items)) {
    return null;
  }
  for (const item of candidate.items) {
    if (!item || typeof item !== "object") return null;
    const listItem = item as Partial<VehicleListItem>;
    if (typeof listItem.id !== "string" || typeof listItem.stockNumber !== "string") {
      return null;
    }
  }
  return candidate as InventoryListWarmCacheDto;
}

async function computeInventoryOverviewSummary(
  ctx: InventoryPageContext,
  hasPipeline: boolean
): Promise<InventoryOverviewSummary> {
  const vehicleSummaryPromise = vehicleDb.getInventoryOverviewVehicleSummary(ctx.dealershipId);
  const [
    vehicleSummary,
    alertsResult,
    pipelineResult,
    floorPlannedCount,
  ] = await Promise.all([
    vehicleSummaryPromise.catch(() => null),
    alerts
      .getAlertCounts(ctx.dealershipId, ctx.userId, true, {
        skipTenantCheck: true,
      })
      .catch(() => ({ missingPhotos: 0, stale: 0, reconOverdue: 0 })),
    hasPipeline
      ? dealPipeline
          .getDealPipeline(ctx.dealershipId, { skipTenantCheck: true })
          .catch(() => DEFAULT_PIPELINE)
      : Promise.resolve(DEFAULT_PIPELINE),
    vehicleDb.countFloorPlanned(ctx.dealershipId).catch(() => 0),
  ]);

  return {
    kpis: vehicleSummary
      ? {
          totalUnits: vehicleSummary.totalUnits,
          addedThisWeek: vehicleSummary.addedThisWeek,
          inventoryValueCents: Number(vehicleSummary.inventoryValueCents),
          avgValuePerVehicleCents:
            vehicleSummary.totalUnits > 0
              ? Number(vehicleSummary.inventoryValueCents / BigInt(vehicleSummary.totalUnits))
              : 0,
        }
      : DEFAULT_KPIS,
    health: vehicleSummary
      ? {
          lt30: vehicleSummary.lt30,
          d30to60: vehicleSummary.d30to60,
          d60to90: vehicleSummary.d60to90,
          gt90: vehicleSummary.gt90,
        }
      : DEFAULT_HEALTH,
    alerts: {
      missingPhotos: alertsResult.missingPhotos,
      over90Days: alertsResult.stale,
      needsRecon: alertsResult.reconOverdue,
    },
    pipeline:
      pipelineResult && hasPipeline
        ? {
            leads: pipelineResult.leads,
            appointments: pipelineResult.appointments,
            workingDeals: pipelineResult.workingDeals,
            pendingFunding: pipelineResult.pendingFunding,
            soldToday: pipelineResult.soldToday,
          }
        : DEFAULT_PIPELINE,
    filterChips: {
      floorPlannedCount,
      previouslySoldCount: vehicleSummary?.previouslySoldCount ?? 0,
    },
  };
}

function coerceOverviewSnapshot(value: unknown): InventoryOverviewSummary | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<InventoryOverviewSummary>;
  if (!candidate.kpis || !candidate.alerts || !candidate.health || !candidate.pipeline || !candidate.filterChips) {
    return null;
  }
  return candidate as InventoryOverviewSummary;
}

async function getInventoryOverviewSummarySnapshotAware(
  ctx: InventoryPageContext,
  hasPipeline: boolean
): Promise<InventoryOverviewSummary> {
  const key = {
    dealershipId: ctx.dealershipId,
    scope: "OVERVIEW" as const,
    userId: ctx.userId,
    hasPipeline,
  };
  const snapshot = await summarySnapshotDb.getSummarySnapshot(key);
  const snapshotValue = coerceOverviewSnapshot(snapshot?.snapshotJson);
  const snapshotAgeMs =
    snapshot?.computedAt != null ? Date.now() - snapshot.computedAt.getTime() : null;

  if (snapshotValue && snapshotAgeMs != null && snapshotAgeMs <= INVENTORY_OVERVIEW_SNAPSHOT_FRESH_MS) {
    return snapshotValue;
  }

  if (snapshotValue && snapshotAgeMs != null && snapshotAgeMs <= INVENTORY_OVERVIEW_SNAPSHOT_MAX_STALE_MS) {
    if (process.env.REDIS_URL) {
      void enqueueAnalytics({
        dealershipId: ctx.dealershipId,
        type: "inventory_summary_snapshot",
        context: {
          scope: "overview",
          userId: ctx.userId,
          hasPipeline,
        },
      });
      return snapshotValue;
    }
  }

  const computed = await computeInventoryOverviewSummary(ctx, hasPipeline);
  await summarySnapshotDb.upsertSummarySnapshot(key, computed);
  return computed;
}

export async function refreshInventoryOverviewSummarySnapshot(params: {
  dealershipId: string;
  userId: string;
  hasPipeline: boolean;
}): Promise<void> {
  const ctx: InventoryPageContext = {
    dealershipId: params.dealershipId,
    userId: params.userId,
    permissions: params.hasPipeline
      ? ["inventory.read", "deals.read"]
      : ["inventory.read"],
  };
  const computed = await computeInventoryOverviewSummary(ctx, params.hasPipeline);
  await summarySnapshotDb.upsertSummarySnapshot(
    {
      dealershipId: params.dealershipId,
      scope: "OVERVIEW",
      userId: params.userId,
      hasPipeline: params.hasPipeline,
    },
    computed
  );
}

async function loadInventoryListFromLiveQuery(params: {
  ctx: InventoryPageContext;
  query: InventoryPageQuery;
  filters: vehicleDb.VehicleListFilters;
  offset: number;
}): Promise<InventoryListLiveResult> {
  const listResult = await vehicleDb.listVehiclesForOverview(params.ctx.dealershipId, {
    limit: params.query.pageSize,
    offset: params.offset,
    filters: params.filters,
    sortBy: params.query.sortBy,
    sortOrder: params.query.sortOrder,
    includeFloorplan: true,
    profileTimings: inventoryOverviewProfileEnabled,
  });

  type RowWithIncludes = (typeof listResult.data)[number] & {
    floorplan?: { lender: { name: string } } | null;
    vehiclePhotos?: Array<{ fileObjectId: string; isPrimary: boolean }>;
  };
  const rows = listResult.data as RowWithIncludes[];
  const vehicleIds = rows.map((r) => r.id);
  const enrichmentStartedAt = Date.now();
  const ptmInput = rows.map((r) => ({
    id: r.id,
    make: r.make,
    model: r.model,
    salePriceCents: r.salePriceCents,
  }));
  const [priceToMarketResult, totalsMap] = await Promise.all([
    priceToMarket.getPriceToMarketForVehiclesWithSnapshots(params.ctx.dealershipId, ptmInput),
    vehicleIds.length > 0
      ? costLedger.getCostTotalsForVehicles(params.ctx.dealershipId, vehicleIds)
      : Promise.resolve(new Map()),
  ]);
  const priceToMarketMap = priceToMarketResult.map;
  const items: VehicleListItem[] = rows.map((row) => {
    const totals = totalsMap.get(row.id);
    const costCents =
      totals != null ? Number(totals.totalInvestedCents) : 0;
    const floorPlanLenderName = row.floorplan?.lender?.name ?? null;
    const daysInStock = priceToMarket.computeDaysInStock(row.createdAt);
    const agingBucket = priceToMarket.agingBucketFromDays(daysInStock);
    const turnRiskStatus = priceToMarket.turnRiskStatus(
      daysInStock,
      priceToMarket.DAYS_TO_TURN_TARGET
    );
    const ptm = priceToMarketMap.get(row.id) ?? null;
    const photos = row.vehiclePhotos ?? [];
    const primaryPhoto = photos.find((p) => p.isPrimary) ?? photos[0] ?? null;
 
    return {
      id: row.id,
      stockNumber: row.stockNumber,
      vin: row.vin,
      year: row.year,
      make: row.make,
      model: row.model,
      mileage: row.mileage,
      status: row.status,
      salePriceCents: Number(row.salePriceCents),
      costCents: costCents,
      floorPlanLenderName,
      createdAt: row.createdAt.toISOString(),
      source: null,
      daysInStock,
      agingBucket,
      turnRiskStatus,
      primaryPhotoFileId: primaryPhoto?.fileObjectId ?? null,
      priceToMarket: ptm
        ? {
            marketStatus: ptm.marketStatus,
            marketDeltaCents: ptm.marketDeltaCents,
            marketDeltaPercent: ptm.marketDeltaPercent,
            sourceLabel: ptm.sourceLabel,
          }
        : null,
    };
  });

  return {
    total: listResult.total,
    enrichmentMs: Date.now() - enrichmentStartedAt,
    vehicleListQueryBreakdownMs: listResult.queryTimingsMs,
    // Explicit DTO projection keeps cache payload JSON-safe (no BigInt/Date objects).
    items: items.map((item) => ({
      ...item,
      priceToMarket: item.priceToMarket
        ? {
            marketStatus: item.priceToMarket.marketStatus,
            marketDeltaCents: item.priceToMarket.marketDeltaCents,
            marketDeltaPercent: item.priceToMarket.marketDeltaPercent,
            sourceLabel: item.priceToMarket.sourceLabel,
          }
        : null,
    })),
  };
}

function toInventoryListWarmCacheDto(value: InventoryListLiveResult): InventoryListWarmCacheDto {
  return {
    total: value.total,
    items: value.items,
  };
}

/**
 * Load full inventory page overview. Requires inventory.read; pipeline uses deals.read or crm.read.
 * Tenant-isolated; all queries scoped by ctx.dealershipId.
 */
export async function getInventoryPageOverview(
  ctx: InventoryPageContext,
  rawQuery: unknown
): Promise<InventoryPageOverview> {
  if (!ctx.permissions.includes("inventory.read")) {
    throw new ApiError("FORBIDDEN", "inventory.read required");
  }
  await requireTenantActiveForRead(ctx.dealershipId);

  const query = inventoryPageQuerySchema.parse(rawQuery);
  const startedAt = Date.now();
  const offset = (query.page - 1) * query.pageSize;
  const hasPipeline =
    ctx.permissions.includes("deals.read") || ctx.permissions.includes("crm.read");

  const filters: vehicleDb.VehicleListFilters = {};
  if (query.status) filters.status = query.status;
  if (query.locationId) filters.locationId = query.locationId;
  if (query.search?.trim()) filters.search = query.search.trim();
  if (query.minPrice != null) filters.minPrice = BigInt(query.minPrice);
  if (query.maxPrice != null) filters.maxPrice = BigInt(query.maxPrice);
  if (query.over90Only) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    filters.createdAtLte = cutoff;
  }
  if (query.missingPhotosOnly) filters.missingPhotosOnly = true;
  if (query.floorPlannedOnly) filters.floorPlannedOnly = true;

  const coreQueriesStartedAt = Date.now();
  const coreBreakdown: Record<string, number> = {};
  let listEnrichmentMs = 0;
  let listQueryBreakdownMs: { findManyMs: number; countMs: number } | undefined;
  const timedCore = async <T>(label: string, loader: () => Promise<T>): Promise<T> => {
    const started = Date.now();
    try {
      return await loader();
    } finally {
      coreBreakdown[label] = Date.now() - started;
    }
  };
  const isDefaultListWarmCacheCandidate = isDefaultFirstPageInventoryQuery(query);
  const [summary, listData] = await Promise.all([
    timedCore("summary", () =>
      withCache(
        inventoryOverviewSummaryKey(ctx.dealershipId, ctx.userId, hasPipeline),
        INVENTORY_OVERVIEW_SUMMARY_TTL_SECONDS,
        () => getInventoryOverviewSummarySnapshotAware(ctx, hasPipeline)
      )
    ),
    isDefaultListWarmCacheCandidate
      ? timedCore("vehicleListWarmCache", async () => {
          const cacheKey = inventoryDefaultListWarmCacheKey(ctx.dealershipId, ctx.userId);
          let cacheHit = true;
          const cachedOrComputed = await withCache(
            cacheKey,
            INVENTORY_DEFAULT_LIST_WARM_CACHE_TTL_SECONDS,
            async () => {
              cacheHit = false;
              const live = await loadInventoryListFromLiveQuery({
                ctx,
                query,
                filters,
                offset,
              });
              listEnrichmentMs = live.enrichmentMs;
              listQueryBreakdownMs = live.vehicleListQueryBreakdownMs;
              return toInventoryListWarmCacheDto(live);
            }
          );
          const coerced = coerceInventoryListWarmCache(cachedOrComputed);
          if (coerced) {
            if (cacheHit) listEnrichmentMs = 0;
            return coerced;
          }
          const live = await loadInventoryListFromLiveQuery({ ctx, query, filters, offset });
          listEnrichmentMs = live.enrichmentMs;
          listQueryBreakdownMs = live.vehicleListQueryBreakdownMs;
          return toInventoryListWarmCacheDto(live);
        })
      : timedCore("vehicleList", () =>
          loadInventoryListFromLiveQuery({ ctx, query, filters, offset }).then((live) => {
            listEnrichmentMs = live.enrichmentMs;
            listQueryBreakdownMs = live.vehicleListQueryBreakdownMs;
            return toInventoryListWarmCacheDto(live);
          })
        ),
  ]);
  const coreQueriesMs = Date.now() - coreQueriesStartedAt;
  const enrichmentMs = listEnrichmentMs;
  const items = listData.items;

  const result: InventoryPageOverview = {
    kpis: summary.kpis,
    alerts: summary.alerts,
    health: summary.health,
    pipeline: summary.pipeline,
    list: {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: listData.total,
    },
    filterChips: summary.filterChips,
  };

  if (inventoryOverviewProfileEnabled) {
    logger.debug("inventory.page_overview.profile", {
      dealershipIdTail: ctx.dealershipId.slice(-6),
      page: query.page,
      pageSize: query.pageSize,
      listTotal: listData.total,
      listedRows: items.length,
      hasPipeline,
      defaultListWarmCacheCandidate: isDefaultListWarmCacheCandidate,
      coreQueriesMs,
      coreBreakdown,
      vehicleListQueryBreakdownMs: listQueryBreakdownMs,
      enrichmentMs,
      totalMs: Date.now() - startedAt,
    });
  }

  return result;
}
