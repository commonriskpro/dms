# Vehicle Cost Ledger V1 — Performance Pass (Step 5)

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/VEHICLE_COST_LEDGER_V1_SPEC.md`  
**Scope:** Audit only — Vehicle Cost Ledger V1 surfaces (VehicleCostsAndDocumentsCard, cost entries list/table, add/edit dialog, documents list/upload/view/remove, GET cost). No redesign; backend/route changes only if a real performance issue is found.

---

## 1. Vehicle detail rendering

### 1.1 Cost card placement and blocking

- **VehicleDetailContent** renders a single card stack; **VehicleCostsAndDocumentsCard** is one child among many (Overview, Pricing, Intelligence, Valuation, Recon, Costs & Documents, Floorplan, etc.).
- The cost card **does not block** the parent or sibling cards. It receives only `vehicleId`; it fetches its own data in a **client-side effect** after mount.
- Vehicle detail page (or modal) loads with existing vehicle + photo URLs; the cost card shows a **Skeleton** until its first fetch completes. No new blocking work on the critical path of vehicle detail.

**Conclusion:** Vehicle detail remains lightweight. Adding the costs section does not add server-side or synchronous blocking; one extra client component that loads its data in parallel with other card-level fetches.

---

## 2. Fetch strategy and refetch churn

### 2.1 Initial load

- **Single effect** runs on mount (and when `vehicleId` or permission-derived flags change): `loadAll()` which runs  
  `Promise.all([fetchCost(), fetchEntries(), canListDocuments ? fetchDocuments() : Promise.resolve()])`.
- So **one batch** of 2 or 3 requests in parallel (cost, entries, and optionally documents). No waterfall; no repeated refetch from overlapping effects.

### 2.2 Effect dependencies

- `loadAll` depends on `[fetchCost, fetchEntries, fetchDocuments, canListDocuments]`.
- `fetchCost` / `fetchEntries` / `fetchDocuments` are **useCallback** with stable deps: `[vehicleId, canReadInventory]` or `[vehicleId, canListDocuments]`.
- When the user navigates to another vehicle, `vehicleId` changes → callbacks and `loadAll` change → effect runs once for the new vehicle. No unnecessary refetch churn on the same vehicle.

### 2.3 After mutations

| Action | Refetch behavior |
|--------|-------------------|
| **Add/Edit cost entry** | After success: `Promise.all([fetchCost(), fetchEntries()])` only. Documents not refetched (unchanged). ✓ |
| **Delete cost entry** | After success: `Promise.all([fetchCost(), fetchEntries(), canListDocuments ? fetchDocuments() : Promise.resolve()])`. Documents refetched so linkage to deleted entry is updated. ✓ |
| **Upload document** | After success: `fetchDocuments()` only. Cost and entries unchanged. ✓ |
| **Remove document** | After success: `fetchDocuments()` only. ✓ |

No full “reload all” on every mutation; only the data that can change is refetched. Refetches are one-shot after the mutation; no polling or repeated refetch loops.

**Conclusion:** No unnecessary refetch churn. Batched initial load; minimal, targeted refetch after mutations.

---

## 3. Add/edit/delete and rerendering

### 3.1 Entry modal (add/edit)

- Opening the dialog only updates local state (`entryModalOpen`, `editingEntry`, form fields). **No fetch** on open.
- On submit, `setEntrySubmitting(true)` → mutation → `closeEntryModal()` → `await Promise.all([fetchCost(), fetchEntries()])` → `setEntrySubmitting(false)`.
- After refetch, **two state updates** (`setCost`, `setEntries`). React 18 batches these in the same tick, so effectively **one rerender** after the modal closes.
- Dialog open/close and form typing do not trigger refetch; only submit does.

### 3.2 Delete entry

- Confirm dialog → DELETE request → refetch (cost, entries, and optionally documents). Same batching: multiple `set*` from refetch result in one rerender when React batches.

### 3.3 Document upload / remove

- Upload: refetch only `fetchDocuments()` → one state update → one rerender.
- Remove: same.

**Conclusion:** Add/edit/delete do not cause excessive rerendering. One refetch batch per mutation and a single resulting rerender (with batching).

---

## 4. Document list and cost ledger table rendering

### 4.1 Document list

- Rendered as a **simple list** (`documentsList.map`) with one list item per document (filename, kind, optional linked entry, date, View/Remove).
- No virtualization. For V1, typical volume per vehicle is **low** (handful to low tens of documents). If a vehicle ever had hundreds of cost documents, virtualization could be considered later; not required for current usage.

### 4.2 Cost ledger table

- Rendered as a **plain table** (`entriesList.map`) with fixed columns (category, amount, vendor, date, memo, attachment count, actions).
- Same as above: no virtualization; typical entry count per vehicle is small. Acceptable for vehicle-detail usage.

**Conclusion:** Document list and cost ledger table are lightweight for expected data sizes. No change needed for V1.

---

## 5. Totals derivation (GET /api/inventory/[id]/cost)

### 5.1 Route

- **getVehicle(ctx.dealershipId, id)** — one query (vehicle by id + dealershipId).
- **costLedger.getCostTotals(ctx.dealershipId, id)** — see below.
- **ledgerTotalsToCostBreakdown(totals)** — in-memory mapping; no DB.

### 5.2 getCostTotalsByVehicleId (db layer)

- **Single** `prisma.vehicleCostEntry.findMany` with:
  - `where: { dealershipId, vehicleId, deletedAt: null }`
  - `select: { category: true, amountCents: true }` (minimal columns).
- Then in-memory loop to aggregate by category into acquisition, transport, recon, fees, misc, total.
- Schema has `@@index([dealershipId, vehicleId])` on VehicleCostEntry, so the query uses the composite index.

**Conclusion:** Totals derivation is efficient: one indexed query per vehicle and a small in-memory aggregation. No N+1; suitable for vehicle-detail usage.

---

## 6. Signed URL view flow

- **handleOpenDocument(fileObjectId)** calls `apiFetch(/api/files/signed-url?fileId=...)` then `window.open(url, "_blank")`.
- **No state update** for the URL or the result (no `setState` with the signed URL). So opening a document **does not cause a rerender** of the cost card.
- One network request per “View” click; no avoidable reload or refetch of the cost/entries/documents list.

**Conclusion:** Signed URL view flow does not trigger avoidable extra reloads or rerenders.

---

## 7. Dialog and form interactions

### 7.1 Entry modal

- Form state is local (`formCategory`, `formAmountDollars`, etc.). Typing and select changes only update that state; no API calls.
- Submit is the only side effect (mutation + refetch). No debounce or extra validation round-trips required for V1.

### 7.2 Upload modal

- File picker, kind select, optional cost-entry link: all local state. Submit triggers one POST (multipart) and then one refetch (documents only).

### 7.3 Confirm dialogs

- **confirm()** for delete entry / remove document is fire-and-forget from a perf perspective; no refetch until the user confirms and the mutation succeeds.

**Conclusion:** Dialog and form interactions remain lightweight; no unnecessary network or heavy work on open/close or input change.

---

## 8. Cost entries and documents API (backend)

### 8.1 GET cost-entries

- **listCostEntriesByVehicleId(dealershipId, vehicleId)**: one `findMany` with `where: { dealershipId, vehicleId, deletedAt: null }`, `orderBy: { occurredAt: "desc" }`. Indexed. No N+1.

### 8.2 GET cost-documents

- **listCostDocumentsByVehicleId(dealershipId, vehicleId)**: one `findMany` with `where: { dealershipId, vehicleId }`, `include: { fileObject: { select: … }, costEntry: { select: … } }`. Single query with joins; no N+1.

**Conclusion:** List endpoints are efficient and index-friendly. No backend changes needed for performance.

---

## 9. Summary

| Area | Status |
|------|--------|
| Vehicle detail rendering | ✓ Lightweight; cost card loads its own data, does not block parent |
| Refetch churn | ✓ Single batched initial load; targeted refetch after mutations only |
| Add/edit/delete rerendering | ✓ One refetch batch per mutation; React batches state updates |
| Document list / ledger table | ✓ Simple list/table; acceptable for typical per-vehicle sizes |
| Totals derivation | ✓ One indexed query + in-memory aggregation; efficient |
| Signed URL view | ✓ No state update; no extra reloads or rerenders |
| Dialog/form interactions | ✓ Local state only until submit; no avoidable work |

**No redesign and no backend/route changes.** No performance issues found that require code changes for V1. If a vehicle ever has very large numbers of cost entries or documents (e.g. hundreds), consider pagination or virtualization in a future iteration.
