# Inventory Index-Support Sprint Report

Date: March 10, 2026  
Sprint type: narrow index-support optimization (no query-shape rewrite)

## Goal

Apply the narrowest justified index support for the hot list variant:
- `status=AVAILABLE`
- `sortBy=salePriceCents`
- `sortOrder=desc`

Constraints followed:
- no broad `findMany` rewrite,
- no `missingPhotosOnly` work in this sprint,
- no tenant/RBAC behavior change.

## Query Shape Confirmed

Hot variant is exercised by:
- `apps/dealer/scripts/performance/run-inventory-scenario.ts`
  - variant: `{ sortBy: "salePriceCents", sortOrder: "desc", status: "AVAILABLE" }`

Live path query source:
- `apps/dealer/modules/inventory/db/vehicle.ts`
  - `listVehiclesForOverview(...)`

## Change Implemented

### Prisma schema
File:
- `apps/dealer/prisma/schema.prisma`

Added on `model Vehicle`:
- `@@index([dealershipId, status, deletedAt, salePriceCents(sort: Desc)], map: "Vehicle_dealership_id_status_deleted_at_sale_price_cents_desc_idx")`

### Migration
File:
- `apps/dealer/prisma/migrations/20260310162000_inventory_status_saleprice_variant_index/migration.sql`

SQL:

```sql
CREATE INDEX IF NOT EXISTS "Vehicle_dealership_id_status_deleted_at_sale_price_cents_desc_idx"
  ON "Vehicle" ("dealership_id", "status", "deleted_at", "sale_price_cents" DESC);
```

Applied with:
- `npx dotenv -e .env.local -- npm run db:migrate`

## Plan Check (Post-Change)

`EXPLAIN (FORMAT JSON)` for the variant still showed planner choice:
- `Index Scan` on `Vehicle_dealership_id_status_idx`
- followed by `Sort`

Interpretation:
- the new composite index does not force a planner switch in this environment for this specific sample.
- measured impact is therefore evaluated only via repeated perf runs.

## Measurement Method

Same command before and after (5 runs each):

```bash
npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2
```

Why 5 runs:
- prior review showed high variance; single-run results are not trustworthy.

## Before vs After (5-run summaries)

Before:
- mean p50: `321.9ms`
- mean p95: `440.66ms`
- mean avg: `312.23ms`
- p95 range: `396.45ms` to `535.2ms` (spread `138.75ms`)

After:
- mean p50: `331.1ms`
- mean p95: `424.3ms`
- mean avg: `304.37ms`
- p95 range: `379.25ms` to `458.3ms` (spread `79.05ms`)

Delta:
- mean p95: `-16.36ms` (`-3.71%`)
- mean avg: `-7.86ms`
- mean p50: `+9.2ms` (slightly worse)
- variance (p95 spread) improved materially in this sample set

## Validation

Focused test:
- `npm -w dealer run test -- modules/inventory/tests/inventory-page.test.ts`
- result: pass (`9/9`)

## Outcome

Status: **Implemented and retained** (narrow index-only change).

Confidence:
- Moderate but not definitive.
- Directionally improved mean p95/avg and lower spread in this sample.
- Planner did not visibly switch in the captured EXPLAIN sample.

## Deferred (Intentionally)

- No `missingPhotosOnly` anti-join optimization in this sprint.
- No broad `findMany` select/include refactor.
- No async migration of live list path.
