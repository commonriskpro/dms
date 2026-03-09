# Saved-Filters Stabilization + Vendor Management V1 — Spec

**Program:** Saved-Filters Stabilization + Vendor Management V1  
**Step:** Architect (Step 1)  
**Goal:** (1) Fix the remaining saved-filters failure and restore repo confidence; (2) Implement Vendor Management V1 as a practical extension of the cost-ledger system.

---

## PHASE 1 — Saved-Filters Stabilization

### 1. Root cause of the current saved-filters failure(s)

- **Failing test:** `modules/customers/tests/saved-filters-searches.integration.test.ts`, describe block **"buildCustomersQuery (URL params)"** (2 tests).
- **Error:** `TypeError: buildCustomersQuery is not a function`.
- **Cause:** The test does `const { buildCustomersQuery } = require("@/modules/customers/ui/CustomersPageClient");` and calls `buildCustomersQuery(...)`. The module `CustomersPageClient.tsx` does **not** export any function named `buildCustomersQuery`. The client builds URLs inline using `buildQueryString` from `@/lib/url/buildQueryString` with ad-hoc param objects. The test was added (per STEP4_CUSTOMERS_FILTERS_SAVED_SEARCH_REPORT) to assert that "buildCustomersQuery" includes limit/offset and preserves all params; the implementation of that helper was never added (or was refactored out) and the test was not updated.
- **URL vs state shape:** The customers **page** uses `page` and `pageSize` in the URL (see `parseSearchParams` in `app/(app)/customers/page.tsx`). Saved-search **stateJson** uses `limit` and `offset` (see `stateJsonSchema` in `app/api/customers/saved-schemas.ts`). So any "build customers query" helper that builds a URL from state-like params must map `limit`/`offset` → `page`/`pageSize` (page = floor(offset/limit)+1, pageSize = limit) so the server continues to receive the shape it expects.

### 2. Fix type: implementation + test alignment

- **Implementation:** Add and export a function that builds the customers list URL query string from the param shape the test (and saved-search apply flow) expect. Use it where the client builds list URLs so all params are preserved.
- **Test:** Keep the describe block; align expectations with the actual URL contract (page/pageSize). No removal of the test; only adjust expected keys/values so they match the function’s output and the server’s contract.

### 3. Exact touched files/helpers

| Location | Change |
|----------|--------|
| `modules/customers/ui/CustomersPageClient.tsx` | Add a named export `buildCustomersQuery(params)` that accepts `{ limit?, offset?, sortBy?, sortOrder?, status?, leadSource?, assignedTo?, q?, savedSearchId? }`, maps limit/offset to page/pageSize, and returns the query string via `buildQueryString`. Use it inside the client where list URLs are built (e.g. `buildPaginatedUrl` / `pushFilters`) so navigation preserves params. |
| `modules/customers/tests/saved-filters-searches.integration.test.ts` | In "buildCustomersQuery (URL params)": (1) First test — expect the returned string to include `page=` and `pageSize=` with values derived from limit/offset (e.g. limit=25, offset=50 → page=3, pageSize=25). (2) Second test — same; expect page, pageSize, sortBy, sortOrder, status, q (and optional leadSource, assignedTo, savedSearchId if present). No change to other describe blocks. |

### 4. Minimal safe fix path

1. Implement `buildCustomersQuery` in `CustomersPageClient.tsx`:
   - Input: object with optional `limit`, `offset` **or** `page`, `pageSize`, plus optional `sortBy`, `sortOrder`, `status`, `leadSource`, `assignedTo`, `q`, `savedSearchId`. (Callers can pass either state-style limit/offset or URL-style page/pageSize.)
   - If `limit`/`offset` are provided, compute `page = Math.max(1, Math.floor((offset ?? 0) / (limit ?? 25)) + 1)` and `pageSize = limit ?? 25`. If `page`/`pageSize` are provided instead, use them.
   - Build record: `{ page, pageSize, sortBy, sortOrder, status, leadSource, assignedTo, q, savedSearchId }` (omit undefined/empty).
   - Return `buildQueryString(record)`.
2. Export `buildCustomersQuery` from `CustomersPageClient.tsx`.
3. Refactor `buildPaginatedUrl` and `pushFilters` (or equivalent) to use `buildCustomersQuery` with the same param set the page uses (page, pageSize, etc.) so behavior is unchanged and all params are preserved.
4. Update the two tests in "buildCustomersQuery (URL params)" to assert on `page` and `pageSize` (and other params) instead of `limit` and `offset`.

### 5. Acceptance criteria (Phase 1)

- The two failing tests in "buildCustomersQuery (URL params)" pass.
- No regression to customer list query behavior: URL shape and server parsing remain as today (page, pageSize, sortBy, sortOrder, status, leadSource, assignedTo, q, savedSearchId).
- No unrelated route/auth/RBAC changes.
- No broad search or filter redesign.

---

## PHASE 2 — Vendor Management V1

### 1. Vendor model

Vendor is a **dealership-scoped**, reusable entity for cost-ledger workflows. Recommended fields:

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID | ✓ | PK, default uuid() |
| dealershipId | UUID | ✓ | Tenant scope, FK Dealership |
| name | String | ✓ | Vendor name, e.g. "Auction Co" |
| type | Enum | ✓ | Vendor type (see §3) |
| contactName | String? | — | Optional contact |
| phone | String? | — | Optional |
| email | String? | — | Optional |
| address | String? | — | Optional (single line or JSON; keep simple in V1) |
| notes | String? | — | Optional |
| isActive | Boolean | ✓ | Default true; soft "hide" without delete |
| createdAt | DateTime | ✓ | |
| updatedAt | DateTime | ✓ | |
| deletedAt | DateTime? | — | Soft delete |
| deletedBy | UUID? | — | Optional |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, isActive])`, `@@index([dealershipId, type])`.  
**Relations:** Dealership; optional relation from VehicleCostEntry (vendorId → Vendor).

### 2. Cost-entry integration (hybrid)

- **VehicleCostEntry:** Add optional `vendorId` (UUID?, FK Vendor, nullable). Keep existing `vendorName` (String?, nullable).
- **Rule:** Structured vendor is preferred: when the user selects a vendor from the picker, set `vendorId` and optionally set `vendorName` from the vendor’s name (for display/fallback). When the user does not select a vendor or uses free text, set `vendorId = null` and `vendorName` to the entered text (or null).
- **Display:** Show vendor as `Vendor.name` when `vendorId` is set; otherwise show `vendorName`; if both null, show "—" or "No vendor".
- **V1:** Free-text fallback remains allowed for speed and backwards compatibility. No validation that forces a structured vendor.
- **Soft-deleted vendors:** Exclude vendors where `deletedAt` is set from list and picker results by default. Existing cost entries that reference a soft-deleted vendor (vendorId set) must still render their vendor identity safely: prefer stored `vendorName` when present; otherwise show the vendor’s name from the Vendor row (e.g. "Vendor name (inactive)" or the name as stored) so the entry remains understandable. No hard delete of vendor rows that are still referenced.

### 3. Vendor types

Controlled set (enum), e.g.:

- auction  
- transporter  
- repair  
- parts  
- detail  
- inspection  
- title_doc  
- other  

Store as Prisma enum or string with whitelist in API/serializer.

### 4. UI scope

**In scope:**

- **Vendor list page** — Table/list: name, type, contact (name or phone/email), basic usage signal if available (e.g. count of cost entries), actions (view, edit). Use existing design system and tokens.
- **Vendor create/edit** — Simple form: name, type, contactName, phone, email, address (single line or textarea), notes, isActive. No overbuilt settings.
- **Vendor detail page** — Basic vendor info; optional section "Recent cost entries" (linked vehicle cost entries) if low-risk and directly useful. Keep compact and operational.
- **Cost-ledger integration** — In the vehicle cost entry form (add/edit): vendor **picker** (search/select); allow **vendorName** fallback (free text) when no structured vendor is chosen. Keep add/edit cost entry flow simple; no redesign of the cost-ledger section.

**Out of scope:**

- Vendor accounting, balances, statements, contracts.
- OCR, approval workflows, portals.
- Advanced analytics or global procurement tooling.

### 5. Integration rules

- **Vendor picker:** Appears in the vehicle cost entry add/edit form (modal or inline form). User can search/select a vendor from the list (dealership-scoped) or leave empty and type into "Vendor name" (free text). When a vendor is selected, prefill or lock display name from Vendor; still allow saving as vendorId + vendorName (vendor name copied) for consistency.
- **vendorName fallback:** Allowed whenever the user does not select a structured vendor. API and DB accept vendorId null and vendorName set to any string (or null).
- **Quick-create vendor:** Optional: small "Create vendor" path from the picker (e.g. modal or inline) that creates a minimal vendor and then selects it. If implemented, keep it minimal (name + type required; rest optional).
- **Existing cost entries:** Display vendor as Vendor.name if vendorId present and resolvable, else vendorName, else "—". No data migration required for existing rows (vendorName-only entries remain as-is).
- **Vendor detail:** "Recent cost entries" or "Linked cost entries" — list cost entries for this vendor (vehicleId, vehicle summary, amount, date) with optional link to vehicle/cost ledger. Limit (e.g. 25); no full history analytics in V1.

### 6. API / backend plan

- **Vendor CRUD:**  
  - `GET /api/vendors` — List vendors (dealership-scoped), **excluding soft-deleted by default** (`deletedAt` null). Optional search (name), optional filter by type, pagination (limit/offset, max 100).  
  - `GET /api/vendors/[id]` — Single vendor (dealership-scoped); 404 if wrong tenant.  
  - `POST /api/vendors` — Create vendor (dealershipId from session; body: name, type, contactName?, phone?, email?, address?, notes?, isActive?).  
  - `PATCH /api/vendors/[id]` — Update vendor (same fields).  
  - `DELETE /api/vendors/[id]` — Soft delete (set deletedAt/deletedBy) or hard delete; prefer soft for audit.
- **Vendor list/search for picker:** Reuse `GET /api/vendors` with optional `q` (search by name) and `type`, limit (e.g. 20) for picker.
- **Cost-entry support:**  
  - Extend VehicleCostEntry API (POST/PATCH) to accept `vendorId` (optional UUID) and `vendorName` (optional string).  
  - When vendorId is provided, validate it belongs to the same dealership and exists; optionally copy Vendor.name into vendorName for display.  
  - When only vendorName is provided, set vendorId = null.  
  - GET cost-entries response includes vendorId and vendorName; optionally include vendor summary (name) when vendorId is set.
- **Serializers:** Add vendor to API response shapes (vendor id, name, type) where needed; cost entry response includes vendorId, vendorName, and optionally vendor: { id, name }.

### 7. Slice plan with acceptance criteria

- **SLICE A — Combined spec**  
  - Deliverable: This spec approved.  
  - Acceptance: Spec defines Phase 1 fix path and Phase 2 vendor scope, model, integration, API, and slices.

- **SLICE B — Saved-filters stabilization**  
  - Scope: Phase 1 only.  
  - Tasks: Implement `buildCustomersQuery`; export from CustomersPageClient; use it in client URL building; update the two integration tests to expect page/pageSize and other params.  
  - Acceptance: Saved-filters "buildCustomersQuery (URL params)" tests pass; no customer list/query regression.

- **SLICE C — Vendor backend (model, services, routes)**  
  - Scope: Vendor Prisma model + migration, vendor db layer, vendor service, vendor CRUD/list APIs, RBAC (e.g. inventory.read or dedicated vendors.read/write), VehicleCostEntry vendorId + vendorName support in cost-entry APIs.  
  - Acceptance: Vendors are tenant-scoped; CRUD and list work; cost entries can be created/updated with vendorId and/or vendorName; existing vendorName-only entries unchanged.

- **SLICE D — Vendor UI (list, detail, create, edit)**  
  - Scope: Vendor list page, vendor detail page, vendor create/edit form. Use existing design system and tokens.  
  - Acceptance: List shows name, type, contact, usage hint; detail shows info and optional recent cost entries; create/edit persist correctly; no raw color classes; operational feel.

- **SLICE E — Cost-ledger vendor integration**  
  - Scope: Vendor picker in vehicle cost entry form; vendorId + vendorName in form submit; display vendor (Vendor.name or vendorName) in cost entry list/detail. Optional quick-create vendor from picker.  
  - Acceptance: User can select a vendor or enter free text; saved entries show correct vendor; no redesign of cost-ledger section.

- **SLICE F — Tests, docs, hardening**  
  - Scope: Focused tests for saved-filters fix; vendor routes/services/UI tests; cost-entry vendor integration tests; security/perf/final reports.  
  - Acceptance: Tests pass; docs and reports complete; any unrelated failures documented.

### 8. Risks (both phases)

| Risk | Mitigation |
|------|------------|
| Saved-filters fix causes query regressions | Use same page/pageSize contract; no change to parseSearchParams beyond what’s needed for buildCustomersQuery input; run existing customer list tests. |
| Overbuilding vendor management | Strict V1 scope: list, detail, create, edit, picker, cost-entry linkage only. No AP, statements, contracts. |
| Vendor duplication | Allow same name across vendors in V1; optional future dedupe or "merge" not in scope. |
| Broken cost-entry compatibility | Hybrid model: vendorId optional, vendorName fallback; existing entries remain valid; API accepts both. |
| Cross-tenant vendor/cost exposure | All vendor and cost-entry APIs scope by ctx.dealershipId; no client-supplied dealershipId. |
| Picker UX too heavy | Picker: search + list; optional quick-create; keep modal/form simple. |

---

## Design lock

- **Phase 1:** Fix the saved-filters issue narrowly and safely; restore green tests and URL/query behavior.
- **Phase 2:** Vendor Management V1 is a practical extension of the cost ledger: structured, reusable, lightweight, operational. No accounting or payables scope.

No app code in Step 1.
