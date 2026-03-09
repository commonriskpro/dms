# Cache Completion Spec — DMS Dealer App

## Current State Audit

### Event Bus Bridging Gap (Critical)

`cacheInvalidation.ts` registers listeners on `@/lib/infrastructure/events/eventBus` (the typed
Node EventEmitter bus, `registerListener`). However, all mutation services (`vehicle.ts`,
`deal.ts`, `customer.ts`) emit events on `@/lib/events` (the simpler untyped registry, `emit`).
These are **two separate, disconnected systems** — cache invalidation listeners were never being
triggered by real service mutations.

**Fix**: Migrate `cacheInvalidation.ts` to import `register` from `@/lib/events` so that all
mutation-emitted events correctly reach the invalidation handlers.

### Missing `deal.sold` Event

`updateDealStatus` emits `deal.status_changed` for all transitions, but never emits `deal.sold`
specifically when `toStatus === "CONTRACTED"` (the deal sold/contracted state). Cache invalidation
for `deal.sold` (dashboard + pipeline + reports) is never triggered.

**Fix**: Emit `deal.sold` in `deal.ts updateDealStatus` when `toStatus === "CONTRACTED"`.

### Inventory Intelligence Dashboard — Local Cache

`inventory-intelligence-dashboard.ts` uses a module-local `createTtlCache` instance
(`aggregateCache`) for caching KPI aggregates. This cache is:
- In-process only (not shared across Next.js workers/pods)
- Not event-invalidated (bypasses the event bus)
- Not visible in the stats endpoint

**Fix**: Replace `aggregateCache.get/set` with `withCache` from the distributed cache layer using
`inventoryIntelKey` from `cacheKeys.ts`.

---

## 1. OBSERVABILITY

### Prometheus Metrics (added to `prometheus.ts`)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `cache_hits_total` | Counter | `resource` | Cache hits per resource type |
| `cache_misses_total` | Counter | `resource` | Cache misses per resource type |
| `cache_invalidations_total` | Counter | `resource` | Cache prefix invalidations per resource |

Resource label is derived from the key pattern `dealer:{id}:cache:{resource}:...` → `{resource}`.

### In-Process Stats Counters

`cacheHelpers.ts` maintains global `_hits` and `_misses` counters (independent of Prometheus)
to feed the `/api/cache/stats` endpoint synchronously without scraping.

---

## 2. STATS ENDPOINT

**Route**: `GET /api/cache/stats`  
**Auth**: Platform admin session (same pattern as `/api/metrics`)  
**Response shape**:

```json
{
  "keysTotal": 42,
  "keysByPrefix": {
    "dashboard": 12,
    "inventory": 8,
    "pipeline": 4,
    "reports": 18
  },
  "hits": 1203,
  "misses": 87
}
```

`keysTotal` and `keysByPrefix` are derived from the `getTrackedKeys()` set in `cacheClient.ts`
(reliable for both in-memory and Redis+memory-mirror backends).

---

## 3. EVENT WIRING (Fixed)

After the bridging fix, the event flow is:

```
Service mutation
  → emit("vehicle.created", payload)          [lib/events.ts]
  → register("vehicle.created", handler)      [cacheInvalidation.ts via lib/events.ts]
  → invalidatePrefix(inventoryPrefix(id))      [cacheHelpers.ts]
  → client.delPrefix(prefix)                  [cacheClient.ts]
```

### Event → Cache Invalidation Map

| Event | Cache Groups Cleared |
|-------|---------------------|
| `vehicle.created` | inventory, dashboard |
| `vehicle.updated` | inventory, dashboard |
| `deal.sold` | dashboard, pipeline, reports |
| `deal.status_changed` | pipeline, dashboard |
| `customer.created` | dashboard |

---

## 4. COVERAGE

### Services with Distributed Cache Applied

| Service | Function | Cache Key | TTL |
|---------|----------|-----------|-----|
| `getDashboardV3Data` | `getDashboardV3Data` | `dashboardKpisKey(id, permHash)` | 20s |
| `deal-pipeline.ts` | `getDealPipeline` | `pipelineKey(id)` | 30s |
| `sales-summary.ts` | `getSalesSummary` | `reportKey(id, "sales-summary", hash)` | 60s |
| `finance-penetration.ts` | `getFinancePenetration` | `reportKey(id, "finance-penetration", hash)` | 60s |
| `inventory-aging.ts` | `getInventoryAging` | `reportKey(id, "inventory-aging", hash)` | 60s |
| `inventory-intelligence-dashboard.ts` | aggregates | `inventoryIntelKey(id, "agg")` | 30s |

---

## 5. ACCEPTANCE CRITERIA

- [ ] Stats endpoint returns correct shape, requires platform admin
- [ ] `cache_hits_total`, `cache_misses_total`, `cache_invalidations_total` appear in `/api/metrics`
- [ ] Creating a vehicle causes `inventoryPrefix` cache invalidation (event → handler → delPrefix)
- [ ] Contracting a deal causes `deal.sold` → dashboard + pipeline + reports invalidation
- [ ] Inventory intelligence dashboard uses distributed cache (verified via stats endpoint key count)
- [ ] API responses for all cached services are byte-identical to pre-cache responses
- [ ] Redis optional — all behaviour works with in-memory fallback
- [ ] No circular dependencies added
