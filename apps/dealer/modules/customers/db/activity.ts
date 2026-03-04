import { prisma } from "@/lib/db";

export type ActivityListOptions = {
  limit: number;
  offset: number;
};

export async function appendActivity(
  dealershipId: string,
  customerId: string,
  activityType: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> | null,
  actorId: string | null
) {
  return prisma.customerActivity.create({
    data: {
      dealershipId,
      customerId,
      activityType,
      entityType,
      entityId,
      metadata: metadata ? (metadata as object) : undefined,
      actorId,
    },
  });
}

export async function listActivity(
  dealershipId: string,
  customerId: string,
  options: ActivityListOptions
) {
  const { limit, offset } = options;
  const where = { dealershipId, customerId };
  const [data, total] = await Promise.all([
    prisma.customerActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.customerActivity.count({ where }),
  ]);
  return { data, total };
}
