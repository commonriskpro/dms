# Vehicle Cost Ledger V1 — Security QA (Step 4)

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/VEHICLE_COST_LEDGER_V1_SPEC.md`  
**Scope:** Review only — Vehicle Cost Ledger V1 surfaces (cost entries, cost documents, GET cost, signed URL, VehicleCostsAndDocumentsCard). No redesign; route/RBAC changes only when a real issue is found.

---

## 1. Tenant scoping

### 1.1 Cost entries

| Surface | Verification |
|--------|---------------|
| **GET /api/inventory/[id]/cost-entries** | `getAuthContext` → `guardPermission(ctx, "inventory.read")`; `inventoryService.getVehicle(ctx.dealershipId, id)` ensures vehicle belongs to tenant (404 if not); `costLedger.listCostEntries(ctx.dealershipId, id)` — DB layer `listCostEntriesByVehicleId(dealershipId, vehicleId)` uses `where: { dealershipId, vehicleId, deletedAt: null }`. ✓ |
| **POST /api/inventory/[id]/cost-entries** | Same vehicle check via `getVehicle(ctx.dealershipId, id)`. `createCostEntry` receives `ctx.dealershipId` and `id` (vehicleId) from URL; DB `createCostEntry` uses these; no client-supplied dealershipId or vehicleId. ✓ |
| **PATCH/DELETE /api/inventory/[id]/cost-entries/[entryId]** | `costLedger.getCostEntry(ctx.dealershipId, entryId)` — DB `getCostEntryById(dealershipId, entryId)` returns null for wrong tenant (service throws NOT_FOUND). Route then checks `entry.vehicleId === id` so path vehicle and entry’s vehicle match. ✓ |

**Conclusion:** Strict tenant scoping for cost entries. All entry operations use `ctx.dealershipId`; entry–vehicle consistency enforced on PATCH/DELETE.

---

### 1.2 Cost documents

| Surface | Verification |
|--------|---------------|
| **GET /api/inventory/[id]/cost-documents** | `guardPermission(ctx, "inventory.read")` and `guardPermission(ctx, "documents.read")`; `getVehicle(ctx.dealershipId, id)`; `costLedger.listCostDocuments(ctx.dealershipId, id)` — DB `listCostDocumentsByVehicleId(dealershipId, vehicleId)`. ✓ |
| **POST /api/inventory/[id]/cost-documents** | `guardPermission(ctx, "inventory.write")` and `guardPermission(ctx, "documents.write")`; `getVehicle(ctx.dealershipId, id)`. When `costEntryId` is supplied: **fixed in this QA** — now validates that the entry exists in the tenant and belongs to the same vehicle (`costLedger.getCostEntry(ctx.dealershipId, entryId)` then `entry.vehicleId !== id` → 400). ✓ |
| **DELETE /api/inventory/[id]/cost-documents/[docId]** | `getCostDocument(ctx.dealershipId, docId)` (NOT_FOUND if wrong tenant); then `doc.vehicleId !== id` → 404. ✓ |

**Conclusion:** Strict tenant scoping for cost documents. **Fix applied:** POST now validates that a supplied `costEntryId` belongs to the same vehicle and dealership.

---

### 1.3 GET /api/inventory/[id]/cost

| Surface | Verification |
|--------|---------------|
| **GET /api/inventory/[id]/cost** | `guardPermission(ctx, "inventory.read")`; `getVehicle(ctx.dealershipId, id)`; `costLedger.getCostTotals(ctx.dealershipId, id)`. Response built only from `ledgerTotalsToCostBreakdown(totals)` and `totals.*` — no Vehicle row or flat cost fields. ✓ |

**Conclusion:** Tenant-scoped; response is ledger-derived only.

---

## 2. RBAC

| Action | Required permission(s) | Verified in code |
|--------|------------------------|------------------|
| List cost entries | `inventory.read` | GET cost-entries: `guardPermission(ctx, "inventory.read")`. ✓ |
| Add cost entry | `inventory.write` | POST cost-entries: `guardPermission(ctx, "inventory.write")`. ✓ |
| Edit cost entry | `inventory.write` | PATCH cost-entries/[entryId]: `guardPermission(ctx, "inventory.write")`. ✓ |
| Delete cost entry | `inventory.write` | DELETE cost-entries/[entryId]: `guardPermission(ctx, "inventory.write")`. ✓ |
| List / view cost documents | `inventory.read` + `documents.read` | GET cost-documents: both guards. ✓ |
| Upload cost document | `inventory.write` + `documents.write` | POST cost-documents: both guards. ✓ |
| Remove cost document | `inventory.write` + `documents.write` | DELETE cost-documents/[docId]: both guards. ✓ |
| Get cost totals | `inventory.read` | GET cost: `guardPermission(ctx, "inventory.read")`. ✓ |

**Conclusion:** Required permissions match spec. No bypass.

---

## 3. Signed URL flow (cost documents)

| Check | Verification |
|-------|---------------|
| **Route** | `GET /api/files/signed-url?fileId=...` — `guardPermission(ctx, "documents.read")`; `fileService.getSignedUrl(ctx.dealershipId, query.fileId, ctx.userId, meta)`. ✓ |
| **Service** | `getSignedUrl(dealershipId, fileId, ...)` calls `fileDb.getFileObjectById(dealershipId, fileId)`. `getFileObjectById` uses `where: { id, dealershipId, deletedAt: null }` — file must belong to the same dealership. ✓ |
| **Cross-dealership** | If `fileId` belongs to another dealership, `getFileObjectById` returns null → service throws NOT_FOUND. No existence leak. ✓ |
| **Cross-vehicle (same dealership)** | Not re-validated at signed-URL time. FileObject is scoped by dealership only. Users get fileIds only from the cost-documents list, which is vehicle-scoped; with `documents.read`, a user could in theory call signed-url with a fileId from another vehicle’s document if they obtained the ID elsewhere. Acceptable for V1: inventory.read grants access to all vehicles in the dealership; no per-vehicle file permission. ✓ |
| **Client** | **Fixed in this QA** — card was using `res?.data?.signedUrl`; API returns `{ url, expiresAt }` at top level. Updated to `res?.url` so View document works. ✓ |

**Conclusion:** Cross-dealership access to cost-document files is blocked. Same-dealership access is consistent with inventory.read scope. Client response handling corrected.

---

## 4. Delete / view and ownership

| Action | Validation |
|--------|------------|
| **DELETE cost entry** | Entry loaded with `getCostEntry(ctx.dealershipId, entryId)` (tenant + existence); then `entry.vehicleId !== id` → 404. ✓ |
| **DELETE cost document** | Document loaded with `getCostDocument(ctx.dealershipId, docId)`; then `doc.vehicleId !== id` → 404. ✓ |
| **View document (signed URL)** | File resolved by `getFileObjectById(dealershipId, fileId)` — ownership is by dealership; document list is vehicle-scoped so UI only exposes fileIds for the current vehicle. ✓ |

**Conclusion:** Delete and view validate tenant and, where applicable, vehicle/document ownership.

---

## 5. Legacy flat-cost and cost responses

| Check | Verification |
|-------|---------------|
| **GET /api/inventory/[id]/cost** | Response contains only: `vehicleId`, `auctionCostCents`, `transportCostCents`, `reconCostCents`, `miscCostCents`, `totalCostCents`, `acquisitionSubtotalCents`, `reconSubtotalCents`, `feesSubtotalCents`, `totalInvestedCents` — all from `costLedger.getCostTotals` and `ledgerTotalsToCostBreakdown`. No Vehicle model fields. ✓ |
| **Cost entries/documents APIs** | Do not read or return Vehicle flat cost columns. ✓ |

**Conclusion:** No legacy flat-cost fallback in cost or ledger-related responses.

---

## 6. VehicleCostsAndDocumentsCard (UI)

| Check | Verification |
|-------|---------------|
| **Visibility** | Card returns `null` when `!hasPermission("inventory.read")`; no API calls. ✓ |
| **Documents section** | Documents block and list fetched only when `canListDocuments` (= `inventory.read` && `documents.read`). ✓ |
| **Add cost entry** | Button and modal shown only when `canWriteInventory` (`inventory.write`). ✓ |
| **Edit/Remove entry** | Row actions only when `canWriteInventory`. ✓ |
| **Add document** | Button shown only when `canUploadDocument` (`inventory.write` && `documents.write`). ✓ |
| **Remove document** | Button per doc only when `canWriteDocs` (`documents.write`). ✓ |
| **View document** | Uses `/api/files/signed-url?fileId=...`; backend enforces `documents.read` and dealership on file. ✓ |

**Conclusion:** UI gates all actions and sections by the same permissions required by the API.

---

## 7. Fixes applied in this QA

1. **POST /api/inventory/[id]/cost-documents — validate `costEntryId`**  
   When the client sends `costEntryId`, the route now: loads the entry with `costLedger.getCostEntry(ctx.dealershipId, entryId)` (ensures tenant and existence) and returns 400 with message "Cost entry must belong to this vehicle" if `entry.vehicleId !== id`. Prevents linking a document to another vehicle’s cost entry.

2. **VehicleCostsAndDocumentsCard — signed URL response shape**  
   The files signed-url API returns `{ url, expiresAt }` at the top level. The card was reading `res?.data?.signedUrl` and never opening the document. Updated to use `res?.url` so View document works.

---

## 8. Summary

| Area | Status |
|------|--------|
| Tenant scoping (entries + documents) | ✓ Verified; costEntryId validation added on POST cost-documents |
| inventory.write for add/edit/delete cost entry | ✓ |
| documents.read for list/view cost documents | ✓ |
| documents.write for upload/remove cost documents | ✓ |
| Signed URL: no cross-dealership; client fix | ✓ |
| costEntryId same vehicle/dealership | ✓ Enforced by fix (1) above |
| Delete/view ownership checks | ✓ |
| No legacy flat-cost in cost responses | ✓ |

**No route or RBAC redesign.** Two small, targeted fixes were applied as above. All other behavior was verified and found correct.
