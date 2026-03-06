import { prisma } from "@/lib/db";
import type { DealStatus } from "@prisma/client";

export type DealHistoryCreateInput = {
  fromStatus: DealStatus | null;
  toStatus: DealStatus;
  changedBy: string | null;
};

export async function listDealHistory(
  dealershipId: string,
  dealId: string,
  options?: { limit?: number; offset?: number }
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const where = { dealershipId, dealId };
  const [data, total] = await Promise.all([
    prisma.dealHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.dealHistory.count({ where }),
  ]);
  return { data, total };
}

export async function insertDealHistory(
  dealershipId: string,
  dealId: string,
  data: DealHistoryCreateInput
) {
  return prisma.dealHistory.create({
    data: {
      dealershipId,
      dealId,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      changedBy: data.changedBy,
    },
  });
}
