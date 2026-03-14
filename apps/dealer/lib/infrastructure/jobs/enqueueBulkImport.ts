/**
 * Bulk Import job producer.
 * Requires REDIS_URL. Pushes to BullMQ "bulkImport" queue; throws when Redis is unavailable.
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

/**
 * Enqueue a bulk vehicle import job. Redis is required; throws if REDIS_URL is unset or enqueue fails.
 */
export async function enqueueBulkImport(data: BulkImportJobData): Promise<void> {
  if (!data.dealershipId) {
    throw new Error("[jobs/enqueueBulkImport] Missing dealershipId");
  }
  if (!process.env.REDIS_URL) {
    throw new Error("[jobs/enqueueBulkImport] REDIS_URL is required for job enqueue");
  }
  const queue = await getQueueSingleton<BulkImportJobData>("bulkImport");
  await queue.add("bulkImport", data, {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 25 },
  });
  recordJobEnqueue("bulkImport");
}
