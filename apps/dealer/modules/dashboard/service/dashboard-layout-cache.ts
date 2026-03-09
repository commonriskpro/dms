/**
 * Short TTL cache for effective dashboard layout per user/dealership.
 * Invalidated on save/reset. Key = dealershipId + userId.
 */
import { createTtlCache } from "@/modules/core/cache/ttl-cache";

const DASHBOARD_LAYOUT_CACHE_TTL_MS = 30_000;
const DASHBOARD_LAYOUT_CACHE_MAX_ENTRIES = 1000;

export type CachedLayoutItem = {
  widgetId: string;
  zone: "topRow" | "main";
  order: number;
  visible: boolean;
  title: string;
  description?: string;
  hideable?: boolean;
  fixed?: boolean;
};

const cache = createTtlCache<CachedLayoutItem[]>({
  ttlMs: DASHBOARD_LAYOUT_CACHE_TTL_MS,
  maxEntries: DASHBOARD_LAYOUT_CACHE_MAX_ENTRIES,
});

export function getDashboardLayoutCacheKey(dealershipId: string, userId: string): string {
  return `dashboard_layout:${dealershipId}:${userId}`;
}

export function getCachedEffectiveLayout(
  dealershipId: string,
  userId: string
): CachedLayoutItem[] | undefined {
  return cache.get(getDashboardLayoutCacheKey(dealershipId, userId));
}

export function setCachedEffectiveLayout(
  dealershipId: string,
  userId: string,
  layout: CachedLayoutItem[]
): void {
  cache.set(getDashboardLayoutCacheKey(dealershipId, userId), layout);
}

export function invalidateDashboardLayoutCache(dealershipId: string, userId: string): void {
  cache.delete(getDashboardLayoutCacheKey(dealershipId, userId));
}
