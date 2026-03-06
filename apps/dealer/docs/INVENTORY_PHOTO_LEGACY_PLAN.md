# Inventory Photo Legacy Removal — Plan

## 1. Context

- **Slice A (VehiclePhoto)** is implemented: CRUD, reorder, primary, max 20 per vehicle, audit.
- **Legacy**: Some vehicles may have `FileObject` rows (bucket `inventory-photos`, `entityType` "Vehicle", `entityId` = vehicleId) with no corresponding `VehiclePhoto` row.
- **DB helper**: `modules/inventory/db/vehicle-photo.ts` → `listFileObjectsForVehicleWithoutVehiclePhoto(dealershipId, vehicleId)` returns legacy FileObjects for a vehicle (ordered by `createdAt` asc).
- **Goal**: Migrate legacy FileObjects → VehiclePhoto, enforce that new vehicle photos always go through VehiclePhoto, and optionally clean up legacy-only FileObjects (safe mode).

---

## 2. Single Source of Truth

- **VehiclePhoto** is the source of truth for “vehicle photos” (ordering, primary, count).
- **FileObject** is blob metadata only; for inventory photos it must always have a corresponding VehiclePhoto row when `bucket = inventory-photos` and `entityType = Vehicle` and `entityId = vehicleId`.

---

## 3. Places Where Vehicle Photos Are Attached/Created

| Location | Behavior |
|----------|----------|
| `modules/inventory/service/vehicle.ts` → `uploadVehiclePhoto` | Creates FileObject (via `fileService.uploadFile` with bucket `inventory-photos`, entityType `Vehicle`, entityId vehicleId) and then creates VehiclePhoto. **This is the only intended path.** |
| `app/api/files/upload/route.ts` | Generic upload; allows bucket `inventory-photos` but does **not** pass `entityType`/`entityId`. So it can create FileObjects in that bucket with null entityType/entityId; those are not “legacy” per our helper (which filters by entityType + entityId). **Enforcement**: Ensure no code path calls `uploadFile` with `bucket === 'inventory-photos'` and `entityType === 'Vehicle'` and `entityId` except via `uploadVehiclePhoto` (or a single consolidated `createVehiclePhotoFromUpload`). |

**Conclusion**: The only path that creates vehicle-linked FileObjects (entityType Vehicle, entityId vehicleId) today is `uploadVehiclePhoto`, which already creates VehiclePhoto. Legacy rows are historical. Enforcement = no new path creates vehicle-linked FileObject without VehiclePhoto; optional guard in file layer for inventory-photos + Vehicle.

---

## 4. Backfill Ordering Rules

- **sortOrder**: By `FileObject.createdAt` ascending (oldest first). Existing VehiclePhoto rows keep their sortOrder; new rows get sortOrder = existingMax + 0, 1, 2, …
- **primary**: If the vehicle has **no** existing primary VehiclePhoto, set `isPrimary: true` on the **first** new VehiclePhoto (first in createdAt order). Otherwise do not change primary.
- **limit**: Create at most `MAX_PHOTOS_PER_VEHICLE` (20) total per vehicle. If existing VehiclePhoto count + legacy count > 20, create only the first (20 - existingCount) legacy rows (by createdAt); **log skipped count** and include in audit metadata.

---

## 5. Batching Strategy

- Iterate **per dealership** (when running “all dealerships”, iterate dealerships in batches).
- **Per dealership**: List vehicle IDs in batches of **100 vehicles** (configurable via `limitVehicles`, cap e.g. 500 for API).
- Use **cursor** (optional): next batch can be identified by offset or by (createdAt, id) cursor for stable pagination; for simplicity use offset-based batching (skip/limit) for the script and API.
- Never load unbounded rows: each batch = up to N vehicle IDs; for each vehicle, call `listFileObjectsForVehicleWithoutVehiclePhoto` and existing VehiclePhoto count/link.

---

## 6. DRY RUN Output Format

Per-vehicle (for preview) and summary:

- **dealershipId**: UUID
- **vehicleId**: UUID
- **fileObjectIdsToCreate**: string[] (IDs that would get a VehiclePhoto)
- **skippedCount**: number (legacy files beyond the 20 cap)
- **wouldSetPrimary**: boolean (true if vehicle has no primary and we would set first new as primary)

**Summary** (for both preview and apply):

- `vehiclesProcessed`: number  
- `photosCreated`: number  
- `photosSkipped`: number  
- `vehiclesWithLegacy`: number (vehicles that had at least one legacy file)  
- Optional `cursor` / `nextCursor` for resumable runs

---

## 7. Audit Events

- **vehicle_photo.backfilled**  
  - Entity: `Vehicle`  
  - entityId: vehicleId  
  - metadata: `{ countCreated, countSkipped, fileObjectIds? }`  
  - dealershipId and actor (system/script or admin userId) set; redact any PII in metadata.

- **file.legacy_cleanup_deleted** (optional cleanup only)  
  - Entity: `FileObject`  
  - entityId: fileId  
  - metadata: `{ bucket, vehicleId }` (for traceability)  
  - Only when optional cleanup deletes legacy-only FileObjects.

---

## 8. Files to Touch (Summary)

| Area | File(s) |
|------|--------|
| Backfill service | **New**: `modules/inventory/service/vehicle-photo-backfill.ts` |
| Script | **New**: `apps/dealer/scripts/backfill-vehicle-photos.ts` |
| Admin API | **New**: `app/api/admin/inventory/vehicle-photos/backfill/preview/route.ts`, `.../apply/route.ts` |
| Enforcement | `modules/inventory/service/vehicle.ts` (ensure single path; optional `createVehiclePhotoFromUpload` wrapping FileObject + VehiclePhoto in tx if we refactor); `modules/core-platform/service/file.ts` or upload route: guard that inventory-photos + Vehicle + entityId is only used by vehicle photo flow |
| Optional cleanup | **New**: `apps/dealer/scripts/cleanup-legacy-vehicle-fileobjects.ts` (report-only or safe delete with audit) |
| Tests | **New**: `modules/inventory/tests/vehicle-photo-backfill.test.ts` (and optionally in `app/api/admin/...` for RBAC) |
| DB | Use existing `listFileObjectsForVehicleWithoutVehiclePhoto`; may add `listVehicleIdsForDealership(dealershipId, limit, offset)` or use existing listVehicles for batch of IDs |

---

## 9. Safety and Defaults

- **Default DRY RUN**: Script and API preview default to dry run; no DB writes without explicit “apply”.
- **Apply flag**: Script requires `--apply` to mutate; API apply endpoint is a separate POST.
- **Tenant isolation**: All backfill/cleanup scoped by `dealershipId`; no cross-tenant data.
- **RBAC**: Backfill/apply only for admin (e.g. `admin.roles.write` or `admin.permissions.manage`).
- **Rate limit**: Conservative rate limit on admin backfill endpoints.
- **Cleanup**: Only delete FileObject rows that have no VehiclePhoto and match “vehicle photo” criteria; default report-only; require explicit `--apply` for deletion; audit every deletion.

---

## 10. Optional Cleanup (Safe Mode)

- **Condition**: Delete only FileObject rows where:  
  - `dealershipId` scoped  
  - `bucket = 'inventory-photos'`  
  - `entityType = 'Vehicle'`  
  - `entityId IS NOT NULL`  
  - No VehiclePhoto row references this FileObject (`NOT EXISTS` or left-join and filter).  
- **No category field** on FileObject for “vehicle photo” beyond bucket + entityType + entityId; the above is the safe definition.
- **Default**: DRY RUN (report only); require `--apply` to delete; audit each deletion with `file.legacy_cleanup_deleted`.
- If we cannot prove safe deletion in all environments, implement **report-only** and do not implement deletion.
