# Inventory Performance Staged Implementation Report

Date: March 10, 2026  
Scope: staged inventory hotspot implementation in required order, with per-stage measurement

## Baseline (Pre-Stage 1)

Scenario command:
- `npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`

Baseline metrics:
- `p50=767.5ms`
- `p95=799.5ms`
- `max=805ms`

Profiling baseline command:
- `INVENTORY_OVERVIEW_PROFILE=1 npm run perf:inventory -- --dealership-slug demo --iterations 8 --warmup 2`

Profiling baseline highlights:
- `coreQueriesMs` dominated (`~570-690ms` steady-state)
- `enrichmentMs` secondary (`~90-100ms`)
- Core subcall leader: `alerts` (typically the slowest subcall in `coreBreakdown`)

---

## Stage 1 — Further Narrow the Live List Query

Implementation attempt:
- Added a narrower list projection path for overview/intelligence list reads.
- Switched overview/intelligence to that narrowed projection.

Measured result:
- `p95` regressed (`~916ms`, with higher outliers in repeat runs).

Decision:
- Reverted Stage 1 query-shape attempt due measured regression.
- Kept previously validated `includeLocation: false` optimization only.

Stage 1 status:
- `Implemented then reverted` (no retained net change from this stage’s new projection attempt).

---

## Stage 2 — Move Row-Derived Badges/Flags into Precomputed State

Implemented (retained):
1. Snapshot-backed row-derived price-to-market read path:
- Added snapshot read helper in `price-to-market` using `VehicleMarketValuation`.
- Snapshot-first, live-compute fallback for missing snapshot rows.

2. Async refresh path for derived snapshot state:
- Added `inventory_valuation_snapshot` analytics job type.
- Added mutation-triggered enqueue on `vehicle.created` and `vehicle.updated`.
- Added batch snapshot refresh service (`refreshVehicleValuationSnapshots`).

3. Safety/overhead controls:
- Added valuation-presence cache to avoid unnecessary snapshot lookups when dealership has no snapshots.
- Removed request-path enqueue from list reads to avoid adding queue latency to hot list requests.

Measured result:
- Stage 2 run: `p95=841.2ms` (`+41.7ms` vs baseline `799.5ms`)

Interpretation:
- Functional precompute path is now present, but current local data coverage/shape did not produce immediate list latency gain.
- Stage 2 retained for architectural direction and future snapshot-hit benefit.

Stage 2 status:
- `Implemented and retained` (measured slight regression in this local run).

---

## Stage 3 — Separate List Read Path from Overview/Intelligence Aggregates

Implemented:
- Split inventory overview into:
  - cached summary path (`summary`) for aggregate data (kpis/alerts/health/pipeline/filter chips)
  - live list row path (`vehicleList`) for paginated rows
- Kept list read path live/canonical.
- Added explicit summary cache key scoped by dealership/user/pipeline-read capability.

Measured result:
- `p50=257.5ms`
- `p95=298.05ms`
- `max=314ms`
- Large improvement from Stage 2 (`p95 841.2 -> 298.05`, `-543.15ms`)

Profiling highlights:
- `coreBreakdown.summary` dropped to ~`32-38ms` on warm reads.
- `vehicleList` became the dominant core component as intended.

Stage 3 status:
- `Implemented and retained`.

---

## Stage 4 — Review and Improve Indexes for the Live List Query

Implemented:
- Added evidence-based composite indexes for dealership-scoped, soft-delete-aware list sort patterns on `Vehicle`:
  - `(dealership_id, deleted_at, created_at desc)`
  - `(dealership_id, deleted_at, updated_at desc)`
  - `(dealership_id, deleted_at, sale_price_cents desc)`
  - `(dealership_id, deleted_at, mileage asc)`
- Added Prisma schema indexes and migration:
  - `apps/dealer/prisma/migrations/20260310023500_inventory_live_list_indexes/migration.sql`
- Applied migration locally via deploy flow.

Measured result:
- `p50=252.5ms`
- `p95=287.5ms`
- `max=304ms`
- Improvement from Stage 3 (`p95 298.05 -> 287.5`, `-10.55ms`)

Stage 4 status:
- `Implemented and retained`.

---

## Stage 5 — Snapshot Overview Counts

Implemented:
- Added durable Postgres model `InventorySummarySnapshot` for scoped summary payloads.
- Added snapshot DB access module:
  - `modules/inventory/db/summary-snapshot.ts`
- Wired snapshot-aware stale-while-revalidate reads into:
  - inventory overview summary path
  - inventory intelligence aggregate summary path
- Added async refresh execution path via existing BullMQ analytics channel:
  - new analytics job type: `inventory_summary_snapshot`
  - refresh handlers for `overview` and `intelligence` scopes
- Applied migration:
  - `apps/dealer/prisma/migrations/20260310030000_inventory_summary_snapshots/migration.sql`

Measured result (Stage 5):
- Before Stage 5 (latest retained): `p95=310.85ms`
- After Stage 5: `p95=296.75ms`
- Delta: `-14.10ms` (`~4.5%` improvement)

---

## Stage 6 — Default First-Page Warm Cache

Retry implementation (retained):
- Added default first-page warm cache for only the canonical inventory list view:
  - `page=1`
  - `pageSize=25`
  - sort `createdAt desc`
  - no status/search/price/location/filter flags
- Added JSON-safe DTO projection for cached list payloads (no `BigInt`/`Date` objects).
- Kept strict live-path fallback:
  - malformed cache payload -> recompute live
  - cache miss -> recompute live and populate cache
  - cache errors continue to fail-open via existing `withCache` behavior

Code validation:
- Profiled default-page runs now show cache-candidate path with no serialization failures.
- Sample profile line after retry:
  - `defaultListWarmCacheCandidate=true`
  - `coreBreakdown.vehicleListWarmCache` present
  - `enrichmentMs=0` on warm-hit request

Measured result (retry):
- Before Stage 6 retry: `p95=313.25ms`
- After Stage 6 retry: `p95=306.05ms`
- Delta: `-7.20ms` (`~2.3%` improvement)

Stage 6 status:
- `Implemented and retained`.

---

## Stage 7 — Consolidate Overlapping List / Intelligence Work

Implemented:
- Consolidated duplicated snapshot+fallback price-to-market logic into one helper:
  - `getPriceToMarketForVehiclesWithSnapshots(...)` in `price-to-market.ts`
- Inventory overview and intelligence list paths now share this consolidated helper.

Measured result:
- Final run after consolidation:
  - `p50=279.5ms`
  - `p95=310.85ms`
  - `max=329ms`

Interpretation:
- Consolidation improved maintainability and keeps snapshot/fallback behavior consistent.
- Net performance stayed in the same improved band as Stage 3/4 (no meaningful additional gain).

---

## Cumulative Measurement (Retained Stages)

Baseline:
- `p95=799.5ms`

Current (latest retained state):
- `p95=306.05ms`

Cumulative delta:
- `-493.45ms` (`~61.7%` improvement)

## Tests Run

- `npm -w dealer run test -- modules/inventory/tests/inventory-page.test.ts`
- `npm -w dealer run test -- modules/inventory/tests/inventory-page.test.ts modules/inventory/tests/dashboard.test.ts`
- `npm -w dealer run test -- modules/inventory/tests/inventory-page.test.ts modules/inventory/tests/dashboard.test.ts modules/intelligence/service/async-jobs.test.ts`

All passed in the final retained state.

## Current Bottleneck

After Stage 4:
- Remaining dominant request-time work is `vehicleList` + `enrichmentMs` for list rows.
- Alerts-heavy summary work is largely amortized by separated summary cache reads.
