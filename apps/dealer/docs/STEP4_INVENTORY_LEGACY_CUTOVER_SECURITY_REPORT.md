# Step 4 — Inventory Legacy Cutover Security Report

**Scope:** All-dealership backfill, cache, photo shape, and legacy read-path cutover.

---

## Checklist

### All-dealership backfill

- **Explicit and safe:** Script requires either `--dealership <uuid>` or `--all-dealership`; mutual exclusivity enforced; mode printed before run.
- **Tenant isolation:** `runBackfillForAllDealerships` iterates dealerships; each call to `runBackfillForDealership` is scoped by that dealership’s id. No cross-tenant data in a single batch.
- **No accidental cross-tenant write:** Each dealership batch uses only that dealership’s vehicle and FileObject rows.

### Cache

- **Tenant-safe key:** Cache key is `inventory:comps:${dealershipId}`. No key can refer to more than one dealership.
- **No cross-tenant reads:** Cache is populated and read only with a single dealershipId per key. No leakage.

### GET [id] photo shape

- **Source:** Photos in GET [id] come from `listVehiclePhotos` → VehiclePhoto-backed only. No legacy FileObject listing in the response path.
- **Data:** Only client-safe fields returned (id, fileObjectId, filename, mimeType, sizeBytes, sortOrder, isPrimary, createdAt). No internal or PII.

### Legacy read-path removal

- **Verified:** No active inventory runtime path calls `listFilesByEntity` for inventory-photos + Vehicle. The only such call was in `listVehiclePhotos` and has been removed.
- **Retained:** Backfill and cleanup scripts still use FileObject for migration-only listing; not in the hot path and scoped by dealershipId.

### Sensitive data

- No new logging of PII or blob metadata in responses. Audit and existing patterns unchanged.

---

## Summary

- Backfill: Explicit mode; tenant-scoped batches.
- Cache: Key includes dealershipId; TTL-only; no cross-tenant use.
- Photo data: VehiclePhoto-only in runtime; response shape client-safe.
- Legacy: Runtime inventory photo reads no longer use FileObject listing.

**No outstanding security issues identified for the cutover scope.**
