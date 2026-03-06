import { prisma } from "@/lib/db";

const PURGE_BATCH_SIZE = 5000;

export async function purgeOldMonitoringEvents(input: {
  olderThanDays: number;
}): Promise<{ deletedCount: number; cutoffIso: string; touchedTables: string[] }> {
  const olderThanDays = Math.max(1, Math.trunc(input.olderThanDays));
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  let deletedCount = 0;
  for (;;) {
    const batch = await prisma.platformMonitoringEvent.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: PURGE_BATCH_SIZE,
    });
    if (batch.length === 0) break;

    const ids = batch.map((row) => row.id);
    const deleted = await prisma.platformMonitoringEvent.deleteMany({
      where: { id: { in: ids } },
    });
    deletedCount += deleted.count;
  }

  // Explicitly document that audit logs are never touched by this purge.
  return {
    deletedCount,
    cutoffIso: cutoff.toISOString(),
    touchedTables: ["platform_monitoring_events"],
  };
}
