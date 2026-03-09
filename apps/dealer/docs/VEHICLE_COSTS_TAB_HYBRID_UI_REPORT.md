# Vehicle Costs Tab Hybrid UI — Implementation Report (Step 3)

**Program:** Vehicle Costs Tab Hybrid UI Implementation  
**Step:** Frontend Engineer (Step 3)  
**Status:** Complete

---

## Summary

The hybrid Costs tab UI is implemented per the approved spec:

- **Tab row** below the vehicle header with Overview, Media, Pricing, Recon, Costs, History.
- **Costs tab** uses a dedicated layout: top summary row (Acquisition Summary + Cost Totals) and main workspace row (Cost Ledger + Documents rail). No main right rail when Costs is active.
- **Non-Costs tabs** show the existing card stack (Overview, Pricing, Intelligence, Valuation, etc., Recon, Floorplan) with the 280px right rail. The monolithic Costs & Documents card is removed from the stack; cost/document content is only available via the Costs tab.
- **Density:** Compact spacing (`gap-3`, `p-3`/`p-4`), tight table and document list, design tokens only.

---

## Slice B — Vehicle Header + Tabs Alignment

- **VehicleDetailTabs** (`modules/inventory/ui/components/VehicleDetailTabs.tsx`): Tab navigation with `VehicleDetailTabId` and `onTabChange`. Active tab styled with accent and bottom border; inactive tabs muted with hover.
- **VehicleDetailContent** (`modules/inventory/ui/VehicleDetailContent.tsx`):
  - Client state: `activeTab` (default `"overview"`).
  - When `activeTab === "costs"`: render `CostsTabContent` only (full width). No right rail.
  - When `activeTab !== "costs"`: render existing `mainGrid` with card stack + 280px aside. Card stack no longer includes `VehicleCostsAndDocumentsCard`.
- Vehicle header is unchanged; no Print/overflow added in this step (per spec: optional refinements only).

---

## Slice C — Summary Row Refinement

- **AcquisitionSummaryCard** (`modules/inventory/ui/components/AcquisitionSummaryCard.tsx`): Standalone card with Purchase Price, Vendor, Purchase Date, Location (— for now). Optional "Edit" button that calls `onEdit` (opens acquisition entry in cost-entry modal).
- **CostTotalsCard** (`modules/inventory/ui/components/CostTotalsCard.tsx`): Standalone card with Acquisition, Recon, Fees, Total Invested. Compact `dl` grid, `p-4`, `typography.cardTitle`.
- **CostsTabContent** (`modules/inventory/ui/components/CostsTabContent.tsx`): Top-level Costs tab container. Fetches cost, entries, documents; derives `acquisitionEntry` and `docsByEntryId`; renders summary row using `costsTabSummaryGrid` (two columns, `gap-3`).

---

## Slice D — Cost Ledger Workspace Refinement

- **CostLedgerCard** (`modules/inventory/ui/components/CostLedgerCard.tsx`): Cost Ledger title, "+ Add Cost" button (when `canWrite`), table with columns Date, Category, Vendor, Amount, Memo, Docs count, Actions (Edit/Remove). Compact table (`text-sm`, `py-2`), no extra padding. Add/Edit entry modal lives in `CostsTabContent`; card receives `onAddCost`, `onEditEntry`, `onDeleteEntry`.
- **CostsTabContent** wires ledger to fetch/refetch and hosts the Add/Edit cost entry dialog (category, amount, vendor name, date, memo; POST/PATCH and refetch on success).

---

## Slice E — Documents Rail Refinement

- **DocumentsRailCard** (`modules/inventory/ui/components/DocumentsRailCard.tsx`): "Documents" title, "Upload" button (when `canUploadDocument`), compact document list (filename, kind, linked entry, date, View/Remove). Upload dialog (file, kind, optional link to cost entry) rendered inside the card; submit and state (open, file, kind, costEntryId, submitting) passed from `CostsTabContent`.
- **CostsTabContent** uses `costsTabWorkspaceGrid` (`1fr` + `320px` on lg) for the row containing `CostLedgerCard` and `DocumentsRailCard`.

---

## Layout Recipes

- **lib/ui/recipes/layout.ts**
  - `costsTabSummaryGrid`: `grid grid-cols-1 gap-3 md:grid-cols-2 items-stretch`
  - `costsTabWorkspaceGrid`: `grid grid-cols-1 gap-3 min-w-0 lg:grid-cols-[1fr_320px]`

---

## Files Touched

| File | Change |
|------|--------|
| `lib/ui/recipes/layout.ts` | Added `costsTabSummaryGrid`, `costsTabWorkspaceGrid` |
| `modules/inventory/ui/components/VehicleDetailTabs.tsx` | **New.** Tab row component |
| `modules/inventory/ui/components/CostsTabContent.tsx` | **New.** Costs tab data + layout + entry modal |
| `modules/inventory/ui/components/AcquisitionSummaryCard.tsx` | **New.** Acquisition summary card |
| `modules/inventory/ui/components/CostTotalsCard.tsx` | **New.** Cost totals card |
| `modules/inventory/ui/components/CostLedgerCard.tsx` | **New.** Cost ledger table + actions |
| `modules/inventory/ui/components/DocumentsRailCard.tsx` | **New.** Documents list + upload modal |
| `modules/inventory/ui/VehicleDetailContent.tsx` | Tab state; conditional Costs vs. card stack; rail hidden on Costs; removed `VehicleCostsAndDocumentsCard` from stack |

**Unchanged:** `VehicleCostsAndDocumentsCard.tsx` remains in the codebase for reference or reuse elsewhere; it is no longer rendered in the vehicle detail flow (cost content is only on the Costs tab).

---

## Design System Compliance

- **Colors:** CSS vars only (`--surface`, `--border`, `--text`, `--muted-text`, `--accent`, etc.).
- **Components:** DMSCard, Button, Input, Select, Table, Dialog from existing UI.
- **Tokens:** `typography.cardTitle`, `typography.muted`, etc. from `@/lib/ui/tokens`.
- **Density:** `gap-3` between sections, `p-3`/`p-4` on cards, compact table and list; no large gaps or banners.

---

## Out of Scope (Not Done)

- URL-based tab routing.
- Per-tab content filtering for Overview vs. Pricing vs. Recon (all non-Costs tabs currently show the same card stack).
- Vehicle header thumbnail or Print/overflow in header (spec allowed refinement only if needed).
- Notes block in the Costs tab.
- Filter/Search controls in the Cost Ledger (mock had Filter and Search; can be added later without changing layout).

---

## Next Steps

- Step 4: Security-QA review.
- Step 5: Performance pass.
- Step 6: QA hardening and final report.
