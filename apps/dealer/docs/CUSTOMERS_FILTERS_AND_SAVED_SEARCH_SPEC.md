# Customers — Advanced Filters + Create Filter + Save Search (Spec)

**Project:** DMS Dealer App (`apps/dealer`)  
**Feature:** DealerCenter/Salesforce-style list views for Customers  
**Stack:** Next.js App Router (server-first), shadcn/ui, Supabase auth, Prisma/Postgres, Zod, Jest.

---

## 1. Definitions

### 1.1 Filter Definition

A **Filter Definition** is the set of **filter fields only** used to narrow the customers list. It does **not** include:

- Search text (`q`)
- Sort (sortBy / sortOrder)
- Pagination (limit / offset)

**Included fields:**

| Field         | Type   | Description |
|---------------|--------|-------------|
| `status`      | enum   | LEAD \| ACTIVE \| SOLD \| INACTIVE |
| `leadSource`  | string | Lead source value (e.g. "Website", "Walk-in") |
| `assignedTo`  | string | User ID (UUID) of assigned user |
| `lastVisit`   | string | Optional. Range spec e.g. `gt:90d`, `lt:30d`, or from/to params |
| `callbacks`   | 0 \| 1 | Optional. 1 = has open callbacks; 0 = no open callbacks (or omit = any) |

Filter definition is stored as **definitionJson** (JSONB) in SavedFilter and as the filter subset inside SavedSearch **stateJson**.

### 1.2 Saved Search / List View

A **Saved Search** (or **List View**) is the **entire view state** of the customers list:

- **q** — search text (name, email, phone, etc.)
- **Filters** — full filter definition (status, leadSource, assignedTo, lastVisit, callbacks)
- **sortBy** — whitelisted column key (e.g. created_at, updated_at, status)
- **sortOrder** — "asc" \| "desc"
- **limit** — page size (e.g. 10, 25, 50)
- **offset** — optional; usually 0 when applying a saved search
- **Optional (future):** columns visibility, density (compact/comfortable)

Stored as **stateJson** (JSONB) in SavedSearch. Applying a saved search means setting URL query params to exactly match this state (and optionally setting `savedSearchId` so "Update current…" is available).

---

## 2. URL / Query Param Contract (Server-First)

Canonical query params for `/customers` (and for serializing saved search state):

| Param       | Type   | Description |
|------------|--------|-------------|
| `q`        | string | Search text (debounced; name, email, phone). Empty = no search. |
| `status`   | enum   | LEAD \| ACTIVE \| SOLD \| INACTIVE. Omit = any. |
| `leadSource` | string | Lead source. Omit = any. |
| `assignedTo`  | string | User ID (UUID). Omit = any. |
| `lastVisit`   | string | Range: e.g. `gt:90d`, `lt:30d`, or use `lastVisitFrom` / `lastVisitTo` (ISO date or relative). Omit = any. |
| `callbacks`   | 0 \| 1 | 1 = has open callbacks; 0 = no open callbacks. Omit = any. |
| `sortBy`   | enum   | Whitelist: `created_at` \| `updated_at` \| `status`. Default `created_at`. |
| `sortOrder`| enum   | `asc` \| `desc`. Default `desc`. |
| `limit`    | number | 10 \| 25 \| 50 (or allow 1–100 with clamp). Default 10. |
| `offset`   | number | Pagination offset. Default 0. |
| `savedSearchId` | string | Optional. UUID of the currently applied saved search (for "Update current…" and display). |

- **Server:** RSC reads `searchParams`, parses with Zod (or equivalent), passes to `listCustomers` and renders list. No client fetch-on-mount; URL drives state.
- **Client:** Typing in search updates `q` via `router.replace` with debounce (e.g. 400 ms). Filter controls and saved search apply update the full param set and call `router.replace` + `router.refresh()`.

---

## 3. Component Map (Customers UI)

### 3.1 CustomersFilterSearchBar

- **Advanced Filters** — Dropdown that contains:
  - Filter controls: Status, Source (leadSource), Last Visit, Callbacks (and any future filter fields).
  - "Saved Filters" section: list of saved filters; clicking one applies **only** its definition (replaces filter params; does not change `q`, sort, or limit).
  - "Clear all" — resets all filter params (optionally keeps `q`; product decision).
- **Search input** — Type-to-filter; updates `q` with debounce; preserves other params.
- **Create Filters** — Opens Save Filter dialog (saves current filter rules only).
- **Save Search** — Dropdown: "Save as new…", "Update current…" (when `savedSearchId` present), list of saved searches to apply, "Manage…".

### 3.2 SavedFiltersMenu (inside Advanced Filters)

- Renders list of saved filters (name, optional visibility badge).
- Click item → apply that filter definition to URL (replace filter params; server re-renders).
- No persistence in this component; data from server (savedFilters catalog).

### 3.3 SaveFilterDialog

- **Inputs:** Name (required), Visibility (Personal \| Shared).
- **Actions:** Save, Cancel.
- **Save:** POST `/api/customers/saved-filters` with `{ name, visibility, definition }` (definition = current filter state only; no `q`, sort, limit). On success: toast + `router.refresh()` so dropdown gets updated list.

### 3.4 SaveSearchDialog

- **Inputs:** Name (required), Visibility (Personal \| Shared), optional "Set as default" checkbox.
- **Actions:** Save, Cancel.
- **Save:** POST `/api/customers/saved-searches` (for "Save as new…") or PATCH `/api/customers/saved-searches/[id]` (for "Update current…") with full state (q, filters, sortBy, sortOrder, limit, optional columns/density). On success: toast + `router.refresh()`; optionally navigate to URL with `savedSearchId` set.

### 3.5 SavedSearchPicker (Apply + Manage)

- **Apply:** List of saved searches; selecting one builds URL from `stateJson` (q, filters, sort, limit, offset=0) and optionally sets `savedSearchId`; then `router.replace` + `router.refresh()`.
- **Manage…** (optional): List saved searches with delete; opens in modal or inline. Delete calls DELETE `/api/customers/saved-searches/[id]`; on success refresh catalog and clear `savedSearchId` if that search was deleted.

---

## 4. Data Contracts

### 4.1 listCustomers (existing, extended)

- **Input (filters):** `status`, `leadSource`, `assignedTo`, `search` (q), and optionally `lastVisit` (range), `callbacks` (0/1). Sort: `sortBy`, `sortOrder`. Pagination: `limit`, `offset`.
- **Output:** `{ data: CustomerListItem[], total: number }` (unchanged). Pagination always enforced (limit/offset).

Extensions for lastVisit/callbacks are backend implementation details (e.g. lastVisit from activity, callbacks from tasks); the service input contract should accept the same shape as the URL param contract (whitelisted).

### 4.2 listSavedFilters

- **Input:** `dealershipId`, `userId` (from auth; never from client).
- **Output:** Array of `{ id, name, visibility, definitionJson, createdAt, updatedAt, ownerUserId? }`. Only SHARED + PERSONAL owned by `userId`. Sorted e.g. by name or updatedAt.

### 4.3 listSavedSearches

- **Input:** `dealershipId`, `userId`.
- **Output:** Array of `{ id, name, visibility, stateJson, isDefault, createdAt, updatedAt, ownerUserId? }`. Same visibility rules. Include `isDefault` for UI (e.g. badge or "Set as default" in Manage).

### 4.4 applySavedSearch (client-side behavior)

- **Input:** Saved search record (e.g. from listSavedSearches).
- **Behavior:** Build URL query from `stateJson`: set `q`, `status`, `leadSource`, `assignedTo`, `lastVisit`, `callbacks`, `sortBy`, `sortOrder`, `limit`, and `offset=0`; set `savedSearchId` to that search’s id. Then `router.replace('/customers?' + query)` and `router.refresh()`. No new API call for list data; server reads URL and re-renders.

---

## 5. RBAC Rules

- **View list / use filters / apply saved filters or saved searches:** Requires `customers.read`. List and catalog endpoints (GET saved-filters, GET saved-searches) require `customers.read`.
- **Create / update / delete SHARED saved filters or saved searches:** Requires `admin.settings.manage` (or documented alternative: `admin.permissions.manage`). Only users with this permission can create or delete SHARED items; they can update SHARED items they have access to (e.g. any shared item in the dealership).
- **Create / update / delete PERSONAL saved filters or saved searches:**
  - **Create:** Any user with `customers.read` may create a PERSONAL saved filter or saved search (owner = current user).
  - **Update / Delete:** Only the **owner** of the PERSONAL item may update or delete it. Ownership enforced by `ownerUserId`; no additional permission beyond `customers.read` for own items. User without `customers.read` cannot list or apply, so they never see the Manage/Update/Delete actions for personal items in practice.
- **Set as default (saved search):** Only the owner of a PERSONAL saved search can set it as their default; for SHARED, require `admin.settings.manage` (or document if default is per-dealership vs per-user; if per-dealership, only admin can set).

**Explicit visibility rules:**

- **PERSONAL:** Visible only to the user who created it (`ownerUserId = userId`). Only that user can update/delete.
- **SHARED:** Visible to all users in the dealership with `customers.read`. Only users with `admin.settings.manage` can create/update/delete SHARED items.

---

## 6. Audit Events

Append-only audit log (existing `auditLog`); entity and action as below. No PII in metadata (per project rules).

| Action                     | Entity      | When |
|----------------------------|------------|------|
| `saved_filter.created`     | SavedFilter | After creating a saved filter |
| `saved_filter.updated`     | SavedFilter | After updating a saved filter (if we support PATCH later) |
| `saved_filter.deleted`     | SavedFilter | After deleting a saved filter |
| `saved_search.created`     | SavedSearch | After creating a saved search |
| `saved_search.updated`     | SavedSearch | After updating a saved search |
| `saved_search.deleted`     | SavedSearch | After deleting a saved search |
| `saved_search.set_default` | SavedSearch | When a saved search is set as default |

Metadata: e.g. `savedFilterId` / `savedSearchId`, `visibility`, `name` length or hash (no full definition/state in log if it could contain sensitive filters). Prefer minimal metadata (id, visibility) to avoid storing sensitive criteria in audit.

---

## 7. Acceptance Checklist

Must match intended UX and non-negotiables:

- [ ] **Advanced filters** — Changing Status, Source, Last Visit, Callbacks (and any other filter controls) updates the list immediately via URL (params updated, server re-renders). No client fetch-on-mount for the list.
- [ ] **Create Filters** — User can save current filter rules (no q, no sort) with a name and Personal/Shared. Saved filter appears under Advanced Filters and can be applied to set URL filter params.
- [ ] **Save Search** — User can save full view state (q + filters + sort + limit + optional columns/density). "Save as new…" and "Update current…" (when a saved search is applied) work. Applying a saved search restores view by updating URL params; list loads from server based on URL.
- [ ] **No client fetch-on-mount for list** — List data comes from RSC + services using `searchParams`; client only updates URL (replace + refresh).
- [ ] **Tenant isolation** — All saved filter/saved search reads and writes scoped by `dealershipId`; never accept `dealershipId` from client.
- [ ] **RBAC** — `customers.read` required to view/apply filters and saved searches; SHARED create/update/delete requires `admin.settings.manage`; PERSONAL create by anyone with `customers.read`; PERSONAL update/delete only by owner.
- [ ] **Validation** — Zod at edge for query params and JSON bodies; sortBy/limit whitelisted; definitionJson and stateJson schemas typed.
- [ ] **Pagination** — Always enforced on list; saved search state includes limit (and offset when applied typically 0).
- [ ] **Audit** — Create/update/delete (and set_default) for saved filters and saved searches recorded as above.

---

## Summary

- **Filter Definition** = filters only (status, leadSource, assignedTo, lastVisit, callbacks); stored in SavedFilter and as part of SavedSearch state.
- **Saved Search** = full list view state (q + filters + sort + limit + optional columns/density); stored in SavedSearch.
- **URL** is the single source of truth for list state; server parses params and renders; client updates URL (debounced for q, immediate for filters/sort/limit and when applying saved filter/search).
- **Create Filters** saves a preset of filter rules; **Save Search** saves and restores full view state, with optional "Update current…" and "Set as default" and "Manage…".
