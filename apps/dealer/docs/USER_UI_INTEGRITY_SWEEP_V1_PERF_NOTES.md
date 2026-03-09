# User UI Integrity Sweep V1 — Performance Notes

## Scope

Audit all changes from Steps 2–4 for performance regressions:
- Excessive rerender churn
- Extra fetch loops
- Modal/dialog weight
- List-row action weight
- Full-page thrash

---

## Changed Files Audited

| # | File | Change Type |
|---|---|---|
| 1 | `VehiclePageHeader.tsx` | Added `printCostLedger()`, `escapeHtml()` |
| 2 | `VehicleCostsPageHeader.tsx` | Added `printCostLedger()`, `escapeHtml()`, wired Print button |
| 3 | `CostLedgerCard.tsx` | Added CSV export handler, replaced pagination with summary |
| 4 | `CostTotalsCard.tsx` | Removed dead button |
| 5 | `DocumentsRailCard.tsx` | Removed dead button |
| 6 | `CostsTabContent.tsx` | No changes (parent orchestrator, verified for side effects) |
| 7 | `EditVehicleUi.tsx` | Disabled buttons, changed button→span, added Link wrapper |
| 8 | `TopCommandBar.tsx` | Added `key` prop, disabled notifications bell |
| 9 | `AddVehiclePage.tsx` | Removed no-op `onScan` prop |
| 10 | `RecommendedActionsCard.tsx` | Replaced fake placeholder with empty state |
| 11 | `CustomersFilterBar.tsx` | Disabled dead button |
| 12 | Backend routes (6 files) | Validation, permission, response shape fixes |

---

## Rerender Churn Analysis

### No regressions introduced

| Component | Assessment |
|---|---|
| `VehiclePageHeader` | `printCostLedger` is a module-level function (not inside component), creates no closures that would cause rerenders. The `onClick` arrow function `() => printCostLedger(...)` is recreated on each render — this is standard for event handlers and does not cause child rerenders since the button is a leaf node. |
| `VehicleCostsPageHeader` | Same pattern. No state added, no new effects. |
| `CostLedgerCard` | The CSV export handler is an inline arrow function in the `onClick`. It closes over `filtered` (a `useMemo` result) — this is correct. No new state, no new effects. The removal of pagination buttons reduces DOM node count. |
| `CostTotalsCard` | Removed a button — strictly fewer DOM nodes, no new state. |
| `DocumentsRailCard` | Removed a button — strictly fewer DOM nodes, no new state. |
| `EditVehicleUi` | Changed buttons to disabled/spans — no new state, no new effects. `QuickActionsCard` now receives `vehicleId` prop, but this is a simple string pass-through with no state implications. |
| `TopCommandBar` | Added `key` prop to list items — this actually improves React's reconciliation since it was previously using index-based keys. No new state. |
| `RecommendedActionsCard` | Removed `PLACEHOLDER_ACTIONS` fallback — simpler conditional rendering, fewer DOM nodes when empty. No new state. |

---

## Fetch Loop Analysis

### No extra fetch loops introduced

| Component | Fetches | Assessment |
|---|---|---|
| `printCostLedger` (both files) | 2 parallel fetches (`/cost` + `/cost-entries`) | Only triggered on user click (not on render/mount). Uses `Promise.all` for parallelism. No polling, no retry loop, no refetch-on-state-change. |
| `CostLedgerCard` CSV export | 0 fetches | Operates entirely on in-memory `filtered` array. No network calls. |
| All other changed components | 0 new fetches | No new `useEffect`, `apiFetch`, or `fetch` calls added. |

---

## Modal/Dialog Weight

### No regressions

- No new modals or dialogs were added in any step.
- `CostsTabContent` retains its existing add/edit cost entry dialog — no changes to its open/close logic.
- `DocumentsRailCard` retains its existing upload dialog — no changes to its open/close logic.
- The `EditVehicleUi` media manager dialog was not modified.

---

## List-Row Action Weight

### Improved (lighter)

| Component | Before | After |
|---|---|---|
| `CostLedgerCard` footer | 4 always-disabled pagination buttons + page indicator + per-page dropdown | Single "Showing X of Y entries" text span |
| `DocumentsRailCard` footer | "Add Note" button with SVG icon | Removed entirely |

Both changes reduce DOM node count in list views.

---

## Full-Page Thrash

### No regressions

- `printCostLedger` opens a new `window.open("", "_blank")` tab for printing — this does not cause a full-page navigation or re-mount of the current page.
- CSV export creates a temporary `Blob` URL and triggers download via a dynamically created `<a>` element — no page navigation.
- All Link-based navigation changes (`Create Deal → /deals/new?vehicleId=`) use Next.js `<Link>` for client-side transitions.

---

## Bundle Size Impact

### Negligible

| Change | Impact |
|---|---|
| `escapeHtml()` function (duplicated in 2 files) | ~150 bytes minified per file. Could be extracted to a shared utility in a future cleanup pass. |
| `sanitizeCsvField()` function | ~80 bytes minified. Inline in click handler. |
| `printCostLedger()` function (duplicated in 2 files) | ~800 bytes minified per file. Already existed in VehiclePageHeader; now also in VehicleCostsPageHeader. Could be extracted to a shared module. Not actionable in this sweep. |
| Removed DOM elements (pagination, Add Note, View breakdown, fake actions) | Net negative — fewer bytes shipped. |

---

## Advisory: Code Duplication

The `printCostLedger` function and `escapeHtml` helper are duplicated between `VehiclePageHeader.tsx` and `VehicleCostsPageHeader.tsx`. This adds ~1KB of duplicate code to the bundle. Extracting to a shared utility (e.g., `modules/inventory/ui/utils/print-cost-ledger.ts`) would reduce this, but is outside the scope of this integrity sweep.

---

## Verdict

**No performance regressions introduced.** All changes are either:
- Click-triggered (no render-time cost)
- Pure DOM reduction (fewer nodes)
- Static prop changes (disabled, key, title attributes)
- No new state, effects, or fetch loops

Net effect on runtime performance: **slightly positive** due to reduced DOM node count in CostLedgerCard and DocumentsRailCard.
