# Step 4 — Inventory Completion Security Report

**Scope:** New and touched inventory routes, services, and scripts from the completion sprint.

---

## Checklist

### Tenant isolation

| Area | Verification |
|------|--------------|
| **Bulk import jobs list** | `GET /api/inventory/bulk/import` uses `ctx.dealershipId` from auth; `listBulkImportJobs(dealershipId, options)` filters by `dealershipId` in DB. No cross-tenant data. |
| **Price-to-market** | `getPriceToMarketForVehicle` and `getPriceToMarketForVehicles` receive `dealershipId`; internal comps and book values are read via `dealershipId` in vehicle and book-values DB. |
| **Days-to-turn** | Computed from vehicle `createdAt`; vehicle list and detail are already scoped by dealership. No new cross-tenant paths. |
| **Legacy photo backfill** | Service and script operate per `dealershipId`; `listVehicleIds` and `listFileObjectsForVehicleWithoutVehiclePhoto` are dealership-scoped. All-dealership mode iterates dealerships; each batch is per-dealership. |

### RBAC

| Route / action | Permission | Verified |
|----------------|------------|----------|
| `GET /api/inventory/bulk/import` | `inventory.read` | `guardPermission(ctx, "inventory.read")` in route. |
| `GET /api/inventory/[id]` | `inventory.read` | Existing; intelligence data same permission. |
| Price-to-market / days-to-turn (list & detail) | Same as list/detail | No new endpoints; data returned with existing GET. |

### Backfill safety

- Script requires `--dealership <uuid>` for V1; no accidental all-tenant run without explicit service call.
- Preview and apply use same service; apply writes only when `dryRun: false`. Audit `vehicle_photo.backfilled` per vehicle.
- No deletion of FileObjects in this sprint; optional cleanup is report-only per spec.

### Validation and abuse

| Item | Verification |
|------|--------------|
| Bulk list query | `listBulkImportJobsQuerySchema`: `limit` 1–100, `offset` ≥ 0, `status` enum. Invalid query returns 400. |
| No sensitive data in list | Response omits `errorsJson` and `createdBy` in list payload; client-safe fields only. |
| Rate limiting | No new mutation routes in this sprint. List endpoint follows existing inventory list patterns; rate limits as per existing API standards. |

### Logging and PII

- No new logging of PII. Audit metadata for backfill: `countCreated`, `countSkipped`, `fileObjectIds` (IDs only).

---

## Summary

- **Tenant isolation:** All new and touched code paths use `dealershipId` from auth or script args; no cross-tenant access.
- **RBAC:** Bulk list and vehicle detail enforce `inventory.read`; no new write paths without permission checks.
- **Backfill:** Script and service are dealership-scoped; dry-run default; audit in place.
- **Validation:** Bulk list query validated with Zod; invalid requests return 400.

**No outstanding security issues identified for the sprint scope.**
