import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CreateNotificationInput = {
  title: string;
  body?: string | null;
  kind: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type ListNotificationsOptions = {
  limit: number;
  offset: number;
  unreadOnly?: boolean;
};

function notificationWhere(
  dealershipId: string,
  userId: string,
  unreadOnly?: boolean
): Prisma.UserNotificationWhereInput {
  return {
    dealershipId,
    userId,
    deletedAt: null,
    ...(unreadOnly ? { readAt: null } : {}),
  };
}

export async function createNotification(
  dealershipId: string,
  userId: string,
  input: CreateNotificationInput
) {
  return prisma.userNotification.create({
    data: {
      dealershipId,
      userId,
      title: input.title,
      body: input.body ?? null,
      kind: input.kind,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}

export async function createNotificationsForUsers(
  dealershipId: string,
  userIds: string[],
  input: CreateNotificationInput
): Promise<number> {
  if (userIds.length === 0) return 0;
  const result = await prisma.userNotification.createMany({
    data: userIds.map((userId) => ({
      dealershipId,
      userId,
      title: input.title,
      body: input.body ?? null,
      kind: input.kind,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    })),
  });
  return result.count;
}

export async function listByUser(
  dealershipId: string,
  userId: string,
  options: ListNotificationsOptions
) {
  const where = notificationWhere(dealershipId, userId, options.unreadOnly);
  const [items, total] = await Promise.all([
    prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(options.limit, 100),
      skip: options.offset,
    }),
    prisma.userNotification.count({ where }),
  ]);
  return { items, total };
}

export async function markRead(
  dealershipId: string,
  userId: string,
  notificationId: string
) {
  const now = new Date();
  const result = await prisma.userNotification.updateMany({
    where: {
      id: notificationId,
      dealershipId,
      userId,
      deletedAt: null,
      readAt: null,
    },
    data: { readAt: now },
  });

  if (result.count === 0) {
    const existing = await prisma.userNotification.findFirst({
      where: { id: notificationId, dealershipId, userId, deletedAt: null },
    });
    return existing ?? null;
  }

  return prisma.userNotification.findFirst({
    where: { id: notificationId, dealershipId, userId, deletedAt: null },
  });
}

export async function listActiveMemberUserIds(dealershipId: string): Promise<string[]> {
  const rows = await prisma.membership.findMany({
    where: { dealershipId, disabledAt: null },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.map((row) => row.userId);
}
