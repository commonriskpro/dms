# Inventory Intelligence Dashboard — Upgrades Report

## What Changed

### 1. Service-level validation (INVALID_QUERY)

- The dashboard service now validates the query with `inventoryDashboardQuerySchema.safeParse(rawQuery)` and throws `ApiError("INVALID_QUERY", "Invalid query", { fieldErrors })` when validation fails.
- The route catches this error (via `isApiError(e) && e.code === "INVALID_QUERY"`) and renders the same “Invalid filters” UI with “Clear and reload” link.
- `lib/api/errors.ts` maps `INVALID_QUERY` to HTTP 400.

### 2. Short server-side cache for aggregates

- **Module:** `apps/dealer/modules/core/cache/ttl-cache.ts` — minimal in-memory TTL cache with configurable TTL and max entries.
- **TTL:** 20 seconds (`INVENTORY_DASHBOARD_AGGREGATE_TTL_MS`).
- **Scope:** Only KPIs + intelligence (including alert center) are cached. The paginated list is always fetched fresh.
- **Cache key:** `inventory:intel-dashboard:${dealershipId}` (tenant-isolated; list params do not affect aggregates).
- **Behavior:** On cache hit, the service returns cached kpis + intelligence and only runs `listVehicles` for the current page. On miss, it runs all aggregate queries, builds the result, then caches kpis + intelligence.
- **Test hook:** `clearDashboardAggregateCacheForTesting()` for tests.

### 3. Alert Center ordering and empty state

- **Severity rank:** high = 0, medium = 1, low = 2.
- **Filter:** Only alerts with `count > 0` are shown. If all are 0, a single row is returned with `key: "none"`, `title: "No active alerts"`, `count: 0`.
- **Sort:** severityRank asc, then count desc, then title asc. The service returns alerts already ordered; the UI does not re-sort.
- **UI:** When `key === "none"`, the Alert Center card renders a non-link row with muted text “No active alerts”.

### 4. Price-to-market internal comps heuristic

- **DB helper:** `vehicleDb.getFleetInternalCompsAvgCents(dealershipId)` in `modules/inventory/db/vehicle.ts`.
  - Computes average `salePriceCents` over non-SOLD vehicles that belong to make+model groups with at least `MIN_COMPS_FOR_MARKET_AVG` (3) vehicles.
  - Returns `null` if no group has ≥ 3 vehicles.
- **Fallback chain:**  
  `marketAvgCents = internalCompsAvg ?? bookValueBaseline ?? avgCostFallback ?? null`  
  - **internalCompsAvg:** result of `getFleetInternalCompsAvgCents`.  
  - **bookValueBaseline:** average of retail cents from the book values map (when non-empty).  
  - **avgCostFallback:** `inventoryValueCents / totalUnits` when totalUnits > 0.
- **Comps rules (v1):** Same make + model (case-insensitive); non-SOLD only; require ≥ 3 vehicles per make+model group to use that group in the average.

### 5. Last updated + Refresh

- **Server:** The dashboard page sets `lastUpdatedMs = Date.now()` after a successful `getInventoryIntelligenceDashboard` and passes it to the client.
- **Component:** `InventoryDashboardHeader` (client) receives `lastUpdatedMs` and displays “Last updated: &lt;time&gt;” (locale time string) and a “Refresh” button with `RefreshCw` from `@/lib/ui/icons` and `ICON_SIZES.button`.
- **Refresh:** The button calls `router.refresh()` (no manual fetch). Uses existing secondary button styling and token-safe classes.

---

## Cache TTL

- **Value:** 20 seconds (`INVENTORY_DASHBOARD_AGGREGATE_TTL_MS` in `modules/core/cache/ttl-cache.ts` and used when creating the dashboard aggregate cache).

---

## Comps heuristic rules (v1)

- **Similarity:** Same `make` and `model` (case-insensitive). Year is not used for fleet-level comps.
- **Minimum comps:** At least 3 vehicles in a make+model group to include that group in the average.
- **Scope:** Non-SOLD vehicles only; `dealershipId` scoped.
- **Result:** Weighted average of `salePriceCents` across all vehicles in qualifying groups. If no group has ≥ 3 vehicles, returns `null` and the service uses book value or avg cost fallback.

---

## Verification commands (run from repo root)

```bash
npm -w apps/dealer run test -- apps/dealer/modules/inventory/tests/inventory-intelligence-dashboard.test.ts apps/dealer/modules/core/cache/ttl-cache.test.ts apps/dealer/components/inventory/dashboard/__tests__/InventoryDashboardHeader.test.tsx
```

Or run the full dealer test suite:

```bash
npm -w apps/dealer run test
```

Lint and build:

```bash
npm run lint
npm -w apps/dealer run build
```

---

## File list (created/updated)

| File | Change |
|------|--------|
| `apps/dealer/docs/INVENTORY_INTELLIGENCE_DASHBOARD_UPGRADES_SPEC.md` | New spec |
| `apps/dealer/docs/INVENTORY_INTELLIGENCE_DASHBOARD_UPGRADES_REPORT.md` | This report |
| `apps/dealer/lib/api/errors.ts` | Map `INVALID_QUERY` → 400 |
| `apps/dealer/modules/core/cache/ttl-cache.ts` | New TTL cache |
| `apps/dealer/modules/core/cache/ttl-cache.test.ts` | Cache unit tests |
| `apps/dealer/modules/inventory/db/vehicle.ts` | `getFleetInternalCompsAvgCents`, `MIN_COMPS_FOR_MARKET_AVG` |
| `apps/dealer/modules/inventory/service/inventory-intelligence-dashboard.ts` | Validation, cache, alert ordering, comps fallback, `clearDashboardAggregateCacheForTesting` |
| `apps/dealer/modules/inventory/tests/inventory-intelligence-dashboard.test.ts` | INVALID_QUERY, cache clear, alert ordering |
| `apps/dealer/app/(app)/inventory/dashboard/page.tsx` | Catch INVALID_QUERY, pass `lastUpdatedMs` |
| `apps/dealer/app/(app)/inventory/dashboard/InventoryDashboardContent.tsx` | `lastUpdatedMs` prop, render header |
| `apps/dealer/components/inventory/dashboard/InventoryDashboardHeader.tsx` | New: Last updated + Refresh |
| `apps/dealer/components/inventory/dashboard/InventoryDashboardHeader.test.tsx` | New: header smoke test |
| `apps/dealer/components/inventory/dashboard/AlertCenterCard.tsx` | Handle `key === "none"` (no link, muted) |
