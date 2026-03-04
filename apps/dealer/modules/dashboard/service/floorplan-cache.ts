/**
 * Server-only cache for floorplan/lending data per dealership.
 * TTL configurable via DASHBOARD_FLOORPLAN_CACHE_TTL_SECONDS (default 60).
 * Cache key: dealershipId. Only safe fields (name, utilizedCents, limitCents, statusLabel).
 */

export type FloorplanCachedLine = {
  name: string;
  utilizedCents: number;
  limitCents: number;
  statusLabel?: string;
};

const DEFAULT_TTL_SECONDS = 60;

function getTtlSeconds(): number {
  const env = process.env.DASHBOARD_FLOORPLAN_CACHE_TTL_SECONDS;
  if (env == null || env === "") return DEFAULT_TTL_SECONDS;
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_SECONDS;
}

type Entry = { data: FloorplanCachedLine[]; expiresAt: number };

const cache = new Map<string, Entry>();

/**
 * Returns floorplan lines for the dealership. Cached per dealershipId; TTL from env or 60s.
 * Provider must return only safe fields (no account numbers, credentials, PII).
 */
export async function getCachedFloorplan(
  dealershipId: string,
  provider: (dealershipId: string) => Promise<FloorplanCachedLine[]>
): Promise<FloorplanCachedLine[]> {
  const now = Date.now();
  const ttlMs = getTtlSeconds() * 1000;
  const entry = cache.get(dealershipId);
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }
  const data = await provider(dealershipId);
  cache.set(dealershipId, { data, expiresAt: now + ttlMs });
  return data;
}

/** Only for tests: clear cache to avoid cross-test pollution. */
export function clearFloorplanCacheForTesting(): void {
  cache.clear();
}
