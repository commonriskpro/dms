# Distributed Cache Layer — Architecture Spec

**Date:** 2026-03-07  
**Status:** Approved  
**Scope:** `apps/dealer` — read-heavy service caching with event-driven invalidation

---

## 1. Current State

### 1.1 Services with High DB Load

| Service | Queries per call | Current caching | Priority |
|---|---|---|---|
| `getDashboardV3Data` | 12 parallel Prisma calls | ❌ None | 🔴 Critical |
| `getInventoryIntelligenceDashboard` | 9 parallel calls (aggregates) | ✅ In-memory TTL (20s, per-process) | 🟡 Upgrade to distributed |
| `getDealPipeline` | 4 parallel calls | ❌ None | 🟠 High |
| `getSalesSummary` | 1 bulk fetch + JS aggregation | ❌ None | 🟠 High |
| `getFinancePenetration` | 2 parallel calls + JS aggregation | ❌ None | 🟡 Medium |
| `getInventoryAging` | 1 bulk fetch + JS aggregation | ❌ None | 🟡 Medium |
| `getJourneyBarData` (CRM) | 3-4 queries | ❌ None | 🟢 Low |

### 1.2 Existing Caching Infrastructure

- **`modules/core/cache/ttl-cache.ts`** — `createTtlCache<T>()`: LRU+TTL in-memory Map, per-process, not distributed. Used by `inventory-intelligence-dashboard.ts` for aggregate KPIs (20s TTL) and by `dashboard/service/floorplan-cache.ts` for lender data.
- **Problem:** per-process means every Next.js worker has its own cold cache. In a multi-instance deployment, cache hit rate is degraded proportionally to worker count.

### 1.3 Query Patterns Identified

**Dashboard V3** (`getDashboardV3Data`): Called on every dashboard page load. 12 concurrent queries:
- `vehicle.count` (inventory total, REPAIR status)  
- `opportunity.count` (open leads)  
- `deal.count`, `deal.groupBy(status)` (pipeline breakdown)
- `financeSubmission.count`, `financeApplication.count`, `financeStipulation.count`
- `listNewProspects`, `listMyTasks` (customer module)
- `getCachedFloorplan` (already cached by floorplan-cache)

Permission-sensitive: output varies by `permissions[]` (RBAC flags). Cache key must include permission hash.

**Inventory Intelligence Dashboard** aggregates: 9 parallel calls — aging, alerts, valuations, stock analysis, floorplan summary. Already has 20s in-process cache.

**Reports** (`getSalesSummary`, `getFinancePenetration`, `getInventoryAging`): Fetch all rows for a date range + aggregate in JS with BigInt math. Expensive on large datasets; results are deterministic for the same params + dealershipId. Safe to cache 60s.

**Deal Pipeline** (`getDealPipeline`): 4 parallel queries, no caching, called from inventory intelligence dashboard on every request.

---

## 2. Cache Strategy

### 2.1 Backend

| Condition | Backend |
|---|---|
| `REDIS_URL` set | ioredis — single connection, JSON serialization |
| `REDIS_URL` absent | In-memory `createTtlCache` (existing, from `modules/core/cache/ttl-cache.ts`) |

Serialization: `JSON.stringify` / `JSON.parse`. BigInt fields serialized as strings.

### 2.2 Key Format

```
dealer:{dealershipId}:cache:{resource}:{discriminator}
```

Examples:
```
dealer:abc-123:cache:dashboard:kpis:{permHash}
dealer:abc-123:cache:inventory:intel:{paramsHash}
dealer:abc-123:cache:pipeline:v1
dealer:abc-123:cache:reports:sales-summary:{paramsHash}
dealer:abc-123:cache:reports:finance-penetration:{paramsHash}
dealer:abc-123:cache:reports:inventory-aging:{paramsHash}
```

### 2.3 TTL Policy

| Resource | TTL | Rationale |
|---|---|---|
| Dashboard KPIs | 20s | High-freq, near-realtime requirement |
| Inventory intelligence aggregates | 20s | Matches existing in-process TTL |
| Deal pipeline | 30s | Moderate staleness acceptable |
| Reports (all) | 60s | Date-range aggregations, costly to recompute |

### 2.4 Prefix Invalidation

`delPrefix(prefix)` scans and deletes all keys matching `prefix*`:
- Redis: `SCAN 0 MATCH {prefix}* COUNT 100` loop + `DEL`
- In-memory: iterate Map keys, delete matching

---

## 3. Invalidation Model

| Event | Clears prefix(es) |
|---|---|
| `vehicle.created` | `dealer:{id}:cache:inventory:`, `dealer:{id}:cache:dashboard:` |
| `vehicle.updated` | `dealer:{id}:cache:inventory:`, `dealer:{id}:cache:dashboard:` |
| `deal.sold` | `dealer:{id}:cache:dashboard:`, `dealer:{id}:cache:pipeline:`, `dealer:{id}:cache:reports:` |
| `customer.created` | `dealer:{id}:cache:dashboard:` |

All invalidation is **fire-and-forget** — errors logged, never propagated to callers.

---

## 4. Module Placement

```
apps/dealer/lib/infrastructure/cache/
├── cacheClient.ts       ← Redis/in-memory backend singleton
├── cacheKeys.ts         ← Tenant-safe key helpers + prefix helpers
├── cacheHelpers.ts      ← withCache<T>() wrapper
└── cacheInvalidation.ts ← Event bus listeners → delPrefix calls
```

No imports from `modules/*`. Infrastructure layer only.

---

## 5. Service Integration Points

| File | Method | Wrap with cache? | Key |
|---|---|---|---|
| `modules/dashboard/service/getDashboardV3Data.ts` | `getDashboardV3Data` | ✅ 20s | `dashboardKpisKey(dealershipId, permHash)` |
| `modules/deals/service/deal-pipeline.ts` | `getDealPipeline` | ✅ 30s | `pipelineKey(dealershipId)` |
| `modules/reports/service/sales-summary.ts` | `getSalesSummary` | ✅ 60s | `reportKey(dealershipId, 'sales-summary', paramsHash)` |
| `modules/reports/service/finance-penetration.ts` | `getFinancePenetration` | ✅ 60s | `reportKey(dealershipId, 'finance-penetration', paramsHash)` |
| `modules/reports/service/inventory-aging.ts` | `getInventoryAging` | ✅ 60s | `reportKey(dealershipId, 'inventory-aging', paramsHash)` |
| `modules/inventory/service/inventory-intelligence-dashboard.ts` | aggregate section | ✅ 20s | `inventoryIntelKey(dealershipId, paramsHash)` |

**Do NOT cache:** mutations (POST/PATCH/DELETE routes), `getDashboardV3CustomerTasks` (user-specific, low-value), `getDashboardV3InventoryAlerts` (already fast).

---

## 6. Acceptance Criteria

| # | Criterion |
|---|---|
| A1 | All cached API routes return identical response shapes |
| A2 | Cache miss → DB hit → cache populated → next call served from cache |
| A3 | `REDIS_URL` absent → in-memory fallback, all tests pass |
| A4 | `vehicle.created/updated` → inventory + dashboard caches cleared |
| A5 | `deal.sold` → dashboard + pipeline + reports caches cleared |
| A6 | Tenant isolation: `dealer:{dealershipId}:cache:*` keys never cross tenants |
| A7 | Cache errors are caught and logged — never crash the route handler |
| A8 | `withCache` fallback: if cache store throws, `fn()` is called directly |
| A9 | All new tests pass; existing tests unaffected |
| A10 | `tsc --noEmit` clean on all new files |

---

*Generated by Distributed Cache Layer — Architect phase, 2026-03-07*
