/**
 * Shared ioredis connection singleton for BullMQ producers in the dealer app.
 * Only instantiated when REDIS_URL is present.
 * Lazy import: this file is only imported when REDIS_URL check passes.
 */

import type { ConnectionOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
