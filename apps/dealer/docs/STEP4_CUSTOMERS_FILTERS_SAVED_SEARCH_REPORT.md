# Step 4 — Customers Filters & Saved Search: Security & QA Report

**Feature:** Advanced Filters + Create Filter + Save Search (Customers list)  
**Spec:** `apps/dealer/docs/CUSTOMERS_FILTERS_AND_SAVED_SEARCH_SPEC.md`

---

## 1. RBAC Verification

### Requirements (from spec)

- **customers.read** required to view/apply saved filters and saved searches (list and apply).
- **admin.settings.manage** required to create/update/delete **SHARED** saved filters and saved searches.
- **PERSONAL** items: any user with **customers.read** may create; only the **owner** may update/delete (no extra permission).

### Implementation

| Area | Implementation |
|------|----------------|
| **List (GET)** | All routes call `guardPermission(ctx, "customers.read")` before calling the service. |
| **Create filter** | Route requires `customers.read`; service rejects SHARED create when `!permissions.includes("admin.settings.manage")`. |
| **Create search** | Same as filter. |
| **Delete filter** | Service: SHARED → requires `admin.settings.manage`; PERSONAL → requires `existing.ownerUserId === userId`. |
| **Update/Delete search** | Same pattern; set-default enforces owner for PERSONAL, admin for SHARED. |

### Tests

- **Integration (with DB):**  
  - User without `admin.settings.manage` cannot create SHARED saved filter (FORBIDDEN).  
  - User with `admin.settings.manage` can create SHARED saved filter.  
  - User cannot delete another user’s PERSONAL saved filter (FORBIDDEN).  
  - Owner can delete own PERSONAL saved filter.  
- **Catalog scope:** `listSavedSearches` returns only items for the same dealership; applying a saved search uses only catalog data from the current tenant (no RBAC bypass).

---

## 2. Tenant Isolation

### Requirements

- All DB access scoped by `dealershipId`.
- Access by ID returns NOT_FOUND across dealerships (no cross-tenant data).

### Implementation

- **DB layer:** Every function in `modules/customers/db/saved-filters.ts` and `saved-searches.ts` takes `dealershipId` and uses it in all `where` clauses (`findMany`, `findFirst`, `create`, `update`, `deleteMany`).
- **API:** `dealershipId` comes only from `getAuthContext(request)` (session/dealership context); never from query or body.
- **Services:** Pass through `dealershipId` from route context; no client-supplied tenant id.

### Tests

- **Integration (with DB):**  
  - `getSavedFilterById(dealerB, createdByDealerA.id)` returns `null`.  
  - `getSavedSearchById(dealerB, createdByDealerA.id)` returns `null`.  
  - `deleteSavedFilter(dealerB, userAdmin, filterIdFromDealerA, perms)` throws NOT_FOUND.  
- **Catalog:** `listSavedSearches(dealerB, userId)` does not include saved searches created for dealer A.

---

## 3. Validation (Zod)

### Requirements

- Zod at the edge for all inputs (query params and JSON bodies).
- sortBy whitelist; limit bounds; definitionJson and stateJson typed.

### Implementation

- **saved-schemas.ts**  
  - **Filter definition:** `status` (enum), `leadSource` (max 500), `assignedTo` (UUID), `lastVisit` (max 100), `callbacks` (0 | 1).  
  - **stateJson:** `q` (max 1000), `status` (enum), `leadSource`, `assignedTo`, `lastVisit`, `callbacks`, `sortBy` (`created_at` \| `updated_at` \| `status`), `sortOrder` (asc/desc), `limit` (1–100), `offset` (≥ 0), optional `columns`/`density`.  
  - **createSavedFilterBodySchema:** name (1–200), visibility (PERSONAL \| SHARED), definition.  
  - **createSavedSearchBodySchema / updateSavedSearchBodySchema:** name, visibility, state, isDefault (optional).  
- **Routes:** All POST/PATCH bodies parsed with the above schemas; invalid payloads return 400 with validation error shape.  
- **ID params:** `parseUuidParam(id)` for saved-filters/[id] and saved-searches/[id].

### Tests

- **Unit (no DB):**  
  - `stateJsonSchema.parse({ sortBy: "invalid_column" })` throws.  
  - `stateJsonSchema.parse({ limit: 500 })` throws.  
  - Valid stateJson (q, status, sortBy, sortOrder, limit, offset) is accepted.

---

## 4. Pagination & URL Params

### Requirements

- Customers list always paginated (limit/offset).
- URL params preserved when only `q` (search) changes (e.g. debounced typing).

### Implementation

- **Customers list:** RSC uses `listCustomers(dealershipId, { limit, offset, filters, sort })`; limit/offset from `searchParams` with defaults and clamp (page already enforced).
- **Saved search state:** stateJson includes `limit` and `offset`; applying a saved search sets full query (including limit, offset=0).
- **buildCustomersQuery:** Builds query string from full params (limit, offset, sortBy, sortOrder, status, leadSource, assignedTo, q, savedSearchId); client uses it for every navigation so all params are preserved when only one (e.g. q) changes.

### Tests

- **Unit:**  
  - `buildCustomersQuery({ limit: 25, offset: 50, sortBy, sortOrder })` includes `limit=25` and `offset=50`.  
  - `buildCustomersQuery(params)` with limit, offset, sortBy, sortOrder, status, q preserves all of them in the output.

---

## 5. Commands Run

All from **repository root** (monorepo rules).

```bash
# Unit + integration tests (saved filters/searches)
npm -w dealer run test -- --testPathPatterns=saved-filters

# With integration DB (when TEST_DATABASE_URL set and SKIP_INTEGRATION_TESTS unset)
npm run test:dealer:integration
```

### Results (saved-filters test file)

- **Without DB:** 5 unit tests run (stateJson validation + buildCustomersQuery); 9 integration tests skipped.  
- **With DB:** 14 tests total; 9 integration (tenant isolation, RBAC, saved search catalog scope) + 5 unit.  
- **Outcome:** All run tests passed.

---

## 6. Checklist vs Spec Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Advanced filters update list via URL (server re-renders) | Yes |
| Create Filters saves preset; appears under Advanced Filters | Yes |
| Save Search saves full view; apply restores URL/state | Yes |
| No client fetch-on-mount for list; URL drives state | Yes |
| Tenant isolation (dealershipId scoped; no client dealershipId) | Yes |
| RBAC (customers.read for list/apply; admin.settings.manage for SHARED; PERSONAL owner for update/delete) | Yes |
| Validation (Zod at edge; sortBy/limit whitelisted; definitionJson/stateJson typed) | Yes |
| Pagination enforced on list | Yes |
| Audit (saved_filter.* / saved_search.* create/update/delete/set_default) | Yes |

---

## 7. Known Follow-ups / Optional Enhancements

- **lastVisit / callbacks:** In URL and stateJson schema; not yet applied in `listCustomers` (backend can add activity/task-based filters later).  
- **AssignedTo in Advanced Filters:** Chip and clear exist; dropdown for “Assigned to” user could be added (e.g. from memberships) for consistency.  
- **Default list view on load:** If a user has a default saved search, the RSC could read it and redirect or merge params on first load (not implemented).  
- **Rate limiting:** Saved filter/search API routes do not add specific rate limits beyond any app-wide middleware; can be added if needed.

---

## 8. Files Touched in Step 4

- **modules/customers/tests/saved-filters-searches.integration.test.ts** — Added: “saved search apply does not bypass RBAC” (listSavedSearches dealership scope); “buildCustomersQuery (URL params)” (limit/offset included, all params preserved).
- **apps/dealer/docs/STEP4_CUSTOMERS_FILTERS_SAVED_SEARCH_REPORT.md** — This report.

No changes to routes, services, or UI in Step 4; verification and tests only.
