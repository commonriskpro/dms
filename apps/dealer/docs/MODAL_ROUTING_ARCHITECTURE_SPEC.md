# Modal Routing Architecture Spec

**Project:** DMS Dealer App  
**Stack:** Next.js App Router, Supabase Auth (server cookies), Prisma/Postgres, Zod, Jest  
**Approach:** Option B — Intercepting routes + parallel routes  
**Scope:** inventory, customers, deals

---

## 1. Overview

Standardized modal routing for list → create/detail flows. When the user navigates from a list to `/module/new` or `/module/[id]`, the UI shows a modal over the list (intercepting). Direct navigation or refresh to the same URLs renders the full page. The parallel route `@modal` provides the modal slot; the default segment renders `null` when no modal is active.

---

## 2. Routing Structure

All routes live under the `(app)` route group. Base path is `/inventory`, `/customers`, or `/deals`.

### 2.1 File layout (per module)

For each of **inventory**, **customers**, **deals**:

```
app/(app)/
  <module>/
    page.tsx                    # List page
    new/
      page.tsx                  # Create (full page when direct)
    [id]/
      page.tsx                  # Detail/edit (full page when direct)

  @modal/
    default.tsx                 # Renders null (shared)
    (.)<module>/
      default.tsx               # Optional: fallback for @modal/(.)<module>
      (.)new/
        page.tsx                # Intercept: create in modal
      (.)[id]/
        page.tsx                # Intercept: detail in modal
```

**Concrete paths:**

| Module     | List       | Create (full) | Detail (full) | Intercept new     | Intercept [id]     |
|-----------|------------|---------------|---------------|-------------------|--------------------|
| inventory | /inventory | /inventory/new | /inventory/vehicle/[id] | (.)inventory/new  | (.)inventory/vehicle/[id]  |
| customers | /customers | /customers/new | /customers/profile/[id] | (.)customers/new  | (.)customers/profile/[id]  |
| deals     | /deals     | /deals/new    | /deals/[id]    | (.)deals/new      | (.)deals/[id]      |

The root layout already exposes the `modal` slot:

```tsx
// app/(app)/layout.tsx
export default function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    …
    <AppShell>{children}</AppShell>
    {modal}
    …
  );
}
```

`@modal/default.tsx` returns `null` so that when no intercept is active, nothing is rendered in the slot.

---

## 3. Route Semantics and Rules

### 3.1 `/module/new` (create mode)

- **Purpose:** Create new entity (vehicle, customer, or deal).
- **Data:** No API fetch. Form is blank; optional reference data (e.g. dropdowns) may be loaded by the form component if needed.
- **RBAC:** Requires `module.create` (or equivalent create permission) to render. Denied users get 403 or redirect.
- **URL:** Never call `/api/module/new`. There is no such endpoint; create uses `POST /api/module`.

### 3.2 `/module/[id]` (detail/edit mode)

- **Purpose:** View and optionally edit a single entity.
- **Data:** Server loads entity via service (tenant-scoped). Data is passed as `initialData` into client components. No client fetch-on-mount for the primary entity.
- **RBAC:** Requires `module.read` to view. Update actions require `module.update` (or `module.write` where that is the implemented permission).
- **ID:** `[id]` must be a valid UUID. Invalid id → 400; not found → 404; permission denied → 403.

### 3.3 Modal shell (shared)

A single shared component encapsulates modal behavior and DMS UI consistency:

- **Path:** `components/modal/ModalShell.tsx`
- **Responsibilities:**
  - Overlay layout (backdrop + centered content).
  - Close via `router.back()` (no dedicated “close” route).
  - Header: title + close button.
  - Body slot for children.
  - Skeleton state while loading (when used with async data).
  - Error state (e.g. 403, 404, network error) with consistent messaging and retry/close.
  - Use design tokens and shadcn-based styling consistent with the rest of the app.

Modal pages (intercepting routes) use `ModalShell` and pass title, body (skeleton/content/error), and close handler.

---

## 4. Data Loading Model

- **Server-first:** Page components (including modal route pages) load data on the server via service layer. No `useEffect` + `fetch(/api/module/:id)` for initial entity load.
- **List pages:** Load list data in the server component (or via server-side data layer). Client receives data as props or from server-rendered content.
- **Detail modal/page:** Server component for the route loads the entity (by `dealership_id` + `id`). It passes `initialData` into a client component that handles interactivity (forms, tabs, etc.). Optional secondary data (e.g. photos, activity) may be loaded client-side only where spec’d (e.g. signed URLs, paginated sublists).
- **Create modal/page:** No entity fetch. Client form component may call APIs for validation (e.g. VIN decode) or reference data; no GET by id.

---

## 5. RBAC Enforcement

| Action            | Route / behavior              | Permission(s)     |
|------------------|-------------------------------|-------------------|
| View list        | GET /api/module (list)        | module.read       |
| Open create UI   | /module/new (page or modal)   | module.create     |
| Submit create    | POST /api/module              | module.create     |
| View detail      | GET /api/module/:id, /module/[id] | module.read   |
| Update entity    | PATCH /api/module/:id, form submit | module.update (or module.write) |
| Delete entity    | DELETE /api/module/:id        | module.delete (or module.write) |

Backend enforces these on every API handler. Implemented permissions use `module.read` and `module.write` (write covers create/update/delete). Frontend checks permission before rendering create/detail UI and before enabling edit/delete actions.

---

## 6. Error Handling

| Condition           | HTTP / behavior | Response shape / UI                    |
|--------------------|-----------------|----------------------------------------|
| Invalid `[id]`     | 400             | `{ error: { code, message, details? } }`; UI: validation message |
| Record not found   | 404             | Same error shape; UI: “Not found” + close/back   |
| Permission denied  | 403             | Same error shape; UI: “Access denied” + close    |
| Server error       | 500             | Generic error; UI: error state + retry/close     |

Modal shell and pages use a consistent error component (e.g. `ErrorState`) and avoid exposing stack traces or internal details.

---

## 7. API Contracts (reference)

Backend must support (and already largely does):

| Method | Path               | Purpose        | Auth + RBAC      |
|--------|--------------------|----------------|------------------|
| GET    | /api/module        | List (paginated) | Tenant + module.read |
| POST   | /api/module        | Create         | Tenant + module.create |
| GET    | /api/module/:id    | Single entity  | Tenant + module.read |
| PATCH  | /api/module/:id    | Update         | Tenant + module.update (or write) |
| DELETE | /api/module/:id   | Delete         | Tenant + module.delete (or write) |

- `:id` must be validated as UUID (Zod). Reject non-UUID with 400.
- All queries must include `dealership_id` (tenant isolation).
- Responses must use serialized DTOs; never expose raw Prisma models.

---

## 8. Audit Logging

Backend must log (or already logs):

- `entity.create` on POST success
- `entity.update` on PATCH success
- `entity.delete` on DELETE success

Where “entity” is vehicle, customer, or deal as appropriate. Audit log is append-only and tenant-scoped.

---

## 9. Out of Scope (this spec)

- Nested modals or wizard flows (future spec).
- Changes to list/detail UI content beyond wiring to modal routing and data loading.
- New API endpoints; only validation, RBAC, and tenant isolation are in scope for backend hardening.

---

## 10. Deliverables Checklist (Step 1)

- [x] This architecture spec: `apps/dealer/docs/MODAL_ROUTING_ARCHITECTURE_SPEC.md`
- [ ] Step 2: Backend implementation and tests (APIs, Zod, RBAC, tenant isolation, audit).
- [ ] Step 3: Frontend implementation (ModalShell, intercepting routes, server-first data).
- [ ] Step 4: Security & QA report and tests.
- [ ] Step 5: Performance pass (no client fetch-on-mount, minimal hydration).
