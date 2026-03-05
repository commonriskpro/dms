# Step 4 — Inventory Depth Sprint Slices A, B, C — Security & QA Report

**Date:** 2025-03-05  
**Scope:** Slices A (Photo pipeline), B (Bulk ops), C (Alerts)

---

## 1. Summary

- **Slice A:** VehiclePhoto model, photo reorder/set-primary/delete with audit; max 20 photos/vehicle, 10MB, MIME whitelist. All routes scoped by `dealershipId` from auth; RBAC `inventory.write` + `documents.write` for mutations.
- **Slice B:** BulkImportJob model; CSV import preview/apply (1MB, 500 rows); bulk update (max 50 IDs); export inventory optional `status` filter. Dealership from auth only.
- **Slice C:** InventoryAlertDismissal model; GET counts/list (exclude user dismissals); POST dismiss/snooze; DELETE undo. `inventory.read` for counts/list, `inventory.write` for dismiss.

---

## 2. Tenant Isolation

- **dealershipId:** Never accepted from client. All list/get/update/delete use `ctx.dealershipId` from `getAuthContext(request)`.
- **VehiclePhoto:** All DB access filters by `dealershipId`; vehicle must belong to dealership.
- **BulkImportJob:** Created and queried with `dealershipId` from auth; GET job by id checks `dealershipId`.
- **Bulk update:** `vehicleIds` validated by loading each vehicle with `getVehicleById(dealershipId, id)`; NOT_FOUND if not in dealership.
- **Alerts:** Counts and list use `dealershipId` from auth; dismissals scoped by `dealershipId` and `userId`.

---

## 3. RBAC

| Route | Permission | Verified |
|-------|------------|----------|
| GET/POST /api/inventory/[id]/photos | inventory.read, documents.read / inventory.write, documents.write | guardPermission before service |
| PATCH photos/reorder, photos/primary | inventory.write, documents.write | Yes |
| DELETE photos/[fileId] | inventory.write, documents.write | Yes |
| GET /api/reports/export/inventory | reports.export | Yes |
| POST bulk/import/preview, apply | inventory.write | Yes |
| GET bulk/import/[jobId] | inventory.read | Yes |
| PATCH bulk/update | inventory.write | Yes |
| GET alerts/counts, GET alerts | inventory.read | Yes |
| POST alerts/dismiss, DELETE alerts/dismiss/[id] | inventory.write | Yes |

---

## 4. Validation (Zod at edge)

- **Slice A:** reorderPhotosBodySchema (fileIds 1–20), setPrimaryPhotoBodySchema (fileId uuid). Max 20 photos and 10MB enforced in service.
- **Slice B:** bulkUpdateBodySchema (vehicleIds 1–50, at least one of status/locationId). Import file size and row count in service + route (1MB, 500 rows).
- **Slice C:** dismissAlertBodySchema (vehicleId, alertType, action, snoozedUntil when SNOOZE); alertsListQuerySchema (limit, offset, alertType).

---

## 5. Audit

- **Slice A:** vehicle_photo.added, vehicle_photo.reordered, vehicle_photo.primary_set, vehicle_photo.removed (entity Vehicle, entityId vehicleId).
- **Slice B:** bulk_import_job.created, bulk_import_job.completed, bulk_import_job.failed; vehicle.updated per vehicle in bulk update (via existing updateVehicle audit).
- **Slice C:** Dismissals are user-preference; optional audit not implemented per spec.

---

## 6. Rate Limiting

- Upload (photos): existing `checkRateLimit(clientId, "upload")` in POST photos.
- Export: existing `checkRateLimit(identifier, "report_export")` in reports/export/inventory.
- Bulk import: no additional rate limit (file size and row limits bound abuse).

---

## 7. Tests and Commands

**Run from repo root:**

```bash
npm -w apps/dealer run test -- modules/inventory/tests
npm -w apps/dealer run build
```

**Existing tests:**  
- `tenant-isolation.test.ts`: listVehiclePhotos, uploadVehiclePhoto, deleteVehiclePhoto cross-dealer NOT_FOUND.  
- `audit.test.ts`: uploadVehiclePhoto creates vehicle_photo.added (and file.uploaded).  
- `upload-validation.test.ts`: MIME and size validation.

**Recommended additions (Jest):**  
- Slice A: reorderVehiclePhotos / setPrimaryVehiclePhoto tenant isolation; max 20 photos rejection.  
- Slice B: bulkUpdateVehicles with vehicleIds from another dealer (expect errors per vehicle); preview/apply file size and row limits.  
- Slice C: getAlertCounts / listAlerts scoped by dealership; dismiss then undo; snoozedUntil future validation.

---

## 8. Gates Checklist

- **Tenant safety:** All inventory/bulk/alerts API routes export `dynamic = "force-dynamic"`. Inventory page uses `noStore()` and passes alert counts from server.
- **API hygiene:** Zod on params/query/body; error shape `{ error: { code, message, details? } }`; list endpoints paginated (alerts, bulk jobs if list added).
- **RBAC:** Every route calls guardPermission before business logic.
- **Quality:** Jest used; lint/build pass.

---

## 9. Files Touched (summary)

**Slice A:**  
- Prisma: VehiclePhoto model, Vehicle.vehiclePhotos, FileObject.vehiclePhoto, Dealership.vehiclePhotos.  
- Migration: 20260305100000_add_vehicle_photo.  
- modules/inventory/db/vehicle-photo.ts, service/vehicle.ts (listVehiclePhotos, uploadVehiclePhoto, deleteVehiclePhoto, reorderVehiclePhotos, setPrimaryVehiclePhoto).  
- app/api/inventory/[id]/photos/route.ts, photos/reorder/route.ts, photos/primary/route.ts, schemas (reorder, setPrimary).

**Slice B:**  
- Prisma: BulkImportJob model, Dealership.bulkImportJobs, Profile.bulkImportJobsCreatedBy.  
- Migration: 20260305110000_add_bulk_import_job.  
- modules/inventory/db/bulk-import-job.ts, service/bulk.ts.  
- modules/reports/db/inventory.ts (status filter), service/export.ts, app/api/reports/schemas.ts, export/inventory/route.ts.  
- app/api/inventory/bulk/import/preview, apply, [jobId], bulk/update routes and schemas.

**Slice C:**  
- Prisma: InventoryAlertType, InventoryAlertDismissalAction, InventoryAlertDismissal; Vehicle, Dealership, Profile relations.  
- Migration: 20260305120000_add_inventory_alert_dismissal.  
- modules/inventory/db/alerts.ts, service/alerts.ts.  
- app/api/inventory/alerts/counts, alerts, alerts/dismiss, alerts/dismiss/[id] routes and schemas.

**Frontend (minimal):**  
- app/(app)/inventory/page.tsx: server fetch of alert counts, initialAlerts passed to InventoryPage.  
- modules/inventory/ui/InventoryPage.tsx: initialAlerts prop, passed to InventoryRightRail.

---

*End of report.*
