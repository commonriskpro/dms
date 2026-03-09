# Inventory Legacy Deprecation Report

**Purpose:** Explicit inventory of removed legacy code, retained legacy code with reasons, and future deletion candidates after the Inventory Legacy Cutover Sprint.

---

## Removed legacy code (runtime)

| Location | What was removed | Reason |
|----------|------------------|--------|
| `modules/inventory/service/vehicle.ts` → `listVehiclePhotos` | Fallback branch that called `fileService.listFilesByEntity(dealershipId, "inventory-photos", "Vehicle", vehicleId)` when no VehiclePhoto rows existed, and returned legacy FileObject list with synthetic sortOrder/isPrimary. | Cutover: active runtime inventory photo reads must use VehiclePhoto only. When no VehiclePhotos exist, return empty array. |

---

## Retained legacy code (and why)

| Location | What is retained | Reason |
|----------|------------------|--------|
| **FileObject table and schema** | Entire model and relations. | Required for blob storage metadata and for VehiclePhoto.fileObjectId FK. Upload still creates FileObject; VehiclePhoto references it. |
| **Upload path** | `uploadVehiclePhoto` creates FileObject (via `fileService.uploadFile`) then creates VehiclePhoto. | Single intended path for new photos; FileObject holds blob metadata (filename, mimeType, sizeBytes, storage path, etc.). |
| **VehiclePhoto → FileObject join** | In `listVehiclePhotosWithOrder` and related helpers, VehiclePhoto is joined to FileObject to read filename, mimeType, sizeBytes, createdAt. | Blob metadata lives on FileObject; join is read-only and tenant-scoped. Not “legacy listing” — it’s the correct source for blob fields. |
| **`listFileObjectsForVehicleWithoutVehiclePhoto`** | `modules/inventory/db/vehicle-photo.ts` | Backfill only: finds FileObjects for a vehicle that do not yet have a VehiclePhoto row, so backfill can create them. Not used in runtime listing. |
| **`listLegacyOnlyVehicleFileObjectIds`** | `modules/inventory/db/vehicle-photo.ts` | Cleanup/report only: finds legacy-only FileObject IDs for optional report or delete. Used by `scripts/cleanup-legacy-vehicle-fileobjects.ts`. Not used in runtime listing. |
| **`scripts/cleanup-legacy-vehicle-fileobjects.ts`** | Report or optional soft-delete of legacy-only FileObjects. | Migration/cleanup tooling; not in hot path. |

---

## Future deletion candidates (not done this sprint)

| Item | Condition | Notes |
|------|-----------|--------|
| **`listLegacyOnlyVehicleFileObjectIds`** | After all tenants are backfilled and cleanup has been run and no longer needed. | Keep until ops confirm no further cleanup or reporting is required. |
| **`scripts/cleanup-legacy-vehicle-fileobjects.ts`** | Same as above; can be removed or archived when legacy cleanup is complete. | Document only; no code change this sprint. |
| **FileObject table** | Do not drop. | Still required for blob metadata and VehiclePhoto FK. Any future “removal” would require a different blob metadata strategy and migration. |

---

## Summary

- **Fully removed from runtime:** The only active code path that listed inventory photos from FileObject (the fallback in `listVehiclePhotos`) has been removed. Runtime inventory photo reads now use VehiclePhoto only.
- **Retained for migration/blob:** FileObject table, upload path, VehiclePhoto–FileObject join for blob fields, and backfill/cleanup helpers remain. Reasons documented above.
- **No DB table or column drops** in this sprint; no schema changes.
