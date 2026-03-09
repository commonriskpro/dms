# Inventory Profitability Integration V1 — Step 3 (Frontend) Report

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/INVENTORY_PROFITABILITY_INTEGRATION_V1_SPEC.md`  
**Scope:** SLICE C (inventory list profitability UI), SLICE D (vehicle detail profitability), SLICE E (inventory intelligence touchpoints). No redesign; Dealer OS visual language only.

---

## 1. Summary

- **Slice C:** Inventory list table (VehicleInventoryTable) and InventoryTableCard use ledger-derived cost/profit from Step 2; column headers given tooltips so “Cost” = total invested and “Profit” = projected gross.
- **Slice D:** VehiclePricingCard shows “Total invested” and “Projected gross” from ledger (via new type helpers); aligned with Costs & Documents card.
- **Slice E:** InventoryTableCard updated to display total invested for Cost column; no other inventory intelligence surfaces required changes beyond list/detail.

---

## 2. SLICE C — Inventory List Profitability UI

### Delivered

- **VehicleInventoryTable:** Cost and Profit columns already use ledger-derived `costCents` and `salePriceCents - costCents` from `VehicleListItem` (supplied by `getInventoryPageOverview` with ledger merge in Step 2). Added `title="Total invested (ledger)"` on the Cost column header and `title="Projected gross (sale − invested)"` on the Profit column header so meaning is clear without changing labels.
- **Summary strip:** Continues to use `initialData.list.items` (costCents and salePriceCents from ledger); no change.
- **Density:** No new columns; table remains compact.

### Files touched

- `modules/inventory/ui/components/VehicleInventoryTable.tsx` — tooltips on Cost and Profit headers.

---

## 3. SLICE D — Vehicle Detail Profitability Integration

### Delivered

- **VehiclePricingCard:**
  - **Sale Price:** Unchanged; still from `getSalePriceCents(vehicle)`.
  - **Total Invested:** Replaces former “Cost” (acquisition-only). Uses `getTotalInvestedCents(vehicle)` — prefers API `totalInvestedCents` when present, otherwise sum of breakdown (auction + transport + recon + misc).
  - **Floor Plan:** Unchanged (placeholder).
  - **Projected Gross:** Replaces “Profit” (sale − acquisition). Uses `getProjectedGrossCents(vehicle)` — prefers API `projectedGrossCents`, otherwise sale − total invested.
- **Alignment:** Same vehicle payload drives Costs & Documents card (GET cost) and Pricing card; both show ledger-derived total invested and projected gross.
- **Helpers:** New in `modules/inventory/ui/types.ts`: `getTotalInvestedCents(v)`, `getProjectedGrossCents(v)`. `VehicleResponse` extended with optional `totalInvestedCents` (API now sends it from Step 2).

### Files touched

- `modules/inventory/ui/components/VehiclePricingCard.tsx` — labels and logic switched to total invested and projected gross; imports from types updated.
- `modules/inventory/ui/types.ts` — `totalInvestedCents` on `VehicleResponse`; `getTotalInvestedCents`, `getProjectedGrossCents` added.

---

## 4. SLICE E — Inventory Intelligence / Profit Touchpoints

### Delivered

- **InventoryTableCard:** Uses `VehicleResponse[]`; Cost column previously used `getAuctionCostCents(v)`. Updated to `getTotalInvestedCents(v)` and header given `title="Total invested (ledger)"` so any use of this card (e.g. client-fetched list) shows ledger total when API returns merged data.
- **VehicleInventoryTable:** Already consumes `VehicleListItem` with ledger-derived `costCents`; no further change.
- **Intelligence dashboard list:** Backend (Step 2) supplies ledger-derived `costCents`; UI unchanged.
- **VehicleForm:** Still uses breakdown fields (auction, transport, recon, misc) for edit form; out of scope for this sprint (no form redesign).

---

## 5. Design System Compliance

- **Tokens:** Existing `typography`, `spacingTokens`; card uses `DMSCard`, `DMSCardHeader`, `DMSCardTitle`, `DMSCardContent`.
- **Colors:** CSS variables only (`--text`, `--muted-text`); no raw palette.
- **Components:** shadcn/ui only; `formatCents` from `@/lib/money`.

---

## 6. Files Touched / Added

| File | Change |
|------|--------|
| `modules/inventory/ui/types.ts` | Added `totalInvestedCents?` to `VehicleResponse`; added `getTotalInvestedCents`, `getProjectedGrossCents`. |
| `modules/inventory/ui/components/VehiclePricingCard.tsx` | “Cost” → “Total Invested” (getTotalInvestedCents), “Profit” → “Projected Gross” (getProjectedGrossCents). |
| `modules/inventory/ui/components/VehicleInventoryTable.tsx` | Cost and Profit column headers given `title` tooltips. |
| `modules/inventory/ui/components/InventoryTableCard.tsx` | Cost column uses getTotalInvestedCents; Cost header given `title`. |

---

## 7. Out of Scope (per spec)

- No vehicle detail or list redesign.
- No new columns; no accounting detail in list rows.
- VehicleForm add/edit cost breakdown left as-is (no form redesign).
- No broad intelligence engine or dashboard UI changes.

---

*Step 3 (Frontend) complete. Ready for Step 4 (Security QA), Step 5 (Performance), Step 6 (QA-Hardening) per AUTO TEAM flow.*
