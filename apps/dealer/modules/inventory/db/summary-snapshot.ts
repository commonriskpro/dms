import { prisma } from "@/lib/db";
import type { InventorySummaryScope } from "@prisma/client";

type SnapshotKey = {
  dealershipId: string;
  scope: InventorySummaryScope;
  userId: string;
  hasPipeline?: boolean;
};

export async function getSummarySnapshot(key: SnapshotKey) {
  return prisma.inventorySummarySnapshot.findUnique({
    where: {
      dealershipId_scope_userId_hasPipeline: {
        dealershipId: key.dealershipId,
        scope: key.scope,
        userId: key.userId,
        hasPipeline: key.hasPipeline ?? false,
      },
    },
    select: {
      snapshotJson: true,
      computedAt: true,
      updatedAt: true,
    },
  });
}

export async function upsertSummarySnapshot(
  key: SnapshotKey,
  snapshotJson: unknown
) {
  return prisma.inventorySummarySnapshot.upsert({
    where: {
      dealershipId_scope_userId_hasPipeline: {
        dealershipId: key.dealershipId,
        scope: key.scope,
        userId: key.userId,
        hasPipeline: key.hasPipeline ?? false,
      },
    },
    create: {
      dealershipId: key.dealershipId,
      scope: key.scope,
      userId: key.userId,
      hasPipeline: key.hasPipeline ?? false,
      snapshotJson: snapshotJson as object,
      computedAt: new Date(),
    },
    update: {
      snapshotJson: snapshotJson as object,
      computedAt: new Date(),
    },
  });
}
