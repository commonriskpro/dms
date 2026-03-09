# Vehicle Cost Ledger V1 — Step 3 (Frontend) Report

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/VEHICLE_COST_LEDGER_V1_SPEC.md`  
**Scope:** Costs & Documents section on vehicle detail; Dealer OS design system only; ledger-only backend (no legacy cost reads/writes).

---

## Delivered

### 1. Acquisition Summary block
- **Location:** Top of “Costs & Documents” card.
- **Content:** Source/vendor (from first `acquisition` cost entry), purchase price, purchase date, total invested (from GET cost `totalInvestedCents`). All derived from ledger; “—” when no acquisition entry or no data.
- **Implementation:** `VehicleCostsAndDocumentsCard` fetches GET `/api/inventory/[id]/cost` and GET `/api/inventory/[id]/cost-entries`; first entry with `category === "acquisition"` drives vendor, price, date; totals from cost response.

### 2. Cost Totals block
- **Location:** Directly below Acquisition summary.
- **Content:** Acquisition subtotal, Recon subtotal, Fees subtotal, Total invested (all from GET cost response: `acquisitionSubtotalCents`, `reconSubtotalCents`, `feesSubtotalCents`, `totalInvestedCents`). Formatted via `formatCents` from `@/lib/money`.
- **Styling:** Design tokens only (`typography.muted`, `text-[var(--text)]`, `text-[var(--muted-text)]`).

### 3. Cost Ledger table
- **Location:** Below Cost totals; compact table.
- **Columns:** Category (label from `VEHICLE_COST_CATEGORY_LABELS`), Amount, Vendor, Date, Memo (truncated with tooltip), Attachment count, Actions (Edit / Remove when `inventory.write`).
- **Components:** shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`; border/radius from `var(--border)`, `var(--radius-input)`.
- **Empty state:** “No cost entries yet.”

### 4. Add / Edit Cost Entry UI
- **Trigger:** “Add cost entry” button (when `inventory.write`); row actions “Edit” / “Remove” (with confirm dialog).
- **Modal:** Shared Dialog for Add and Edit; form fields: Category (select), Amount ($), Vendor name (optional), Date (datetime-local), Memo (optional). Required: category, amount, date.
- **API:** POST `/api/inventory/[id]/cost-entries` (create), PATCH `/api/inventory/[id]/cost-entries/[entryId]` (update), DELETE (soft delete). On success, refetch cost and entries.
- **Validation:** Amount parsed to cents; invalid amount shows toast. No schema/backend changes.

### 5. Documents list and attachment area
- **Visibility:** Documents section only when `inventory.read` and `documents.read`.
- **List:** Each row: filename (or fileObjectId), kind label, optional “· {category}” when linked to a cost entry, created date. Actions: “View” (signed URL), “Remove” (when `documents.write`).
- **Upload:** “Add document” button when `inventory.write` and `documents.write`. Modal: file input, Kind (invoice | receipt | bill_of_sale | title_doc | other), optional “Link to cost entry” (select from current entries or “Vehicle only”). POST multipart to `/api/inventory/[id]/cost-documents`.
- **Styling:** List items use `bg-[var(--surface-2)]`, `border-[var(--border)]`, `rounded-[var(--radius-input)]`; no raw color classes.

### 6. Open / download / view document
- **Pattern:** Reuses existing file pattern: GET `/api/files/signed-url?fileId={fileObjectId}` (FileObject id from `VehicleCostDocument.fileObjectId`). On success, `window.open(url, "_blank", "noopener,noreferrer")`. No inline PDF/image viewer in V1.
- **Remove link:** DELETE `/api/inventory/[id]/cost-documents/[docId]` (new route); confirm dialog before remove.

### 7. Backend integration (minimal)
- **New route:** `DELETE /api/inventory/[id]/cost-documents/[docId]` — validates vehicle id and document ownership, then `costLedger.deleteCostDocument`; 204 on success. Uses `costDocumentIdParamSchema` from `app/api/inventory/schemas.ts`.
- **No schema or cost-ledger logic changes;** all cost/totals/entries/documents already implemented in Step 2.

### 8. Integration into vehicle detail
- **Placement:** “Costs & Documents” card added to `VehicleDetailContent` in the left card stack, between `VehicleReconCard` and `VehicleFloorplanCard`. No redesign of vehicle detail; existing layout and cards unchanged.
- **Permissions:** Card renders only when `inventory.read`. Documents block and “Add document” gated by `documents.read` / `documents.write` as above.

### 9. UI tests and report
- **Tests:** `modules/inventory/ui/components/__tests__/VehicleCostsAndDocumentsCard.test.tsx` (Jest).
  - Renders nothing when user lacks `inventory.read`.
  - Fetches cost, cost-entries, cost-documents when `inventory.read` and `documents.read`.
  - Shows “Costs & Documents” title and Acquisition summary, Cost totals, Cost ledger.
  - Shows acquisition vendor and total invested from mocked ledger data.
  - “Add cost entry” only when `inventory.write`; “Add document” and Documents section when `documents.read` + `inventory.write` + `documents.write`.
  - Does not fetch cost-documents when user lacks `documents.read`.
- **Report:** This document.

---

## Design system compliance
- **Tokens:** `typography`, `spacingTokens` from `@/lib/ui/tokens`; card uses `DMSCard`, `DMSCardHeader`, `DMSCardTitle`, `DMSCardContent`.
- **Colors:** CSS variables only (`--text`, `--muted-text`, `--text-soft`, `--surface`, `--surface-2`, `--border`, `--danger` for errors).
- **Components:** shadcn/ui only (`Button`, `Input`, `Select`, `Dialog`, `Table`, `Skeleton`); `confirm` from `@/components/ui/confirm-dialog`; `formatCents` from `@/lib/money`.

---

## Files touched/added
- **New:** `app/api/inventory/[id]/cost-documents/[docId]/route.ts` (DELETE).
- **New:** `modules/inventory/ui/components/VehicleCostsAndDocumentsCard.tsx`.
- **New:** `modules/inventory/ui/components/__tests__/VehicleCostsAndDocumentsCard.test.tsx`.
- **New:** `apps/dealer/docs/VEHICLE_COST_LEDGER_V1_STEP3_REPORT.md`.
- **Updated:** `modules/inventory/ui/types.ts` (cost totals, cost entry, cost document types and labels).
- **Updated:** `modules/inventory/ui/VehicleDetailContent.tsx` (import and render `VehicleCostsAndDocumentsCard`).

---

## Out of scope (per spec)
- No vehicle detail redesign.
- No vendor management (vendorName-only on cost entry).
- No raw color classes; no new design tokens beyond existing Dealer OS.
- No backend/schema changes except the single DELETE cost-document route.

---

*Step 3 complete. Ready for Step 4 (Security) / Step 5 (Performance) / Step 6 (QA) as needed.*
