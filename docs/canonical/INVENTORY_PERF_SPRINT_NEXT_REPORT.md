# Inventory Performance Sprint (Next) Report

Date: March 10, 2026

## 1. Scope

Measured, low-risk inventory read-path sprint focused on the current dominant cost in the live inventory path.

Constraints preserved:
- live list remains canonical and synchronous
- no async migration for list reads
- no broad inventory architecture rewrite
- tenant scoping and RBAC behavior unchanged

## 2. Measurement-First Re-Profile (Before Changes)

Command:
- `INVENTORY_OVERVIEW_PROFILE=1 npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`

Before metrics:
- `p50=262ms`
- `p95=311.6ms`
- `max=327ms`

Before profiling highlights:
- `coreQueriesMs` remained dominant.
- `coreBreakdown.vehicleList` was the primary contributor in steady-state runs.
- `summary` stayed near zero after cache warm hits.
- `enrichmentMs` was secondary (~`90-100ms` on 50-row variants).

## 3. Optimization Implemented

### Change
Added a slim select query path for inventory overview/intelligence list reads so those surfaces stop loading full `Vehicle` rows.

Files changed:
- `apps/dealer/modules/inventory/db/vehicle.ts`
  - added `listVehiclesForOverview(...)`
  - selects only list-required fields plus needed relations (photos, optional floorplan lender)
- `apps/dealer/modules/inventory/service/inventory-page.ts`
  - switched from `listVehicles(...)` to `listVehiclesForOverview(...)`
- `apps/dealer/modules/inventory/service/inventory-intelligence-dashboard.ts`
  - switched from `listVehicles(...)` to `listVehiclesForOverview(...)`

### Why this is safe
- list response shape is unchanged
- no permission/tenant guard changes
- no query-parameter behavior changes
- generic `listVehicles(...)` remains available for other surfaces

## 4. Validation

Focused tests:
- `npm -w dealer run test -- modules/inventory/tests/inventory-page.test.ts modules/inventory/tests/dashboard.test.ts`
- Result: pass (`18/18`)

## 5. Post-Change Measurement

Command (same as baseline):
- `INVENTORY_OVERVIEW_PROFILE=1 npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`

Post-change metrics (stabilized rerun):
- `p50=258ms`
- `p95=310.55ms`
- `max=343ms`

Post-change profiling highlights:
- `coreQueriesMs` remains dominant.
- `coreBreakdown.vehicleList` remains the main contributor.
- `enrichmentMs` remains secondary (~`90-95ms` on 50-row variants).

## 6. Before/After Delta

- `p95: 311.6ms -> 310.55ms` (`-1.05ms`, ~`0.34%`)
- `p50: 262ms -> 258ms` (`-4ms`, ~`1.53%`)

Interpretation:
- Improvement is real but small.
- The sprint confirms remaining hotspot concentration in `vehicleList` query path rather than summary or enrichment.

## 7. Cumulative Context

From staged baseline:
- `p95: 799.5ms -> 310.55ms` (`-488.95ms`, ~`61.2%`)

Inventory remains materially improved versus original baseline, but still one of the highest valid measured read-path hotspots.

## 8. Next Bottleneck

Next dominant target remains inside `vehicleList` core query cost:
- list query + total-count shape under high-cardinality variants
- especially default/status-sorted and missing-photos list variants

Recommended next step:
- add deeper per-subcall instrumentation around list DB read vs count query time to isolate which half of `vehicleList` now dominates before further tuning.

---

## 9. VehicleList Micro-Profiling Follow-Up

Implemented:
- explicit `vehicleListQueryBreakdownMs` logging for:
  - `findManyMs`
  - `countMs`

Finding:
- `findMany` is usually the dominant half of `vehicleList`.
- `count` is secondary with intermittent spikes for some filtered variants.

Low-risk optimization attempted:
- `VehiclePhoto(dealership_id, vehicle_id, sort_order)` index for list photo retrieval order path.

Measured outcome:
- no clear p95 improvement in local runs; attribution clarity improved, but latency win not yet material.

---

## 10. FindMany Query-Shape Sprint (March 10, 2026)

Goal:
- optimize the dominant `findMany` half directly after micro-profiling.

Measured baseline (instrumented):
- `p50=295ms`
- `p95=370.8ms`
- `max=384ms`

Query-shape audit result:
- hot `findMany` uses:
  - dealership + soft-delete scoped vehicle rows
  - sorted by one of `createdAt|salePriceCents|mileage|stockNumber|updatedAt`
  - includes floorplan lender and first active photo relation
- hydration risk is concentrated around relation work on list rows.

Optimization attempted:
- removed per-row `vehiclePhotos` relation from list `findMany`
- replaced with one batched photo lookup query by `vehicleIds`

Measured result (attempt):
- `p95` regressed (example run: `392.75ms`)
- enrichment cost increased and no net gain.

Decision:
- reverted this query-shape change.
- reverted associated speculative index/migration changes from repo state.
- retained only micro-profiling instrumentation (`findManyMs`, `countMs`) for next targeted pass.

Post-revert measurement (instrumented):
- `p50=300.5ms`
- `p95=400.85ms`
- `max=430ms`

Interpretation:
- environment/run variance remains high, but the attempted findMany shape change did not improve p95 and was rolled back.
- actionable insight retained: `findMany` remains typically dominant, with occasional `count` spikes.
