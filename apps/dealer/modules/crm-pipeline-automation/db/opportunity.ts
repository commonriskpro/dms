import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { OpportunityStatus } from "@prisma/client";
import { labelQueryFamily } from "@/lib/request-context";
import { paginatedQuery } from "@/lib/db/paginate";

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

export async function countOpportunities(
  dealershipId: string,
  filters: OpportunityListFilters
): Promise<number> {
  const conditions: Prisma.Sql[] = [Prisma.sql`o.dealership_id = ${dealershipId}::uuid`];

  if (filters.stageId) {
    conditions.push(Prisma.sql`o.stage_id = ${filters.stageId}::uuid`);
  }
  if (filters.ownerId) {
    conditions.push(Prisma.sql`o.owner_id = ${filters.ownerId}::uuid`);
  }
  if (filters.status) {
    conditions.push(Prisma.sql`o.status = ${filters.status}::"OpportunityStatus"`);
  }
  if (filters.customerId) {
    conditions.push(Prisma.sql`o.customer_id = ${filters.customerId}::uuid`);
  }
  if (filters.source) {
    conditions.push(Prisma.sql`o.source = ${filters.source}`);
  }
  if (filters.pipelineId) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "Stage" s
        WHERE s.id = o.stage_id
          AND s.dealership_id = ${dealershipId}::uuid
          AND s.pipeline_id = ${filters.pipelineId}::uuid
      )`
    );
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(
      Prisma.sql`(
        o.next_action_text ILIKE ${pattern}
        OR o.notes ILIKE ${pattern}
        OR o.source ILIKE ${pattern}
        OR EXISTS (
          SELECT 1
          FROM "Customer" c
          WHERE c.id = o.customer_id
            AND c.dealership_id = ${dealershipId}::uuid
            AND c.name ILIKE ${pattern}
        )
      )`
    );
  }

  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "Opportunity" o
    WHERE ${Prisma.join(conditions, " AND ")}
  `);

  return Number(rows[0]?.count ?? 0);
}

export async function listOpportunities(dealershipId: string, options: OpportunityListOptions) {
  labelQueryFamily("crm.opportunities.list");
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
  return paginatedQuery(
    () =>
      prisma.opportunity.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          dealershipId: true,
          customerId: true,
          vehicleId: true,
          dealId: true,
          stageId: true,
          ownerId: true,
          source: true,
          priority: true,
          estimatedValueCents: true,
          notes: true,
          nextActionAt: true,
          nextActionText: true,
          status: true,
          lossReason: true,
          createdAt: true,
          updatedAt: true,
          stage: {
            select: {
              id: true,
              pipelineId: true,
              order: true,
              name: true,
              colorKey: true,
              dealershipId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          customer: { select: { id: true, name: true } },
          vehicle: { select: { id: true, vin: true, year: true, make: true, model: true } },
          deal: { select: { id: true, status: true } },
          owner: { select: { id: true, fullName: true, email: true } },
        },
      }),
    () => countOpportunities(dealershipId, filters)
  );
}

export async function getOpenOpportunityFilterOptions(dealershipId: string): Promise<{
  owners: Array<{ value: string; label: string }>;
  sources: Array<{ value: string; label: string }>;
}> {
  labelQueryFamily("crm.opportunities.filter-options");
  const [ownerRows, sourceRows] = await Promise.all([
    prisma.$queryRaw<Array<{ value: string; label: string }>>(Prisma.sql`
      SELECT DISTINCT
        p.id AS value,
        COALESCE(p.full_name, p.email) AS label
      FROM "Opportunity" o
      JOIN "Profile" p
        ON p.id = o.owner_id
      WHERE o.dealership_id = ${dealershipId}::uuid
        AND o.status = 'OPEN'::"OpportunityStatus"
        AND o.owner_id IS NOT NULL
      ORDER BY label ASC
    `),
    prisma.$queryRaw<Array<{ value: string }>>(Prisma.sql`
      SELECT DISTINCT
        o.source AS value
      FROM "Opportunity" o
      WHERE o.dealership_id = ${dealershipId}::uuid
        AND o.status = 'OPEN'::"OpportunityStatus"
        AND o.source IS NOT NULL
      ORDER BY o.source ASC
    `),
  ]);

  const owners = ownerRows.filter((owner) => Boolean(owner.value && owner.label));
  const sources = sourceRows
    .filter((source) => Boolean(source.value))
    .map((source) => ({ value: source.value, label: source.value }));

  return { owners, sources };
}

export async function getOpportunityById(dealershipId: string, id: string) {
  labelQueryFamily("crm.opportunities.detail");
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
  labelQueryFamily("crm.opportunities.create");
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
  labelQueryFamily("crm.opportunities.update");
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
