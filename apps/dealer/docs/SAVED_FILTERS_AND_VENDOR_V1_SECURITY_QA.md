# Saved-Filters Stabilization + Vendor Management V1 — Security QA (Step 4)

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/SAVED_FILTERS_STABILIZATION_AND_VENDOR_V1_SPEC.md`  
**Scope:** Phase 1 (saved-filters buildCustomersQuery), Phase 2 vendor backend (model, APIs, cost-entry vendorId), Vendor UI (list, detail, create, edit). Review only; apply fixes only where a real issue is found.

---

## 1. Phase 1 — Saved-filters stabilization

### 1.1 Scope and surfaces

- **Change:** `buildCustomersQuery` in `CustomersPageClient.tsx`; URL building uses it; tests expect `page`/`pageSize`.
- **No new routes.** Customer list and saved-search flows already use `getAuthContext` and `guardPermission(ctx, "customers.read")` on the server; URL params are parsed by `parseSearchParams` on the customers page. No client-supplied tenant or auth data.

### 1.2 Verification

| Check | Verification |
|-------|--------------|
| **URL shape** | `buildCustomersQuery` outputs only `page`, `pageSize`, `sortBy`, `sortOrder`, `status`, `leadSource`, `assignedTo`, `q`, `savedSearchId`. No sensitive or tenant data in query string. ✓ |
| **Server contract** | Customers page `parseSearchParams` expects `page`, `pageSize`; buildCustomersQuery maps limit/offset → page/pageSize. No server-side change to auth or tenant scoping. ✓ |

**Conclusion:** Phase 1 has no new security surface. Auth and tenant handling remain on the server; URL builder is pure and does not expose or accept tenant/auth data.

---

## 2. Vendor APIs — tenant scoping

### 2.1 List and CRUD

| Surface | Verification |
|--------|---------------|
| **GET /api/vendors** | `getAuthContext` → `guardPermission(ctx, "inventory.read")`; `vendorService.listVendors(ctx.dealershipId, ...)`. DB `listVendors` uses `where: { dealershipId, ... }`. No client-supplied dealershipId. ✓ |
| **POST /api/vendors** | `guardPermission(ctx, "inventory.write")`; body parsed by Zod; `createVendor(ctx.dealershipId, ...)`. DealershipId from session only. ✓ |
| **GET /api/vendors/[id]** | `guardPermission(ctx, "inventory.read")`; `vendorService.getVendor(ctx.dealershipId, id)`. DB `getVendorById(dealershipId, id)` → null for wrong tenant (404). ✓ |
| **PATCH /api/vendors/[id]** | `guardPermission(ctx, "inventory.write")`; `updateVendor(ctx.dealershipId, ...)`. DB scopes by dealershipId. ✓ |
| **DELETE /api/vendors/[id]** | `guardPermission(ctx, "inventory.write")`; `deleteVendor(ctx.dealershipId, ...)`. Soft-delete; DB scopes by dealershipId. ✓ |

**Conclusion:** All vendor CRUD and list are strictly tenant-scoped via `ctx.dealershipId`. No client-supplied dealershipId anywhere.

### 2.2 Vendor cost-entries (detail page)

| Surface | Verification |
|--------|---------------|
| **GET /api/vendors/[id]/cost-entries** | `guardPermission(ctx, "inventory.read")`; `vendorService.getVendor(ctx.dealershipId, id)` first — 404 if vendor not found or wrong tenant; then `costLedger.listCostEntriesByVendor(ctx.dealershipId, id, limit)`. DB `listCostEntriesByVendorId(dealershipId, vendorId, limit)` uses `where: { dealershipId, vendorId, deletedAt: null }`. ✓ |

**Conclusion:** Vendor cost-entries list is tenant-scoped; vendor id is validated as belonging to the dealership before listing entries.

---

## 3. Cost-entry vendorId — cross-tenant validation

### 3.1 Risk

Cost entries accept optional `vendorId` (UUID). The FK constraint only ensures the vendor row exists; it does not enforce that the vendor belongs to the same dealership. A client could send another dealership’s vendorId and create/update a cost entry linked to that vendor, causing cross-tenant data linkage.

### 3.2 Fix applied in this QA

| Surface | Fix |
|--------|-----|
| **POST /api/inventory/[id]/cost-entries** | When `data.vendorId` is present (non-null, non-empty), the route now calls `vendorService.getVendor(ctx.dealershipId, data.vendorId)`. If the vendor is null (wrong tenant or missing), the route returns **400** with `VALIDATION_ERROR` and message "Vendor not found" / "Vendor must belong to your dealership". No existence leak across tenants (400, not 404). ✓ |
| **PATCH /api/inventory/[id]/cost-entries/[entryId]** | Same validation when `data.vendorId` is supplied (including when setting a new vendor). When `vendorId` is null (to clear), no validation. ✓ |

**Conclusion:** Cost entry create/update now enforce that any supplied `vendorId` belongs to `ctx.dealershipId`. Prevents cross-tenant vendor linkage.

---

## 4. RBAC

| Action | Required permission | Verified in code |
|--------|--------------------|------------------|
| List vendors | `inventory.read` | GET /api/vendors: `guardPermission(ctx, "inventory.read")`. ✓ |
| Create vendor | `inventory.write` | POST /api/vendors: `guardPermission(ctx, "inventory.write")`. ✓ |
| Get vendor | `inventory.read` | GET /api/vendors/[id]: `guardPermission(ctx, "inventory.read")`. ✓ |
| Update vendor | `inventory.write` | PATCH /api/vendors/[id]: `guardPermission(ctx, "inventory.write")`. ✓ |
| Delete (soft) vendor | `inventory.write` | DELETE /api/vendors/[id]: `guardPermission(ctx, "inventory.write")`. ✓ |
| List vendor cost entries | `inventory.read` | GET /api/vendors/[id]/cost-entries: `guardPermission(ctx, "inventory.read")`. ✓ |
| Cost entry create/update (with or without vendorId) | `inventory.write` | POST/PATCH cost-entries: unchanged; `guardPermission(ctx, "inventory.write")`. ✓ |

**Conclusion:** Vendor and cost-entry surfaces use existing inventory permissions. No bypass; no admin exception.

---

## 5. Soft-deleted vendors

| Check | Verification |
|-------|---------------|
| **List/picker** | `listVendors` uses `deletedAt: null` when `includeDeleted !== true`. GET /api/vendors does not send `includeDeleted` by default; client can opt in. Soft-deleted vendors are excluded from default list and picker. ✓ |
| **Cost entries linked to deleted vendor** | Entries keep `vendorId` and optional `vendorName`. List cost-entries includes `vendor` relation; response uses `vendorDisplayName`: `vendorName ?? vendor?.name ?? null`. So entries linked to a soft-deleted vendor still show stored name (vendor row still exists, name still resolvable). No cross-tenant exposure. ✓ |
| **GET /api/vendors/[id]** | Returns vendor by id scoped by dealershipId. Soft-deleted vendors are still returned (no filter on deletedAt) so detail page and edit-from-URL continue to work. Acceptable: tenant already owns the vendor. ✓ |

**Conclusion:** Soft-delete behavior matches spec: excluded from list/picker by default; cost entries still render vendor identity safely.

---

## 6. Input validation and error handling

| Surface | Verification |
|--------|---------------|
| **Vendor schemas** | Zod: `listVendorsQuerySchema`, `createVendorBodySchema`, `updateVendorBodySchema`, `vendorIdParamSchema`. Name length, type enum, email format, UUIDs. ✓ |
| **Cost entry vendorId** | `costEntryCreateBodySchema` / `costEntryUpdateBodySchema`: `vendorId` optional, `z.string().uuid()` when present. Invalid UUID → 400. ✓ |
| **API error shape** | Handlers use `handleApiError`; validation uses `validationErrorResponse`. No stack traces to client. ✓ |

**Conclusion:** Input validation and error responses are consistent and safe.

---

## 7. Audit and sensitive data

| Check | Verification |
|-------|---------------|
| **Vendor create/update/delete** | `vendorService` calls `auditLog` for `vendor.created`, `vendor.updated`, `vendor.deleted` with dealershipId, entityId, metadata (no PII). ✓ |
| **Cost entry** | Unchanged; already audited for create/update/delete. ✓ |
| **Vendor payload** | No SSN, DOB, income, card data, or passwords. Contact name, phone, email, address, notes are operational only. ✓ |

**Conclusion:** Audit present for vendor mutations; no sensitive data stored in vendor or cost-entry vendor fields.

---

## 8. Vendor UI (list, detail, create, edit)

| Check | Verification |
|-------|---------------|
| **Visibility** | VendorsListPage and VendorDetailPage gate on `hasPermission("inventory.read")`; no fetch when !canRead. ✓ |
| **Create/Edit/Remove** | Buttons and dialogs gated by `canWrite` (`inventory.write`) and `WriteGuard` / `MutationButton`. ✓ |
| **Detail page** | Edit button and “Recent cost entries” only when canRead; edit requires canWrite. Links to vehicle use path `/inventory/[vehicleId]` (vehicle access still gated by inventory.read on that page). ✓ |
| **List “Include removed”** | Filter is a query param to GET /api/vendors; backend already scopes by dealershipId. No extra exposure. ✓ |

**Conclusion:** UI permission gates align with API RBAC. No actions exposed without the required permission.

---

## 9. Fixes applied in this QA

1. **POST /api/inventory/[id]/cost-entries — validate vendorId**  
   When the client sends a non-null, non-empty `vendorId`, the route now verifies that the vendor exists and belongs to `ctx.dealershipId` via `vendorService.getVendor(ctx.dealershipId, data.vendorId)`. If the vendor is null, the route returns **400** with code `VALIDATION_ERROR` and message "Vendor not found" and details path `["vendorId"]`. Prevents linking a cost entry to another dealership’s vendor.

2. **PATCH /api/inventory/[id]/cost-entries/[entryId] — validate vendorId**  
   Same validation when the request body includes `vendorId` (including when setting a new vendor). When `vendorId` is explicitly null (to clear the link), no validation is performed.

---

## 10. Summary

| Area | Status |
|------|--------|
| Phase 1 (saved-filters) | ✓ No new security surface; URL builder and server contract verified |
| Vendor APIs tenant scoping | ✓ All use ctx.dealershipId; no client dealershipId |
| Vendor cost-entries API | ✓ Vendor validated first; list scoped by dealershipId + vendorId |
| Cost entry vendorId | ✓ **Fixed** — create/update validate vendor same-tenant |
| RBAC (inventory.read / inventory.write) | ✓ Enforced on all vendor and cost-entry routes |
| Soft-deleted vendors | ✓ Excluded from list by default; cost entries show vendor name safely |
| Input validation / error shape | ✓ Zod and handler patterns in place |
| Audit / no sensitive data | ✓ Vendor mutations audited; no PII in vendor model |
| Vendor UI gates | ✓ Read/write gates match API permissions |

**No route or RBAC redesign.** One targeted fix was applied: validate `vendorId` on cost entry create and update so that only vendors belonging to the current dealership can be linked. All other behavior was verified and found correct.
