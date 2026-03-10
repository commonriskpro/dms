# Inventory Performance Optimization Report

Date: March 10, 2026  
Scope: two measured low-risk inventory hotspot sprints (no broad inventory rewrite)

Update:
- Staged implementation results are now tracked in `docs/canonical/INVENTORY_PERF_STAGED_IMPLEMENTATION_REPORT.md`.
- Use that staged report as the latest canonical stage-by-stage measurement trail.
- Stage 5 durable Postgres snapshot model is now implemented and measured in the staged report.
- Stage 6 default first-page warm cache retry is now retained with serialization-safe DTO projection.
- Latest measured follow-up sprint is documented in `docs/canonical/INVENTORY_PERF_SPRINT_NEXT_REPORT.md`.

## Latest Measured Sprint (Post Stages 1-7)

Measurement-first baseline:
- `INVENTORY_OVERVIEW_PROFILE=1 npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`
- `p50=262ms`, `p95=311.6ms`, `max=327ms`
- dominant contributor: `coreBreakdown.vehicleList` within `coreQueriesMs`

Optimization implemented:
- added `vehicleDb.listVehiclesForOverview(...)` slim row select for overview/intelligence list surfaces
- switched list reads in:
  - `modules/inventory/service/inventory-page.ts`
  - `modules/inventory/service/inventory-intelligence-dashboard.ts`

Validation:
- `npm -w dealer run test -- modules/inventory/tests/inventory-page.test.ts modules/inventory/tests/dashboard.test.ts`
- pass (`18/18`)

After:
- `p50=258ms`, `p95=310.55ms`, `max=343ms`

Delta:
- `p95: -1.05ms` (`~0.34%`)
- `p50: -4ms` (`~1.53%`)

Interpretation:
- gain is modest but consistent with low-risk scope; `vehicleList` core query remains the next bottleneck focus.

## VehicleList Micro-Profiling Sprint Update

This sprint added explicit query-side split timing for the `vehicleList` hotspot:
- `vehicleListQueryBreakdownMs.findManyMs`
- `vehicleListQueryBreakdownMs.countMs`

Measured baseline (with new profiling enabled):
- `p50=295ms`, `p95=370.8ms`, `max=384ms`

Dominance finding:
- `findMany` is usually the larger half of `vehicleList`.
- `count` remains secondary but has occasional spikes on filtered variants.

Low-risk optimization applied:
- added `VehiclePhoto` composite index for list photo-order retrieval path:
  - `@@index([dealershipId, vehicleId, sortOrder])`

Post-change measured reruns:
- run 1: `p50=297ms`, `p95=385.3ms`, `max=415ms`
- run 2: `p50=273ms`, `p95=371.5ms`, `max=421ms`

Result:
- no clear p95 improvement in this environment from the index-only change.
- retained value is improved hotspot attribution for the next targeted query-shape pass.

## FindMany Query-Shape Optimization Attempt (Reverted)

Given `findMany` dominance, this sprint attempted:
- removing photo relation hydration from list `findMany`
- replacing it with one batched photo lookup query

Measured result:
- baseline (instrumented): `p95=370.8ms`
- after attempt: `p95=392.75ms` (regression)

Action:
- reverted the query-shape change.
- reverted speculative index/migration changes from repo state.
- retained only the micro-profiling instrumentation.

Current conclusion:
- hotspot attribution is better (`findMany` usually dominant, `count` occasional spikes),
- but this specific low-risk findMany reshaping did not improve p95 in local runs.

## Goal
Reduce inventory scenario latency by optimizing the dominant measured path from current profiling (`coreQueriesMs` vs `enrichmentMs`).

## Baseline Evidence

Source baseline (canonical perf run):
- `docs/canonical/PERFORMANCE_RUN_REVIEW.md`
- `artifacts/perf/2026-03-10T01-47-37-594Z/summary.json`
- Inventory `p95`: `1070.65ms`

Profiling breakdown (pre-change sample run with `INVENTORY_OVERVIEW_PROFILE=1`):
- Typical `coreQueriesMs`: ~`740-760ms` (dominant)
- Typical `enrichmentMs`: ~`90-96ms`
- Conclusion: optimization target is the core list/query path, not enrichment.

## Sprint 1 Optimization Implemented

### Change
Removed unnecessary `location` relation fetch from list-heavy inventory overview paths.

Files changed:
- `apps/dealer/modules/inventory/db/vehicle.ts`
  - Added `VehicleListOptions.includeLocation?: boolean`
  - Default preserved as `true` for backward compatibility
  - Conditional include for `location` relation
- `apps/dealer/modules/inventory/service/inventory-page.ts`
  - `vehicleDb.listVehicles(..., includeLocation: false)` for inventory page overview
- `apps/dealer/modules/inventory/service/inventory-intelligence-dashboard.ts`
  - `vehicleDb.listVehicles(..., includeLocation: false)` for intelligence dashboard list

### Why this is safe
- Inventory overview and intelligence list mappings do not use `row.location`.
- API paths that may still need location continue using default behavior (`includeLocation: true`).
- Tenant scoping and RBAC checks are unchanged.

## Validation

Focused test:
- Command: `npm -w dealer run test -- modules/inventory/tests/inventory-page.test.ts`
- Result: pass (9/9 tests)

Perf re-run:
- Command: `npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`
- Post-change inventory `p95`: `1012.55ms`

## Before / After

- Before: `p95=1070.65ms`
- After: `p95=1012.55ms`
- Delta: `-58.10ms` (`~5.4%` improvement)

## Sprint 2 Re-Profile (Measured)

Additional profiling instrumentation added under existing `INVENTORY_OVERVIEW_PROFILE=1` log:
- `coreBreakdown.kpis`
- `coreBreakdown.agingBuckets`
- `coreBreakdown.alerts`
- `coreBreakdown.pipeline`
- `coreBreakdown.vehicleList`
- `coreBreakdown.floorPlannedCount`
- `coreBreakdown.previouslySoldCount`

Finding:
- `alerts` remained the consistent slowest core sub-call inside `coreQueriesMs`.
- `coreQueriesMs` remained dominant over `enrichmentMs`.

## Sprint 2 Optimization Implemented

### Changes
1. Alert counts moved to direct DB count queries (instead of list-all IDs + in-memory filtering):
- `apps/dealer/modules/inventory/db/alerts.ts`
  - added:
    - `countVehiclesWithMissingPhotos(...)`
    - `countVehiclesStale(...)`
    - `countVehiclesReconOverdue(...)`
- `apps/dealer/modules/inventory/service/alerts.ts`
  - `getAlertCounts(...)` now uses count APIs with per-alert dismissal exclusions.

2. Removed repeated tenant status checks within the same inventory overview request:
- `apps/dealer/modules/inventory/service/dashboard.ts`
  - `getKpis(...)` and `getAgingBuckets(...)` now support `skipTenantCheck`.
- `apps/dealer/modules/deals/service/deal-pipeline.ts`
  - `getDealPipeline(...)` now supports `skipTenantCheck`.
- `apps/dealer/modules/inventory/service/alerts.ts`
  - `getAlertCounts(...)` now supports `skipTenantCheck`.
- `apps/dealer/modules/inventory/service/inventory-page.ts`
  - passes `skipTenantCheck: true` for internal core calls because tenant validity is already enforced once at entry.

### Why this is safe
- `getInventoryPageOverview` still enforces tenant-read guard at route service entry.
- Skip behavior is opt-in and only used internally in a call path that already validated tenant.
- Alert semantics (dismissed/snoozed exclusion) are preserved.
- RBAC and tenant scoping are unchanged.

## Sprint 2 Validation

Focused tests:
- `npm -w dealer run test -- modules/inventory/tests/dashboard.test.ts modules/inventory/tests/inventory-page.test.ts`
- Result: pass (18/18)

Perf re-run:
- Command: `npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`
- Post-sprint-2 inventory `p95`: `917.55ms`

## Sprint 2 Before / After

- Before (post-sprint-1): `p95=1012.55ms`
- After (post-sprint-2): `p95=917.55ms`
- Delta: `-95.00ms` (`~9.4%` improvement)

## Cumulative Before / After (Sprint 1 + Sprint 2)

- Initial baseline: `p95=1070.65ms`
- Current: `p95=917.55ms`
- Total delta: `-153.10ms` (`~14.3%` improvement)

## Current Assessment

- Inventory remains the top valid measured hotspot.
- Dominant cost remains `coreQueriesMs`; enrichment remains secondary.
- Both sprints delivered low-risk reductions without changing inventory behavior.
- Latest staged retained measurement after Stage 6 retry: `p95=306.05ms` (from staged baseline `799.5ms`, `~61.7%` lower).

## Deferred Intentionally

- No broad inventory architecture changes.
- No schema/index migrations in this sprint.
- No caching policy changes for inventory overview reads in this sprint.

## Query-Plan Stability Follow-Up (March 10, 2026)

Reference:
- `docs/canonical/INVENTORY_QUERY_PLAN_REVIEW.md`

Confirmed in this follow-up:
- `findMany` remains the dominant half of `vehicleList` under profiled runs.
- `count` remains secondary but can spike on `missingPhotosOnly` variant.
- repeated p95 measurements show enough variance that small one-run deltas are not trustworthy.

Next evidence-based target:
- index support for `status=AVAILABLE + salePriceCents desc` path (currently uses filter index + explicit sort plan).

Not selected yet:
- broad missing-photo anti-join redesign (higher risk/complexity than current sprint scope).

## Narrow Index-Support Implementation (March 10, 2026)

Reference:
- `docs/canonical/INVENTORY_INDEX_SUPPORT_REPORT.md`

Change:
- Added `Vehicle` composite index for the measured variant:
  - `dealershipId + status + deletedAt + salePriceCents DESC`

Measured (5-run before/after comparison):
- mean p95: `440.66ms -> 424.3ms` (`-16.36ms`, `-3.71%`)
- mean avg: `312.23ms -> 304.37ms`
- mean p50: `321.9ms -> 331.1ms` (slightly worse)
- p95 spread: `138.75ms -> 79.05ms` (more stable sample band)

Assessment:
- modest improvement with narrow index-only scope;
- keep optimization retained, continue variance-aware measurement.
