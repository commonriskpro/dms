/**
 * Bulk Import job producer.
 * When REDIS_URL is set → pushes to BullMQ "bulkImport" queue.
 * When no Redis → executes sync fallback (import runs in-process).
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { recordJobEnqueue } from "@/lib/infrastructure/metrics/prometheus";

export type BulkImportJobData = {
  dealershipId: string;
  importId: string;
  rowCount: number;
  /** JSON-serializable row data */
  rows: Record<string, unknown>[];
};

export type BulkImportSyncHandler = (data: BulkImportJobData) => Promise<void>;

/**
 * Enqueue a bulk vehicle import job.
 * Pass a syncHandler for the no-Redis fallback path (runs in-process synchronously).
 */
export async function enqueueBulkImport(
  data: BulkImportJobData,
  syncHandler?: BulkImportSyncHandler
): Promise<void> {
  if (!data.dealershipId) {
    console.error("[jobs/enqueueBulkImport] Missing dealershipId — skipped");
    return;
  }

  if (process.env.REDIS_URL) {
    try {
      const { Queue } = await import("bullmq");
      const { redisConnection } = await import("@/lib/infrastructure/jobs/redis");
      const queue = new Queue("bulkImport", { connection: redisConnection });
      await queue.add("bulkImport", data, {
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      });
      recordJobEnqueue("bulkImport");
    } catch (err) {
      console.error("[jobs/enqueueBulkImport] Failed to enqueue — running sync:", err);
      if (syncHandler) await syncHandler(data);
    }
    return;
  }

  // Sync fallback: run handler in-process
  recordJobEnqueue("bulkImport");
  if (syncHandler) {
    await syncHandler(data);
  }
}
