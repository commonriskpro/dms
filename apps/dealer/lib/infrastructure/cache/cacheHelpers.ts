/**
 * Cache helper — withCache<T> wrapper + stats tracking.
 * On cache hit: returns cached value immediately, records hit metric.
 * On cache miss: runs fn(), stores result, records miss metric.
 * On any cache error: falls back to fn() directly — never throws.
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { getCacheClient, getTrackedKeys } from "@/lib/infrastructure/cache/cacheClient";
import {
  recordCacheHit,
  recordCacheMiss,
  recordCacheInvalidation,
} from "@/lib/infrastructure/metrics/prometheus";

// ---------------------------------------------------------------------------
// In-process stats counters (feeds /api/cache/stats without Prometheus scrape)
// ---------------------------------------------------------------------------

const globalForStats = globalThis as typeof globalThis & {
  __cacheHits?: number;
  __cacheMisses?: number;
};

function incHits(): void {
  globalForStats.__cacheHits = (globalForStats.__cacheHits ?? 0) + 1;
}

function incMisses(): void {
  globalForStats.__cacheMisses = (globalForStats.__cacheMisses ?? 0) + 1;
}

/** Extract the resource segment from a cache key (dealer:{id}:cache:{resource}:...). */
function extractResource(key: string): string {
  const parts = key.split(":");
  return parts[3] ?? "unknown";
}

/** Extract the resource segment from an invalidation prefix. Same pattern as key. */
function extractPrefixResource(prefix: string): string {
  return extractResource(prefix);
}

// ---------------------------------------------------------------------------
// Public cache helpers
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with cache read-through.
 *
 * @param key       Full cache key (use helpers from cacheKeys.ts)
 * @param ttlSeconds  Time-to-live in seconds
 * @param fn        Async factory — called on cache miss
 * @returns         Cached or freshly computed value
 *
 * @example
 * const data = await withCache(
 *   dashboardKpisKey(dealershipId, permHash),
 *   20,
 *   () => computeDashboardKpis(dealershipId, userId, permissions)
 * );
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const client = getCacheClient();
  const resource = extractResource(key);

  try {
    const cached = await client.get<T>(key);
    if (cached !== null) {
      incHits();
      try {
        recordCacheHit(resource);
      } catch {
        // metrics failure must never break cache path
      }
      return cached;
    }
  } catch (err) {
    // Cache read failed — fall through to fn()
    console.error("[cache/withCache] read error, bypassing cache:", err);
  }

  incMisses();
  try {
    recordCacheMiss(resource);
  } catch {
    // metrics failure must never break cache path
  }

  const value = await fn();

  try {
    await client.set(key, value, ttlSeconds);
  } catch (err) {
    // Cache write failed — return value anyway
    console.error("[cache/withCache] write error, returning uncached value:", err);
  }

  return value;
}

/**
 * Invalidate a single cache key. Fire-and-forget — errors logged, never thrown.
 */
export async function invalidateKey(key: string): Promise<void> {
  try {
    await getCacheClient().del(key);
  } catch (err) {
    console.error("[cache/withCache] invalidateKey error:", err);
  }
}

/**
 * Invalidate all keys matching a prefix. Fire-and-forget — errors logged, never thrown.
 * Records invalidation metric.
 */
export async function invalidatePrefix(prefix: string): Promise<void> {
  try {
    await getCacheClient().delPrefix(prefix);
    try {
      recordCacheInvalidation(extractPrefixResource(prefix));
    } catch {
      // metrics failure must never break invalidation
    }
  } catch (err) {
    console.error("[cache/withCache] invalidatePrefix error:", err);
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export type CacheStats = {
  keysTotal: number;
  keysByPrefix: Record<string, number>;
  hits: number;
  misses: number;
};

/**
 * Returns in-process cache stats. Used by GET /api/cache/stats.
 * keysTotal and keysByPrefix reflect the tracked-keys set (reliable for
 * both in-memory and Redis+memory-mirror backends).
 */
export function getCacheStats(): CacheStats {
  const keys = getTrackedKeys();
  const keysByPrefix: Record<string, number> = {};

  for (const key of keys) {
    const resource = extractResource(key);
    keysByPrefix[resource] = (keysByPrefix[resource] ?? 0) + 1;
  }

  return {
    keysTotal: keys.size,
    keysByPrefix,
    hits: globalForStats.__cacheHits ?? 0,
    misses: globalForStats.__cacheMisses ?? 0,
  };
}

/** Reset stats counters — for tests only. */
export function _resetCacheStats(): void {
  globalForStats.__cacheHits = 0;
  globalForStats.__cacheMisses = 0;
}
