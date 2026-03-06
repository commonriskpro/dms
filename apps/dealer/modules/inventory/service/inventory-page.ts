/**
 * Inventory page overview: single service to load KPIs, alerts, health, pipeline, and list.
 * Used by the Inventory page RSC. RBAC: inventory.read required; pipeline requires deals.read or crm.read.
 */
import { z } from "zod";
import * as vehicleDb from "../db/vehicle";
import * as dashboard from "./dashboard";
import * as alerts from "./alerts";
import * as dealPipeline from "@/modules/deals/service/deal-pipeline";
import * as priceToMarket from "./price-to-market";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

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
  year: number | null;
  make: string | null;
  model: string | null;
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
  const offset = (query.page - 1) * query.pageSize;
  const hasPipeline =
    ctx.permissions.includes("deals.read") || ctx.permissions.includes("crm.read");

  const filters: vehicleDb.VehicleListFilters = {};
  if (query.status) filters.status = query.status;
  if (query.locationId) filters.locationId = query.locationId;
  if (query.search?.trim()) filters.search = query.search.trim();
  if (query.minPrice != null) filters.minPrice = BigInt(query.minPrice);
  if (query.maxPrice != null) filters.maxPrice = BigInt(query.maxPrice);

  const [
    kpisResult,
    healthResult,
    alertsResult,
    pipelineResult,
    listResult,
    floorPlannedCount,
    previouslySoldCount,
  ] = await Promise.all([
    dashboard.getKpis(ctx.dealershipId).catch(() => null),
    dashboard.getAgingBuckets(ctx.dealershipId).catch(() => null),
    alerts
      .getAlertCounts(ctx.dealershipId, ctx.userId, true)
      .catch(() => ({ missingPhotos: 0, stale: 0, reconOverdue: 0 })),
    hasPipeline
      ? dealPipeline.getDealPipeline(ctx.dealershipId).catch(() => DEFAULT_PIPELINE)
      : Promise.resolve(DEFAULT_PIPELINE),
    vehicleDb.listVehicles(ctx.dealershipId, {
      limit: query.pageSize,
      offset,
      filters,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeFloorplan: true,
    }),
    vehicleDb.countFloorPlanned(ctx.dealershipId),
    vehicleDb.countPreviouslySold(ctx.dealershipId),
  ]);

  const kpis: InventoryPageKpis = kpisResult
    ? {
        totalUnits: kpisResult.totalUnits,
        addedThisWeek: kpisResult.delta7d ?? 0,
        inventoryValueCents: kpisResult.inventoryValueCents,
        avgValuePerVehicleCents: kpisResult.avgValueCents,
      }
    : DEFAULT_KPIS;

  const health: InventoryPageHealth = healthResult ?? DEFAULT_HEALTH;

  const alertsOut: InventoryPageAlerts = {
    missingPhotos: alertsResult.missingPhotos,
    over90Days: alertsResult.stale,
    needsRecon: alertsResult.reconOverdue,
  };

  const pipeline: InventoryPagePipeline =
    pipelineResult && hasPipeline
      ? {
          leads: pipelineResult.leads,
          appointments: pipelineResult.appointments,
          workingDeals: pipelineResult.workingDeals,
          pendingFunding: pipelineResult.pendingFunding,
          soldToday: pipelineResult.soldToday,
        }
      : DEFAULT_PIPELINE;

  type RowWithFloorplan = (typeof listResult.data)[number] & {
    floorplan?: { lender: { name: string } } | null;
  };
  const rows = listResult.data as RowWithFloorplan[];
  const priceToMarketMap = await priceToMarket.getPriceToMarketForVehicles(
    ctx.dealershipId,
    rows.map((r) => ({
      id: r.id,
      make: r.make,
      model: r.model,
      salePriceCents: r.salePriceCents,
    }))
  );
  const items: VehicleListItem[] = rows.map((row) => {
    const totalCost =
      Number(row.auctionCostCents) +
      Number(row.transportCostCents) +
      Number(row.reconCostCents) +
      Number(row.miscCostCents);
    const floorPlanLenderName = row.floorplan?.lender?.name ?? null;
    const daysInStock = priceToMarket.computeDaysInStock(row.createdAt);
    const agingBucket = priceToMarket.agingBucketFromDays(daysInStock);
    const turnRiskStatus = priceToMarket.turnRiskStatus(
      daysInStock,
      priceToMarket.DAYS_TO_TURN_TARGET
    );
    const ptm = priceToMarketMap.get(row.id) ?? null;
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
      daysInStock,
      agingBucket,
      turnRiskStatus,
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
    kpis,
    alerts: alertsOut,
    health,
    pipeline,
    list: {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: listResult.total,
    },
    filterChips: {
      floorPlannedCount,
      previouslySoldCount,
    },
  };
}
