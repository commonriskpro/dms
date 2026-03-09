import { prisma } from "@/lib/db";
import type { InventorySourceLeadStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { paginatedQuery } from "@/lib/db/paginate";

export type AcquisitionListFilters = {
  status?: InventorySourceLeadStatus;
  sourceType?: string;
  vin?: string;
};

export type AcquisitionListOptions = {
  limit: number;
  offset: number;
  filters?: AcquisitionListFilters;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
};

function buildWhere(dealershipId: string, filters?: AcquisitionListFilters): Prisma.InventorySourceLeadWhereInput {
  const where: Prisma.InventorySourceLeadWhereInput = { dealershipId };
  if (filters?.status) where.status = filters.status;
  if (filters?.sourceType)
    where.sourceType = filters.sourceType as "AUCTION" | "TRADE_IN" | "MARKETPLACE" | "STREET";
  if (filters?.vin?.trim()) where.vin = { contains: filters.vin.trim(), mode: "insensitive" };
  return where;
}

export async function listInventorySourceLeads(dealershipId: string, options: AcquisitionListOptions) {
  const limit = Math.min(options.limit, 100);
  const offset = options.offset ?? 0;
  const where = buildWhere(dealershipId, options.filters);
  const orderBy: Prisma.InventorySourceLeadOrderByWithRelationInput =
    options.sortBy === "updatedAt"
      ? { updatedAt: options.sortOrder ?? "desc" }
      : { createdAt: options.sortOrder ?? "desc" };
  return paginatedQuery(
    () =>
      prisma.inventorySourceLead.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          appraisal: {
            select: {
              id: true,
              vin: true,
              status: true,
              expectedRetailCents: true,
              expectedProfitCents: true,
            },
          },
        },
      }),
    () => prisma.inventorySourceLead.count({ where })
  );
}

export async function getInventorySourceLeadById(dealershipId: string, id: string) {
  return prisma.inventorySourceLead.findFirst({
    where: { id, dealershipId },
    include: {
      appraisal: {
        select: {
          id: true,
          vin: true,
          status: true,
          expectedRetailCents: true,
          expectedProfitCents: true,
          vehicleId: true,
        },
      },
    },
  });
}

export type InventorySourceLeadCreateInput = {
  vin: string;
  sourceType: "AUCTION" | "TRADE_IN" | "MARKETPLACE" | "STREET";
  sellerName?: string | null;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  askingPriceCents?: bigint | null;
  negotiatedPriceCents?: bigint | null;
  appraisalId?: string | null;
};

export async function createInventorySourceLead(dealershipId: string, data: InventorySourceLeadCreateInput) {
  return prisma.inventorySourceLead.create({
    data: {
      dealershipId,
      vin: data.vin,
      sourceType: data.sourceType,
      sellerName: data.sellerName ?? null,
      sellerPhone: data.sellerPhone ?? null,
      sellerEmail: data.sellerEmail ?? null,
      askingPriceCents: data.askingPriceCents ?? null,
      negotiatedPriceCents: data.negotiatedPriceCents ?? null,
      appraisalId: data.appraisalId ?? null,
    },
    include: {
      appraisal: { select: { id: true, vin: true, status: true } },
    },
  });
}

export type InventorySourceLeadUpdateInput = Partial<
  Omit<InventorySourceLeadCreateInput, "vin" | "sourceType">
>;

export async function updateInventorySourceLead(
  dealershipId: string,
  id: string,
  data: InventorySourceLeadUpdateInput
) {
  const existing = await prisma.inventorySourceLead.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Prisma.InventorySourceLeadUpdateInput = {};
  if (data.sellerName !== undefined) payload.sellerName = data.sellerName;
  if (data.sellerPhone !== undefined) payload.sellerPhone = data.sellerPhone;
  if (data.sellerEmail !== undefined) payload.sellerEmail = data.sellerEmail;
  if (data.askingPriceCents !== undefined) payload.askingPriceCents = data.askingPriceCents;
  if (data.negotiatedPriceCents !== undefined) payload.negotiatedPriceCents = data.negotiatedPriceCents;
  if (data.appraisalId !== undefined) {
    payload.appraisal =
      data.appraisalId === null
        ? { disconnect: true }
        : { connect: { id: data.appraisalId } };
  }
  return prisma.inventorySourceLead.update({
    where: { id },
    data: payload,
    include: {
      appraisal: { select: { id: true, vin: true, status: true } },
    },
  });
}

export async function setInventorySourceLeadStatus(
  dealershipId: string,
  id: string,
  status: InventorySourceLeadStatus
) {
  const existing = await prisma.inventorySourceLead.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.inventorySourceLead.update({
    where: { id },
    data: { status },
    include: {
      appraisal: { select: { id: true, vin: true, status: true } },
    },
  });
}
