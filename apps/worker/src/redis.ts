import type { ConnectionOptions } from "bullmq";

if (!process.env.REDIS_URL) {
  throw new Error("[worker] REDIS_URL is required to run the worker process");
}

/**
 * Connection options passed directly to BullMQ.
 * Using URL string avoids ioredis version conflicts between the
 * separately installed ioredis and BullMQ's bundled ioredis.
 */
export const redisConnection: ConnectionOptions = {
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
