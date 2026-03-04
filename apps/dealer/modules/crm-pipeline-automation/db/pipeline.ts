import { prisma } from "@/lib/db";

export type PipelineListOptions = {
  limit: number;
  offset: number;
};

export async function listPipelines(dealershipId: string, options: PipelineListOptions) {
  const { limit, offset } = options;
  const where = { dealershipId };
  const [data, total] = await Promise.all([
    prisma.pipeline.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { stages: { orderBy: { order: "asc" } } },
    }),
    prisma.pipeline.count({ where }),
  ]);
  return { data, total };
}

export async function getPipelineById(dealershipId: string, id: string) {
  return prisma.pipeline.findFirst({
    where: { id, dealershipId },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export type CreatePipelineInput = {
  name: string;
  isDefault?: boolean;
};

export async function createPipeline(dealershipId: string, data: CreatePipelineInput) {
  return prisma.pipeline.create({
    data: {
      dealershipId,
      name: data.name,
      isDefault: data.isDefault ?? false,
    },
    include: { stages: true },
  });
}

export type UpdatePipelineInput = {
  name?: string;
  isDefault?: boolean;
};

export async function updatePipeline(
  dealershipId: string,
  id: string,
  data: UpdatePipelineInput
) {
  const existing = await prisma.pipeline.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.pipeline.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function deletePipeline(dealershipId: string, id: string) {
  const existing = await prisma.pipeline.findFirst({
    where: { id, dealershipId },
    include: { stages: { include: { _count: { select: { opportunities: true } } } } },
  });
  if (!existing) return null;
  const hasOpportunities = existing.stages.some((s) => s._count.opportunities > 0);
  if (hasOpportunities) return "HAS_OPPORTUNITIES" as const;
  await prisma.pipeline.delete({ where: { id } });
  return existing;
}

export async function getDefaultPipelineId(dealershipId: string): Promise<string | null> {
  const p = await prisma.pipeline.findFirst({
    where: { dealershipId, isDefault: true },
    select: { id: true },
  });
  return p?.id ?? null;
}
