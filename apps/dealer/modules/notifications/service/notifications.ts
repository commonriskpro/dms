import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { Prisma } from "@prisma/client";
import * as notificationsDb from "@/modules/notifications/db/notifications";

export type NotificationPayload = {
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

export async function createForUser(
  dealershipId: string,
  userId: string,
  payload: NotificationPayload
) {
  await requireTenantActiveForWrite(dealershipId);
  return notificationsDb.createNotification(dealershipId, userId, payload);
}

export async function createForActiveMembers(
  dealershipId: string,
  payload: NotificationPayload
): Promise<number> {
  await requireTenantActiveForWrite(dealershipId);
  const userIds = await notificationsDb.listActiveMemberUserIds(dealershipId);
  return notificationsDb.createNotificationsForUsers(dealershipId, userIds, payload);
}

export async function listForUser(
  dealershipId: string,
  userId: string,
  options: ListNotificationsOptions
) {
  await requireTenantActiveForRead(dealershipId);
  return notificationsDb.listByUser(dealershipId, userId, options);
}

export async function markAsRead(
  dealershipId: string,
  userId: string,
  notificationId: string
) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await notificationsDb.markRead(dealershipId, userId, notificationId);
  if (!updated) throw new ApiError("NOT_FOUND", "Notification not found");
  return updated;
}
