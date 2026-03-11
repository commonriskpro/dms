# Modal Routing Security & QA Report

**Date:** 2025-03-04  
**Scope:** Modal routing architecture for inventory, customers, deals (Option B: intercepting + parallel routes)  
**Reference:** `MODAL_ROUTING_ARCHITECTURE_SPEC.md`

---

## 1. RBAC Enforcement

### 1.1 API layer

| Module     | List (GET /api/module) | Create (POST) | Read (GET /:id) | Update (PATCH /:id) | Delete (DELETE /:id) |
|-----------|------------------------|---------------|-----------------|----------------------|------------------------|
| inventory | `inventory.read`       | `inventory.write` | `inventory.read` | `inventory.write`    | `inventory.write`      |
| customers | `customers.read`       | `customers.write` | `customers.read` | `customers.write`    | `customers.write`      |
| deals     | `deals.read`           | `deals.write`     | `deals.read`     | `deals.write`        | `deals.write`          |

- All relevant route handlers call `guardPermission(ctx, "<module>.<action>")` before business logic.
- Jest route tests added for **GET/PATCH/DELETE** `.../[id]`: when `guardPermission` throws `ApiError("FORBIDDEN", ...)`, response is **403** with body `error.code === "FORBIDDEN"`.
- Negative tests: **invalid UUID** → **400** (Zod validation in route); **permission denied** → **403**.

### 1.2 UI / modal routes

- **Create modals** (`/module/new`): Rendered inside `ModalShell`; underlying `CreateVehiclePage` / `CreateCustomerPage` / `CreateDealPage` use `useSession().hasPermission("<module>.write")` to gate submit and optional UI.
- **Detail modals** (`/module/[id]`): Server component checks `session?.permissions?.includes("<module>.read")` before loading entity. If missing, client receives `errorKind="forbidden"` and `ModalShell` shows “Access denied”.
- Form submit (create/update) goes to **POST /api/module** or **PATCH /api/module/:id**; API enforces `module.write` (or equivalent).

---

## 2. Tenant Isolation

- **Service layer:** Every inventory, customers, and deals service function takes `dealershipId` and passes it to the DB layer. Queries use `where: { dealershipId, ... }` (or equivalent).
- **API layer:** `dealershipId` comes from `getAuthContext(request)` (cookie + membership); no impersonation bypass for tenant context.
- **Modal server pages:** `getSessionContextOrNull()` provides `activeDealershipId`; entity load uses `inventoryService.getVehicle(dealershipId, id)` (and analogous for customers/deals). No cross-tenant data passed to client.
- **Existing tests:** `modules/inventory/tests/tenant-isolation.test.ts`, `modules/deals/tests/tenant-isolation.test.ts` (and equivalent for customers where present) verify cross-tenant access returns null or throws NOT_FOUND.
- **API route config:** Tenant-facing API routes export `dynamic = "force-dynamic"` (inventory, inventory/[id], customers, customers/[id], deals, deals/[id]) to avoid cross-tenant caching.

---

## 3. Input Validation

- **Route params `[id]`:** All three modules validate with **Zod** `z.string().uuid()` in API route handlers (`idParamSchema`, `customerIdParamSchema`, `dealIdParamSchema`). Non-UUID `id` returns **400** with validation error shape.
- **Modal server pages:** `idSchema.safeParse(id)` used before calling service; invalid UUID results in `errorKind="invalid_id"` and modal shows “Invalid … ID” (no service call).
- **Jest route tests:** Each `.../[id]/route.test.ts` includes a case with `id: "not-a-uuid"` and asserts **400** and that the service (e.g. `getVehicle`) is **not** called.

---

## 4. Modal Correctness

- **`/inventory/new`**, **`/customers/new`**, **`/deals/new`**: Create mode; no API fetch for entity. Renders create form inside `ModalShell`. No endpoint `/api/<module>/new` exists; create uses **POST /api/<module>**.
- **`/inventory/vehicle/[id]`**, **`/customers/profile/[id]`**, **`/deals/[id]`**: Detail mode; server loads entity via service and passes `initialData` to client. Client does **not** call `GET /api/<module>/:id` on mount for the primary entity (inventory detail modal may still fetch photo signed URLs client-side for display only).
- **Verification:** No references to `/api/inventory/new`, `/api/customers/new`, or `/api/deals/new` in the codebase (grep confirmed).

---

## 5. Tests Added / Relevant

- **`app/api/inventory/[id]/route.test.ts`**: Invalid UUID → 400; FORBIDDEN → 403 for GET, PATCH, DELETE.
- **`app/api/customers/[id]/route.test.ts`**: Same.
- **`app/api/deals/[id]/route.test.ts`**: Same.
- **Service/tenant tests:** Existing `tenant-isolation.test.ts` and RBAC tests in `modules/inventory/tests`, `modules/deals/tests`, and customers module remain in use.

---

## 6. Performance (No Client Fetch-on-Mount for Initial Entity)

- **Inventory detail modal:** Data loaded in server component (`@modal/(.)inventory/vehicle/[id]/page.tsx`) via `inventoryService.getVehicle` + `listVehiclePhotos`; result passed as `initialData` to `VehicleDetailModalClient`. Client only fetches photo signed URLs for images (auxiliary).
- **Customers detail modal:** Server loads via `customerService.getCustomer`; `CustomerDetailModalClient` receives `initialData` only; no client fetch for customer.
- **Deals detail modal:** Server loads via `dealService.getDeal`; serialized deal passed as `initialData` to `DealDetailModalClient`; `DealDetailPage` accepts `initialData` and skips `useEffect` fetch when present.
- **Create modals:** No entity fetch; form-only.

---

## 7. Error Handling

- **Invalid id:** 400 (API); modal shows “Invalid … ID” with optional retry/navigate.
- **Not found:** 404 from API; modal server catches `ApiError("NOT_FOUND")` and passes `errorKind="not_found"`; modal shows “Not found” with link back to list.
- **Permission denied:** 403 from API; modal server checks permission before load and shows “Access denied” when missing read.

---

## 8. Checklist Summary

| Item                                      | Status |
|-------------------------------------------|--------|
| RBAC on list/create/read/update/delete    | Done   |
| Tenant isolation (dealershipId) in queries| Done   |
| Zod UUID validation for `[id]`            | Done   |
| Modal /module/new → create, no /api/../new | Done   |
| Modal /module/[id] → detail, server load  | Done   |
| No client fetch-on-mount for initial data | Done   |
| Jest route tests (400, 403)               | Done   |
| `dynamic = "force-dynamic"` on tenant APIs| Done   |

---

## 9. Performance Pass (Step 5)

- **Server-first:** Detail modal data is loaded in RSC; client receives `initialData`. No `useEffect` in `@modal` that fetches `GET /api/<module>/:id` for the primary entity.
- **Minimal client hydration:** Modal shell and body are client components only where needed (close handler, optional photo URLs for inventory). List and detail links use Next.js `<Link>` so navigation to `/module/new` and `/module/[id]` is client-side; intercepting routes show the modal without full page reload.
- **Redundant queries:** Server modal page runs once per navigation; no duplicate GET for the same entity. Photo signed URLs in inventory modal are a separate, optional client fetch for display only.

---

## 10. Recommendations

- Consider adding an **integration test** that, with a real session cookie, requests `GET /api/inventory/<other-tenant-vehicle-id>` and asserts **404** (tenant isolation at API boundary).
- Optional: Add a **smoke test** that navigates to `/inventory/new` and `/inventory/<valid-uuid>` and asserts modal content (title, no “Invalid ID”) to lock modal route behavior.
