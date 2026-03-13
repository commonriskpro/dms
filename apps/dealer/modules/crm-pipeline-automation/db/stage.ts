import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { labelQueryFamily } from "@/lib/request-context";

export type CreateStageInput = {
  order: number;
  name: string;
  colorKey?: string | null;
};

export async function listStagesByPipelineId(dealershipId: string, pipelineId: string) {
  return prisma.stage.findMany({
    where: { dealershipId, pipelineId },
    orderBy: { order: "asc" },
  });
}

export async function getStageById(dealershipId: string, id: string) {
  return prisma.stage.findFirst({
    where: { id, dealershipId },
    include: { pipeline: true },
  });
}

export async function createStage(
  dealershipId: string,
  pipelineId: string,
  data: CreateStageInput
) {
  return prisma.stage.create({
    data: {
      dealershipId,
      pipelineId,
      order: data.order,
      name: data.name,
      colorKey: data.colorKey ?? null,
    },
  });
}

export type UpdateStageInput = {
  order?: number;
  name?: string;
  colorKey?: string | null;
};

export async function updateStage(
  dealershipId: string,
  id: string,
  data: UpdateStageInput
) {
  const existing = await prisma.stage.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.stage.update({
    where: { id },
    data: {
      ...(data.order !== undefined && { order: data.order }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.colorKey !== undefined && { colorKey: data.colorKey ?? null }),
    },
  });
}

export async function countOpportunitiesInStage(dealershipId: string, stageId: string): Promise<number> {
  return prisma.opportunity.count({
    where: { dealershipId, stageId },
  });
}

/** Dashboard: opportunity counts per stage for tenant, ordered by pipeline and stage order. */
export async function getPipelineFunnelCounts(
  dealershipId: string
): Promise<{ stageId: string; stageName: string; count: number }[]> {
  labelQueryFamily("crm.command-center.pipeline-funnel");
  const rows = await prisma.$queryRaw<Array<{ stageId: string; stageName: string; count: bigint }>>(Prisma.sql`
    SELECT
      s.id AS "stageId",
      s.name AS "stageName",
      COUNT(o.id)::bigint AS count
    FROM "Stage" s
    LEFT JOIN "Opportunity" o
      ON o.stage_id = s.id
     AND o.dealership_id = ${dealershipId}::uuid
    WHERE s.dealership_id = ${dealershipId}::uuid
    GROUP BY s.id, s.name, s.pipeline_id, s."order"
    ORDER BY s.pipeline_id ASC, s."order" ASC
  `);
  return rows.map((row) => ({
    stageId: row.stageId,
    stageName: row.stageName,
    count: Number(row.count),
  }));
}

export async function deleteStage(dealershipId: string, id: string) {
  const existing = await prisma.stage.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  await prisma.stage.delete({ where: { id } });
  return existing;
}

export async function reassignAndDeleteStage(
  dealershipId: string,
  stageId: string,
  targetStageId: string
) {
  const stage = await prisma.stage.findFirst({
    where: { id: stageId, dealershipId },
  });
  const target = await prisma.stage.findFirst({
    where: { id: targetStageId, dealershipId },
  });
  if (!stage || !target || target.pipelineId !== stage.pipelineId) return null;
  await prisma.$transaction([
    prisma.opportunity.updateMany({
      where: { dealershipId, stageId },
      data: { stageId: targetStageId },
    }),
    prisma.stage.delete({ where: { id: stageId } }),
  ]);
  return stage;
}
