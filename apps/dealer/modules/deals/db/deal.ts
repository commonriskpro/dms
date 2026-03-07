import { prisma } from "@/lib/db";
import type { DealStatus, DeliveryStatus, DealFundingStatus } from "@prisma/client";
import { paginatedQuery } from "@/lib/db/paginate";
import { VEHICLE_SUMMARY_SELECT, CUSTOMER_SUMMARY_SELECT } from "@/lib/db/common-selects";

export type DealListFilters = {
  status?: DealStatus;
  customerId?: string;
  vehicleId?: string;
};

export type DealListOptions = {
  limit: number;
  offset: number;
  filters?: DealListFilters;
  sortBy?: "createdAt" | "frontGrossCents" | "status" | "updatedAt";
  sortOrder?: "asc" | "desc";
};

export type DealCreateInput = {
  customerId: string;
  vehicleId: string;
  salePriceCents: bigint;
  purchasePriceCents: bigint;
  taxRateBps: number;
  taxCents: bigint;
  docFeeCents: bigint;
  downPaymentCents: bigint;
  totalFeesCents: bigint;
  totalDueCents: bigint;
  frontGrossCents: bigint;
  notes?: string | null;
};

export type DealUpdateInput = {
  salePriceCents?: bigint;
  purchasePriceCents?: bigint;
  taxRateBps?: number;
  taxCents?: bigint;
  docFeeCents?: bigint;
  downPaymentCents?: bigint;
  totalFeesCents?: bigint;
  totalDueCents?: bigint;
  frontGrossCents?: bigint;
  notes?: string | null;
};

/** Typeahead search: match q on vehicle stock number or customer name. Returns id, stockNumber (from vehicle), customerName. */
export async function searchDealsByTerm(
  dealershipId: string,
  q: string,
  limit: number
): Promise<{ id: string; stockNumber: string; customerName: string }[]> {
  const term = q.trim();
  if (!term) return [];
  const where = {
    dealershipId,
    deletedAt: null,
    OR: [
      { vehicle: { stockNumber: { contains: term, mode: "insensitive" as const } } },
      { customer: { name: { contains: term, mode: "insensitive" as const } } },
    ],
  };
  const rows = await prisma.deal.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { stockNumber: true } },
      customer: { select: { name: true } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    stockNumber: d.vehicle.stockNumber,
    customerName: d.customer.name,
  }));
}

export async function listDeals(dealershipId: string, options: DealListOptions) {
  const { limit, offset, filters = {}, sortBy = "createdAt", sortOrder = "desc" } = options;
  const where = {
    dealershipId,
    deletedAt: null,
    ...(filters.status && { status: filters.status }),
    ...(filters.customerId && { customerId: filters.customerId }),
    ...(filters.vehicleId && { vehicleId: filters.vehicleId }),
  };
  const orderBy = { [sortBy]: sortOrder };
  return paginatedQuery(
    () =>
      prisma.deal.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          customer: { select: CUSTOMER_SUMMARY_SELECT },
          vehicle: { select: VEHICLE_SUMMARY_SELECT },
          fees: true,
          trades: true,
        },
      }),
    () => prisma.deal.count({ where })
  );
}

export async function getDealById(dealershipId: string, id: string) {
  return prisma.deal.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      vehicle: { select: VEHICLE_SUMMARY_SELECT },
      fees: true,
      trades: true,
      dealFinance: {
        where: { deletedAt: null },
        include: { products: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      },
      dealFundings: {
        orderBy: { createdAt: "desc" },
        include: { lenderApplication: { select: { id: true, lenderName: true } } },
      },
      dealTitle: true,
      dealDmvChecklistItems: { orderBy: { createdAt: "asc" } },
    },
  });
}

/** Returns an active deal (deletedAt null, status <> CANCELED) for the given vehicle in this dealership, if any. */
export async function getActiveDealByVehicleId(dealershipId: string, vehicleId: string) {
  return prisma.deal.findFirst({
    where: {
      dealershipId,
      vehicleId,
      deletedAt: null,
      status: { not: "CANCELED" },
    },
  });
}

export async function createDeal(dealershipId: string, data: DealCreateInput) {
  return prisma.deal.create({
    data: {
      dealershipId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      salePriceCents: data.salePriceCents,
      purchasePriceCents: data.purchasePriceCents,
      taxRateBps: data.taxRateBps,
      taxCents: data.taxCents,
      docFeeCents: data.docFeeCents,
      downPaymentCents: data.downPaymentCents,
      totalFeesCents: data.totalFeesCents,
      totalDueCents: data.totalDueCents,
      frontGrossCents: data.frontGrossCents,
      notes: data.notes ?? null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      vehicle: { select: VEHICLE_SUMMARY_SELECT },
      fees: true,
      trades: true,
    },
  });
}

export async function updateDeal(dealershipId: string, id: string, data: DealUpdateInput) {
  const existing = await prisma.deal.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.salePriceCents !== undefined) payload.salePriceCents = data.salePriceCents;
  if (data.purchasePriceCents !== undefined) payload.purchasePriceCents = data.purchasePriceCents;
  if (data.taxRateBps !== undefined) payload.taxRateBps = data.taxRateBps;
  if (data.taxCents !== undefined) payload.taxCents = data.taxCents;
  if (data.docFeeCents !== undefined) payload.docFeeCents = data.docFeeCents;
  if (data.downPaymentCents !== undefined) payload.downPaymentCents = data.downPaymentCents;
  if (data.totalFeesCents !== undefined) payload.totalFeesCents = data.totalFeesCents;
  if (data.totalDueCents !== undefined) payload.totalDueCents = data.totalDueCents;
  if (data.frontGrossCents !== undefined) payload.frontGrossCents = data.frontGrossCents;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (Object.keys(payload).length === 0) return existing;
  const updated = await prisma.deal.update({
    where: { id },
    data: payload as Parameters<typeof prisma.deal.update>[0]["data"],
    include: {
      customer: { select: { id: true, name: true } },
      vehicle: { select: VEHICLE_SUMMARY_SELECT },
      fees: true,
      trades: true,
    },
  });
  return updated;
}

export async function softDeleteDeal(dealershipId: string, dealId: string, deletedBy: string) {
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  await prisma.deal.update({
    where: { id: dealId },
    data: { deletedAt: new Date(), deletedBy },
  });
  return existing;
}

/** Count deals with status in the given list (for dashboard pipeline). */
export async function countDealsByStatuses(
  dealershipId: string,
  statuses: DealStatus[]
): Promise<number> {
  if (statuses.length === 0) return 0;
  return prisma.deal.count({
    where: { dealershipId, deletedAt: null, status: { in: statuses } },
  });
}

/** Start of today UTC. */
function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** Count deals with status CONTRACTED and createdAt or updatedAt >= start of today UTC (sold today). */
export async function countDealsContractedToday(dealershipId: string): Promise<number> {
  const start = startOfTodayUtc();
  return prisma.deal.count({
    where: {
      dealershipId,
      deletedAt: null,
      status: "CONTRACTED",
      OR: [{ createdAt: { gte: start } }, { updatedAt: { gte: start } }],
    },
  });
}

/** Count deals created today (for team activity). */
export async function countDealsCreatedToday(dealershipId: string): Promise<number> {
  const start = startOfTodayUtc();
  return prisma.deal.count({
    where: { dealershipId, deletedAt: null, createdAt: { gte: start } },
  });
}

/** Update delivery status and optional deliveredAt. Returns updated deal or null. */
export async function updateDealDelivery(
  dealershipId: string,
  dealId: string,
  data: { deliveryStatus: DeliveryStatus; deliveredAt?: Date | null }
) {
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  return prisma.deal.update({
    where: { id: dealId },
    data: {
      deliveryStatus: data.deliveryStatus,
      ...(data.deliveredAt !== undefined && { deliveredAt: data.deliveredAt }),
    },
    include: {
      customer: { select: { id: true, name: true } },
      vehicle: { select: VEHICLE_SUMMARY_SELECT },
      fees: true,
      trades: true,
    },
  });
}

/** List deals ready for delivery (deliveryStatus = READY_FOR_DELIVERY). Paginated. */
export async function listDealsForDeliveryQueue(
  dealershipId: string,
  options: { limit: number; offset: number }
) {
  const { limit, offset } = options;
  const where = {
    dealershipId,
    deletedAt: null,
    status: "CONTRACTED" as const,
    deliveryStatus: "READY_FOR_DELIVERY" as const,
  };
  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: { select: CUSTOMER_SUMMARY_SELECT },
        vehicle: { select: VEHICLE_SUMMARY_SELECT },
      },
    }),
    prisma.deal.count({ where }),
  ]);
  return { data, total };
}

/** List deals with at least one DealFunding in PENDING or APPROVED (awaiting funding). Paginated. */
export async function listDealsForFundingQueue(
  dealershipId: string,
  options: { limit: number; offset: number }
) {
  const { limit, offset } = options;
  const where = {
    dealershipId,
    deletedAt: null,
    status: "CONTRACTED" as const,
    dealFundings: {
      some: { fundingStatus: { in: ["PENDING", "APPROVED"] as DealFundingStatus[] } },
    },
  };
  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: { select: CUSTOMER_SUMMARY_SELECT },
        vehicle: { select: VEHICLE_SUMMARY_SELECT },
        dealFundings: {
          where: { fundingStatus: { in: ["PENDING", "APPROVED", "FUNDED"] as DealFundingStatus[] } },
          orderBy: { createdAt: "desc" },
          include: { lenderApplication: { select: { id: true, lenderName: true } } },
        },
      },
    }),
    prisma.deal.count({ where }),
  ]);
  return { data, total };
}
