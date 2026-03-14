/**
 * Redis-backed rate limiter for public endpoints (e.g. website_lead).
 * When REDIS_URL is set, uses Redis for distributed counting; otherwise
 * falls back to in-memory store. On Redis errors, falls back to in-memory
 * (per-instance limit only — documented).
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { getClientIdentifier } from "@/lib/api/rate-limit";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";

const WEBSITE_LEAD_WINDOW_SEC = 60;
const WEBSITE_LEAD_MAX = 5;

const RATE_LIMIT_KEY_PREFIX = "rl:website_lead:";

type RedisClient = import("ioredis").default;
let redisPromise: Promise<RedisClient> | null = null;

async function getRedis(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null;
  if (!redisPromise) {
    redisPromise = (async () => {
      const { default: IORedis } = await import("ioredis");
      const client = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        lazyConnect: true,
      });
      client.on("error", (err) => console.error("[rate-limit/redis] error:", err));
      await client.connect();
      return client;
    })();
  }
  try {
    return await redisPromise;
  } catch {
    return null;
  }
}

export type PublicRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Check and increment website_lead rate limit for the given identifier (e.g. IP).
 * Uses Redis when REDIS_URL is set for distributed limiting; otherwise in-memory.
 * On Redis failure, falls back to in-memory (limit is then per-instance).
 */
export async function checkAndIncrementWebsiteLeadRateLimit(
  identifier: string
): Promise<PublicRateLimitResult> {
  const redis = await getRedis();
  if (redis) {
    try {
      const key = `${RATE_LIMIT_KEY_PREFIX}${identifier}`;
      const count = await redis.incr(key);
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        await redis.expire(key, WEBSITE_LEAD_WINDOW_SEC);
      }
      if (count > WEBSITE_LEAD_MAX) {
        await redis.decr(key);
        return { allowed: false, retryAfterMs: WEBSITE_LEAD_WINDOW_SEC * 1000 };
      }
      return { allowed: true };
    } catch (err) {
      console.error("[rate-limit/redis] check/increment error:", err);
      // Fall through to in-memory fallback
    }
  }

  const key = `ip:${identifier}:website_lead`;
  const allowed = checkRateLimit(key, "website_lead");
  if (!allowed) {
    return { allowed: false, retryAfterMs: WEBSITE_LEAD_WINDOW_SEC * 1000 };
  }
  incrementRateLimit(key, "website_lead");
  return { allowed: true };
}

/** Re-export for use in public lead route (server derives IP from request). */
export { getClientIdentifier };
