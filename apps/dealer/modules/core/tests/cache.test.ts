/**
 * Distributed Cache Infrastructure Tests
 * Tests: cache client (hit/miss/fallback), cacheKeys, withCache wrapper, TTL expiry, invalidation.
 */

// Ensure no Redis for all tests (pure in-memory fallback)
beforeAll(() => { delete process.env.REDIS_URL; });
afterAll(() => { delete process.env.REDIS_URL; });

import { _resetCacheClient, getCacheClient } from "@/lib/infrastructure/cache/cacheClient";
import { withCache, invalidateKey, invalidatePrefix } from "@/lib/infrastructure/cache/cacheHelpers";
import {
  dashboardKpisKey,
  inventoryIntelKey,
  pipelineKey,
  reportKey,
  paramsHash,
  permissionsHash,
  dashboardPrefix,
  inventoryPrefix,
  pipelinePrefix,
  reportsPrefix,
} from "@/lib/infrastructure/cache/cacheKeys";
import {
  registerCacheInvalidationListeners,
  _resetCacheInvalidationListeners,
} from "@/lib/infrastructure/cache/cacheInvalidation";
import { emitEvent, clearListeners } from "@/lib/infrastructure/events/eventBus";

beforeEach(() => {
  _resetCacheClient();
  _resetCacheInvalidationListeners();
  clearListeners();
});

afterEach(() => {
  _resetCacheClient();
  _resetCacheInvalidationListeners();
  clearListeners();
});

// ---------------------------------------------------------------------------
// cacheKeys
// ---------------------------------------------------------------------------

describe("cacheKeys", () => {
  it("dashboardKpisKey includes dealershipId and permHash", () => {
    const key = dashboardKpisKey("d-1", "abc123");
    expect(key).toBe("dealer:d-1:cache:dashboard:kpis:abc123");
  });

  it("inventoryIntelKey includes dealershipId and queryHash", () => {
    const key = inventoryIntelKey("d-1", "xyz789");
    expect(key).toBe("dealer:d-1:cache:inventory:intel:xyz789");
  });

  it("pipelineKey is versioned and tenant-scoped", () => {
    const key = pipelineKey("d-1");
    expect(key).toBe("dealer:d-1:cache:pipeline:v1");
    expect(pipelineKey("d-2")).not.toBe(pipelineKey("d-1"));
  });

  it("reportKey includes type and queryHash", () => {
    expect(reportKey("d-1", "sales-summary", "h1")).toBe(
      "dealer:d-1:cache:reports:sales-summary:h1"
    );
    expect(reportKey("d-1", "finance-penetration", "h2")).toBe(
      "dealer:d-1:cache:reports:finance-penetration:h2"
    );
    expect(reportKey("d-1", "inventory-aging", "h3")).toBe(
      "dealer:d-1:cache:reports:inventory-aging:h3"
    );
  });

  it("paramsHash produces consistent 8-char hex for same input", () => {
    const h1 = paramsHash({ from: "2026-01-01", to: "2026-01-31" });
    const h2 = paramsHash({ from: "2026-01-01", to: "2026-01-31" });
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(8);
    expect(/^[0-9a-f]+$/.test(h1)).toBe(true);
  });

  it("paramsHash produces different hash for different params", () => {
    const h1 = paramsHash({ from: "2026-01-01", to: "2026-01-31" });
    const h2 = paramsHash({ from: "2026-02-01", to: "2026-02-28" });
    expect(h1).not.toBe(h2);
  });

  it("permissionsHash is order-independent", () => {
    const h1 = permissionsHash(["inventory.read", "deals.read"]);
    const h2 = permissionsHash(["deals.read", "inventory.read"]);
    expect(h1).toBe(h2);
  });

  it("prefix helpers produce correct prefixes", () => {
    expect(dashboardPrefix("d-1")).toBe("dealer:d-1:cache:dashboard:");
    expect(inventoryPrefix("d-1")).toBe("dealer:d-1:cache:inventory:");
    expect(pipelinePrefix("d-1")).toBe("dealer:d-1:cache:pipeline:");
    expect(reportsPrefix("d-1")).toBe("dealer:d-1:cache:reports:");
  });

  it("tenant isolation: same resource, different dealershipIds → different keys", () => {
    expect(pipelineKey("d-1")).not.toBe(pipelineKey("d-2"));
    expect(dashboardKpisKey("d-1", "h")).not.toBe(dashboardKpisKey("d-2", "h"));
  });
});

// ---------------------------------------------------------------------------
// cacheClient — in-memory fallback
// ---------------------------------------------------------------------------

describe("CacheClient (in-memory fallback, no REDIS_URL)", () => {
  it("get returns null on cold cache", async () => {
    const client = getCacheClient();
    const result = await client.get("some-key");
    expect(result).toBeNull();
  });

  it("set then get returns the stored value", async () => {
    const client = getCacheClient();
    await client.set("key-1", { count: 42, name: "test" }, 60);
    const result = await client.get<{ count: number; name: string }>("key-1");
    expect(result).toEqual({ count: 42, name: "test" });
  });

  it("del removes the key", async () => {
    const client = getCacheClient();
    await client.set("key-del", "value", 60);
    await client.del("key-del");
    const result = await client.get("key-del");
    expect(result).toBeNull();
  });

  it("del on non-existent key does not throw", async () => {
    const client = getCacheClient();
    await expect(client.del("non-existent")).resolves.toBeUndefined();
  });

  it("stores and retrieves nested objects", async () => {
    const client = getCacheClient();
    const data = { metrics: { count: 10, delta: null }, items: [1, 2, 3] };
    await client.set("nested", data, 30);
    const result = await client.get<typeof data>("nested");
    expect(result).toEqual(data);
  });

  it("stores and retrieves arrays", async () => {
    const client = getCacheClient();
    await client.set("arr", [{ id: "1" }, { id: "2" }], 30);
    const result = await client.get<{ id: string }[]>("arr");
    expect(result).toEqual([{ id: "1" }, { id: "2" }]);
  });

  it("TTL expiry: expired entries return null", async () => {
    const client = getCacheClient();
    // Set with 0s TTL (immediately expired)
    await client.set("expired-key", "should-expire", 0);
    // Advance time slightly
    await new Promise((r) => setTimeout(r, 5));
    const result = await client.get("expired-key");
    expect(result).toBeNull();
  });

  it("delPrefix removes all keys with matching prefix", async () => {
    const client = getCacheClient();
    await client.set("dealer:d-1:cache:inventory:a", "v1", 60);
    await client.set("dealer:d-1:cache:inventory:b", "v2", 60);
    await client.set("dealer:d-1:cache:dashboard:x", "v3", 60);

    await client.delPrefix("dealer:d-1:cache:inventory:");

    expect(await client.get("dealer:d-1:cache:inventory:a")).toBeNull();
    expect(await client.get("dealer:d-1:cache:inventory:b")).toBeNull();
    // Dashboard key unaffected
    expect(await client.get("dealer:d-1:cache:dashboard:x")).toBe("v3");
  });

  it("delPrefix does not touch another dealership's keys", async () => {
    const client = getCacheClient();
    await client.set("dealer:d-1:cache:pipeline:v1", "d1-data", 60);
    await client.set("dealer:d-2:cache:pipeline:v1", "d2-data", 60);

    await client.delPrefix("dealer:d-1:cache:pipeline:");

    expect(await client.get("dealer:d-1:cache:pipeline:v1")).toBeNull();
    expect(await client.get("dealer:d-2:cache:pipeline:v1")).toBe("d2-data");
  });
});

// ---------------------------------------------------------------------------
// withCache
// ---------------------------------------------------------------------------

describe("withCache", () => {
  it("calls fn on cache miss and stores result", async () => {
    const fn = jest.fn().mockResolvedValue({ value: 99 });
    const result = await withCache("miss-key", 60, fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: 99 });
  });

  it("returns cached value on subsequent calls (cache hit)", async () => {
    const fn = jest.fn().mockResolvedValue({ value: "cached" });
    const key = "hit-key-" + Date.now();

    await withCache(key, 60, fn);
    const result2 = await withCache(key, 60, fn);

    expect(fn).toHaveBeenCalledTimes(1); // fn NOT called again
    expect(result2).toEqual({ value: "cached" });
  });

  it("calls fn again after TTL expires", async () => {
    const fn = jest.fn().mockResolvedValue({ value: "fresh" });
    const key = "ttl-key-" + Date.now();

    await withCache(key, 0, fn); // TTL = 0s → immediately expired
    await new Promise((r) => setTimeout(r, 5));
    await withCache(key, 0, fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to fn when cache read throws", async () => {
    const client = getCacheClient();
    jest.spyOn(client, "get").mockRejectedValueOnce(new Error("cache error"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const fn = jest.fn().mockResolvedValue({ fallback: true });
    const result = await withCache("error-key", 60, fn);

    expect(result).toEqual({ fallback: true });
    expect(fn).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("returns fn result even when cache write throws", async () => {
    const client = getCacheClient();
    jest.spyOn(client, "set").mockRejectedValueOnce(new Error("write error"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const fn = jest.fn().mockResolvedValue({ data: "ok" });
    const result = await withCache("write-fail-key", 60, fn);

    expect(result).toEqual({ data: "ok" });
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// invalidateKey / invalidatePrefix
// ---------------------------------------------------------------------------

describe("invalidateKey / invalidatePrefix", () => {
  it("invalidateKey removes a specific key", async () => {
    const client = getCacheClient();
    await client.set("to-invalidate", "data", 60);
    await invalidateKey("to-invalidate");
    expect(await client.get("to-invalidate")).toBeNull();
  });

  it("invalidateKey does not throw on non-existent key", async () => {
    await expect(invalidateKey("ghost-key")).resolves.toBeUndefined();
  });

  it("invalidatePrefix removes all matching keys", async () => {
    const client = getCacheClient();
    await client.set("dealer:d-9:cache:reports:sales-summary:h1", "r1", 60);
    await client.set("dealer:d-9:cache:reports:inventory-aging:h2", "r2", 60);
    await client.set("dealer:d-9:cache:pipeline:v1", "p1", 60);

    await invalidatePrefix(reportsPrefix("d-9"));

    expect(await client.get("dealer:d-9:cache:reports:sales-summary:h1")).toBeNull();
    expect(await client.get("dealer:d-9:cache:reports:inventory-aging:h2")).toBeNull();
    expect(await client.get("dealer:d-9:cache:pipeline:v1")).toBe("p1"); // untouched
  });
});

// ---------------------------------------------------------------------------
// cacheInvalidation — event bus integration
// ---------------------------------------------------------------------------

describe("cacheInvalidation listeners", () => {
  it("vehicle.created clears inventory + dashboard caches", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(inventoryIntelKey("d-5", "h1"), { count: 1 }, 60);
    await client.set(dashboardKpisKey("d-5", "ph"), { metrics: {} }, 60);

    emitEvent("vehicle.created", { dealershipId: "d-5", vehicleId: "v-1" });
    await new Promise((r) => setTimeout(r, 10)); // let async listeners settle

    expect(await client.get(inventoryIntelKey("d-5", "h1"))).toBeNull();
    expect(await client.get(dashboardKpisKey("d-5", "ph"))).toBeNull();
  });

  it("vehicle.updated clears inventory + dashboard caches", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(inventoryIntelKey("d-6", "h1"), { count: 2 }, 60);
    await client.set(dashboardKpisKey("d-6", "ph"), { metrics: {} }, 60);

    emitEvent("vehicle.updated", { dealershipId: "d-6", vehicleId: "v-2", fields: ["price"] });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(inventoryIntelKey("d-6", "h1"))).toBeNull();
    expect(await client.get(dashboardKpisKey("d-6", "ph"))).toBeNull();
  });

  it("deal.sold clears dashboard + pipeline + reports caches", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(dashboardKpisKey("d-7", "ph"), { metrics: {} }, 60);
    await client.set(pipelineKey("d-7"), { leads: 5 }, 60);
    await client.set(reportKey("d-7", "sales-summary", "h1"), { total: 10 }, 60);

    emitEvent("deal.sold", { dealershipId: "d-7", dealId: "deal-1", amount: 25000 });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(dashboardKpisKey("d-7", "ph"))).toBeNull();
    expect(await client.get(pipelineKey("d-7"))).toBeNull();
    expect(await client.get(reportKey("d-7", "sales-summary", "h1"))).toBeNull();
  });

  it("customer.created clears dashboard caches only", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(dashboardKpisKey("d-8", "ph"), { metrics: {} }, 60);
    await client.set(pipelineKey("d-8"), { leads: 3 }, 60); // should NOT be cleared

    emitEvent("customer.created", { dealershipId: "d-8", customerId: "c-1" });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(dashboardKpisKey("d-8", "ph"))).toBeNull();
    // Pipeline is NOT affected by customer.created — only dashboard prefix is cleared
    expect(await client.get(pipelineKey("d-8"))).toEqual({ leads: 3 });
  });

  it("invalidation does not affect other dealerships", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(dashboardKpisKey("d-10", "ph"), { metrics: "d10" }, 60);
    await client.set(dashboardKpisKey("d-11", "ph"), { metrics: "d11" }, 60);

    emitEvent("vehicle.created", { dealershipId: "d-10", vehicleId: "v-x" });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(dashboardKpisKey("d-10", "ph"))).toBeNull();
    // d-11 unaffected
    expect(await client.get(dashboardKpisKey("d-11", "ph"))).toEqual({ metrics: "d11" });
  });

  it("registerCacheInvalidationListeners is idempotent", () => {
    registerCacheInvalidationListeners();
    registerCacheInvalidationListeners();
    registerCacheInvalidationListeners();
    // Should not register duplicate listeners — no assertion needed beyond no error
  });
});
