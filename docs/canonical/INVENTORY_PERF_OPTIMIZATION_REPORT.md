# Inventory Performance Optimization Report

Date: March 10, 2026  
Scope: two measured low-risk inventory hotspot sprints (no broad inventory rewrite)

Update:
- Staged implementation results are now tracked in `docs/canonical/INVENTORY_PERF_STAGED_IMPLEMENTATION_REPORT.md`.
- Use that staged report as the latest canonical stage-by-stage measurement trail.
- Stage 5 durable Postgres snapshot model is now implemented and measured in the staged report.
- Stage 6 default first-page warm cache retry is now retained with serialization-safe DTO projection.

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
