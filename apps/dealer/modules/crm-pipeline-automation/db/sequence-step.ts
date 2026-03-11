import { prisma } from "@/lib/db";

export type CreateSequenceStepInput = {
  order: number;
  stepType: string;
  config?: Record<string, unknown> | null;
};

export async function listStepsByTemplateId(dealershipId: string, templateId: string) {
  return prisma.sequenceStep.findMany({
    where: { dealershipId, templateId },
    orderBy: { order: "asc" },
  });
}

export async function createSequenceStep(
  dealershipId: string,
  templateId: string,
  data: CreateSequenceStepInput
) {
  return prisma.sequenceStep.create({
    data: {
      dealershipId,
      templateId,
      order: data.order,
      stepType: data.stepType,
      config: data.config == null ? undefined : (data.config as object),
    },
  });
}

export type UpdateSequenceStepInput = {
  order?: number;
  stepType?: string;
  config?: Record<string, unknown> | null;
};

export async function updateSequenceStep(
  dealershipId: string,
  id: string,
  data: UpdateSequenceStepInput
) {
  const existing = await prisma.sequenceStep.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.sequenceStep.update({
    where: { id },
    data: {
      ...(data.order !== undefined && { order: data.order }),
      ...(data.stepType !== undefined && { stepType: data.stepType }),
      ...(data.config !== undefined && { config: data.config == null ? undefined : (data.config as object) }),
    },
  });
}

export async function deleteSequenceStep(dealershipId: string, id: string) {
  const existing = await prisma.sequenceStep.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  await prisma.sequenceStep.delete({ where: { id } });
  return existing;
}
