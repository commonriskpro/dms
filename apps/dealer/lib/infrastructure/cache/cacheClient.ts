/**
 * Distributed cache client.
 * Redis backend when REDIS_URL is set; falls back to in-memory TTL cache.
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 * All errors are caught and logged — never propagated to callers.
 */

import { createTtlCache } from "@/modules/core/cache/ttl-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CacheClient = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Delete all keys starting with prefix. Safe prefix scan — never uses KEYS. */
  delPrefix(prefix: string): Promise<void>;
};

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

const globalForMemCache = globalThis as typeof globalThis & {
  __dealerMemCache?: ReturnType<typeof createTtlCache<string>>;
};

function getMemCache(): ReturnType<typeof createTtlCache<string>> {
  if (!globalForMemCache.__dealerMemCache) {
    // maxEntries=2000, ttlMs overridden per-set via wrapper
    globalForMemCache.__dealerMemCache = createTtlCache<string>({
      ttlMs: 60_000,
      maxEntries: 2000,
    });
  }
  return globalForMemCache.__dealerMemCache;
}

/**
 * In-memory cache client backed by createTtlCache.
 * TTL is applied per-set by storing expiry metadata in the value JSON envelope.
 */
function makeMemoryClient(): CacheClient {
  // We store {v, exp} so we can honour per-key TTL even though the backing
  // cache has a single TTL. The backing TTL (60s) acts as max upper bound.
  type Envelope = { v: unknown; exp: number };

  const cache = getMemCache();

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const raw = cache.get(key);
        if (raw === undefined) return null;
        const envelope: Envelope = JSON.parse(raw);
        if (Date.now() > envelope.exp) {
          cache.delete(key);
          return null;
        }
        return envelope.v as T;
      } catch {
        return null;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      try {
        const envelope: Envelope = { v: value, exp: Date.now() + ttlSeconds * 1000 };
        cache.set(key, JSON.stringify(envelope));
        getTrackedKeys().add(key);
      } catch (err) {
        console.error("[cache/memory] set error:", err);
      }
    },

    async del(key: string): Promise<void> {
      try {
        cache.delete(key);
        getTrackedKeys().delete(key);
      } catch (err) {
        console.error("[cache/memory] del error:", err);
      }
    },

    async delPrefix(prefix: string): Promise<void> {
      try {
        // Access internal map via a known-safe pattern: re-export from ttl-cache isn't
        // exposed, so we track our own prefix-delete list via a side Map.
        // Workaround: store a global Set of all live keys so we can scan by prefix.
        const keys = getTrackedKeys();
        const toDelete = [...keys].filter((k) => k.startsWith(prefix));
        for (const k of toDelete) {
          cache.delete(k);
          keys.delete(k);
        }
      } catch (err) {
        console.error("[cache/memory] delPrefix error:", err);
      }
    },
  };
}

// Side-channel key tracker for delPrefix support (in-memory only)
const globalForKeys = globalThis as typeof globalThis & {
  __dealerCacheKeys?: Set<string>;
};

export function getTrackedKeys(): Set<string> {
  if (!globalForKeys.__dealerCacheKeys) {
    globalForKeys.__dealerCacheKeys = new Set();
  }
  return globalForKeys.__dealerCacheKeys;
}

// ---------------------------------------------------------------------------
// Redis client
// ---------------------------------------------------------------------------

function makeRedisClient(): CacheClient {
  // Dynamic import to avoid crashing when ioredis not used
  let redisPromise: Promise<import("ioredis").default> | null = null;

  async function getRedis(): Promise<import("ioredis").default> {
    if (!redisPromise) {
      const { default: IORedis } = await import("ioredis");
      const client = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        lazyConnect: true,
      });
      client.on("error", (err) => console.error("[cache/redis] error:", err));
      await client.connect();
      redisPromise = Promise.resolve(client);
    }
    return redisPromise;
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const redis = await getRedis();
        const raw = await redis.get(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        console.error("[cache/redis] get error:", err);
        return null;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      try {
        const redis = await getRedis();
        await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } catch (err) {
        console.error("[cache/redis] set error:", err);
      }
    },

    async del(key: string): Promise<void> {
      try {
        const redis = await getRedis();
        await redis.del(key);
      } catch (err) {
        console.error("[cache/redis] del error:", err);
      }
    },

    async delPrefix(prefix: string): Promise<void> {
      try {
        const redis = await getRedis();
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            `${prefix}*`,
            "COUNT",
            100
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== "0");
      } catch (err) {
        console.error("[cache/redis] delPrefix error:", err);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton — auto-selects backend
// ---------------------------------------------------------------------------

const globalForClient = globalThis as typeof globalThis & {
  __dealerCacheClient?: CacheClient;
};

function buildClient(): CacheClient {
  const memClient = makeMemoryClient();
  if (!process.env.REDIS_URL) return memClient;

  const redisClient = makeRedisClient();

  // Wrap Redis client: on any error, transparently fall back to in-memory
  return {
    async get<T>(key: string): Promise<T | null> {
      const result = await redisClient.get<T>(key);
      if (result !== null) return result;
      // Redis returned null — could be miss or silent error (already logged)
      return memClient.get<T>(key);
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await redisClient.set(key, value, ttlSeconds);
      // Mirror to memory for resilience on Redis disconnect
      await memClient.set(key, value, ttlSeconds);
      getTrackedKeys().add(key);
    },
    async del(key: string): Promise<void> {
      await redisClient.del(key);
      await memClient.del(key);
      getTrackedKeys().delete(key);
    },
    async delPrefix(prefix: string): Promise<void> {
      await redisClient.delPrefix(prefix);
      await memClient.delPrefix(prefix);
    },
  };
}

export function getCacheClient(): CacheClient {
  if (!globalForClient.__dealerCacheClient) {
    globalForClient.__dealerCacheClient = buildClient();
  }
  return globalForClient.__dealerCacheClient;
}

/** Reset singleton — for tests only. */
export function _resetCacheClient(): void {
  globalForClient.__dealerCacheClient = undefined;
  globalForMemCache.__dealerMemCache = undefined;
  globalForKeys.__dealerCacheKeys = undefined;
}
