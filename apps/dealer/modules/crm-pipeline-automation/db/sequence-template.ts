import { prisma } from "@/lib/db";

export type SequenceTemplateListOptions = { limit: number; offset: number };

export async function listSequenceTemplates(
  dealershipId: string,
  options: SequenceTemplateListOptions
) {
  const { limit, offset } = options;
  const where = { dealershipId, deletedAt: null };
  const [data, total] = await Promise.all([
    prisma.sequenceTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { steps: { orderBy: { order: "asc" } } },
    }),
    prisma.sequenceTemplate.count({ where }),
  ]);
  return { data, total };
}

export async function getSequenceTemplateById(dealershipId: string, id: string) {
  return prisma.sequenceTemplate.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export type CreateSequenceTemplateInput = { name: string; description?: string | null };

export async function createSequenceTemplate(
  dealershipId: string,
  data: CreateSequenceTemplateInput
) {
  return prisma.sequenceTemplate.create({
    data: {
      dealershipId,
      name: data.name,
      description: data.description ?? null,
    },
    include: { steps: true },
  });
}

export type UpdateSequenceTemplateInput = { name?: string; description?: string | null };

export async function updateSequenceTemplate(
  dealershipId: string,
  id: string,
  data: UpdateSequenceTemplateInput
) {
  const existing = await prisma.sequenceTemplate.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  return prisma.sequenceTemplate.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export async function softDeleteSequenceTemplate(dealershipId: string, id: string) {
  const existing = await prisma.sequenceTemplate.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  return prisma.sequenceTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
