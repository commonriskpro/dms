/**
 * VIN Decode job producer.
 * When REDIS_URL is set → pushes to BullMQ "vinDecode" queue.
 * When no Redis → executes a sync no-op stub (VIN decode remains synchronous in the route handler).
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { recordJobEnqueue } from "@/lib/infrastructure/metrics/prometheus";

export type VinDecodeJobData = {
  dealershipId: string;
  vehicleId: string;
  vin: string;
};

/**
 * Enqueue a VIN decode job.
 * Caller must already have performed the decode synchronously if needed —
 * this is for async post-processing (cache warm-up, analytics, audit).
 */
export async function enqueueVinDecode(data: VinDecodeJobData): Promise<void> {
  if (!data.dealershipId) {
    console.error("[jobs/enqueueVinDecode] Missing dealershipId — skipped");
    return;
  }

  if (process.env.REDIS_URL) {
    try {
      const { Queue } = await import("bullmq");
      const { redisConnection } = await import("@/lib/infrastructure/jobs/redis");
      const queue = new Queue("vinDecode", { connection: redisConnection });
      await queue.add("vinDecode", data, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });
      recordJobEnqueue("vinDecode");
    } catch (err) {
      console.error("[jobs/enqueueVinDecode] Failed to enqueue — falling back to no-op:", err);
    }
    return;
  }

  // Sync fallback: no-op (VIN decode already happened synchronously in route)
  recordJobEnqueue("vinDecode");
}
