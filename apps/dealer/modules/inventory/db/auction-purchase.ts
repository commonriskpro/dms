import { prisma } from "@/lib/db";
import type { AuctionPurchaseStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { paginatedQuery } from "@/lib/db/paginate";

export type AuctionPurchaseListFilters = {
  status?: AuctionPurchaseStatus;
  vehicleId?: string;
};

export type AuctionPurchaseListOptions = {
  limit: number;
  offset: number;
  filters?: AuctionPurchaseListFilters;
  sortBy?: "createdAt" | "etaDate";
  sortOrder?: "asc" | "desc";
};

function buildWhere(
  dealershipId: string,
  filters?: AuctionPurchaseListFilters
): Prisma.AuctionPurchaseWhereInput {
  const where: Prisma.AuctionPurchaseWhereInput = { dealershipId };
  if (filters?.status) where.status = filters.status;
  if (filters?.vehicleId) where.vehicleId = filters.vehicleId;
  return where;
}

export async function listAuctionPurchases(
  dealershipId: string,
  options: AuctionPurchaseListOptions
) {
  const limit = Math.min(options.limit, 100);
  const offset = options.offset ?? 0;
  const where = buildWhere(dealershipId, options.filters);
  const orderBy: Prisma.AuctionPurchaseOrderByWithRelationInput =
    options.sortBy === "etaDate"
      ? { etaDate: options.sortOrder ?? "asc" }
      : { createdAt: options.sortOrder ?? "desc" };
  return paginatedQuery(
    () =>
      prisma.auctionPurchase.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          vehicle: { select: { id: true, stockNumber: true, vin: true, year: true, make: true, model: true } },
        },
      }),
    () => prisma.auctionPurchase.count({ where })
  );
}

export async function getAuctionPurchaseById(dealershipId: string, id: string) {
  return prisma.auctionPurchase.findFirst({
    where: { id, dealershipId },
    include: {
      vehicle: { select: { id: true, stockNumber: true, vin: true, year: true, make: true, model: true } },
    },
  });
}

export type AuctionPurchaseCreateInput = {
  vehicleId?: string | null;
  auctionName: string;
  lotNumber: string;
  purchasePriceCents: bigint;
  feesCents?: bigint;
  shippingCents?: bigint;
  etaDate?: Date | null;
  status?: AuctionPurchaseStatus;
  notes?: string | null;
};

export async function createAuctionPurchase(dealershipId: string, data: AuctionPurchaseCreateInput) {
  return prisma.auctionPurchase.create({
    data: {
      dealershipId,
      vehicleId: data.vehicleId ?? null,
      auctionName: data.auctionName,
      lotNumber: data.lotNumber,
      purchasePriceCents: data.purchasePriceCents,
      feesCents: data.feesCents ?? BigInt(0),
      shippingCents: data.shippingCents ?? BigInt(0),
      etaDate: data.etaDate ?? null,
      status: data.status ?? "PENDING",
      notes: data.notes ?? null,
    },
    include: {
      vehicle: { select: { id: true, stockNumber: true, vin: true } },
    },
  });
}

export type AuctionPurchaseUpdateInput = Partial<{
  vehicleId: string | null;
  auctionName: string;
  lotNumber: string;
  purchasePriceCents: bigint;
  feesCents: bigint;
  shippingCents: bigint;
  etaDate: Date | null;
  status: AuctionPurchaseStatus;
  notes: string | null;
}>;

export async function updateAuctionPurchase(
  dealershipId: string,
  id: string,
  data: AuctionPurchaseUpdateInput
) {
  const existing = await prisma.auctionPurchase.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Prisma.AuctionPurchaseUpdateInput = {};
  if (data.vehicleId !== undefined) {
    payload.vehicle =
      data.vehicleId === null
        ? { disconnect: true }
        : { connect: { id: data.vehicleId } };
  }
  if (data.auctionName !== undefined) payload.auctionName = data.auctionName;
  if (data.lotNumber !== undefined) payload.lotNumber = data.lotNumber;
  if (data.purchasePriceCents !== undefined) payload.purchasePriceCents = data.purchasePriceCents;
  if (data.feesCents !== undefined) payload.feesCents = data.feesCents;
  if (data.shippingCents !== undefined) payload.shippingCents = data.shippingCents;
  if (data.etaDate !== undefined) payload.etaDate = data.etaDate;
  if (data.status !== undefined) payload.status = data.status;
  if (data.notes !== undefined) payload.notes = data.notes;
  return prisma.auctionPurchase.update({
    where: { id },
    data: payload,
    include: {
      vehicle: { select: { id: true, stockNumber: true, vin: true } },
    },
  });
}
