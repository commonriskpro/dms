# Inventory Legacy Cutover Sprint — Specification

**Document path:** `apps/dealer/docs/INVENTORY_LEGACY_CUTOVER_SPEC.md`  
**Mode:** Execute through strict 4-step flow (Spec → Backend → Frontend → Security & QA).  
**Goal:** Finish remaining inventory follow-ups and cut over to VehiclePhoto as the sole runtime source of truth for inventory media; reduce/remove legacy FileObject dependency safely.

---

## 1. Goal / scope

**Sprint objective:**

- Finish remaining inventory follow-ups (all-dealership backfill CLI, list regression tests, internal comps TTL cache, photo shape alignment).
- Cut active inventory media flows over to VehiclePhoto so it is the **sole operational source of truth** for inventory photos.
- Reduce/remove legacy FileObject dependency from **runtime** inventory reads; keep FileObject only for blob metadata, migration/backfill, and explicit non-runtime support where unavoidable.
- Leave explicit cleanup/deprecation notes for any retained legacy code and future deletion candidates.

**Out of scope:** Unrelated CRM/deals/dashboard work; broad repo refactors; blind DB table drops; new external infra; user-facing behavior changes unrelated to cutover.

---

## 2. Current state — inventory media architecture

### Where VehiclePhoto is already the source of truth

| Area | Implementation |
|------|----------------|
| **Upload** | `uploadVehiclePhoto` creates FileObject (blob) then creates VehiclePhoto. Single path; no other code creates vehicle-linked FileObjects. |
| **Photos list API** | `GET /api/inventory/[id]/photos` uses `listVehiclePhotos` → when VehiclePhoto rows exist, returns data from `vehiclePhotoDb.listVehiclePhotosWithOrder` (VehiclePhoto + FileObject join for filename/mime/size). |
| **Reorder / primary / delete** | All operate on VehiclePhoto (and blob via FileObject FK). No legacy path. |
| **Backfill** | Reads legacy FileObjects via `listFileObjectsForVehicleWithoutVehiclePhoto`; creates VehiclePhoto rows. Migration-only. |

### Where FileObject is still referenced in inventory flows

| Location | Usage | Category |
|----------|--------|----------|
| **`modules/inventory/service/vehicle.ts` → `listVehiclePhotos`** | When `withOrder.length === 0`, **fallback** to `fileService.listFilesByEntity(dealershipId, "inventory-photos", "Vehicle", vehicleId)`. Returns legacy FileObject list with synthetic sortOrder/isPrimary. | **Runtime-critical legacy read** — to be removed. |
| **`modules/inventory/db/vehicle-photo.ts`** | `listVehiclePhotosWithOrder` joins VehiclePhoto to FileObject for filename, mimeType, sizeBytes, createdAt. `listFileObjectsForVehicleWithoutVehiclePhoto`, `listLegacyOnlyVehicleFileObjectIds` for backfill/cleanup. | VehiclePhoto read path is correct; FileObject used for join (blob metadata) and migration-only helpers. |
| **`modules/core-platform/service/file.ts`** | `uploadFile` creates FileObject; `listFilesByEntity` used by legacy fallback above. | Upload must keep creating FileObject (blob metadata); listFilesByEntity used only by legacy fallback. |
| **`scripts/backfill-vehicle-photos.ts`** | Calls backfill service; no direct FileObject. | N/A. |
| **`scripts/cleanup-legacy-vehicle-fileobjects.ts`** | Uses `listLegacyOnlyVehicleFileObjectIds` (FileObject). | Migration/cleanup only. |
| **GET /api/inventory/[id]** | Returns `photos` from `listVehiclePhotos`; shape is `{ id, filename, mimeType, sizeBytes, createdAt }` — **missing** sortOrder, isPrimary, fileObjectId. | Response shape to align with photos list API; data source will be VehiclePhoto-only after fallback removal. |

### Summary

- **Runtime inventory photo reads:** Today `listVehiclePhotos` uses VehiclePhoto when present and **falls back to FileObject** when no VehiclePhoto rows exist. That fallback is the only active runtime dependency on legacy FileObject for listing; it must be removed so that **active runtime reads come from VehiclePhoto only**. When no VehiclePhotos exist, return empty array.
- **FileObject remains** for: (1) blob storage metadata (upload still creates FileObject; VehiclePhoto references it); (2) backfill (listing legacy FileObjects without VehiclePhoto); (3) optional cleanup script (listLegacyOnlyVehicleFileObjectIds). No dropping of FileObject table or schema in this sprint.

---

## 3. Legacy cutover strategy

### Phased approach

1. **Backfill completeness assumptions**  
   - Cutover assumes backfill has been run (or is runnable) so that vehicles that had legacy photos have VehiclePhoto rows.  
   - After cutover, any vehicle with only legacy FileObjects and no VehiclePhoto will show **zero photos** in the app until backfill is run. This is acceptable: VehiclePhoto is the source of truth; legacy rows are migration debt.

2. **Read-path cutover**  
   - In `listVehiclePhotos`: remove the fallback branch that calls `fileService.listFilesByEntity`. When `withOrder.length === 0`, return `[]`.  
   - No other runtime inventory code should call `listFilesByEntity` for inventory-photos + Vehicle.  
   - Backfill and cleanup scripts continue to use `listFileObjectsForVehicleWithoutVehiclePhoto` / `listLegacyOnlyVehicleFileObjectIds` (migration-only).

3. **Response shape alignment**  
   - GET `/api/inventory/[id]` and GET `/api/inventory/[id]/photos` must expose the same canonical photo shape (see §7).  
   - GET [id] currently omits sortOrder, isPrimary, fileObjectId from photos; align to include them so both endpoints return the same structure.

4. **Fallback removal rules**  
   - Remove only the legacy **read** fallback in `listVehiclePhotos`.  
   - Do not remove: FileObject creation on upload, VehiclePhoto→FileObject join for blob metadata, or backfill/cleanup helpers that query FileObject for migration.

5. **Cleanup rules for dead code**  
   - If any other code path is found that reads inventory photos from FileObject for runtime display, remove or replace it with VehiclePhoto-backed reads.  
   - Keep migration-only helpers; document them in the deprecation report.

6. **Rollback / failure**  
   - If issues arise, re-adding the fallback in `listVehiclePhotos` is a one-line revert. No schema or migration needed for rollback.

### Explicit statements

- **Active runtime inventory photo reads** must come from **VehiclePhoto only** (via `listVehiclePhotosWithOrder` or equivalent). No `listFilesByEntity` for inventory-photos in runtime listing.
- **FileObject** may remain for: (1) blob metadata (upload, storage); (2) migration/backfill (listing legacy-only FileObjects); (3) optional cleanup reporting. It is **not** the source of truth for ordering, primary, or count.

---

## 4. --all-dealership backfill CLI support

### Behavior

- **Flag:** `--all-dealership` (optional). When present, run backfill for all dealerships (using existing `runBackfillForAllDealerships`). When absent, require `--dealership <uuid>` for single-dealership run.
- **Mutual exclusivity:** Either `--dealership <uuid>` **or** `--all-dealership`, not both. If both provided, error and exit with usage message.
- **Dry-run:** Default remains dry-run. `--apply` performs writes. Same for both modes.
- **Output summary:**  
  - Single-dealership: existing summary (vehiclesProcessed, vehiclesWithLegacy, photosCreated/photosWouldCreate, photosSkipped, nextOffset).  
  - All-dealership: summary with dealershipsProcessed, totalPhotosCreated, totalPhotosSkipped, and per-dealership results array (dealershipId, summary, errors if any).
- **Batching/cursor:** All-dealership mode uses existing `runBackfillForAllDealerships` (batch of dealerships, each with default vehicle batch size). No cursor across dealerships for V1; optional limit via `limitDealerships` if already supported.
- **Safety:** Script prints mode (single vs all) and dry-run/apply before running. No confirmation prompt required; operator must pass explicit flags.
- **Idempotency:** Unchanged; re-run is safe.

### Usage (target)

```text
# Single dealership (existing)
npm -w apps/dealer run db:backfill-vehicle-photos -- --dealership <uuid> [--apply] [--dry-run] [--limit-vehicles N] [--cursor N]

# All dealerships (new)
npm -w apps/dealer run db:backfill-vehicle-photos -- --all-dealership [--apply] [--dry-run] [--limit-dealerships N]
```

---

## 5. Inventory list regression coverage

### Scope

Regression tests must assert that the **list payload** (service or route output) includes intelligence fields and handles no-data/fallback correctly. Prefer **service-level or route-level** tests over brittle UI-only tests.

**Fields to assert:**

- `daysInStock`: number | null (or number when vehicle has createdAt).
- `agingBucket`: string | null (e.g. "<30", "30-60", "60-90", ">90").
- `turnRiskStatus`: string ("good" | "warn" | "bad" | "na").
- `priceToMarket`: object | null with `marketStatus`, `marketDeltaCents`, `marketDeltaPercent`, `sourceLabel`; or null when no data.
- No-data/fallback: when no internal comps and no book value, `priceToMarket.marketStatus` is "No Market Data" (or equivalent); when no createdAt, daysInStock/turnRiskStatus handled (e.g. null / "na").

**Where to test:**

- Option A: Test `getInventoryPageOverview` (or equivalent) with mocked DB so that list items in the result have the expected shape and fallback values.
- Option B: Test the serializer/mapper that builds `VehicleListItem` from DB rows + priceToMarket map so that all four fields are present and typed.

**Expectations:**

- Every list item has `daysInStock`, `agingBucket`, `turnRiskStatus`, `priceToMarket` (possibly null).
- Serializer/list shape is stable; no accidental omission of new fields.

---

## 6. Internal comps TTL cache

### What is cached

- **Value:** Result of `getInternalCompsAvgCentsByMakeModel(dealershipId)` — a `Map<string, number>` (makeModelKey → average cents). This is the only expensive aggregate used for price-to-market on the list; caching it per dealership avoids repeated DB work for the same dealership in a short window.
- **Key:** `inventory:comps:${dealershipId}`. Must include dealershipId so cache is tenant-safe. No make/model in key; the map covers all make/model groups for that dealership.
- **TTL:** 20–30 seconds (recommend 25_000 ms). No invalidation on write; TTL-only is sufficient for list/detail intelligence.
- **What is NOT cached:** Per-vehicle price-to-market result; retail map; fleet-level aggregates. Only the internal comps-by-make-model map is cached.

### Implementation

- Use existing `createTtlCache` from `@/modules/core/cache/ttl-cache`. New cache instance: `ttlMs: 25_000`, `maxEntries` reasonable (e.g. 500). Key format above.
- In `getPriceToMarketForVehicles` (or in a thin wrapper around `getInternalCompsAvgCentsByMakeModel`): check cache by `inventory:comps:${dealershipId}`; on miss, call DB, store map in cache, return. On hit, return cached map. Map is in-memory; no cross-tenant key possible if key always includes dealershipId.
- **Invalidation:** None. TTL-only. Optional future: invalidate on vehicle create/update/delete for that dealership if product requires; out of scope for V1.

---

## 7. Photo shape alignment

### Canonical inventory photo response shape

Based on current GET `/api/inventory/[id]/photos` and VehiclePhoto-backed data:

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Client-facing photo id; same as fileObjectId (used for signed URL, delete, reorder, set primary). |
| `fileObjectId` | string | Blob reference (optional in response but useful for consistency). |
| `filename` | string | Original filename. |
| `mimeType` | string | e.g. image/jpeg. |
| `sizeBytes` | number | File size. |
| `sortOrder` | number | Display order. |
| `isPrimary` | boolean | Primary photo flag. |
| `createdAt` | string | ISO date. |

**Not in canonical shape (no change):** `url` / `thumbnailUrl` — client obtains signed URL via separate endpoint; no change.

### Alignment target

- **GET /api/inventory/[id]**  
  - `data.photos` must use the **same** shape as GET `/api/inventory/[id]/photos`: include `id`, `fileObjectId`, `filename`, `mimeType`, `sizeBytes`, `sortOrder`, `isPrimary`, `createdAt`.  
  - Source: same `listVehiclePhotos` (VehiclePhoto-backed only after cutover); map to canonical shape in one place if possible (shared helper/serializer).

- **GET /api/inventory/[id]/photos**  
  - Already returns this shape; no change except that data will no longer come from legacy fallback.

### Backward compatibility

- Adding `sortOrder`, `isPrimary`, `fileObjectId` to GET [id] photos is **additive**. Existing consumers that only use `id`, `filename`, `mimeType`, `sizeBytes`, `createdAt` continue to work. New consumers can use full shape. No breaking change.

---

## 8. Legacy cleanup scope

### What “get rid of legacy system” means this sprint

- **Remove:** Legacy **read** fallback from active inventory flows (i.e. the branch in `listVehiclePhotos` that calls `fileService.listFilesByEntity` when no VehiclePhoto rows exist).
- **Retain:**  
  - FileObject table and schema.  
  - Upload path that creates FileObject + VehiclePhoto.  
  - VehiclePhoto → FileObject join for blob metadata (filename, mimeType, sizeBytes, createdAt).  
  - Backfill helpers: `listFileObjectsForVehicleWithoutVehiclePhoto`, `listLegacyOnlyVehicleFileObjectIds`.  
  - Cleanup script (report-only or optional delete) that uses legacy-only FileObject listing.
- **Do NOT:** Drop DB tables; remove backfill/cleanup helpers; or break blob storage linkage.

### Cleanup / deprecation report (to be produced in Step 2/4)

Must list:

- **Removed legacy code:** e.g. `listVehiclePhotos` fallback to `listFilesByEntity`.
- **Retained legacy code:** e.g. `listFileObjectsForVehicleWithoutVehiclePhoto`, `listLegacyOnlyVehicleFileObjectIds`, FileObject creation in upload, cleanup script. With **reason retained** (migration, backfill, blob metadata).
- **Future deletion candidates:** e.g. after all tenants are backfilled and cleanup has run, optional removal of `listLegacyOnlyVehicleFileObjectIds` if no longer needed; document only, no action this sprint.

---

## 9. RBAC / security / tenant isolation

- **Backfill:** Script and service remain tenant-scoped. All-dealership mode iterates dealerships; each batch is per-dealership. No cross-tenant data in a single batch.
- **Cache:** Cache key includes `dealershipId`; no cross-tenant reads.
- **GET [id] / photos:** Already use auth context and `dealershipId`; no change.
- **Permissions:** No new endpoints; existing `inventory.read` / `documents.read` and write equivalents unchanged.
- **Verification:** Confirm no active inventory runtime path reads FileObject for listing photos after cutover; confirm cache key format in code review.

---

## 10. Acceptance criteria

- [ ] **All-dealership backfill CLI:** Script accepts `--all-dealership`; mutually exclusive with `--dealership`; dry-run and apply work; summary output as specified.
- [ ] **Inventory list regression tests:** Tests cover list item shape for daysInStock, agingBucket, turnRiskStatus, priceToMarket and no-data/fallback where relevant.
- [ ] **Internal comps TTL cache:** Cache key includes dealershipId; TTL ~25s; getInternalCompsAvgCentsByMakeModel result cached; no cross-tenant leakage.
- [ ] **GET [id] photo shape:** Aligned to canonical shape (id, fileObjectId, filename, mimeType, sizeBytes, sortOrder, isPrimary, createdAt).
- [ ] **Active runtime no legacy FileObject reads:** `listVehiclePhotos` does not call `listFilesByEntity` for inventory photos; zero photos when no VehiclePhoto rows.
- [ ] **Docs:** Backend and Step 4 reports clearly list removed legacy code, retained legacy code with reasons, and future deletion candidates.

---

## 11. File plan

### Step 2 — Backend

| Action | File(s) |
|--------|--------|
| Add all-dealership CLI | `scripts/backfill-vehicle-photos.ts` |
| List regression tests | `modules/inventory/tests/inventory-page.test.ts` or new `modules/inventory/tests/inventory-list-intelligence.test.ts` |
| Comps TTL cache | `modules/inventory/service/price-to-market.ts` and/or new small cache wrapper; reuse `createTtlCache` |
| Photo shape alignment | `app/api/inventory/[id]/route.ts` (photos mapping); optional shared serializer in `modules/inventory/` |
| Remove legacy fallback | `modules/inventory/service/vehicle.ts` → `listVehiclePhotos` |
| Deprecation/cleanup report | `apps/dealer/docs/INVENTORY_LEGACY_CUTOVER_BACKEND_REPORT.md` |

### Step 3 — Frontend

| Action | File(s) |
|--------|--------|
| Consume aligned photo shape if needed | `modules/inventory/ui/types.ts`, `VehicleDetailPage` / `VehicleDetailContent` if they depend on photo shape |
| Report | `apps/dealer/docs/INVENTORY_LEGACY_CUTOVER_FRONTEND_REPORT.md` |

### Step 4 — Security & QA

| Action | File(s) |
|--------|--------|
| Reports | `STEP4_INVENTORY_LEGACY_CUTOVER_SECURITY_REPORT.md`, `STEP4_INVENTORY_LEGACY_CUTOVER_SMOKE_REPORT.md`, `STEP4_INVENTORY_LEGACY_CUTOVER_PERF_REPORT.md`, `INVENTORY_LEGACY_DEPRECATION_REPORT.md` |

---

*End of spec. No code until spec is complete.*
