import { prisma } from "@/lib/db";
import type { VehicleStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

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
};

export type VehicleCreateInput = {
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
  } = options;
  const where = buildListWhere(dealershipId, filters);
  const orderBy: Prisma.VehicleOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };
  const [data, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        location: { select: { id: true, name: true } },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);
  return { data, total };
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
    where: { dealershipId, deletedAt: null },
  });
}

/** Count vehicles created on or after `since`. For delta7d. */
export async function countVehiclesCreatedSince(
  dealershipId: string,
  since: Date
): Promise<number> {
  return prisma.vehicle.count({
    where: { dealershipId, deletedAt: null, createdAt: { gte: since } },
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
  const baseWhere = { dealershipId, deletedAt: null };
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

/** Days in stock from createdAt to now. Buckets: <30, 30–60, 60–90, >90. Boundary: exactly 30 days ago is in d30to60. */
export async function countByAgingBuckets(
  dealershipId: string
): Promise<InventoryAgingBuckets> {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const t30 = new Date(now.getTime() - 30 * dayMs);
  const t60 = new Date(now.getTime() - 60 * dayMs);
  const t90 = new Date(now.getTime() - 90 * dayMs);
  const baseWhere = { dealershipId, deletedAt: null };
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
