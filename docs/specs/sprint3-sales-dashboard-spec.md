# SPRINT 3 — Sales Dashboard (SPEC ONLY)

**Goal:** `/dashboard` route with five permission-gated widgets; real data for four widgets, appointments placeholder; permission gating (no fetch without permission); money via formatCents; tests for no-fetch-without-permission and tenant-scoped aggregation.

**Document type:** Specification only. No code, no Prisma, no TypeScript, no UI implementation.

**Compliance:** Multi-tenant (dealership_id on all queries), RBAC on every route, Zod at edge, pagination on lists, audit where applicable (DMS Non-Negotiables).

---

## 1) SCOPE

### In scope

- **Route:** `/dashboard` — single dashboard page with five widget areas.
- **Permission gating:** Each widget fetches data only when the user has the required permission(s). No request is sent for a widget when the user lacks the corresponding permission.
- **Widgets and required permission(s):**
  - **My Tasks:** `customers.read` OR `crm.read` — show tasks for current user (assigned to or created by).
  - **New Prospects:** `customers.read` — customers with status = LEAD.
  - **Pipeline Funnel:** `crm.read` — aggregate counts per CRM stage (opportunities per stage).
  - **Stale Leads:** `customers.read` OR `crm.read` — customers (or leads) with no activity for more than X days.
  - **Appointments:** `crm.read` — placeholder only; API stub returns empty or fixed structure.
- **Page-level access:** User must have at least one of `crm.read` or `customers.read` to see the dashboard. If the user has neither, show "No access" (or redirect); do not render dashboard or call any dashboard/widget API.

### MVP

- **Real data:** My Tasks, New Prospects, Pipeline Funnel, Stale Leads (all tenant-scoped, permission-gated).
- **Placeholder:** Appointments — stub API returns 200 with empty array or fixed structure; UI shows placeholder (e.g. "Appointments coming soon" or empty list).

### Out of scope

- Full calendar or scheduling UI.
- Appointment CRUD or real appointment data.
- Complex dashboard configuration (drag-and-drop, saved layouts, user preferences).
- Cross-tenant or platform-level analytics.

### Performance and API shape recommendation

- **Recommendation:** Single **GET /api/dashboard** (or **GET /api/dashboard/widgets**) that returns a payload with **sections** (e.g. `myTasks`, `newProspects`, `pipelineFunnel`, `staleLeads`, `appointments`). Server includes only sections for which the user has the required permission; sections the user cannot access are omitted from the response.
- **Rationale:** One round trip, simpler frontend (one load state), consistent permission enforcement on the server, and no risk of the client calling widget endpoints when it shouldn’t. Alternative: separate endpoints per widget (e.g. GET /api/dashboard/my-tasks, GET /api/dashboard/new-prospects, …); then frontend must only call each when the user has the right permission, and loading states are per widget. Spec allows either; single dashboard endpoint is recommended.

---

## 2) DATA / API CONTRACT

All endpoints or sections are tenant-scoped: `dealership_id` comes from auth/context; every query filters by it. No cross-tenant data.

### My Tasks

- **Endpoint or section key:** `myTasks` (if single dashboard response) or e.g. **GET /api/dashboard/my-tasks** (if per-widget).
- **Required permission:** `customers.read` OR `crm.read` (either suffices).
- **Semantics:** Tasks assigned to current user or created by current user, for customers (and deals) in the tenant. If the data model has no task assignee, "assigned to" is interpreted as "created by" for MVP.
- **Response shape (conceptual):** List of tasks with at least: `id`, `title`, `dueAt` (ISO date-time or null), `customerId`, `customerName` (optional), `link` (e.g. URL to customer or task context). Any monetary value (if ever added) as string cents; client uses formatCents for display.
- **Pagination:** Required (e.g. `limit`, `offset` with defaults and max; or cursor). Typical limit for widget: small (e.g. 10–20).

### New Prospects

- **Endpoint or section key:** `newProspects`.
- **Required permission:** `customers.read`.
- **Semantics:** Customers with `status = LEAD`, tenant-scoped, ordered (e.g. by `createdAt` desc).
- **Response shape:** List with at least: `id`, `name`, `createdAt`, `primaryPhone` (optional), `primaryEmail` (optional). Paginated.
- **Pagination:** `limit` (required, with default and max); `offset` or cursor as per project convention.

### Pipeline Funnel

- **Endpoint or section key:** `pipelineFunnel`.
- **Required permission:** `crm.read`.
- **Semantics:** Aggregate count of opportunities per CRM stage for the tenant. Only opportunities belonging to the authenticated user’s dealership are counted.
- **Response shape:** e.g. `stages: Array<{ stageId, stageName, count }>` or equivalent. Optionally include deal/value aggregate per stage; if so, money as string cents, display with formatCents.
- **Tenant scoping:** Counts must be strictly tenant-scoped; no inclusion of opportunities from other dealerships.

### Stale Leads

- **Endpoint or section key:** `staleLeads`.
- **Required permission:** `customers.read` OR `crm.read`.
- **Semantics:** Customers (or opportunities) with no activity for more than X days. X is configurable (e.g. 7); default (e.g. 7) and max (e.g. 90) defined in contract. "Last activity" is defined as the latest of: customer activity, notes, tasks (create/update/complete), opportunity activity — per customer (or per opportunity, if defined that way).
- **Response shape:** List with at least: `id`, `name`, `lastActivityAt` (ISO date-time or null), `daysSinceActivity` (number). Tenant-scoped. Paginated (`limit`, `offset` or cursor).

### Appointments (stub)

- **Endpoint or section key:** `appointments` or **GET /api/dashboard/appointments**.
- **Required permission:** `crm.read`.
- **Contract:** API returns 200 with body e.g. `{ data: [] }` or a fixed structure (e.g. `{ data: [], meta: {} }`). No real appointment data. Document in API contract as "stub for future appointments feature."

### Money

- Any monetary value in dashboard responses (e.g. deal value in funnel, task-related value) must be expressed in **cents** (string or number; project convention). Client MUST display all money using **formatCents** (or equivalent); no raw cents in UI labels.

### Error and response envelope

- Success: e.g. `{ data: T }` or `{ data: T[], meta: { total, limit, offset } }` per section or endpoint. For single dashboard response: e.g. `{ data: { myTasks?: …, newProspects?: …, pipelineFunnel?: …, staleLeads?: …, appointments?: … } }` with only permitted sections present.
- Error: Consistent shape `{ error: { code, message, details? } }`. 403 when user lacks required permission for the route or section.

---

## 3) RBAC + TENANT

### Page and widget access

- **Dashboard route:** To show the dashboard at all, user must have at least one of `crm.read` or `customers.read`. If user has neither → show "No access" (or redirect); do not fetch any dashboard/widget API.
- **Per-widget:** Backend includes data for a widget only if the user has the required permission for that widget. Frontend must not call a widget API (or must not expect a section) when the user lacks the corresponding permission — i.e. no fetch without permission.
- **No "admin bypass":** No special bypass of permission checks unless explicitly required elsewhere; least privilege.

### Tenant scoping rules

- Every list, get, and aggregate is scoped by `dealership_id` from auth/context (or path). No cross-tenant access.
- Pipeline funnel (and any other aggregate) must only include data for the authenticated user’s tenant. Example: create opportunities in Dealer B, request dashboard as Dealer A → funnel must not include Dealer B’s counts.
- Document in implementation: cross-tenant access is forbidden; no endpoint returns or mutates another tenant’s data.

### Sensitive reads

- Dashboard data (tasks, prospects, funnel, stale leads) is sensitive; ensure audit requirements for sensitive reads are applied if/when such audit is implemented (per DMS rules). This spec notes the requirement; no implementation here.

---

## 4) MONEY

- All monetary values in dashboard API responses: **string cents** (or number cents per project convention). No floating-point amounts.
- **Display:** Every money field is rendered in the UI using **formatCents**. Specify in API contract: "money fields as string cents"; client uses formatCents for display.

---

## 5) FRONTEND CONTRACT

- **Route:** `/dashboard` — render dashboard layout with five widget areas (placeholders/slots).
- **Permission:** If user has neither `crm.read` nor `customers.read`, show "No access" and do not call any dashboard/widget API. If user has at least one, show dashboard and only fetch (or request sections for) widgets for which the user has the required permission.
- **Per widget:** If user has permission → fetch and show data (or show corresponding section from single dashboard response). If user does not have permission → do not fetch; widget is hidden or shows a "No access" message.
- **Loading and error:** Loading and error state per widget (or global if single endpoint); empty states when data is empty (e.g. no tasks, no prospects, no stale leads).
- **Appointments widget:** Call stub API (or use stub section); show placeholder UI (e.g. "Appointments coming soon" or empty list). No real appointment data.

---

## 6) TEST REQUIREMENTS (for Step 4)

- **No fetch without permission**
  - **Frontend test:** When user has neither `crm.read` nor `customers.read`, the dashboard does not call any dashboard/widget API (no request to GET /api/dashboard or GET /api/dashboard/*).
  - **Frontend test:** When user has only `customers.read`, only widgets that require `customers.read` are fetched; widgets that require only `crm.read` (and not `customers.read`) are not fetched if the implementation distinguishes (e.g. Pipeline Funnel, Appointments stub). So: only sections/endpoints the user is allowed to see are called.
- **Aggregation tenant-scoped**
  - **Backend integration test:** Pipeline funnel (or any aggregate endpoint) returns only counts for the authenticated user’s tenant. Example: create opportunities in Dealer B; authenticate as user in Dealer A and call dashboard (or funnel endpoint); response must not include Dealer B’s counts.

---

## DELIVERABLES CHECKLIST

- [x] **1) SCOPE:** In/out of scope, MVP, performance recommendation (single GET /api/dashboard with sections).
- [x] **2) DATA / API CONTRACT:** My Tasks, New Prospects, Pipeline Funnel, Stale Leads, Appointments stub — endpoint/section, permission, response shape, pagination, tenant scoping, money as cents + formatCents.
- [x] **3) RBAC + TENANT:** Page and per-widget permission rules, tenant scoping, no cross-tenant data.
- [x] **4) MONEY:** Cents in API; formatCents in UI.
- [x] **5) FRONTEND CONTRACT:** /dashboard behavior, permission gating, loading/error/empty, appointments placeholder.
- [x] **6) TEST REQUIREMENTS:** No fetch without permission (frontend); aggregation tenant-scoped (backend integration).

**Next step:** Backend implements dashboard API(s), validation (Zod at edge), and tests; frontend implements /dashboard and widgets per this spec.
