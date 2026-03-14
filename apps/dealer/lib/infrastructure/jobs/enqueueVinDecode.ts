/**
 * VIN Decode job producer.
 * Requires REDIS_URL. Pushes to BullMQ "vinDecode" queue; throws when Redis is unavailable.
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
 * Enqueue a VIN decode job (async post-processing). Redis is required; throws if REDIS_URL is unset or enqueue fails.
 */
export async function enqueueVinDecode(data: VinDecodeJobData): Promise<void> {
  if (!data.dealershipId) {
    throw new Error("[jobs/enqueueVinDecode] Missing dealershipId");
  }
  if (!process.env.REDIS_URL) {
    throw new Error("[jobs/enqueueVinDecode] REDIS_URL is required for job enqueue");
  }
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
}
