/**
 * Bulk Import job producer.
 * When REDIS_URL is set → pushes to BullMQ "bulkImport" queue.
 * When no Redis → executes sync fallback (import runs in-process).
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { recordJobEnqueue } from "@/lib/infrastructure/metrics/prometheus";
import { getQueueSingleton } from "@/lib/infrastructure/jobs/queueSingleton";

export type BulkImportJobData = {
  dealershipId: string;
  importId: string;
  requestedByUserId: string;
  rowCount: number;
  rows: Array<{
    rowNumber: number;
    stockNumber: string;
    vin?: string;
    status?: string;
    salePriceCents?: number;
  }>;
};

export type BulkImportSyncHandler = (data: BulkImportJobData) => Promise<void>;

/**
 * Enqueue a bulk vehicle import job.
 * Pass a syncHandler for the no-Redis fallback path (runs in-process synchronously).
 */
export async function enqueueBulkImport(
  data: BulkImportJobData,
  syncHandler?: BulkImportSyncHandler
): Promise<{ enqueued: boolean }> {
  if (!data.dealershipId) {
    console.error("[jobs/enqueueBulkImport] Missing dealershipId — skipped");
    return { enqueued: false };
  }

  if (process.env.REDIS_URL) {
    try {
      const queue = await getQueueSingleton<BulkImportJobData>("bulkImport");
      await queue.add("bulkImport", data, {
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      });
      recordJobEnqueue("bulkImport");
      return { enqueued: true };
    } catch (err) {
      console.error("[jobs/enqueueBulkImport] Failed to enqueue — running sync:", err);
      if (syncHandler) await syncHandler(data);
      return { enqueued: false };
    }
  }

  // Sync fallback: run handler in-process
  recordJobEnqueue("bulkImport");
  if (syncHandler) {
    await syncHandler(data);
  }
  return { enqueued: false };
}
