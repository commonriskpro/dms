# Inventory Legacy Cutover — Backend Report

**Step 2 deliverables.** All-dealership backfill CLI, list regression tests, internal comps TTL cache, photo shape alignment, legacy read-path cutover, and deprecation summary.

---

## A. All-dealership backfill CLI

**Implemented.**

- **Script:** `scripts/backfill-vehicle-photos.ts`
- **New flag:** `--all-dealership`. When set, runs `runBackfillForAllDealerships({ limitDealerships, dryRun }, actorUserId)`.
- **Mutual exclusivity:** If both `--dealership <uuid>` and `--all-dealership` are provided, script errors and exits with usage message. If neither is provided, script errors.
- **Optional:** `--limit-dealerships N` (default 50) for all-dealership mode.
- **Output:** All-dealership mode prints `dealershipsProcessed`, `totalPhotosCreated`, `totalPhotosSkipped`, and `results` (per-dealership summaries). Exit code 1 if any dealership had errors.
- **Dry-run / apply:** Unchanged; default dry-run, `--apply` for writes.
- **Idempotency:** Unchanged; re-run safe.

---

## B. Inventory list regression tests

**Implemented.**

- **inventory-page.test.ts:** In the existing integration test "returns overview shape with list and filterChips", added assertions that when `overview.list.items.length > 0`, the first item has `daysInStock`, `agingBucket`, `turnRiskStatus`, `priceToMarket`; `turnRiskStatus` in ["good","warn","bad","na"]; `priceToMarket` has `marketStatus`, `sourceLabel`; when present, `agingBucket` in ["<30","30-60","60-90",">90"].
- **inventory-list-intelligence.test.ts:** New unit tests that (1) require all VehicleListItem keys including intelligence fields, (2) allow null/na and "No Market Data" for no-data fallback, (3) document valid turnRiskStatus and agingBucket values.

---

## C. Internal comps TTL cache

**Implemented.**

- **Module:** `modules/inventory/service/price-to-market.ts`
- **Cache:** `createTtlCache<Map<string, number>>` with `ttlMs: 25_000`, `maxEntries: 500`.
- **Key:** `inventory:comps:${dealershipId}` — tenant-safe; no cross-tenant leakage.
- **Behavior:** In `getPriceToMarketForVehicles`, check cache by key; on miss call `getInternalCompsAvgCentsByMakeModel(dealershipId)`, set cache, use result; on hit use cached map. Retail map is not cached (single query per request).
- **Invalidation:** TTL-only; no explicit invalidation.

---

## D. Photo shape alignment

**Implemented.**

- **GET /api/inventory/[id]:** `data.photos` now uses the same shape as GET `/api/inventory/[id]/photos`: `id`, `fileObjectId`, `filename`, `mimeType`, `sizeBytes`, `sortOrder`, `isPrimary`, `createdAt` (ISO string). Source remains `listVehiclePhotos` (VehiclePhoto-backed only after cutover).
- **GET /api/inventory/[id]/photos:** Unchanged; already returned this shape. Data source is now VehiclePhoto-only (no legacy fallback).

---

## E. Legacy read-path cutover

**Implemented.**

- **Removed:** In `modules/inventory/service/vehicle.ts`, the branch in `listVehiclePhotos` that called `fileService.listFilesByEntity(dealershipId, "inventory-photos", "Vehicle", vehicleId)` when `withOrder.length === 0`. That fallback returned legacy FileObject-based photos with synthetic sortOrder/isPrimary.
- **Current behavior:** `listVehiclePhotos` always uses `vehiclePhotoDb.listVehiclePhotosWithOrder(dealershipId, vehicleId)` and returns its result (mapped to the same client shape). When there are no VehiclePhoto rows, it returns an empty array. No FileObject listing in the runtime read path.
- **Retained:** FileObject creation in `uploadVehiclePhoto` (blob metadata); VehiclePhoto → FileObject join in `listVehiclePhotosWithOrder` for filename, mimeType, sizeBytes, createdAt; backfill helpers `listFileObjectsForVehicleWithoutVehiclePhoto`, `listLegacyOnlyVehicleFileObjectIds`; cleanup script. No DB table or column dropped.

---

## F. What was cut over / removed / retained

| Item | Status | Notes |
|------|--------|-------|
| Runtime inventory photo list | **Cut over** | `listVehiclePhotos` now uses VehiclePhoto only; no legacy fallback. |
| GET [id] photos shape | **Aligned** | Same shape as GET [id]/photos (sortOrder, isPrimary, fileObjectId). |
| Legacy fallback code | **Removed** | `fileService.listFilesByEntity` no longer called from `listVehiclePhotos`. |
| FileObject table/schema | **Retained** | Required for blob metadata and VehiclePhoto FK. |
| Upload path (FileObject + VehiclePhoto) | **Retained** | Single path for new photos. |
| Backfill helpers (listFileObjectsForVehicleWithoutVehiclePhoto, listLegacyOnlyVehicleFileObjectIds) | **Retained** | Migration/backfill/cleanup only. |
| cleanup-legacy-vehicle-fileobjects script | **Retained** | Report/optional delete of legacy-only FileObjects. |

**Future deletion candidates (not done this sprint):** After all tenants are backfilled and cleanup has run, `listLegacyOnlyVehicleFileObjectIds` could be removed if no longer needed; document only.

---

## Files modified

- `scripts/backfill-vehicle-photos.ts` — all-dealership mode, mutual exclusivity, usage.
- `modules/inventory/service/vehicle.ts` — removed legacy fallback in `listVehiclePhotos`.
- `modules/inventory/service/price-to-market.ts` — internal comps TTL cache.
- `app/api/inventory/[id]/route.ts` — photos array aligned to canonical shape.
- `modules/inventory/tests/inventory-page.test.ts` — list item intelligence assertions.
- `modules/inventory/tests/inventory-list-intelligence.test.ts` — new unit tests for list shape.

---

*Backend step complete. Proceed to Step 3 (Frontend) and Step 4 (Security & QA).*
