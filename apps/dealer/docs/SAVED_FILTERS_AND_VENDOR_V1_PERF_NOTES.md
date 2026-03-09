# Saved-Filters Stabilization + Vendor Management V1 — Performance Pass (Step 5)

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/SAVED_FILTERS_STABILIZATION_AND_VENDOR_V1_SPEC.md`  
**Scope:** Phase 1 (buildCustomersQuery), Phase 2 vendor backend (list/CRUD, vendor cost-entries), cost-entry vendorId/vendorName, Vendor UI (list, detail, create, edit). Audit only; backend/route changes only where a real performance issue is found.

---

## 1. Phase 1 — Saved-filters (buildCustomersQuery)

- **buildCustomersQuery** is a pure function: in-memory mapping from params to a query string. No network, no DB, no new work on the critical path of the customers list or saved-search apply.
- **Customers list** and **saved-search apply** continue to use the same server-side list and parseSearchParams; only the client-side URL shape is built by buildCustomersQuery. No additional round-trips or blocking.

**Conclusion:** Phase 1 has no performance impact. No changes needed.

---

## 2. Vendor list API (GET /api/vendors)

### 2.1 Backend

- **listVendors(dealershipId, options):**  
  - `Promise.all([ findMany(where, take, skip, include: _count.vehicleCostEntries), count(where) ])` — **two queries** in parallel: one for the page of rows with per-row cost-entry count, one for total count.
  - **where:** `dealershipId`, optional `deletedAt: null`, optional `name: { contains, mode: 'insensitive' }`, optional `type`.
  - **Indexes on Vendor:** `@@index([dealershipId])`, `@@index([dealershipId, isActive])`, `@@index([dealershipId, type])`, `@@index([dealershipId, deletedAt])`. List query uses dealershipId and optionally deletedAt and type; index usage is adequate.
  - **Limit:** Zod schema caps `limit` at 100; default 25. No unbounded list.

**Conclusion:** Vendor list is efficient: two parallel queries, indexed, bounded. No N+1.

---

## 3. Vendor detail and vendor cost-entries API

### 3.1 GET /api/vendors/[id]

- **getVendor(dealershipId, id):** one `findFirst({ where: { id, dealershipId } })`. Indexed by PK and dealershipId. Single row.

### 3.2 GET /api/vendors/[id]/cost-entries

- **Route:** getVendor (1 query) then listCostEntriesByVendor(dealershipId, id, limit).
- **listCostEntriesByVendorId:** one `findMany` with:
  - `where: { dealershipId, vendorId, deletedAt: null }`
  - `include: { vehicle: { select: { id, year, make, model, stockNumber } } }`
  - `orderBy: { occurredAt: "desc" }`, `take: limit` (default 25, max 100).
- **Index:** VehicleCostEntry had `@@index([vendorId])`. For the filter `(dealershipId, vendorId, deletedAt)` a composite index is better.

### 3.3 Fix applied in this pass

- **Composite index on VehicleCostEntry:** added `@@index([dealershipId, vendorId])` so the vendor cost-entries list query can use a single index for both tenant and vendor. Migration: `20260309210000_vehicle_cost_entry_dealer_vendor_index`.

**Conclusion:** Vendor detail and vendor cost-entries are each a small, bounded number of queries. Composite index keeps the vendor cost-entries list query efficient.

---

## 4. Cost-entry APIs (with vendorId / vendor)

### 4.1 GET /api/inventory/[id]/cost-entries

- **listCostEntriesByVehicleId** now uses `include: { vendor: true }` so each entry can expose `vendorDisplayName` (vendorName ?? vendor.name). **Single query** with a join to Vendor; no N+1.
- **Index:** Existing `@@index([dealershipId, vehicleId])` on VehicleCostEntry is used. No change needed.

### 4.2 POST/PATCH cost entry with vendorId

- When the client sends **vendorId**, the route calls **getVendor(ctx.dealershipId, data.vendorId)** before create/update. That adds **one extra read** per create/update that includes a vendor. Single row by PK + dealershipId; indexed. Acceptable for V1.

**Conclusion:** Cost-entry list remains one query with include; create/update add one validated vendor read when vendorId is present. No N+1; no unbounded queries.

---

## 5. Vendor UI — fetch strategy and rerenders

### 5.1 VendorsListPage

- **Initial load:** One `fetchVendors(0)` in a single effect when `canRead` is true. Dependencies: `[canRead, fetchVendors]`; `fetchVendors` is useCallback with `[canRead, search, typeFilter, includeDeleted]`. So when the user changes filters and clicks "Apply", they trigger a new fetch; no polling or automatic refetch on every keystroke.
- **Pagination:** "Next/Previous" calls `fetchVendors(offset)` once. No duplicate or cascading fetches.
- **Edit from URL (?edit=id):** Separate effect runs when `editIdFromUrl` is set; one GET /api/vendors/[id] to open the edit dialog. Runs once per edit id; no loop.
- **Create/Edit/Delete dialogs:** On success, `fetchVendors(meta.offset)` is called once to refresh the list. Single refetch.

**Conclusion:** List page has a single initial fetch, explicit refetch on filter apply or pagination or after mutation. No unnecessary churn.

### 5.2 VendorDetailPage

- **Initial load:** One effect runs `fetchVendor()`, which does **Promise.all([ GET /api/vendors/[id], GET /api/vendors/[id]/cost-entries ])**. Two requests in parallel; no waterfall.
- **No refetch** on mount after navigation; no polling. User sees detail once; to refresh they would navigate away and back (or we could add a refresh button later).

**Conclusion:** Detail page uses two parallel requests; no N+1 on the client.

### 5.3 List and detail rendering

- **List:** Table of vendors (name, type, contact, cost entry count, actions). No virtualization. Typical vendor list per dealership is expected to be tens to low hundreds; pagination (limit 25, max 100) keeps response size bounded. Acceptable for V1.
- **Detail:** Details card + table of "Recent cost entries" (up to 25). Small, fixed size. No virtualization needed.

**Conclusion:** No excessive DOM or rerenders; list size bounded by pagination.

---

## 6. Cache and rate limiting

- **Vendor and cost-entry APIs** do not use response caching (per .cursorrules: no cache on single-entity reads or mutations). Vendor list could be cached with short TTL in a future iteration if needed; not required for V1.
- **Rate limiting:** No new rate-limit rules added for vendor or cost-entry routes. Existing auth and route rate limits apply. Acceptable for V1.

**Conclusion:** No cache or rate-limit changes in this pass.

---

## 7. Summary

| Area | Status |
|------|--------|
| Phase 1 (buildCustomersQuery) | ✓ No perf impact; pure URL building |
| Vendor list API | ✓ Two parallel queries; indexed; limit ≤ 100 |
| Vendor detail + cost-entries API | ✓ Small, bounded queries; composite index added for vendor cost-entries |
| Cost-entry list (with vendor) | ✓ Single query with include; no N+1 |
| Cost entry create/update (vendorId) | ✓ One extra vendor read when vendorId present; acceptable |
| VendorsListPage fetch strategy | ✓ Single initial fetch; refetch on apply/pagination/mutation only |
| VendorDetailPage fetch strategy | ✓ Two parallel requests; no waterfall |
| List/detail rendering | ✓ Pagination and limit 25 on cost-entries; no virtualization needed for V1 |

**Change applied in this pass:** Added composite index `(dealership_id, vendor_id)` on `vehicle_cost_entry` to optimize GET /api/vendors/[id]/cost-entries. No other code or route changes required for performance.
