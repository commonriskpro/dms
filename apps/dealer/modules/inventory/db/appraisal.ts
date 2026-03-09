import { prisma } from "@/lib/db";
import type { VehicleAppraisalStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { paginatedQuery } from "@/lib/db/paginate";

export type AppraisalListFilters = {
  status?: VehicleAppraisalStatus;
  sourceType?: string;
  vin?: string;
};

export type AppraisalListOptions = {
  limit: number;
  offset: number;
  filters?: AppraisalListFilters;
  sortBy?: "createdAt" | "expectedRetailCents" | "expectedProfitCents";
  sortOrder?: "asc" | "desc";
};

function buildWhere(dealershipId: string, filters?: AppraisalListFilters): Prisma.VehicleAppraisalWhereInput {
  const where: Prisma.VehicleAppraisalWhereInput = { dealershipId };
  if (filters?.status) where.status = filters.status;
  if (filters?.sourceType) where.sourceType = filters.sourceType as "TRADE_IN" | "AUCTION" | "MARKETPLACE" | "STREET";
  if (filters?.vin?.trim()) where.vin = { contains: filters.vin.trim(), mode: "insensitive" };
  return where;
}

export async function listAppraisals(dealershipId: string, options: AppraisalListOptions) {
  const limit = Math.min(options.limit, 100);
  const offset = options.offset ?? 0;
  const where = buildWhere(dealershipId, options.filters);
  const orderBy: Prisma.VehicleAppraisalOrderByWithRelationInput =
    options.sortBy === "expectedRetailCents"
      ? { expectedRetailCents: options.sortOrder ?? "desc" }
      : options.sortBy === "expectedProfitCents"
        ? { expectedProfitCents: options.sortOrder ?? "desc" }
        : { createdAt: options.sortOrder ?? "desc" };
  return paginatedQuery(
    () =>
      prisma.vehicleAppraisal.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          appraisedBy: { select: { id: true, fullName: true } },
          vehicle: { select: { id: true, stockNumber: true, vin: true } },
        },
      }),
    () => prisma.vehicleAppraisal.count({ where })
  );
}

export async function getAppraisalById(dealershipId: string, id: string) {
  return prisma.vehicleAppraisal.findFirst({
    where: { id, dealershipId },
    include: {
      appraisedBy: { select: { id: true, fullName: true } },
      vehicle: { select: { id: true, stockNumber: true, vin: true, year: true, make: true, model: true } },
    },
  });
}

export type AppraisalCreateInput = {
  vin: string;
  sourceType: "TRADE_IN" | "AUCTION" | "MARKETPLACE" | "STREET";
  appraisedByUserId?: string | null;
  acquisitionCostCents?: bigint;
  reconEstimateCents?: bigint;
  transportEstimateCents?: bigint;
  feesEstimateCents?: bigint;
  expectedRetailCents?: bigint;
  expectedWholesaleCents?: bigint;
  expectedTradeInCents?: bigint;
  expectedProfitCents?: bigint;
  notes?: string | null;
};

export async function createAppraisal(dealershipId: string, data: AppraisalCreateInput) {
  return prisma.vehicleAppraisal.create({
    data: {
      dealershipId,
      vin: data.vin,
      sourceType: data.sourceType,
      appraisedByUserId: data.appraisedByUserId ?? null,
      acquisitionCostCents: data.acquisitionCostCents ?? BigInt(0),
      reconEstimateCents: data.reconEstimateCents ?? BigInt(0),
      transportEstimateCents: data.transportEstimateCents ?? BigInt(0),
      feesEstimateCents: data.feesEstimateCents ?? BigInt(0),
      expectedRetailCents: data.expectedRetailCents ?? BigInt(0),
      expectedWholesaleCents: data.expectedWholesaleCents ?? BigInt(0),
      expectedTradeInCents: data.expectedTradeInCents ?? BigInt(0),
      expectedProfitCents: data.expectedProfitCents ?? BigInt(0),
      notes: data.notes ?? null,
    },
    include: {
      appraisedBy: { select: { id: true, fullName: true } },
    },
  });
}

export type AppraisalUpdateInput = Partial<
  Omit<AppraisalCreateInput, "vin" | "sourceType">
>;

export async function updateAppraisal(dealershipId: string, id: string, data: AppraisalUpdateInput) {
  const existing = await prisma.vehicleAppraisal.findFirst({
    where: { id, dealershipId },
  });
  if (!existing || existing.status !== "DRAFT") return null;
  const payload: Prisma.VehicleAppraisalUpdateInput = {};
  if (data.appraisedByUserId !== undefined) {
    payload.appraisedBy =
      data.appraisedByUserId === null
        ? { disconnect: true }
        : { connect: { id: data.appraisedByUserId } };
  }
  if (data.acquisitionCostCents !== undefined) payload.acquisitionCostCents = data.acquisitionCostCents;
  if (data.reconEstimateCents !== undefined) payload.reconEstimateCents = data.reconEstimateCents;
  if (data.transportEstimateCents !== undefined) payload.transportEstimateCents = data.transportEstimateCents;
  if (data.feesEstimateCents !== undefined) payload.feesEstimateCents = data.feesEstimateCents;
  if (data.expectedRetailCents !== undefined) payload.expectedRetailCents = data.expectedRetailCents;
  if (data.expectedWholesaleCents !== undefined) payload.expectedWholesaleCents = data.expectedWholesaleCents;
  if (data.expectedTradeInCents !== undefined) payload.expectedTradeInCents = data.expectedTradeInCents;
  if (data.expectedProfitCents !== undefined) payload.expectedProfitCents = data.expectedProfitCents;
  if (data.notes !== undefined) payload.notes = data.notes;
  return prisma.vehicleAppraisal.update({
    where: { id },
    data: payload,
    include: {
      appraisedBy: { select: { id: true, fullName: true } },
      vehicle: { select: { id: true, stockNumber: true, vin: true } },
    },
  });
}

export async function setAppraisalStatus(
  dealershipId: string,
  id: string,
  status: VehicleAppraisalStatus
) {
  const existing = await prisma.vehicleAppraisal.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.vehicleAppraisal.update({
    where: { id },
    data: { status },
    include: {
      appraisedBy: { select: { id: true, fullName: true } },
      vehicle: { select: { id: true, stockNumber: true, vin: true } },
    },
  });
}

export async function setAppraisalVehicleId(dealershipId: string, id: string, vehicleId: string) {
  const existing = await prisma.vehicleAppraisal.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.vehicleAppraisal.update({
    where: { id },
    data: { vehicleId, status: "CONVERTED" },
    include: {
      appraisedBy: { select: { id: true, fullName: true } },
      vehicle: { select: { id: true, stockNumber: true, vin: true } },
    },
  });
}
