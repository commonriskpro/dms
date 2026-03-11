import { prisma } from "@/lib/db";
import type { VehicleStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { paginatedQuery } from "@/lib/db/paginate";

export const VEHICLE_STATUSES: VehicleStatus[] = [
  "AVAILABLE",
  "HOLD",
  "SOLD",
  "WHOLESALE",
  "REPAIR",
  "ARCHIVED",
];

export type VehicleListFilters = {
  status?: VehicleStatus;
  locationId?: string;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  stockNumber?: string;
  minPrice?: bigint;
  maxPrice?: bigint;
  search?: string;
  /** For aging/STALE filter: vehicles created on or before this date (e.g. >90 days old). */
  createdAtLte?: Date;
  /** Only vehicles with no non-deleted photos (missing photos alert). */
  missingPhotosOnly?: boolean;
  /** Only vehicles that have a floorplan. */
  floorPlannedOnly?: boolean;
};

export type VehicleSortBy =
  | "createdAt"
  | "salePriceCents"
  | "mileage"
  | "stockNumber"
  | "updatedAt";

export type VehicleListOptions = {
  limit: number;
  offset: number;
  filters?: VehicleListFilters;
  sortBy?: VehicleSortBy;
  sortOrder?: "asc" | "desc";
  /** When true, include floorplan with lender name for list overview. */
  includeFloorplan?: boolean;
  /** When true, include location relation; disable on overview pages that do not render location. */
  includeLocation?: boolean;
};

export type VehicleOverviewListOptions = {
  limit: number;
  offset: number;
  filters?: VehicleListFilters;
  sortBy?: VehicleSortBy;
  sortOrder?: "asc" | "desc";
  includeFloorplan?: boolean;
  /** Enable query-level timing capture (findMany/count) for profiling. */
  profileTimings?: boolean;
};

export type VehicleCreateInput = {
  isDraft?: boolean;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  stockNumber: string;
  mileage?: number | null;
  color?: string | null;
  status?: VehicleStatus;
  salePriceCents?: bigint;
  auctionCostCents?: bigint;
  transportCostCents?: bigint;
  reconCostCents?: bigint;
  miscCostCents?: bigint;
  locationId?: string | null;
};

export type VehicleUpdateInput = Partial<VehicleCreateInput>;

function buildListWhere(
  dealershipId: string,
  filters: VehicleListFilters
): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = {
    dealershipId,
    deletedAt: null,
    isDraft: false,
  };
  if (filters.status) where.status = filters.status;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.year != null) where.year = filters.year;
  if (filters.make)
    where.make = { contains: filters.make, mode: "insensitive" };
  if (filters.model)
    where.model = { contains: filters.model, mode: "insensitive" };
  if (filters.vin) where.vin = filters.vin;
  if (filters.stockNumber)
    where.stockNumber = {
      contains: filters.stockNumber,
      mode: "insensitive",
    };
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.salePriceCents = {};
    if (filters.minPrice != null)
      (where.salePriceCents as { gte?: bigint }).gte = filters.minPrice;
    if (filters.maxPrice != null)
      (where.salePriceCents as { lte?: bigint }).lte = filters.maxPrice;
  }
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { vin: { contains: term, mode: "insensitive" } },
      { make: { contains: term, mode: "insensitive" } },
      { model: { contains: term, mode: "insensitive" } },
    ];
  }
  if (filters.createdAtLte) {
    where.createdAt = { lte: filters.createdAtLte };
  }
  if (filters.missingPhotosOnly) {
    where.vehiclePhotos = { none: { fileObject: { deletedAt: null } } };
  }
  if (filters.floorPlannedOnly) {
    where.floorplan = { isNot: null };
  }
  return where;
}

export async function listVehicles(
  dealershipId: string,
  options: VehicleListOptions
): Promise<{ data: Awaited<ReturnType<typeof prisma.vehicle.findMany>>; total: number }> {
  const {
    limit,
    offset,
    filters = {},
    sortBy = "createdAt",
    sortOrder = "desc",
    includeFloorplan = false,
    includeLocation = true,
  } = options;
  const where = buildListWhere(dealershipId, filters);
  const orderBy: Prisma.VehicleOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };
  const include: Prisma.VehicleInclude = {
    vehiclePhotos: {
      where: { fileObject: { deletedAt: null } },
      orderBy: { sortOrder: "asc" },
      take: 1,
      select: { fileObjectId: true, isPrimary: true },
    },
  };
  if (includeLocation) {
    include.location = { select: { id: true, name: true } };
  }
  if (includeFloorplan) {
    include.floorplan = {
      include: { lender: { select: { name: true } } },
    };
  }
  return paginatedQuery(
    () => prisma.vehicle.findMany({ where, orderBy, take: limit, skip: offset, include }),
    () => prisma.vehicle.count({ where })
  );
}

/**
 * Slim list query for inventory overview/intelligence surfaces.
 * Returns only fields required by list rendering/enrichment, reducing row payload size.
 */
export async function listVehiclesForOverview(
  dealershipId: string,
  options: VehicleOverviewListOptions
): Promise<{
  data: Awaited<ReturnType<typeof prisma.vehicle.findMany>>;
  total: number;
  queryTimingsMs?: {
    findManyMs: number;
    countMs: number;
  };
}> {
  const {
    limit,
    offset,
    filters = {},
    sortBy = "createdAt",
    sortOrder = "desc",
    includeFloorplan = false,
    profileTimings = false,
  } = options;
  const where = buildListWhere(dealershipId, filters);
  const orderBy: Prisma.VehicleOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };
  const select: Prisma.VehicleSelect = {
    id: true,
    stockNumber: true,
    vin: true,
    year: true,
    make: true,
    model: true,
    mileage: true,
    status: true,
    salePriceCents: true,
    createdAt: true,
    vehiclePhotos: {
      where: { fileObject: { deletedAt: null } },
      orderBy: { sortOrder: "asc" },
      take: 1,
      select: { fileObjectId: true, isPrimary: true },
    },
  };
  if (includeFloorplan) {
    select.floorplan = {
      select: { lender: { select: { name: true } } },
    };
  }
  if (!profileTimings) {
    return paginatedQuery(
      () => prisma.vehicle.findMany({ where, orderBy, take: limit, skip: offset, select }),
      () => prisma.vehicle.count({ where })
    );
  }

  const findManyStartedAt = Date.now();
  const findManyPromise = prisma.vehicle
    .findMany({ where, orderBy, take: limit, skip: offset, select })
    .then((data) => ({
      data,
      durationMs: Date.now() - findManyStartedAt,
    }));

  const countStartedAt = Date.now();
  const countPromise = prisma.vehicle.count({ where }).then((total) => ({
    total,
    durationMs: Date.now() - countStartedAt,
  }));

  const [findManyResult, countResult] = await Promise.all([
    findManyPromise,
    countPromise,
  ]);

  return {
    data: findManyResult.data,
    total: countResult.total,
    queryTimingsMs: {
      findManyMs: findManyResult.durationMs,
      countMs: countResult.durationMs,
    },
  };
}

/** List vehicle IDs for a dealership with pagination (e.g. for backfill batching). */
export async function listVehicleIds(
  dealershipId: string,
  limit: number,
  offset: number
): Promise<{ ids: string[]; total: number }> {
  const where: Prisma.VehicleWhereInput = { dealershipId, deletedAt: null, isDraft: false };
  const [ids, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
      select: { id: true },
    }).then((rows) => rows.map((r) => r.id)),
    prisma.vehicle.count({ where }),
  ]);
  return { ids, total };
}

export type FeedVehicleRow = {
  id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string;
  mileage: number | null;
  salePriceCents: bigint;
  vehiclePhotos: Array<{ fileObjectId: string; fileObject: { path: string } }>;
};

/** List vehicles for marketplace feed (AVAILABLE, with photos). Single query with includes. */
export async function listVehiclesForFeed(
  dealershipId: string,
  limit: number
): Promise<FeedVehicleRow[]> {
  const rows = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null, isDraft: false, status: "AVAILABLE" },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 500),
    select: {
      id: true,
      vin: true,
      year: true,
      make: true,
      model: true,
      trim: true,
      stockNumber: true,
      mileage: true,
      salePriceCents: true,
      vehiclePhotos: {
        where: { fileObject: { deletedAt: null } },
        orderBy: { sortOrder: "asc" },
        select: {
          fileObjectId: true,
          fileObject: { select: { path: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    vehiclePhotos: r.vehiclePhotos
      .filter((p): p is { fileObjectId: string; fileObject: { path: string } } => p.fileObject != null)
      .map((p) => ({ fileObjectId: p.fileObjectId, fileObject: p.fileObject })),
  })) as FeedVehicleRow[];
}

/** Count vehicles that have an active floor plan (VehicleFloorplan) for the dealership. */
export async function countFloorPlanned(dealershipId: string): Promise<number> {
  return prisma.vehicle.count({
    where: {
      dealershipId,
      deletedAt: null,
      isDraft: false,
      floorplan: { isNot: null },
    },
  });
}

/** Count vehicles with status SOLD (previously sold). */
export async function countPreviouslySold(dealershipId: string): Promise<number> {
  return prisma.vehicle.count({
    where: { dealershipId, deletedAt: null, isDraft: false, status: "SOLD" },
  });
}

/** Typeahead search: match q on vin or stockNumber. Returns id, vin, stockNumber, yearMakeModel. */
export async function searchVehiclesByTerm(
  dealershipId: string,
  q: string,
  limit: number
): Promise<
  { id: string; vin: string | null; stockNumber: string; yearMakeModel: string }[]
> {
  const term = q.trim();
  if (!term) return [];
  const where: Prisma.VehicleWhereInput = {
    dealershipId,
    deletedAt: null,
    isDraft: false,
    OR: [
      { vin: { contains: term, mode: "insensitive" } },
      { stockNumber: { contains: term, mode: "insensitive" } },
    ],
  };
  const rows = await prisma.vehicle.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      vin: true,
      stockNumber: true,
      year: true,
      make: true,
      model: true,
    },
  });
  return rows.map((v) => ({
    id: v.id,
    vin: v.vin ?? null,
    stockNumber: v.stockNumber,
    yearMakeModel: [v.year, v.make, v.model].filter(Boolean).join(" ") || "",
  }));
}

export async function getVehicleById(dealershipId: string, id: string) {
  return prisma.vehicle.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: {
      location: { select: { id: true, name: true } },
    },
  });
}

export async function findActiveVehicleByStockNumber(
  dealershipId: string,
  stockNumber: string,
  excludeId?: string
) {
  return prisma.vehicle.findFirst({
    where: {
      dealershipId,
      stockNumber,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
}

export async function findActiveVehicleByVin(
  dealershipId: string,
  vin: string,
  excludeId?: string
) {
  if (!vin || !vin.trim()) return null;
  return prisma.vehicle.findFirst({
    where: {
      dealershipId,
      vin: vin.trim(),
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
}

export async function createVehicle(
  dealershipId: string,
  data: VehicleCreateInput
) {
  return prisma.vehicle.create({
    data: {
      dealershipId,
      vin: data.vin ?? null,
      isDraft: data.isDraft ?? false,
      year: data.year ?? null,
      make: data.make ?? null,
      model: data.model ?? null,
      trim: data.trim ?? null,
      stockNumber: data.stockNumber,
      mileage: data.mileage ?? null,
      color: data.color ?? null,
      status: data.status ?? "AVAILABLE",
      salePriceCents: data.salePriceCents ?? BigInt(0),
      auctionCostCents: data.auctionCostCents ?? BigInt(0),
      transportCostCents: data.transportCostCents ?? BigInt(0),
      reconCostCents: data.reconCostCents ?? BigInt(0),
      miscCostCents: data.miscCostCents ?? BigInt(0),
      locationId: data.locationId ?? null,
    },
    include: {
      location: { select: { id: true, name: true } },
    },
  });
}

export async function updateVehicle(
  dealershipId: string,
  id: string,
  data: VehicleUpdateInput
) {
  const existing = await prisma.vehicle.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  const updatePayload: Record<string, unknown> = {};
  if (data.vin !== undefined) updatePayload.vin = data.vin ?? null;
  if (data.isDraft !== undefined) updatePayload.isDraft = data.isDraft;
  if (data.year !== undefined) updatePayload.year = data.year ?? null;
  if (data.make !== undefined) updatePayload.make = data.make ?? null;
  if (data.model !== undefined) updatePayload.model = data.model ?? null;
  if (data.trim !== undefined) updatePayload.trim = data.trim ?? null;
  if (data.stockNumber !== undefined) updatePayload.stockNumber = data.stockNumber;
  if (data.mileage !== undefined) updatePayload.mileage = data.mileage ?? null;
  if (data.color !== undefined) updatePayload.color = data.color ?? null;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.salePriceCents !== undefined)
    updatePayload.salePriceCents = data.salePriceCents;
  if (data.auctionCostCents !== undefined)
    updatePayload.auctionCostCents = data.auctionCostCents;
  if (data.transportCostCents !== undefined)
    updatePayload.transportCostCents = data.transportCostCents;
  if (data.reconCostCents !== undefined)
    updatePayload.reconCostCents = data.reconCostCents;
  if (data.miscCostCents !== undefined)
    updatePayload.miscCostCents = data.miscCostCents;
  if (data.locationId !== undefined) updatePayload.locationId = data.locationId ?? null;
  return prisma.vehicle.update({
    where: { id },
    data: updatePayload,
    include: {
      location: { select: { id: true, name: true } },
    },
  });
}

export async function softDeleteVehicle(
  dealershipId: string,
  id: string,
  deletedBy: string
) {
  const existing = await prisma.vehicle.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  return prisma.vehicle.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy },
    include: {
      location: { select: { id: true, name: true } },
    },
  });
}

export type AgingSortBy = "daysInStock";
export type AgingListOptions = {
  limit: number;
  offset: number;
  status?: VehicleStatus;
  sortBy?: AgingSortBy;
  sortOrder?: "asc" | "desc";
};

export async function listAging(
  dealershipId: string,
  options: AgingListOptions
) {
  const { limit, offset, status, sortBy = "daysInStock", sortOrder = "desc" } = options;
  const where = {
    dealershipId,
    deletedAt: null,
    isDraft: false,
    ...(status && { status }),
  };
  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      stockNumber: true,
      year: true,
      make: true,
      model: true,
      status: true,
      salePriceCents: true,
      createdAt: true,
    },
  });
  const now = Date.now();
  const withDays = vehicles.map((v) => ({
    vehicleId: v.id,
    stockNumber: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    status: v.status,
    salePriceCents: v.salePriceCents,
    createdAt: v.createdAt,
    daysInStock: Math.floor(
      (now - v.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    ),
  }));
  withDays.sort((a, b) =>
    sortOrder === "desc"
      ? b.daysInStock - a.daysInStock
      : a.daysInStock - b.daysInStock
  );
  const total = withDays.length;
  const data = withDays.slice(offset, offset + limit);
  return { data, total };
}

/** Count vehicles (dealershipId, deletedAt null). For dashboard KPIs. */
export async function countVehicles(dealershipId: string): Promise<number> {
  return prisma.vehicle.count({
    where: { dealershipId, deletedAt: null, isDraft: false },
  });
}

/** Count vehicles created on or after `since`. For delta7d. */
export async function countVehiclesCreatedSince(
  dealershipId: string,
  since: Date
): Promise<number> {
  return prisma.vehicle.count({
    where: { dealershipId, deletedAt: null, isDraft: false, createdAt: { gte: since } },
  });
}

export type VehicleKpiAggregates = {
  totalUnits: number;
  inReconUnits: number;
  salePendingUnits: number;
  salePendingValueCents: bigint;
  inventoryValueCents: bigint;
};

/** Single-query aggregates for dashboard KPIs. Excludes SOLD from value; REPAIR=in recon, HOLD=sale pending. */
export async function getVehicleKpiAggregates(
  dealershipId: string
): Promise<VehicleKpiAggregates> {
  const baseWhere = { dealershipId, deletedAt: null, isDraft: false };
  const [totalUnits, inReconUnits, salePendingResult, valueResult] = await Promise.all([
    prisma.vehicle.count({ where: baseWhere }),
    prisma.vehicle.count({ where: { ...baseWhere, status: "REPAIR" } }),
    prisma.vehicle.aggregate({
      where: { ...baseWhere, status: "HOLD" },
      _count: { id: true },
      _sum: { salePriceCents: true },
    }),
    prisma.vehicle.aggregate({
      where: { ...baseWhere, status: { not: "SOLD" } },
      _sum: { salePriceCents: true },
    }),
  ]);
  return {
    totalUnits,
    inReconUnits,
    salePendingUnits: salePendingResult._count.id,
    salePendingValueCents: salePendingResult._sum.salePriceCents ?? BigInt(0),
    inventoryValueCents: valueResult._sum.salePriceCents ?? BigInt(0),
  };
}

export type InventoryAgingBuckets = {
  lt30: number;
  d30to60: number;
  d60to90: number;
  gt90: number;
};

/** Non-SOLD vehicle ids for ledger-based cost aggregation (inventory intelligence). */
export async function getNonSoldVehicleIds(
  dealershipId: string
): Promise<string[]> {
  const rows = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null, isDraft: false, status: { not: "SOLD" } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Minimal vehicle cost data for inventory value aggregate (non-SOLD only). Uses legacy Vehicle cost columns; prefer ledger via getNonSoldVehicleIds + costLedger.getCostTotalsForVehicles. */
export async function getNonSoldVehicleCosts(
  dealershipId: string
): Promise<{ vehicleId: string; costCents: number }[]> {
  const rows = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null, isDraft: false, status: { not: "SOLD" } },
    select: {
      id: true,
      auctionCostCents: true,
      transportCostCents: true,
      reconCostCents: true,
      miscCostCents: true,
    },
  });
  return rows.map((r) => ({
    vehicleId: r.id,
    costCents:
      Number(r.auctionCostCents) +
      Number(r.transportCostCents) +
      Number(r.reconCostCents) +
      Number(r.miscCostCents),
  }));
}

/** Minimum number of similar vehicles required to use internal comps average. */
export const MIN_COMPS_FOR_MARKET_AVG = 3;

/**
 * Fleet-level internal comps: average salePriceCents over non-SOLD vehicles that belong to
 * make+model groups with at least MIN_COMPS_FOR_MARKET_AVG vehicles. Returns null if no such group.
 */
export async function getFleetInternalCompsAvgCents(
  dealershipId: string
): Promise<number | null> {
  const rows = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null, isDraft: false, status: { not: "SOLD" } },
    select: { make: true, model: true, salePriceCents: true },
  });
  const key = (make: string | null, model: string | null) =>
    `${(make ?? "").toLowerCase()}|${(model ?? "").toLowerCase()}`;
  const groups = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const k = key(r.make, r.model);
    if (!k || k === "|") continue;
    const val = groups.get(k) ?? { sum: 0, count: 0 };
    val.sum += Number(r.salePriceCents);
    val.count += 1;
    groups.set(k, val);
  }
  let totalSum = 0;
  let totalCount = 0;
  for (const { sum, count } of groups.values()) {
    if (count >= MIN_COMPS_FOR_MARKET_AVG) {
      totalSum += sum;
      totalCount += count;
    }
  }
  if (totalCount < MIN_COMPS_FOR_MARKET_AVG) return null;
  return Math.round(totalSum / totalCount);
}

/**
 * Internal comps average sale price (cents) for a specific make+model in the dealership.
 * Returns null if the group has fewer than MIN_COMPS_FOR_MARKET_AVG non-SOLD vehicles.
 */
export async function getInternalCompsAvgCentsForMakeModel(
  dealershipId: string,
  make: string | null,
  model: string | null
): Promise<number | null> {
  if (!make?.trim() && !model?.trim()) return null;
  const rows = await prisma.vehicle.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      isDraft: false,
      status: { not: "SOLD" },
      ...(make?.trim() && { make: { equals: make, mode: "insensitive" } }),
      ...(model?.trim() && { model: { equals: model, mode: "insensitive" } }),
    },
    select: { salePriceCents: true },
  });
  if (rows.length < MIN_COMPS_FOR_MARKET_AVG) return null;
  const sum = rows.reduce((acc, r) => acc + Number(r.salePriceCents), 0);
  return Math.round(sum / rows.length);
}

/** Key for make+model grouping (case-insensitive). */
export function makeModelKey(make: string | null, model: string | null): string {
  return `${(make ?? "").toLowerCase().trim()}|${(model ?? "").toLowerCase().trim()}`;
}

/**
 * Internal comps average (cents) per make+model group. Only groups with >= MIN_COMPS_FOR_MARKET_AVG.
 * Used for batch price-to-market on list.
 */
export async function getInternalCompsAvgCentsByMakeModel(
  dealershipId: string
): Promise<Map<string, number>> {
  const rows = await prisma.vehicle.findMany({
    where: { dealershipId, deletedAt: null, isDraft: false, status: { not: "SOLD" } },
    select: { make: true, model: true, salePriceCents: true },
  });
  const groups = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const k = makeModelKey(r.make, r.model);
    if (!k || k === "|") continue;
    const val = groups.get(k) ?? { sum: 0, count: 0 };
    val.sum += Number(r.salePriceCents);
    val.count += 1;
    groups.set(k, val);
  }
  const out = new Map<string, number>();
  for (const [key, { sum, count }] of groups) {
    if (count >= MIN_COMPS_FOR_MARKET_AVG) out.set(key, Math.round(sum / count));
  }
  return out;
}

/** Days in stock from createdAt to now. Buckets: <30, 30–60, 60–90, >90. Boundary: exactly 30 days ago is in d30to60. */
export async function countByAgingBuckets(
  dealershipId: string
): Promise<InventoryAgingBuckets> {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const t30 = new Date(now.getTime() - 30 * dayMs);
  const t60 = new Date(now.getTime() - 60 * dayMs);
  const t90 = new Date(now.getTime() - 90 * dayMs);
  const baseWhere = { dealershipId, deletedAt: null, isDraft: false };
  const [lt30, d30to60, d60to90, gt90] = await Promise.all([
    prisma.vehicle.count({ where: { ...baseWhere, createdAt: { gt: t30 } } }),
    prisma.vehicle.count({
      where: { ...baseWhere, createdAt: { gt: t60, lte: t30 } },
    }),
    prisma.vehicle.count({
      where: { ...baseWhere, createdAt: { gt: t90, lte: t60 } },
    }),
    prisma.vehicle.count({ where: { ...baseWhere, createdAt: { lte: t90 } } }),
  ]);
  return { lt30, d30to60, d60to90, gt90 };
}
