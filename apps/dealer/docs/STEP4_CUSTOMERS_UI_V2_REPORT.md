# Step 4 — Customers UI V2 Security & QA Report

**Date:** 2026-03-05  
**Scope:** Customers page UI V2 (UPDATED mock), modal routing, server-first data, RBAC, tenant isolation  
**Reference:** CUSTOMERS_UI_MOCK_V2_SPEC.md, MODAL_ROUTING_ARCHITECTURE_SPEC.md

---

## 1. RBAC Verification

### 1.1 List page (server)

- **customers.read** required to load list and summary. Implemented in `app/(app)/customers/page.tsx`:
  - `getSessionContextOrNull()` provides `session.activeDealershipId` and `session.permissions`.
  - When `!hasRead` (no `customers.read` or no `activeDealershipId`), the page renders `<CustomersPageClient initialData={null} canRead={false} canWrite={false} />` and **does not call** `listCustomers` or `getCustomerSummaryMetrics`.
- **Jest tests:** `app/(app)/customers/__tests__/page.test.tsx`:
  - Session without `customers.read` → `listCustomers` and `getCustomerSummaryMetrics` are **not** called.
  - `activeDealershipId === null` → same (services not called).
  - Session with `customers.read` and `activeDealershipId` → both services called with `dealershipId`.

### 1.2 Create (new)

- **customers.write** required to submit the create form. `POST /api/customers` is guarded by `guardPermission(ctx, "customers.write")` in `app/api/customers/route.ts`.
- **/customers/new** (full page and modal) **never** fetches a customer by id. No code path in the create flow calls `/api/customers/:id` or `getCustomer`. Create uses only `POST /api/customers` and optionally reference data (e.g. memberships).

### 1.3 Detail ([id])

- **customers.read** required to load detail. Modal route `app/(app)/@modal/(.)customers/profile/[id]/page.tsx` checks `session?.permissions?.includes("customers.read")` and passes `errorKind="forbidden"` when missing.
- **Invalid UUID:** Modal detail page uses `z.string().uuid().safeParse(id)`. Non-UUID `id` results in `errorKind="invalid_id"` and **getCustomer is not called**. API route `GET /api/customers/[id]` returns **400** for invalid id (covered by `app/api/customers/[id]/route.test.ts`).

---

## 2. Tenant Isolation

- **List and summary:** `listCustomers(dealershipId, ...)` and `getCustomerSummaryMetrics(dealershipId)` are called with `dealershipId` from session only.
- **Detail:** Modal and full-page detail load via `customerService.getCustomer(dealershipId, id)`; service and DB scope by `dealershipId`.
- **API:** All customer API handlers use `ctx.dealershipId` from `getAuthContext(request)`.
- **Tests:** `modules/customers/tests/tenant-isolation.test.ts` covers list, getCustomer, getCustomerSummaryMetrics, update, delete, notes, tasks.

---

## 3. No Client Fetch-on-Mount

- **Customers list and summary** are loaded in the **server component** `app/(app)/customers/page.tsx`:
  - `noStore()` and `dynamic = "force-dynamic"` are set.
  - `listCustomers` and `getCustomerSummaryMetrics` are invoked in parallel on the server.
  - Result is passed as `initialData` to `<CustomersPageClient />`.
- **CustomersPageClient** does **not** call `apiFetch` or `fetch` for list or summary on mount. It uses `initialData` and updates the URL for filters/pagination/search, then `router.refresh()` for server refetch.
- **CustomersFilterSearchBar** search submit updates URL (via `onSearchSubmit` → `handleFilterChange`) and triggers server-driven reload; no client fetch for list.

---

## 4. Jest Tests Added / Run

| Test suite / file | Result |
|-------------------|--------|
| `app/(app)/customers/__tests__/page.test.tsx` | Passed — server denies load when no customers.read or no dealership; services called when permitted. |
| `app/(app)/@modal/(.)customers/profile/[id]/__tests__/page.test.tsx` | Passed — getCustomer not called when id is non-UUID; getCustomer not called when session lacks customers.read. |
| `app/api/customers/route.test.ts` | Passed — GET list with meta, 403 FORBIDDEN, search/sort/pagination forwarded, limit capped, invalid sortBy 400, POST 403. |
| `app/api/customers/[id]/route.test.ts` | Passed — 400 invalid UUID, 403 FORBIDDEN; getCustomer not called for invalid id. |
| `modules/customers/tests/tenant-isolation.test.ts` | Passed — tenant scoping for list, getCustomer, getCustomerSummaryMetrics, update, delete. |

### 4.1 Coverage Summary

- **Customers page denies without customers.read:** Covered by `app/(app)/customers/__tests__/page.test.tsx` (services not called when permission or dealership missing).
- **/customers/profile/[id] rejects non-UUID:** API covered by `app/api/customers/[id]/route.test.ts` (400, getCustomer not called). Modal page covered by `app/(app)/@modal/(.)customers/profile/[id]/__tests__/page.test.tsx` (getCustomer not called for non-UUID id).
- **/customers/new does not call /api/customers/:id:** Confirmed by code review; create flow uses only POST /api/customers and optional reference-data endpoints. No Jest test added for this (no server component that could call getCustomer).

---

## 5. Modal Correctness

- **/customers/new:** Rendered via `@modal/(.)customers/new/page.tsx` (modal) and `customers/new/page.tsx` (full page). No fetch of a customer record; create uses **POST /api/customers**.
- **/customers/profile/[id]:** Rendered via `@modal/(.)customers/profile/[id]/page.tsx` (server loads customer, passes `initialData` to `CustomerDetailModalClient`) and `customers/profile/[id]/page.tsx`. Invalid UUID → client receives `errorKind="invalid_id"` without calling `getCustomer`.

---

## 6. Summary

- **RBAC:** List and detail require `customers.read`; create/update require `customers.write`; enforced in server page, modal page, and API.
- **Tenant isolation:** All customer queries scoped by `dealershipId` from session/context; covered by tenant-isolation tests.
- **No client fetch-on-mount for list:** List and summary loaded in RSC and passed as `initialData`; search/filters/pagination trigger server refresh via URL + `router.refresh()`.
- **Invalid ID:** Non-UUID rejected in modal detail (getCustomer not called) and in API (400); Jest tests cover both.
- **Create flow:** No fetch to `/api/customers/:id`; only POST to `/api/customers`.
