# Inventory Completion Sprint — Backend Report

**Step 2 deliverables.** Implements: legacy photo backfill (existing + script summary), bulk import jobs list GET, price-to-market intelligence, days-to-turn analytics, and tests.

---

## A. Legacy vehicle photo backfill

**Status:** Already implemented; no code changes required for behavior.

- **Service:** `modules/inventory/service/vehicle-photo-backfill.ts` — `previewBackfillForDealership`, `runBackfillForDealership`, `runBackfillForAllDealerships`. Idempotent, dry-run/real-run, batch (100 vehicles per batch, cap 500), tenant-scoped. Primary and max 20 enforced; audit `vehicle_photo.backfilled` per vehicle.
- **Script:** `scripts/backfill-vehicle-photos.ts` — `--dealership <uuid>` (required), `--apply`, `--dry-run`, `--limit-vehicles`, `--cursor`. Summary and nextOffset printed for preview and apply.
- **Tests:** `modules/inventory/tests/vehicle-photo-backfill.test.ts` (existing); `app/api/admin/inventory/vehicle-photos/backfill/backfill.route.test.ts` (existing).
- **DB helper:** `listFileObjectsForVehicleWithoutVehiclePhoto` (createdAt asc); `listVehicleIds` for batching.

---

## B. Bulk import jobs list endpoint

**Implemented.**

- **Route:** `GET /api/inventory/bulk/import` in `app/api/inventory/bulk/import/route.ts`.
- **Query:** `listBulkImportJobsQuerySchema`: `limit` (1–100, default 25), `offset` (default 0), optional `status` (`PENDING` | `RUNNING` | `COMPLETED` | `FAILED`).
- **Response:** `{ data: BulkImportJobListItem[], meta: { total, limit, offset } }`. Client-safe fields: id, status, totalRows, processedRows, createdAt, completedAt.
- **RBAC:** `inventory.read`. Tenant isolation via `ctx.dealershipId`.
- **Service:** `bulkService.listBulkImportJobs(dealershipId, options)` in `modules/inventory/service/bulk.ts`; uses `bulkJobDb.listBulkImportJobs`.
- **Tests:** `app/api/inventory/bulk/import/route.test.ts` — valid list, status filter, invalid query 400, FORBIDDEN 403.

---

## C. Price-to-market intelligence

**Implemented.**

- **Per-vehicle:** `modules/inventory/service/price-to-market.ts`:
  - `getPriceToMarketForVehicle(dealershipId, vehicleId, vehicle)` — internal comps (same make/model, ≥3 vehicles) then book value retail; otherwise "No Market Data". Returns `marketStatus`, `marketDeltaCents`, `marketDeltaPercent`, `sourceLabel`.
  - `getPriceToMarketForVehicles(dealershipId, vehicles)` — batch for list; one retail map + one internal-comps-by-make-model map.
- **DB:** `getInternalCompsAvgCentsForMakeModel`, `getInternalCompsAvgCentsByMakeModel`, `makeModelKey` in `modules/inventory/db/vehicle.ts`.
- **Threshold:** ±2% for "At Market" (`PRICE_TO_MARKET_THRESHOLD_PCT = 0.02`).
- **Integration:**
  - **List:** `getInventoryPageOverview` in `inventory-page.ts` calls `getPriceToMarketForVehicles` and attaches `priceToMarket` to each `VehicleListItem`.
  - **Detail:** `GET /api/inventory/[id]` calls `getPriceToMarketForVehicle` and returns `data.intelligence.priceToMarket` and `data.intelligence.daysToTurn`.
- **Caching:** None for V1; batch list uses two bulk queries (retail map + comps by make/model). Can add short TTL cache later if needed.

---

## D. Days-to-turn analytics

**Implemented.**

- **Helpers:** `modules/inventory/service/price-to-market.ts` (pure, no DB):
  - `computeDaysInStock(createdAt)` — `floor((now - createdAt) / dayMs)`.
  - `agingBucketFromDays(days)` — "<30" | "30-60" | "60-90" | ">90".
  - `turnRiskStatus(daysInStock, targetDays)` — good (≤45), warn (≤67), bad (>67), na (null). `DAYS_TO_TURN_TARGET = 45`.
- **List:** Each `VehicleListItem` now has `daysInStock`, `agingBucket`, `turnRiskStatus` (and `priceToMarket`).
- **Detail:** `GET /api/inventory/[id]` returns `data.intelligence.daysToTurn`: `{ daysInStock, agingBucket, targetDays, turnRiskStatus }`.
- **Tests:** `modules/inventory/tests/price-to-market.test.ts` — computeDaysInStock, agingBucketFromDays, turnRiskStatus.

---

## E. Schemas / serializers / services

- **Schemas:** `listBulkImportJobsQuerySchema` already in `app/api/inventory/schemas.ts`. No new Zod for list response (typed in service).
- **Serializers:** Bulk list items serialized in `bulkService.listBulkImportJobs` (dates to ISO string). Vehicle list/detail use existing response shapes plus new fields.
- **Vehicle GET:** Extended with `intelligence.priceToMarket` and `intelligence.daysToTurn`.
- **Inventory page:** `VehicleListItem` extended; `getInventoryPageOverview` builds items with days-to-turn and price-to-market.

---

## F. Tests added/updated

| Test file | Coverage |
|-----------|----------|
| `app/api/inventory/bulk/import/route.test.ts` | GET list 200, status filter, invalid query 400, 403 FORBIDDEN |
| `modules/inventory/tests/price-to-market.test.ts` | computeDaysInStock, agingBucketFromDays, turnRiskStatus |
| `app/api/inventory/[id]/route.test.ts` | Mock price-to-market and vehicle with createdAt for GET |

---

## Files added

- `app/api/inventory/bulk/import/route.ts` — GET list
- `app/api/inventory/bulk/import/route.test.ts` — route tests
- `modules/inventory/service/price-to-market.ts` — price-to-market + days-to-turn helpers
- `modules/inventory/tests/price-to-market.test.ts` — unit tests

## Files modified

- `modules/inventory/db/vehicle.ts` — `getInternalCompsAvgCentsForMakeModel`, `getInternalCompsAvgCentsByMakeModel`, `makeModelKey`
- `modules/inventory/service/bulk.ts` — `listBulkImportJobs`, `BulkImportJobListItem`
- `modules/inventory/service/inventory-page.ts` — `VehicleListItem` extended; list items include `daysInStock`, `agingBucket`, `turnRiskStatus`, `priceToMarket`; call `getPriceToMarketForVehicles`
- `app/api/inventory/[id]/route.ts` — GET returns `intelligence.priceToMarket` and `intelligence.daysToTurn`; mock in test

---

*Backend step complete. Proceed to Step 3 (Frontend).*
