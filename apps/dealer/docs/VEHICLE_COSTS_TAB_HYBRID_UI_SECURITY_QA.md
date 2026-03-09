# Vehicle Costs Tab Hybrid UI — Security QA (Step 4)

**Program:** Vehicle Costs Tab Hybrid UI Implementation  
**Step:** Security-QA (Step 4)  
**Status:** Complete

---

## Scope

Review of all surfaces touched by the hybrid Costs tab implementation for permission consistency, document access, and visibility.

---

## 1. Permission model (no drift)

### 1.1 Costs tab entry point

- **CostsTabContent** uses `useSession().hasPermission()` and returns `null` when `!canReadInventory` (`inventory.read`). No cost totals, entries, or documents are fetched or rendered for users without `inventory.read`.
- **Verdict:** No permission drift. Users without `inventory.read` never see the Costs tab content.

### 1.2 Cost ledger actions

| Action | UI gate | Backend |
|--------|--------|--------|
| View cost totals / entries / summary | `canReadInventory` (inventory.read) | GET `/api/inventory/[id]/cost` → `guardPermission(ctx, "inventory.read")` |
| Add cost entry | `canWriteInventory` (inventory.write) | POST `/api/inventory/[id]/cost-entries` → `guardPermission(ctx, "inventory.write")` |
| Edit cost entry | `canWriteInventory` | PATCH `/api/inventory/[id]/cost-entries/[entryId]` → `guardPermission(ctx, "inventory.write")` |
| Remove cost entry | `canWriteInventory` | DELETE same route → `guardPermission(ctx, "inventory.write")` |

- **CostsTabContent:** `handleSaveEntry` and `handleDeleteEntry` both guard with `if (!canWriteInventory) return` before performing mutations.
- **CostLedgerCard:** Receives `canWrite` from parent; "+ Add Cost" and Edit/Remove column only render when `canWrite` is true.
- **Verdict:** UI gates align with API RBAC. No new actions exposed without the same permissions as before.

### 1.3 Acquisition Summary "Edit"

- **AcquisitionSummaryCard** receives `onEdit` only when `acquisitionEntry && canWriteInventory`. The Edit button opens the cost-entry modal for the acquisition entry; save/delete still go through the same `handleSaveEntry` / `handleDeleteEntry` and API routes.
- **Verdict:** No drift. Edit is gated by `inventory.write`.

---

## 2. Document rail — documents.read / documents.write

### 2.1 Visibility and list

- **CostsTabContent:** `canListDocuments = canReadInventory && canReadDocs` where `canReadDocs = hasPermission("documents.read")`. Documents are only fetched when `canListDocuments` is true (`fetchDocuments` in `loadAll`).
- **DocumentsRailCard:** Returns `null` when `!canListDocuments`, so the entire Documents rail is hidden for users without either `inventory.read` or `documents.read`.
- **Backend:** GET `/api/inventory/[id]/cost-documents` requires both `inventory.read` and `documents.read` (both `guardPermission` calls).
- **Verdict:** Document rail respects `documents.read`. No visibility regression.

### 2.2 Upload and remove

- **Upload:** Upload button only shown when `canUploadDocument` (passed from parent), which is `canWriteInventory && canWriteDocs` (`inventory.write` and `documents.write`). Submit handler in parent only runs when `canUploadDocument` is true.
- **Remove:** DocumentsRailCard shows Remove only when `canWriteDocs`; `handleRemoveDocument` in CostsTabContent checks `if (!canWriteDocs) return` before calling the API.
- **Backend:** POST `/api/inventory/[id]/cost-documents` requires `inventory.write` and `documents.write`; DELETE `/api/inventory/[id]/cost-documents/[docId]` requires the same.
- **Verdict:** Document rail respects `documents.write` for upload and remove. No drift.

### 2.3 View document (signed URL)

- **DocumentsRailCard:** "View" calls `onViewDocument(fileObjectId)` → CostsTabContent’s `handleOpenDocument`, which calls `GET /api/files/signed-url?fileId=...`. That route is responsible for auth and tenant checks; the UI does not bypass it.
- **Verdict:** View remains server-enforced via the signed-url API. No change to security posture.

---

## 3. Header / action alignment

- **VehicleDetailContent** and **VehicleDetailPage** were not changed to add or remove header actions. The vehicle header (Edit, Upload Photos, Create Deal, intelligence badges) is unchanged; no Print or overflow was added in this sprint.
- Tab row (**VehicleDetailTabs**) is pure navigation. Selecting a tab does not trigger any mutation or data access; it only switches which content is rendered. Users who can load the vehicle detail page already have access to the vehicle; the Costs tab simply shows a different layout and returns `null` when `!canReadInventory`.
- **Verdict:** No unauthorized actions exposed by header or tab changes.

---

## 4. Visibility regression

### 4.1 Users with inventory.read (no documents.read)

- Before: Could see acquisition summary, cost totals, cost ledger, but not the documents section in the monolithic card.
- After: Same. CostsTabContent fetches documents only when `canListDocuments` (inventory.read **and** documents.read). DocumentsRailCard returns `null` when `!canListDocuments`, so the rail is hidden.
- **Verdict:** No regression. Document section remains hidden without `documents.read`.

### 4.2 Users with inventory.read + documents.read (no write)

- Before: Could see cost and document list; no Add Cost, no Edit/Remove on entries, no Upload/Remove on documents.
- After: Same. `canWriteInventory` and `canUploadDocument` / `canWriteDocs` control all write UI. Read-only users see summary, totals, ledger table, and document list without action buttons.
- **Verdict:** No regression.

### 4.3 Users without inventory.read

- Before: Vehicle detail page could still load (e.g. from direct URL); the monolithic Costs & Documents card returned `null` when `!canReadInventory`.
- After: CostsTabContent returns `null` when `!canReadInventory`. If the user switches to the Costs tab, they see nothing (no data, no layout). Tab row is still visible; content is empty/hidden.
- **Verdict:** No regression. Cost and document sections remain hidden without `inventory.read`.

---

## 5. Summary

| Check | Result |
|-------|--------|
| No permission drift in Costs tab actions | Pass — inventory.read/write and documents.read/write used consistently |
| Document rail respects documents.read / documents.write | Pass — list gated by both inventory.read and documents.read; upload/remove by inventory.write and documents.write |
| Header/action alignment does not expose unauthorized actions | Pass — no header changes; tabs are navigation only |
| No visibility regression in cost or document sections | Pass — same permission rules as prior Costs & Documents card |

No security issues identified. UI permission gates match backend RBAC; document rail and cost ledger remain correctly scoped.
