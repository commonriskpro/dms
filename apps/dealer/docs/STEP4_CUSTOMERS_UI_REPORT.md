# Step 4 — Customers UI Security & QA Report

**Date:** 2025-03-04  
**Scope:** Customers page UI (mock match), modal routing, server-first data, RBAC, tenant isolation  
**Reference:** CUSTOMERS_UI_MOCK_SPEC.md, MODAL_ROUTING_ARCHITECTURE_SPEC.md

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

- **customers.write** (or **customers.create** where enforced) required to submit the create form. `CreateCustomerPage` checks `hasPermission("customers.write")` and disables submit when missing.
- **POST /api/customers** is guarded by `guardPermission(ctx, "customers.write")` in `app/api/customers/route.ts`.
- **/customers/new** (full page and modal) **never** fetches a customer by id. Verified: `CreateCustomerPage` only calls:
  - `GET /api/admin/memberships?limit=100` (for assigned-to options),
  - `POST /api/customers` (on submit).
- No code path in the create flow calls `/api/customers/:id` or `/api/customers/new`.

### 1.3 Detail ([id])

- **customers.read** required to load detail. Modal route `app/(app)/@modal/(.)customers/profile/[id]/page.tsx` checks `session?.permissions?.includes("customers.read")` and passes `errorKind="forbidden"` to the client when missing.
- **customers.write** is used for update/delete in the API (`PATCH/DELETE /api/customers/[id]`).
- **Invalid UUID:** Modal detail page uses `z.string().uuid().safeParse(id)`. Non-UUID `id` results in `errorKind="invalid_id"` and the client shows “Invalid customer ID” (no service call). API route `GET /api/customers/[id]` uses `customerIdParamSchema` (Zod UUID); invalid id returns **400** (covered by existing `app/api/customers/[id]/route.test.ts`).

---

## 2. Tenant Isolation

- **List and summary:** `listCustomers(dealershipId, ...)` and `getCustomerSummaryMetrics(dealershipId)` are called with `dealershipId` from session only. No cross-tenant data.
- **Detail:** Modal and full-page detail load customer via `customerService.getCustomer(dealershipId, id)`; service and DB layer scope by `dealershipId`.
- **API:** All customer API handlers use `ctx.dealershipId` from `getAuthContext(request)` and pass it to the service layer.
- **Tests:** Existing `modules/customers/tests/tenant-isolation.test.ts` and `app/api/customers/route.integration.test.ts` cover tenant isolation. Added `getCustomerSummaryMetrics` tenant-scoping test in `tenant-isolation.test.ts` (Dealer A vs Dealer B counts).

---

## 3. No Client Fetch-on-Mount for List

- **Customers list and summary** are loaded in the **server component** `app/(app)/customers/page.tsx`:
  - `noStore()` and `dynamic = "force-dynamic"` are set.
  - `listCustomers` and `getCustomerSummaryMetrics` are invoked in parallel on the server.
  - Result is passed as `initialData` to `<CustomersPageClient />`.
- **CustomersPageClient** does **not** call `apiFetch` or `fetch` for the list or summary on mount. It only uses `initialData` and updates the URL for filters/pagination, then `router.refresh()` to refetch on the server.
- Verified by code review: no `useEffect` in `CustomersPageClient` or in the list/summary data flow that fetches `/api/customers` or `/api/dashboard/customer-metrics` for initial load.

---

## 4. Tests Run

| Test suite / file | Result |
|-------------------|--------|
| `app/(app)/customers/__tests__/page.test.tsx` | 3 passed (server denies load when no customers.read or no dealership; services called when permitted) |
| `app/api/customers/route.test.ts` | Passed (GET list with meta, 403 when FORBIDDEN, rate limit 429) |
| `app/api/customers/[id]/route.test.ts` | Passed (400 invalid UUID, 403 FORBIDDEN) |
| `app/api/customers/route.integration.test.ts` | Passed (RBAC, tenant isolation, overrides) |
| `modules/customers/tests/tenant-isolation.test.ts` | Passed (includes getCustomerSummaryMetrics tenant scoping) |

---

## 5. Modal Correctness

- **/customers/new** (create): Rendered via intercepting route `@modal/(.)customers/new/page.tsx` (modal) and full page `customers/new/page.tsx`. No fetch of a customer record; create uses **POST /api/customers**.
- **/customers/profile/[id]** (detail): Rendered via intercepting route `@modal/(.)customers/profile/[id]/page.tsx` (server loads customer, passes `initialData` to `CustomerDetailModalClient`) and full page `customers/profile/[id]/page.tsx`. No “/api/customers/new” or GET by id on mount for the modal path (server provides data).
- Confirmed: no route or component calls **GET /api/customers/new**.

---

## 6. Summary

- **RBAC:** List and detail require `customers.read`; create/update require `customers.write`; enforced in server page, modal page, and API.
- **Tenant isolation:** All customer queries scoped by `dealershipId` from session/context; tests include list, detail, and summary metrics.
- **No client fetch-on-mount for list:** List and summary loaded in RSC and passed as `initialData`; client only triggers server refresh via URL + `router.refresh()`.
- **Invalid ID:** Non-UUID rejected in modal detail (invalid_id) and in API (400); Jest tests cover API and server page behavior.
- **Create flow:** No fetch to `/api/customers/:id`; only POST to `/api/customers` and optional GET memberships.
