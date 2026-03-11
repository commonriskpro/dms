/**
 * Minimal in-memory TTL cache. Safe for tenant isolation when key includes tenantId.
 * Used for aggregate dashboard data (not list). Deterministic, small surface.
 */

const DEFAULT_TTL_MS = 20_000;
const DEFAULT_MAX_ENTRIES = 500;

export type TtlCacheOptions = {
  ttlMs?: number;
  maxEntries?: number;
};

type Entry<T> = { value: T; expiresAt: number };

/**
 * Create a TTL cache. Keys are strings; value is stored until TTL expires.
 * When maxEntries is reached, oldest entry (by insert order) is evicted.
 */
export function createTtlCache<T>(options: TtlCacheOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const map = new Map<string, Entry<T>>();
  const insertionOrder: string[] = [];

  function evictOne(): void {
    while (insertionOrder.length > 0 && map.size >= maxEntries) {
      const key = insertionOrder.shift();
      if (key != null) map.delete(key);
    }
  }

  return {
    get(key: string): T | undefined {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        map.delete(key);
        const i = insertionOrder.indexOf(key);
        if (i !== -1) insertionOrder.splice(i, 1);
        return undefined;
      }
      return entry.value;
    },

    set(key: string, value: T): void {
      if (map.has(key)) {
        const entry = map.get(key)!;
        entry.value = value;
        entry.expiresAt = Date.now() + ttlMs;
        return;
      }
      evictOne();
      insertionOrder.push(key);
      map.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    delete(key: string): boolean {
      const ok = map.delete(key);
      if (ok) {
        const i = insertionOrder.indexOf(key);
        if (i !== -1) insertionOrder.splice(i, 1);
      }
      return ok;
    },

    clear(): void {
      map.clear();
      insertionOrder.length = 0;
    },
  };
}
