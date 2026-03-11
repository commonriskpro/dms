import { prisma } from "@/lib/db";
import type { OpportunityStatus } from "@prisma/client";

export type OpportunityListFilters = {
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  status?: OpportunityStatus;
  customerId?: string;
  source?: string;
  q?: string;
};

export type OpportunityListOptions = {
  limit: number;
  offset: number;
  filters?: OpportunityListFilters;
  sortBy?: "createdAt" | "nextActionAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
};

export async function listOpportunities(dealershipId: string, options: OpportunityListOptions) {
  const { limit, offset, filters = {}, sortBy = "createdAt", sortOrder = "desc" } = options;
  const where: Record<string, unknown> = { dealershipId };
  if (filters.stageId) where.stageId = filters.stageId;
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.status) where.status = filters.status;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.source) where.source = filters.source;
  if (filters.pipelineId) {
    where.stage = { pipelineId: filters.pipelineId };
  }
  if (filters.q) {
    where.OR = [
      { nextActionText: { contains: filters.q, mode: "insensitive" } },
      { notes: { contains: filters.q, mode: "insensitive" } },
      { source: { contains: filters.q, mode: "insensitive" } },
      { customer: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  const orderBy = { [sortBy]: sortOrder };
  const [data, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        stage: true,
        customer: { select: { id: true, name: true } },
        vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
        deal: { select: { id: true, status: true } },
        owner: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.opportunity.count({ where }),
  ]);
  return { data, total };
}

export async function getOpportunityById(dealershipId: string, id: string) {
  return prisma.opportunity.findFirst({
    where: { id, dealershipId },
    include: {
      stage: { include: { pipeline: true } },
      customer: { select: { id: true, name: true, leadSource: true } },
      vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
      deal: { select: { id: true, status: true } },
      owner: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export type CreateOpportunityInput = {
  customerId: string;
  vehicleId?: string | null;
  dealId?: string | null;
  stageId: string;
  ownerId?: string | null;
  source?: string | null;
  priority?: string | null;
  estimatedValueCents?: bigint | null;
  notes?: string | null;
  nextActionAt?: Date | null;
  nextActionText?: string | null;
};

export async function createOpportunity(dealershipId: string, data: CreateOpportunityInput) {
  return prisma.opportunity.create({
    data: {
      dealershipId,
      customerId: data.customerId,
      vehicleId: data.vehicleId ?? null,
      dealId: data.dealId ?? null,
      stageId: data.stageId,
      ownerId: data.ownerId ?? null,
      source: data.source ?? null,
      priority: data.priority ?? null,
      estimatedValueCents: data.estimatedValueCents ?? null,
      notes: data.notes ?? null,
      nextActionAt: data.nextActionAt ?? null,
      nextActionText: data.nextActionText ?? null,
      status: "OPEN",
    },
    include: {
      stage: true,
      customer: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export type UpdateOpportunityInput = {
  stageId?: string;
  ownerId?: string | null;
  source?: string | null;
  priority?: string | null;
  estimatedValueCents?: bigint | null;
  notes?: string | null;
  nextActionAt?: Date | null;
  nextActionText?: string | null;
  status?: OpportunityStatus;
  lossReason?: string | null;
};

export async function updateOpportunity(
  dealershipId: string,
  id: string,
  data: UpdateOpportunityInput
) {
  const existing = await prisma.opportunity.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.opportunity.update({
    where: { id },
    data: {
      ...(data.stageId !== undefined && { stageId: data.stageId }),
      ...(data.ownerId !== undefined && { ownerId: data.ownerId ?? null }),
      ...(data.source !== undefined && { source: data.source ?? null }),
      ...(data.priority !== undefined && { priority: data.priority ?? null }),
      ...(data.estimatedValueCents !== undefined && { estimatedValueCents: data.estimatedValueCents ?? null }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
      ...(data.nextActionAt !== undefined && { nextActionAt: data.nextActionAt ?? null }),
      ...(data.nextActionText !== undefined && { nextActionText: data.nextActionText ?? null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.lossReason !== undefined && { lossReason: data.lossReason ?? null }),
    },
    include: {
      stage: true,
      customer: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true, email: true } },
    },
  });
}
