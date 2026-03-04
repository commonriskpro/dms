import { prisma } from "@/lib/db";

export type AppendActivityInput = {
  opportunityId: string;
  activityType: string;
  fromStageId?: string | null;
  toStageId?: string | null;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
};

export async function appendActivity(
  dealershipId: string,
  input: AppendActivityInput
) {
  return prisma.opportunityActivity.create({
    data: {
      dealershipId,
      opportunityId: input.opportunityId,
      activityType: input.activityType,
      fromStageId: input.fromStageId ?? null,
      toStageId: input.toStageId ?? null,
      metadata: input.metadata == null ? undefined : (input.metadata as object),
      actorId: input.actorId ?? null,
    },
  });
}

export type ActivityListOptions = {
  limit: number;
  offset: number;
};

export async function listActivityByOpportunityId(
  dealershipId: string,
  opportunityId: string,
  options: ActivityListOptions
) {
  const { limit, offset } = options;
  const where = { dealershipId, opportunityId };
  const [data, total] = await Promise.all([
    prisma.opportunityActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        fromStage: { select: { id: true, name: true } },
        toStage: { select: { id: true, name: true } },
        actor: { select: { id: true, fullName: true } },
      },
    }),
    prisma.opportunityActivity.count({ where }),
  ]);
  return { data, total };
}
