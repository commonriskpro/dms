import { prisma } from "@/lib/db";
import type { CustomerCallbackStatus } from "@prisma/client";

export type CallbackListOptions = {
  limit: number;
  offset: number;
  status?: CustomerCallbackStatus;
};

export async function createCallback(
  dealershipId: string,
  customerId: string,
  data: {
    callbackAt: Date;
    reason?: string | null;
    assignedToUserId?: string | null;
  }
) {
  return prisma.customerCallback.create({
    data: {
      dealershipId,
      customerId,
      callbackAt: data.callbackAt,
      reason: data.reason ?? null,
      assignedToUserId: data.assignedToUserId ?? null,
    },
    include: {
      assignedTo: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function getCallbacksByCustomerId(
  dealershipId: string,
  customerId: string,
  options: CallbackListOptions
) {
  const { limit, offset, status } = options;
  const where = { dealershipId, customerId, ...(status && { status }) };
  const [data, total] = await Promise.all([
    prisma.customerCallback.findMany({
      where,
      orderBy: [{ status: "asc" }, { callbackAt: "asc" }],
      take: limit,
      skip: offset,
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.customerCallback.count({ where }),
  ]);
  return { data, total };
}

export async function getCallbackById(
  dealershipId: string,
  callbackId: string
) {
  return prisma.customerCallback.findFirst({
    where: { id: callbackId, dealershipId },
    include: {
      assignedTo: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function updateCallback(
  dealershipId: string,
  callbackId: string,
  data: { status?: CustomerCallbackStatus; snoozedUntil?: Date | null }
) {
  const existing = await prisma.customerCallback.findFirst({
    where: { id: callbackId, dealershipId },
  });
  if (!existing) return null;
  const updatePayload: { status?: CustomerCallbackStatus; snoozedUntil?: Date | null } = {};
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.snoozedUntil !== undefined) updatePayload.snoozedUntil = data.snoozedUntil;
  if (Object.keys(updatePayload).length === 0) return existing;
  return prisma.customerCallback.update({
    where: { id: callbackId },
    data: updatePayload,
    include: {
      assignedTo: { select: { id: true, fullName: true, email: true } },
    },
  });
}

/** Count callbacks created today (start of day UTC). For dashboard team activity. */
export async function countCallbacksCreatedToday(dealershipId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return prisma.customerCallback.count({
    where: { dealershipId, createdAt: { gte: start } },
  });
}
