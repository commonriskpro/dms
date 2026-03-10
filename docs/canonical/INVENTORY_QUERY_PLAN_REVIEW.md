# Inventory Query-Plan Review

Date: March 10, 2026  
Scope: Inventory hot-path `findMany`/`count` measurement stability and query-plan support review.

## Executive Summary

- Inventory remains a valid hotspot, but current local variance is high.
- Micro-profiling confirms `findMany` is usually the dominant half of `vehicleList`; `count` is secondary with intermittent spikes.
- Query-plan evidence shows:
  - default list path has good index support,
  - `status + salePrice desc` path still pays a sort,
  - `missingPhotosOnly` path degrades to sequential scans + hash joins.
- Next best low-risk move: targeted index support for `status + salePrice desc` variant.  
- Do not do another broad query-shape rewrite yet.

## Measurement Stability (Repeated Runs)

Command pattern:

```bash
npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2
```

Repeated runs (`metrics.total`):

| Run | p50Ms | p95Ms | maxMs |
| --- | ---: | ---: | ---: |
| 1 | 315 | 392.95 | 432 |
| 2 | 282 | 396 | 440 |
| 3 | 355 | 442.45 | 487 |
| 4 | 283.5 | 414.2 | 445 |
| 5 | 300.5 | 507.3 | 614 |

Variance note:
- p95 ranged from `392.95ms` to `507.3ms` in this environment.
- This is enough variance to avoid declaring tiny deltas as wins.

## Micro-Profiling Evidence (`vehicleList`)

Profile command:

```bash
LOG_LEVEL=debug INVENTORY_OVERVIEW_PROFILE=1 npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2
```

From profiled iteration set (excluding warmup lines):

- `findManyMs` stats: min `64`, avg `152.33`, p50 `155`, p95 `221.15`, max `247`
- `countMs` stats: min `31`, avg `53.42`, p50 `37.5`, p95 `128.45`, max `206`
- dominance: `findMany` > `count` in `11/12` profiled iterations

Conclusion:
- dominant remaining cost is still `findMany`, not `count`.

## Hot Query Shape (Code Truth)

Source path:
- `apps/dealer/modules/inventory/db/vehicle.ts` (`listVehiclesForOverview(...)`)

Live list query structure:
- `where`: `dealershipId` + `deletedAt: null` + variant filters
- `orderBy`: dynamic from query (`createdAt`, `salePriceCents`, `mileage`, etc.)
- `select`: slim row fields + first non-deleted photo (`vehiclePhotos` with `take: 1`, `orderBy sortOrder asc`)
- paired `count(where)` in parallel

Scenario variants exercised by perf runner:
- default: page 1, `sortBy=createdAt desc`
- available by price: `status=AVAILABLE`, `sortBy=salePriceCents desc`
- missing photos: `missingPhotosOnly=true`, `sortBy=mileage asc`, page 2
- search + floorplanned: `search=toyota`, `floorPlannedOnly=true`

## Query-Plan Evidence (EXPLAIN)

Using `EXPLAIN (FORMAT JSON)` against live query-equivalent SQL:

1. Default list (`createdAt desc`, tenant + deleted filter)
- Plan: `Index Scan` on `Vehicle_dealership_id_created_at_idx` + `Limit`
- Assessment: already index-supported.

2. `status=AVAILABLE` + `salePriceCents desc`
- Plan: `Index Scan` on `Vehicle_dealership_id_status_idx` followed by `Sort`
- Assessment: filtering is indexed, but ordering still incurs sort work.

3. `missingPhotosOnly` + `mileage asc`
- Plan: sequential scans on `Vehicle`, `VehiclePhoto`, `FileObject` with hash joins + sort
- Assessment: this variant is expensive and plan shape is join-heavy.

4. `count(*)` default path
- Plan: `Index Only Scan` on a `Vehicle(dealership_id, deleted_at, mileage)` index
- Assessment: count baseline is generally efficient.

5. `count(*)` missing-photos variant
- Plan: hash joins with sequential scans over `Vehicle`, `VehiclePhoto`, `FileObject`
- Assessment: explains occasional `countMs` spikes on filtered variants.

## Index/Plan Support Assessment

Current schema highlights (`apps/dealer/prisma/schema.prisma`):
- `Vehicle`: indexes on `(dealershipId, deletedAt, createdAt desc)`, `(dealershipId, deletedAt, salePriceCents desc)`, `(dealershipId, deletedAt, mileage asc)`, and others.
- `VehiclePhoto`: indexes on `(dealershipId, vehicleId)` and `(vehicleId)`.
- `FileObject`: no index on `deletedAt` (or `(dealershipId, deletedAt)`), which hurts missing-photo anti-join planning.

Important nuance:
- Existing `Vehicle(dealershipId, deletedAt, salePriceCents desc)` may not fully satisfy the `status=AVAILABLE` sort variant, so planner sorts after using the `(dealershipId, status)` index.

## Decision: Next Best Move

Recommended next optimization target:
- **Index support change**, narrowly scoped to reduce sort work for the `status + salePrice desc` variant.

Reason:
- It is low-risk and directly tied to observed plan behavior.
- It avoids high-risk query rewrites.
- It targets a common real variant without changing list semantics.

Deferred for now:
- Broad `missingPhotosOnly` anti-join redesign (higher complexity/risk).
- More select/include reshaping (already tried recently; regression risk observed).

## Suggested Next Sprint (Evidence-Based)

1. Add one targeted composite index supporting:
- `dealershipId`, `status`, `deletedAt`, `salePriceCents desc` (exact ordering per final SQL needs)

2. Re-run:
- the same 5-run stability batch
- one profiled debug batch

3. Success threshold:
- consistent p95 reduction beyond current variance band (not a single-run win).

## Stop Criteria

Stop inventory query-shape work for now if:
- targeted index change does not produce a repeatable gain across the stability batch, or
- gains are below variance noise floor.
