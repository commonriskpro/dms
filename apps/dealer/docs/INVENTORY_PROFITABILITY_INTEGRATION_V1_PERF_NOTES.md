# Inventory Profitability Integration V1 — Performance Notes

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/INVENTORY_PROFITABILITY_INTEGRATION_V1_SPEC.md`  
**Scope:** Audit of inventory list rendering cost, ledger totals integration cost on list/detail/dashboard/reports paths, avoidance of repeated expensive recomputation, and list/detail interaction weight.

---

## 1. Summary

- **List paths (API and RSC):** One batch `getCostTotalsForVehicles(dealershipId, vehicleIds)` per request; vehicle count capped by pagination (default 25, max 100). No N+1; no repeated ledger calls for the same page.
- **Detail path:** Single `getCostTotals(dealershipId, vehicleId)` per vehicle, already in place and parallelized with photos/price-to-market. No change to request count or blocking.
- **Intelligence dashboard:** Aggregates (including ledger batch for all non-SOLD vehicles) are cached 30s per dealership; list is one ledger batch per page (same cap). Cache limits cost of large non-SOLD sets.
- **Reports (aging / export):** Aging result cached 60s; both aging and export run one ledger batch per run. Export and aging use unbounded vehicle lists (existing pattern); ledger add is one extra batch query, not per-row.
- **Frontend:** No new components or heavy recomputation; list table and pricing card use existing layout with ledger-derived values. No duplicate work.

---

## 2. Inventory List

### 2.1 GET /api/inventory

- **Flow:** `listVehicles(dealershipId, { limit, offset, ... })` → `vehicleIds = data.map(row => row.id)` → `getCostTotalsForVehicles(ctx.dealershipId, vehicleIds)` → merge and serialize.
- **Ledger cost:** One `findMany` on `VehicleCostEntry` with `where: { dealershipId, vehicleId: { in: vehicleIds }, deletedAt: null }`, `select: { vehicleId, category, amountCents }`. In-memory aggregation by vehicleId. No per-row DB round-trips.
- **Pagination:** `limit` from query schema is `min(1).max(100)`, default 25. So at most 100 vehicle ids per request; batch size is bounded.
- **Conclusion:** Single batch per list request; no N+1; list rendering cost is unchanged (same number of rows and columns).

### 2.2 getInventoryPageOverview (RSC)

- **Flow:** `listVehicles(dealershipId, { limit: query.pageSize, offset, ... })` → same cap (pageSize max 100). Then `Promise.all([ getPriceToMarketForVehicles(...), getCostTotalsForVehicles(dealershipId, vehicleIds) ])`.
- **Ledger cost:** One batch `getCostTotalsForVehicles` for the page’s vehicle ids. Runs in parallel with price-to-market; no waterfall.
- **Conclusion:** One ledger batch per overview request; bounded by page size; parallel with existing work.

---

## 3. Vehicle Detail

- **Flow:** GET /api/inventory/[id] already does `Promise.all([ getCostTotals(dealershipId, id), listVehiclePhotos(...), getPriceToMarketForVehicle(...) ])`. Single vehicle; one `getCostTotals` (one `getCostTotalsByVehicleId` query).
- **Change in this sprint:** None to the request shape or count. Response now includes `totalInvestedCents` (derived from same totals already used for breakdown and projected gross).
- **Conclusion:** Detail path remains lightweight; no extra round-trips or blocking.

---

## 4. Intelligence Dashboard

### 4.1 List (per page)

- **Flow:** `listVehicles(dealershipId, { limit: query.pageSize, offset, ... })` (pageSize max 100) → `Promise.all([ getPriceToMarketForVehicles(...), getCostTotalsForVehicles(dealershipId, listVehicleIds) ])` → map to items.
- **Ledger cost:** One batch per dashboard list request, same as inventory page overview. Bounded by page size.

### 4.2 Aggregates (KPIs + intelligence)

- **Flow:** `computeInventoryAggregates(ctx)` is wrapped in `withCache(inventoryIntelKey(dealershipId, "agg"), 30, () => ...)`. On cache miss it runs `getNonSoldVehicleIds(dealershipId)` then `getCostTotalsForVehicles(dealershipId, nonSoldIds)`.
- **Ledger cost:** One `findMany` for ids (id-only), then one `getCostTotalsByVehicleIds(dealershipId, nonSoldIds)`. For large dealers, `nonSoldIds` can be large (all non-SOLD vehicles); the single `VehicleCostEntry` findMany with `vehicleId: { in: nonSoldIds }` is one query. Result is cached 30s.
- **Risk:** Very large dealerships (e.g. 10k+ non-SOLD vehicles) could see a large `IN` list and a big result set. Mitigation: cache means this runs at most once per 30s per dealer; consider capping or aggregate-only path later if needed.
- **Conclusion:** Aggregates path uses one batch and is cached; list path uses one batch per page. No repeated recomputation within a request.

---

## 5. Reports

### 5.1 Inventory aging

- **Flow:** `getInventoryAging` is wrapped in `withCache(reportKey(dealershipId, "inventory-aging", ...), 60, () => computeInventoryAging(...))`. On cache miss: `listVehiclesForAging(dealershipId)` (unbounded), then `getCostTotalsForVehicles(dealershipId, vehicleIds)`.
- **Ledger cost:** One batch for all vehicles returned by `listVehiclesForAging`. Unbounded vehicle count (existing pattern; see PRISMA_QUERY_AUDIT). One extra query per cache miss, not per vehicle.
- **Conclusion:** Single ledger batch per aging run; 60s cache limits repeat cost.

### 5.2 Inventory export

- **Flow:** No cache. `listVehiclesForExport(dealershipId, asOf, status)` (unbounded) → `getCostTotalsForVehicles(dealershipId, vehicleIds)` → build CSV rows with `purchaseValueCents` from map.
- **Ledger cost:** One batch for all vehicles in the export. Same unbounded-list pattern as before; ledger adds one batch query. Rate limit and audit already in place.
- **Conclusion:** One ledger batch per export; no per-row DB calls. If export is ever capped or paginated, the same single batch pattern applies to the capped set.

---

## 6. Avoidance of Repeated Recomputation

- **Per request:** Every path does at most one `getCostTotalsForVehicles` (or one `getCostTotals` for single-vehicle). No loop that calls ledger per vehicle.
- **Merge logic:** `mergeVehicleWithLedgerTotals` and `ledgerTotalsToCostBreakdown` are pure in-memory; called once per vehicle in the response list. No duplicate ledger reads.
- **Dashboard aggregates:** Cached; recomputation only on cache miss.
- **Aging:** Cached; recomputation only on cache miss.

---

## 7. List and Detail UI

- **List table:** Same columns (Cost, Price, Profit, etc.); values are now ledger-derived. No new columns, no virtualization change, no client-side aggregation. Rendering cost is unchanged.
- **Pricing card (detail):** Same four rows (Sale Price, Total Invested, Floor Plan, Projected Gross); values from props (API response). No extra fetches or heavy computation.
- **Summary strip (list):** Uses existing `items` (costCents, salePriceCents); simple sum/average over the current page. No extra work.

---

## 8. DB Layer

- **getCostTotalsByVehicleIds:** Single `prisma.vehicleCostEntry.findMany` with `where: { dealershipId, vehicleId: { in: vehicleIds }, deletedAt: null }`, `select: { vehicleId, category, amountCents }`. Indexes on `(dealershipId, vehicleId)` (and vehicleId) support this. No N+1.
- **Empty list:** All callers check `vehicleIds.length > 0` (or equivalent) before calling; empty list returns `new Map()` without hitting the DB.

---

## 9. Recommendations (no change required for V1)

- **List/detail:** Already bounded and single-batch; no action.
- **Dashboard aggregates:** Monitor for very large `nonSoldIds` if dealers grow; consider cap or aggregate-only query later if needed.
- **Aging/export:** Unbounded vehicle list is pre-existing; ledger adds one batch. Any future cap or pagination on these reports would apply to the vehicle list and the single ledger batch would run on that same set.

---

*Performance pass complete. No code changes required for this step.*
