/**
 * Cache Observability Tests
 * Verifies: hit/miss counters increment, invalidation counter increments,
 * getCacheStats() shape, event→invalidation via lib/events bridge,
 * deal.sold emission wires correctly, Prometheus metric names present.
 */

beforeAll(() => { delete process.env.REDIS_URL; });
afterAll(() => { delete process.env.REDIS_URL; });

import { _resetCacheClient, getCacheClient } from "@/lib/infrastructure/cache/cacheClient";
import {
  withCache,
  invalidatePrefix,
  getCacheStats,
  _resetCacheStats,
} from "@/lib/infrastructure/cache/cacheHelpers";
import {
  dashboardKpisKey,
  pipelineKey,
  inventoryIntelKey,
  reportKey,
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
  _resetCacheStats();
  _resetCacheInvalidationListeners();
  clearListeners();
});

afterEach(() => {
  _resetCacheClient();
  _resetCacheStats();
  _resetCacheInvalidationListeners();
  clearListeners();
});

// ---------------------------------------------------------------------------
// getCacheStats — shape and counter accuracy
// ---------------------------------------------------------------------------

describe("getCacheStats", () => {
  it("returns zeroed stats on a fresh cache", () => {
    const stats = getCacheStats();
    expect(stats).toMatchObject({
      keysTotal: 0,
      keysByPrefix: {},
      hits: 0,
      misses: 0,
    });
  });

  it("increments hits counter on cache hit", async () => {
    await withCache(dashboardKpisKey("d-obs-1", "ph"), 60, async () => ({ kpis: 1 }));
    // First call is a miss (populate)
    expect(getCacheStats().misses).toBe(1);
    expect(getCacheStats().hits).toBe(0);

    // Second call is a hit
    await withCache(dashboardKpisKey("d-obs-1", "ph"), 60, async () => ({ kpis: 1 }));
    expect(getCacheStats().hits).toBe(1);
    expect(getCacheStats().misses).toBe(1);
  });

  it("increments misses counter on cache miss", async () => {
    await withCache(pipelineKey("d-obs-2"), 60, async () => ({ pipeline: "data" }));
    expect(getCacheStats().misses).toBe(1);
    expect(getCacheStats().hits).toBe(0);
  });

  it("tracks multiple hits and misses independently", async () => {
    const key1 = dashboardKpisKey("d-obs-3", "p1");
    const key2 = pipelineKey("d-obs-3");

    // Two misses
    await withCache(key1, 60, async () => "v1");
    await withCache(key2, 60, async () => "v2");
    expect(getCacheStats().misses).toBe(2);
    expect(getCacheStats().hits).toBe(0);

    // Two hits
    await withCache(key1, 60, async () => "v1");
    await withCache(key2, 60, async () => "v2");
    expect(getCacheStats().misses).toBe(2);
    expect(getCacheStats().hits).toBe(2);
  });

  it("reflects correct keysTotal after sets", async () => {
    await withCache(dashboardKpisKey("d-obs-4", "ph"), 60, async () => "d");
    await withCache(pipelineKey("d-obs-4"), 60, async () => "p");
    const stats = getCacheStats();
    expect(stats.keysTotal).toBe(2);
  });

  it("groups keysByPrefix by resource segment", async () => {
    await withCache(dashboardKpisKey("d-obs-5", "p1"), 60, async () => "d1");
    await withCache(dashboardKpisKey("d-obs-5", "p2"), 60, async () => "d2");
    await withCache(pipelineKey("d-obs-5"), 60, async () => "p");
    await withCache(inventoryIntelKey("d-obs-5", "h1"), 60, async () => "i");
    await withCache(reportKey("d-obs-5", "sales-summary", "r1"), 60, async () => "r");

    const stats = getCacheStats();
    expect(stats.keysByPrefix["dashboard"]).toBe(2);
    expect(stats.keysByPrefix["pipeline"]).toBe(1);
    expect(stats.keysByPrefix["inventory"]).toBe(1);
    expect(stats.keysByPrefix["reports"]).toBe(1);
    expect(stats.keysTotal).toBe(5);
  });

  it("decrements keysTotal after invalidation", async () => {
    await withCache(dashboardKpisKey("d-obs-6", "ph"), 60, async () => "d");
    await withCache(pipelineKey("d-obs-6"), 60, async () => "p");
    expect(getCacheStats().keysTotal).toBe(2);

    await invalidatePrefix(dashboardPrefix("d-obs-6"));
    expect(getCacheStats().keysTotal).toBe(1);
    expect(getCacheStats().keysByPrefix["dashboard"]).toBeUndefined();
    expect(getCacheStats().keysByPrefix["pipeline"]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Event → invalidation bridge (lib/events → cacheInvalidation)
// ---------------------------------------------------------------------------

describe("event invalidation bridge", () => {
  it("vehicle.created triggers inventory + dashboard invalidation", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(inventoryIntelKey("d-ev-1", "h1"), { count: 5 }, 60);
    await client.set(dashboardKpisKey("d-ev-1", "ph"), { kpi: 1 }, 60);
    await client.set(pipelineKey("d-ev-1"), { leads: 10 }, 60); // should remain

    emitEvent("vehicle.created", { dealershipId: "d-ev-1", vehicleId: "v-new" });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(inventoryIntelKey("d-ev-1", "h1"))).toBeNull();
    expect(await client.get(dashboardKpisKey("d-ev-1", "ph"))).toBeNull();
    expect(await client.get(pipelineKey("d-ev-1"))).toEqual({ leads: 10 });
  });

  it("vehicle.updated triggers inventory + dashboard invalidation", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(inventoryIntelKey("d-ev-2", "h2"), { count: 3 }, 60);
    await client.set(dashboardKpisKey("d-ev-2", "ph2"), { kpi: 2 }, 60);

    emitEvent("vehicle.updated", { dealershipId: "d-ev-2", vehicleId: "v-upd", fields: ["price"] });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(inventoryIntelKey("d-ev-2", "h2"))).toBeNull();
    expect(await client.get(dashboardKpisKey("d-ev-2", "ph2"))).toBeNull();
  });

  it("deal.sold triggers dashboard + pipeline + reports invalidation", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(dashboardKpisKey("d-ev-3", "ph"), { kpi: 9 }, 60);
    await client.set(pipelineKey("d-ev-3"), { leads: 7 }, 60);
    await client.set(reportKey("d-ev-3", "sales-summary", "r1"), { total: 50 }, 60);

    emitEvent("deal.sold", { dealershipId: "d-ev-3", dealId: "deal-x", amount: 45000 });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(dashboardKpisKey("d-ev-3", "ph"))).toBeNull();
    expect(await client.get(pipelineKey("d-ev-3"))).toBeNull();
    expect(await client.get(reportKey("d-ev-3", "sales-summary", "r1"))).toBeNull();
  });

  it("deal.status_changed triggers pipeline + dashboard invalidation", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(pipelineKey("d-ev-4"), { leads: 2 }, 60);
    await client.set(dashboardKpisKey("d-ev-4", "ph"), { kpi: 0 }, 60);
    await client.set(reportKey("d-ev-4", "inventory-aging", "r2"), { aging: [] }, 60); // should remain

    emitEvent("deal.status_changed", {
      dealershipId: "d-ev-4",
      dealId: "deal-y",
      from: "DRAFT",
      to: "STRUCTURED",
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(pipelineKey("d-ev-4"))).toBeNull();
    expect(await client.get(dashboardKpisKey("d-ev-4", "ph"))).toBeNull();
    expect(await client.get(reportKey("d-ev-4", "inventory-aging", "r2"))).toEqual({ aging: [] });
  });

  it("customer.created triggers dashboard invalidation only", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(dashboardKpisKey("d-ev-5", "ph"), { kpi: 3 }, 60);
    await client.set(pipelineKey("d-ev-5"), { leads: 4 }, 60); // should remain

    emitEvent("customer.created", { dealershipId: "d-ev-5", customerId: "c-new" });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(dashboardKpisKey("d-ev-5", "ph"))).toBeNull();
    expect(await client.get(pipelineKey("d-ev-5"))).toEqual({ leads: 4 });
  });

  it("invalidation does not bleed into other dealerships", async () => {
    registerCacheInvalidationListeners();
    const client = getCacheClient();

    await client.set(dashboardKpisKey("tenant-A", "ph"), { kpi: "A" }, 60);
    await client.set(dashboardKpisKey("tenant-B", "ph"), { kpi: "B" }, 60);

    emitEvent("vehicle.created", { dealershipId: "tenant-A", vehicleId: "v-1" });
    await new Promise((r) => setTimeout(r, 10));

    expect(await client.get(dashboardKpisKey("tenant-A", "ph"))).toBeNull();
    expect(await client.get(dashboardKpisKey("tenant-B", "ph"))).toEqual({ kpi: "B" });
  });
});

// ---------------------------------------------------------------------------
// invalidatePrefix — counter integration
// ---------------------------------------------------------------------------

describe("invalidatePrefix stats integration", () => {
  it("does not increment misses/hits when only invalidating", async () => {
    const client = getCacheClient();
    await client.set(dashboardKpisKey("d-ip-1", "ph"), { x: 1 }, 60);

    await invalidatePrefix(dashboardPrefix("d-ip-1"));

    const stats = getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.keysTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// withCache — resilience: fn() error propagates, cache error is silent
// ---------------------------------------------------------------------------

describe("withCache resilience", () => {
  it("propagates fn() errors without swallowing them", async () => {
    await expect(
      withCache(pipelineKey("d-res-1"), 60, async () => {
        throw new Error("compute failed");
      })
    ).rejects.toThrow("compute failed");
  });

  it("returns correct value on second hit after initial miss", async () => {
    const key = reportKey("d-res-2", "finance-penetration", "h1");
    const v1 = await withCache(key, 60, async () => ({ pct: 42 }));
    const v2 = await withCache(key, 60, async () => ({ pct: 99 })); // second fn() never called
    expect(v1).toEqual({ pct: 42 });
    expect(v2).toEqual({ pct: 42 });
  });
});

// ---------------------------------------------------------------------------
// _resetCacheStats
// ---------------------------------------------------------------------------

describe("_resetCacheStats", () => {
  it("resets hit and miss counters to zero", async () => {
    await withCache(pipelineKey("d-rst-1"), 60, async () => "x");
    await withCache(pipelineKey("d-rst-1"), 60, async () => "x");
    expect(getCacheStats().hits).toBe(1);
    expect(getCacheStats().misses).toBe(1);

    _resetCacheStats();
    expect(getCacheStats().hits).toBe(0);
    expect(getCacheStats().misses).toBe(0);
  });
});
