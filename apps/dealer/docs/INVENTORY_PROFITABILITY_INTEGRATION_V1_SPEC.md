# Inventory Profitability Integration V1 — Product & Technical Spec

**Sprint:** Inventory Profitability Integration V1  
**Step:** Architect (Step 1)  
**Prerequisite:** Vehicle Cost Ledger V1 (ledger-only cost; GET cost, cost-entries, cost-documents; Costs & Documents card on vehicle detail).

**Goal:** Promote the ledger-only Vehicle Cost Ledger V1 into real product value by integrating ledger-derived profitability into inventory-facing workflows and intelligence surfaces. Users see real invested total and projected gross where it matters; no redesign; no new accounting/AP/vendor scope.

---

## 1. Source of truth

- **Ledger-only cost totals are canonical.** All vehicle cost and profitability calculations in touched surfaces must use ledger-derived totals (from `costLedger.getCostTotals` / `getCostTotalsForVehicles` and `ledgerTotalsToCostBreakdown` / `VehicleCostTotals`). No reads from legacy Vehicle flat cost columns (`auctionCostCents`, `transportCostCents`, `reconCostCents`, `miscCostCents`) for cost or profitability in any path touched by this sprint.
- **Touched surfaces that must read ledger totals:**
  - **Inventory list (API):** Already uses `getCostTotalsForVehicles` + `mergeVehicleWithLedgerTotals` in GET `/api/inventory`. No change to source; response shape may be extended (e.g. `totalInvestedCents`) for clarity.
  - **Inventory list (RSC):** `getInventoryPageOverview` and any RSC/list builder that produces `VehicleListItem` or equivalent currently use `vehicleDb.listVehicles` and derive `costCents` from Vehicle row (legacy). Must switch to: after listing vehicles, call `costLedger.getCostTotalsForVehicles(dealershipId, vehicleIds)`, merge ledger totals into each row, then build list items with `costCents` (and any profit field) from ledger-derived totals only.
  - **Inventory intelligence dashboard:** Same as above for list items; in addition, `computeInventoryAggregates` uses `vehicleDb.getNonSoldVehicleCosts` (legacy Vehicle columns) for `computeInventoryValueCents`. Must use ledger-derived costs for non-SOLD vehicles (e.g. batch `getCostTotalsForVehicles` for non-SOLD ids, or a dedicated ledger aggregate path) so "inventory value" (retail vs cost fallback) uses ledger cost when falling back to cost.
  - **Vehicle detail:** Already uses `costLedger.getCostTotals` + `mergeVehicleWithLedgerTotals` for GET/PATCH. Detail pricing/profit **UI** must display "Total invested" (ledger total) and "Projected gross" (existing `projectedGrossCents` from API); no backend change.
  - **Vehicle detail Pricing card:** Today shows "Cost" = acquisition only (`getAuctionCostCents`) and "Profit" = sale − acquisition. Must show "Total invested" (sum of ledger breakdown or explicit total) and "Projected gross" (use `projectedGrossCents` from API).
  - **Pricing/apply and appraisals/convert:** Already use `costLedger.getCostTotals`; no change.
  - **Reports/adapters touched by inventory profitability:** If an inventory-facing report or export uses vehicle cost (e.g. aging report total inventory value, export purchase value), switch that path to ledger-derived totals. In scope: `reports` module `listVehiclesForAging` / `listVehiclesForExport` and `inventory-aging` service that sum cost — use ledger batch totals for those vehicle sets instead of Vehicle flat columns.

---

## 2. Surfaces in scope

### A. Inventory list

- **Data path:** GET `/api/inventory` (already ledger-merged); RSC `getInventoryPageOverview` (must be updated to merge ledger); intelligence dashboard list (must be updated to merge ledger).
- **UI:** `VehicleInventoryTable` (Cost / Price / Profit columns and summary strip); optional `InventoryTableCard` if still used elsewhere — both must consume ledger-derived cost and projected gross.
- **List row data:** Each item must have `costCents` (and profit) derived from ledger totals, not from Vehicle row. No new columns required; keep Cost / Price / Profit compact.

### B. Vehicle detail profitability / pricing areas

- **Data path:** GET `/api/inventory/[id]` already returns ledger-merged breakdown and `projectedGrossCents`.
- **UI:** `VehiclePricingCard`: show "Total invested" (ledger total) and "Projected gross" (from `projectedGrossCents`). Align with existing Costs & Documents card (which already shows total invested and breakdown). No vehicle detail redesign.

### C. Inventory profitability helpers / services

- **Helpers:** `totalCostCents` / `projectedGrossCents` in `modules/inventory/service/vehicle.ts` operate on a breakdown shape; they remain valid when that breakdown is filled from `ledgerTotalsToCostBreakdown(totals)`. No change to formula; callers must supply ledger-derived breakdown.
- **Services:** `inventory-page.ts` (`getInventoryPageOverview`), `inventory-intelligence-dashboard.ts` (list mapping + `computeInventoryAggregates`), and any other service that today reads Vehicle cost columns for list/aggregates must be updated to use ledger batch totals.

### D. Narrowly touched inventory-facing report / helper

- **Reports:** `modules/reports/db/inventory.ts` — `listVehiclesForAging`, `listVehiclesForExport` currently select Vehicle flat cost columns and sum them (or use `totalCostCents`). In scope: provide ledger-derived total cost per vehicle for these sets (e.g. call `costLedger.getCostTotalsForVehicles` for the returned vehicle ids and use that for "value" / `purchaseValueCents`), or add a dedicated batch in cost-entry layer and use it from reports service. `modules/reports/service/inventory-aging.ts` — `getInventoryAging` uses `listVehiclesForAging` and sums cost; must use ledger-derived totals for `totalInventoryValueCents` when that represents cost.
- **Scope:** Only these report paths that depend on vehicle cost; no broad reporting or dashboard rewrite.

---

## 3. Exact data to show

- **Inventory list (table):**
  - **Total invested:** One column or field per row (e.g. "Cost" relabeled to "Invested" or keep "Cost" but value = ledger total invested). Compact; table-safe.
  - **Price:** Sale price (unchanged).
  - **Projected gross:** Profit column = sale price − total invested (ledger); already computed as `projectedGrossCents` where merged totals exist; list items must carry this from ledger.
- **Vehicle detail (Pricing card):**
  - **Sale price:** Unchanged.
  - **Total invested:** Ledger-derived total (sum of breakdown or `totalInvestedCents`).
  - **Floor plan:** Placeholder/unchanged.
  - **Projected gross:** From API `projectedGrossCents` (sale − total invested).
- **Optional:** Gross margin % or profit indicator only if already safely derivable from existing data (e.g. projected gross / sale price) and does not clutter list rows. Not required for V1.
- **No** accounting detail (line-item breakdown) in list rows; breakdown stays on vehicle detail Costs & Documents card.

---

## 4. UI placement rules

- **Inventory list:** Invested total and projected gross appear in existing Cost and Profit columns (or renamed to "Invested" / "Projected gross" if desired). Keep current table density; no extra columns unless one explicit addition is approved (e.g. one combined "Invested" column). Summary strip (Total Value, Avg Cost, Page Profit) must use ledger-derived cost/profit from list items.
- **Vehicle detail:** Profitability summary in existing Pricing card: Total invested + Projected gross; alignment with Costs & Documents card (same totals source). No new cards; no table density change.
- **Compact vs expanded:** List stays compact; detail keeps current card layout. No redesign of inventory pages.

---

## 5. Backend / helper plan

| Area | Current state | Change |
|------|----------------|--------|
| **GET /api/inventory** | Uses `getCostTotalsForVehicles` + `mergeVehicleWithLedgerTotals`; `toVehicleResponse` includes `projectedGrossCents`. | Optional: add `totalInvestedCents` to response for list UI clarity; otherwise list can sum the four breakdown fields. Prefer one shared response shape. |
| **getInventoryPageOverview** | Calls `vehicleDb.listVehicles`; builds items with `costCents` = sum of Vehicle row cost columns. | After `listVehicles`, call `costLedger.getCostTotalsForVehicles(ctx.dealershipId, vehicleIds)`; merge totals into each row via `ledgerTotalsToCostBreakdown`; build each `VehicleListItem` with `costCents` = ledger total (and projected gross from merged row if needed for consistency). |
| **Inventory intelligence dashboard** | `mapListToItems` uses `row.auctionCostCents` + … from `listVehicles`; `computeInventoryAggregates` uses `getNonSoldVehicleCosts` (Vehicle flat). | List: same as above — fetch ledger for list vehicle ids, merge, then map to items with ledger cost/projected gross. Aggregates: replace `getNonSoldVehicleCosts` usage with ledger-derived costs for non-SOLD vehicles (e.g. get non-SOLD vehicle ids, `getCostTotalsForVehicles`, then pass `{ vehicleId, costCents }[]` into `computeInventoryValueCents`). |
| **Dashboard getKpis** | `inventoryValueCents` = sum of Vehicle `salePriceCents` (retail). | No change (value = retail). Any future "cost-based" KPI would use ledger. |
| **Vehicle detail GET/PATCH** | Already ledger-merged. | No change. |
| **VehiclePricingCard** | Uses `getAuctionCostCents` (acquisition only), profit = sale − auction. | Use total invested (helper that sums breakdown or reads `totalInvestedCents` if added to detail response) and `projectedGrossCents` for profit. Types: add or use `getTotalInvestedCents(v)` and use `projectedGrossCents` from API. |
| **Reports: aging / export** | `listVehiclesForAging` / `listVehiclesForExport` read Vehicle cost columns; aging service sums with `totalCostCents(v)`. | For aging: keep listVehiclesForAging for id/status/createdAt; get vehicle ids, then `getCostTotalsForVehicles`; use ledger totals for `totalInventoryValueCents` (cost component). For export: same — ledger-derived `purchaseValueCents` per vehicle (e.g. batch ledger lookup by ids). Avoid redundant recomputation: single batch call per report run where possible. |

- **Shared path:** Prefer one shared profitability path: list/overview and intelligence dashboard both use `getCostTotalsForVehicles` + merge; reports use the same batch API for their vehicle sets. No duplicated inline cost logic; no reads from Vehicle cost columns in touched paths.
- **No schema changes** unless strictly necessary (e.g. no new Vehicle columns for cost). No route renames. No broad report or dashboard churn beyond the above.

---

## 6. Slice plan with acceptance criteria

### SLICE A — Profitability integration spec

- **Deliverable:** This spec approved; no app code.
- **Acceptance:** Spec defines source of truth, surfaces, data to show, UI placement, backend plan, slices, and risks.

### SLICE B — Ledger-derived helper / service integration

- **Scope:** Backend and service layer only. Ensure every touched list/overview and report path uses ledger-derived totals.
- **Tasks:** (1) `getInventoryPageOverview`: after `listVehicles`, call `getCostTotalsForVehicles`, merge totals into rows, build items with `costCents` and projected gross from ledger. (2) Intelligence dashboard: same for list; for aggregates, replace `getNonSoldVehicleCosts` with ledger-derived costs (batch ledger for non-SOLD ids). (3) Reports: aging and export — use `getCostTotalsForVehicles` (or equivalent batch) for the relevant vehicle ids and use ledger totals for value/cost. (4) Optional: add `totalInvestedCents` to vehicle list/detail API response for clarity.
- **Acceptance:** No legacy Vehicle cost reads in getInventoryPageOverview, intelligence dashboard list/aggregates, or touched report paths. All list items and report value/cost fields come from ledger.

### SLICE C — Inventory list profitability UI

- **Scope:** Inventory list table and summary only. Use ledger-derived data from API or RSC.
- **Tasks:** (1) Ensure list table (VehicleInventoryTable) and summary strip receive and display cost/profit from ledger (RSC path will supply correct `costCents`/projected gross after Slice B). (2) If column label "Cost" is ambiguous, rename to "Invested" or keep "Cost" with tooltip that it is total invested. (3) No new columns unless approved; keep compact.
- **Acceptance:** List shows total invested and projected gross per row; summary strip (Total Value, Avg Cost, Page Profit) matches ledger-derived values. No table density drift.

### SLICE D — Vehicle detail profitability integration

- **Scope:** Vehicle detail pricing/profit surfaces only.
- **Tasks:** (1) VehiclePricingCard: show "Total invested" (ledger total — use sum of breakdown or `totalInvestedCents` from API) and "Projected gross" (use `projectedGrossCents` from vehicle response). (2) Ensure alignment with Costs & Documents card (same totals). (3) Add or use type helpers (e.g. `getTotalInvestedCents`) so UI does not duplicate logic.
- **Acceptance:** Pricing card shows total invested and projected gross from ledger; no acquisition-only cost or sale−acquisition profit. No vehicle detail redesign.

### SLICE E — Inventory intelligence / profit touchpoints

- **Scope:** Any remaining inventory intelligence or pricing surface that uses cost/profit and is in scope (e.g. price-to-market or internal comps that compare to cost). Only where directly relevant and low-risk.
- **Tasks:** Identify any helper or UI that still reads cost from Vehicle or from non-ledger source; switch to ledger-derived totals. If none beyond list/detail/reports already covered, document that and close.
- **Acceptance:** No remaining inventory intelligence or pricing touchpoints in scope use legacy cost; all use ledger-derived totals where cost is used.

### SLICE F — Tests / docs / hardening

- **Scope:** Focused tests, doc updates, final report.
- **Tasks:** (1) Tests for getInventoryPageOverview list items (ledger-derived cost/projected gross). (2) Tests for intelligence dashboard list and aggregates (ledger). (3) Tests for vehicle detail response and VehiclePricingCard display. (4) Optional: report aging/export integration tests. (5) Update ARCHITECTURE_MAP or module docs if needed. (6) Security QA, performance pass, QA-hardening, final report per AUTO TEAM steps 4–6.
- **Acceptance:** Touched paths have focused tests; docs and final report completed.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| **Stale profitability** | List and aggregates are server-rendered or API-fed; ledger is read at request time. No client cache of cost; refetch on navigation/pagination. |
| **List performance regression** | Keep single batch `getCostTotalsForVehicles(dealershipId, vehicleIds)` per list request; no N+1. Reuse existing cost-entry batch query; consider index on (dealershipId, vehicleId) if not present. |
| **Duplicated cost logic** | One merge path: `mergeVehicleWithLedgerTotals` + `ledgerTotalsToCostBreakdown`; list and detail use same helpers. Reports use same batch ledger API. |
| **Inconsistent gross across pages** | List and detail both use ledger-derived totals and same formula (sale − total invested); API and RSC paths must both merge ledger so UI sees same numbers. |
| **Table clutter** | No new columns unless one "Invested" rename; keep Cost/Price/Profit. No accounting detail in rows. |
| **Tenant leakage** | All ledger calls already scoped by `ctx.dealershipId`; no new routes; serializer and response shape unchanged except optional `totalInvestedCents`. |

---

## 8. Out of scope

- Full accounting / AP; vendor management V2; OCR; bulk cost imports; broad dashboard or reporting rewrite; broad intelligence engine redesign. No redesign of inventory pages; no turning list rows into accounting screens.

---

*Step 1 (Architect) complete. No app code in this step. Proceed to Step 2 (Backend) per AUTO TEAM flow.*
