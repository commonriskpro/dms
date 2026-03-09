# Vehicle Costs Tab Hybrid UI — Performance Notes (Step 5)

**Program:** Vehicle Costs Tab Hybrid UI Implementation  
**Step:** Performance pass (Step 5)  
**Status:** Complete

---

## Audit summary

The refined Costs tab remains lightweight. No extra request churn is introduced on initial page load; data for the Costs tab is fetched only when the tab is active. Layout changes do not cause unnecessary rerender churn. Ledger and document rail rendering are simple list/table renders with no heavy work per item.

---

## 1. Costs tab remains lightweight

### 1.1 Lazy mount and fetch

- **CostsTabContent** is rendered only when `activeTab === "costs"`. When the user is on Overview (or any other tab), the Costs tab subtree is not in the DOM and no cost/document API calls are made.
- **Initial load:** Vehicle detail page loads with default tab "overview". The three cost-related endpoints (`/cost`, `/cost-entries`, `/cost-documents`) are not called until the user switches to the Costs tab.
- **Verdict:** No extra request churn on first paint. Costs data is fetched on demand when the user opens the Costs tab.

### 1.2 Batch fetch on Costs tab entry

- On mount, **CostsTabContent** runs a single `useEffect` that calls `loadAll()`. `loadAll()` performs `Promise.all([fetchCost(), fetchEntries(), canListDocuments ? fetchDocuments() : Promise.resolve()])` — up to three requests in parallel.
- Same pattern as the previous monolithic Costs & Documents card: one batch, no N+1 or sequential waterfalls.
- **Verdict:** Request behavior is unchanged and efficient.

### 1.3 Refetch scope after mutations

- After add/edit/delete cost entry: `fetchCost()` and `fetchEntries()` are awaited (documents refetched only when `canListDocuments`, in delete path).
- After upload/remove document: only `fetchDocuments()` (or `fetchDocuments()` in addition to cost/entries for delete entry).
- No full `loadAll()` on every mutation; only the affected resources are refetched where implemented. Delete entry currently refetches cost, entries, and documents; that’s a small, bounded set of requests.
- **Verdict:** Mutation refetch scope is appropriate.

---

## 2. Rerender churn from layout changes

### 2.1 Tab state

- **VehicleDetailContent** holds a single `useState<VehicleDetailTabId>("overview")`. Changing tabs updates one state value and causes one re-render; the conditional `isCostsTab ? <CostsTabContent /> : <main grid>` swaps the rendered branch. The other branch is unmounted, so there is no duplicate tree.
- **Verdict:** No unnecessary layout thrash; tab switch is a single state update and subtree swap.

### 2.2 Callback stability in CostsTabContent

- **Stable:** `fetchCost`, `fetchEntries`, `fetchDocuments`, `loadAll` are wrapped in `useCallback` with correct dependencies (`vehicleId`, permission flags). `openEntryModal` and `closeEntryModal` are `useCallback` with empty deps.
- **Not memoized:** `handleSaveEntry`, `handleDeleteEntry`, `handleOpenDocument`, `handleRemoveDocument`, `handleUploadDocument` are plain functions. They get new references each render, so children that receive them as props (e.g. `CostLedgerCard`, `DocumentsRailCard`) will re-render when the parent re-renders (e.g. after state updates from fetch or form). For this screen, re-renders are driven by user actions and refetches; there is no high-frequency update loop. Memoizing every handler would add code without a meaningful win unless profiling showed a hot path.
- **Verdict:** Acceptable. No evidence of unnecessary churn; callback stability is sufficient for fetch and modal open/close.

### 2.3 Derived state

- `acquisitionEntry` and `docsByEntryId` are computed with `useMemo`; `entriesList` and `documentsList` are simple array references. Expensive derivations are memoized.
- **Verdict:** No redundant recomputation.

---

## 3. Ledger workspace performance

### 3.1 Table rendering

- **CostLedgerCard** renders a single `<Table>` with one row per cost entry. Rows are straightforward: date, category, vendor, amount, memo, doc count, actions. No per-row components, no heavy computation in render (only `formatDate`, `truncateMemo`, `formatCents`, and a `docsByEntryId.get(entry.id)` lookup).
- Cost entries per vehicle are typically on the order of tens. The vehicle cost-entries API currently returns all entries for the vehicle (no pagination in the API). If a vehicle ever had hundreds of entries, the table would still be a single pass over the list; consider pagination or virtualization only if real usage shows large lists.
- **Verdict:** Ledger workspace remains lightweight and appropriate for expected list sizes.

### 3.2 Backend list size

- **listCostEntriesByVehicleId** (used by GET `/api/inventory/[id]/cost-entries`) returns all non-deleted entries for the vehicle with no `take` limit. This matches pre-refactor behavior. Adding a cap or pagination would be a backend change and is out of scope for this UI refinement.
- **Verdict:** No new backend load; behavior unchanged.

---

## 4. Document rail rendering

### 4.1 List

- **DocumentsRailCard** renders a simple `<ul>` of list items. Each item shows filename, kind, optional cost-entry link, date, and View/Remove buttons. No virtualization, no heavy per-item work.
- Document lists per vehicle are typically small. Same as the previous card: no change to rendering cost.
- **Verdict:** Document rail remains lightweight.

### 4.2 Upload modal

- Upload dialog is rendered inside DocumentsRailCard; it mounts when the user opens it. No work done until the user clicks Upload.
- **Verdict:** No impact on initial Costs tab render.

---

## 5. No extra request churn from UI refinement

| Scenario | Before (monolithic card in stack) | After (Costs tab) |
|----------|-----------------------------------|--------------------|
| Load vehicle detail (default view) | All cards in DOM; Costs card mounted and called cost/entries/documents on mount | Default tab = overview; CostsTabContent not mounted; no cost/entries/documents requests |
| User switches to Costs tab | N/A (card was in scroll) | CostsTabContent mounts; one batch of up to 3 requests |
| User switches away from Costs tab | N/A | CostsTabContent unmounts; no ongoing requests |
| User returns to Costs tab | N/A | CostsTabContent mounts again; batch refetch (fresh data) |

- **Verdict:** UI refinement reduces cost-related requests on initial load (they only run when the user opens the Costs tab). Re-entering the Costs tab triggers a refetch, which is acceptable for data freshness and is not considered churn.

---

## 6. Layout and CSS

- Layout uses CSS Grid and Flexbox (`costsTabSummaryGrid`, `costsTabWorkspaceGrid`, flex for tab row and cards). No JS-driven layout, no resize observers or repeated DOM reads in the new components.
- **Verdict:** No layout thrash; rendering is style-driven.

---

## 7. Recommendations (optional, not required for this sprint)

- **Cost entries pagination:** If vehicles with very large cost-entry counts become common, add pagination (or a cap) to GET `/api/inventory/[id]/cost-entries` and optionally a "Load more" or paginated table in the ledger. Current design is fine for typical counts.
- **Tab content caching:** If product wants to avoid refetch when switching back to Costs tab, consider keeping Costs tab data in a parent or context and only refetching on explicit refresh or after mutations. Current "refetch on every Costs tab mount" is simpler and ensures freshness.
- **Handler memoization:** If profiling ever shows CostLedgerCard or DocumentsRailCard as hot (e.g. many re-renders from parent), consider wrapping mutation handlers in `useCallback` or passing stable refs. Not needed for current usage.

---

## 8. Summary

| Area | Result |
|------|--------|
| Refined Costs tab lightweight | Yes — lazy mount, batch fetch, no work until tab active |
| Unnecessary rerender churn | None identified — single tab state, stable fetch/modal callbacks |
| Ledger workspace performance | Good — simple table, small typical list size |
| Document rail rendering | Lightweight — simple list, upload modal on demand |
| Extra request churn from UI refinement | None — fewer requests on initial load (cost data only when Costs tab open) |

No performance issues identified. The hybrid Costs tab implementation is appropriate for production use from a performance perspective.
