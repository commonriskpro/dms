# Global Search — SPEC (Sprint 2)

**Module:** global-search (topbar)  
**Scope:** Single typeahead search across Customers, Deals, and Inventory. Server-side only, tenant-scoped, permission-gated.

References: DMS Non-Negotiables, Coding Standards, customers-spec, deals-spec, inventory-spec.

---

## 1) SCOPE

### 1.1 Endpoint strategy (recommendation)

**Recommendation: single aggregated endpoint** (e.g. `GET /api/search?q=...&limit=20`).

- **Rationale:** One round trip per debounced input; one loading state; one response with grouped results. Permission gating is handled server-side: the backend checks the user’s read permissions for customers, deals, and inventory, runs only the queries the user is allowed, and returns only those sections. The client does not need to know which resources the user can read before calling—it always calls the same endpoint and renders whatever types are returned.
- **Alternative (multiple endpoints):** Separate endpoints per entity would allow simpler per-resource permission checks and smaller payloads per call, but the client would need to call up to three endpoints (or branch on permissions client-side), increasing round trips and complexity for typeahead. Rejected for MVP in favor of one request and server-side permission filtering.

### 1.2 Search fields

| Entity    | Searchable fields                                      |
|-----------|--------------------------------------------------------|
| Customers | name, phone (any), email (any)                         |
| Deals     | stock number, customer name (via deal–customer link)   |
| Inventory | VIN, stock number                                      |

### 1.3 In scope

- One aggregated search API (single endpoint).
- Server-side search only (no client-side filtering of a full dataset).
- Tenant-scoped (every query filtered by `dealershipId` from auth/session).
- Permission-gated (only query and return entity types the user has read permission for).
- Typeahead-oriented: limit total results; response time target &lt; 500 ms for typical query.

### 1.4 Out of scope

- Search inside documents/files.
- Full-text search engine (e.g. Elasticsearch). MVP uses DB `LIKE`/`ILIKE` (or equivalent) on the above fields.
- Fuzzy matching or relevance ranking (MVP: deterministic match, e.g. contains).

### 1.5 Performance and scalability

- **Performance:** Response &lt; 500 ms for typical query (e.g. 2–3 DB queries, each with `dealership_id` + text condition, with limits).
- **Result caps:** Global limit (e.g. default 20, max 50) applied to the aggregated result set; optionally sub-limits per entity so no single type dominates (e.g. cap 10 per type when total cap is 20).
- **Scalability:** Multi-tenant; every query filtered by `dealershipId`; indexes on `dealership_id` and searchable columns (per existing module schemas).

---

## 2) API CONTRACT

### 2.1 Endpoint

| Method | Path           | Purpose                                      |
|--------|----------------|----------------------------------------------|
| GET    | /api/search    | Aggregated typeahead search (customers, deals, inventory). |

No request body. All inputs via query string.

### 2.2 Query parameters

| Param  | Required | Type   | Rules / semantics |
|--------|----------|--------|-------------------|
| q      | Yes      | string | Search term. Min length 2 (after trim). |
| limit  | No       | number | Total result cap across all types. Default 20, max 50. Integer, &gt; 0. |
| offset | No       | number | Pagination offset. Default 0, min 0. Integer. |

- **Validation:** Backend validates with Zod (or equivalent): `q` required, trimmed length ≥ 2; `limit` in [1, 50], default 20; `offset` ≥ 0, default 0.
- **Pagination:** Limit/offset for MVP. Total count across all types is optional (can be omitted for typeahead to keep response fast).

### 2.3 Response shape (success)

- **200 OK:** JSON body.
  - **Structure:** List of result items; each item includes:
    - `type`: discriminant — `"customer"` | `"deal"` | `"inventory"`.
    - `id`: string (UUID) — stable id for the entity.
    - Display fields (enough to render one row and to build the link):
      - **Customer:** e.g. `name`, `primaryPhone` (or first phone), `primaryEmail` (or first email).
      - **Deal:** e.g. `id`, `stockNumber`, `customerName`.
      - **Inventory:** e.g. `id`, `vin`, `stockNumber`, `yearMakeModel` (or equivalent year/make/model for display).
  - **Grouping:** Either a single flat list with `type` on each item (client groups by type for display) or a structured object with keys `customers`, `deals`, `inventory` (each an array). Spec recommends **flat list with `type`** for simplicity; client groups by `type` for the dropdown sections (Customers, Deals, Inventory).
  - **Links:** Client builds routes from `type` + `id`: `/customers/[id]`, `/deals/[id]`, `/inventory/[id]` (or existing app path conventions).

Example shape (conceptual):

- `{ data: [ { type: "customer", id: "...", name: "...", primaryPhone: "...", primaryEmail: "..." }, { type: "deal", id: "...", stockNumber: "...", customerName: "..." }, ... ], meta?: { total?: number, limit: number, offset: number } }`
- Or with grouped keys: `{ data: { customers: [...], deals: [...], inventory: [...] }, meta?: { ... } }`. Either is acceptable; document the chosen shape.

### 2.4 Response shape (errors)

- **400 Bad Request:** Missing `q` or `q` length &lt; 2 after trim; or invalid `limit`/`offset` (e.g. limit &gt; 50 or &lt; 1, offset &lt; 0). Body: consistent error shape `{ error: { code, message, details? } }`.
- **401 Unauthenticated:** No valid session. No body required beyond standard error shape.
- **403 Forbidden:** Not used for “no results”; only if the route itself is forbidden (e.g. user has no read permission for any of the three resources — then optionally 403 so client does not call again). Alternatively, return 200 with empty `data` when user has no permissions; spec recommends **200 with empty data** when user has no read permission for any type, to avoid revealing permission layout. So 403 is reserved for route-level denial if the product requires it.
- **No cross-tenant data:** Response must never include results for a different `dealershipId`. 200 must only contain the authenticated user’s tenant data.

### 2.5 Pagination and safety

- **Limit:** Default 20, max 50. Server enforces cap (e.g. 51 → 50).
- **Offset:** Min 0; integer. Invalid values yield 400.
- **Unbounded results:** Not allowed; `limit` is always applied.

---

## 3) RBAC + TENANT

### 3.1 Permissions

- Search results **respect read permissions** per resource:
  - **customers.read:** Include customer matches in the response; if absent, do not query customers and do not return any customer items.
  - **deals.read:** Include deal matches; if absent, do not query deals and do not return any deal items.
  - **inventory.read:** Include inventory matches; if absent, do not query inventory and do not return any inventory items.
- If the user has **no** read permission for any of the three, the backend does not query any of the three and returns an empty result set (200 with empty `data`). No “admin bypass”; least privilege.

### 3.2 Tenant scoping

- **dealershipId** comes from auth/session only (or from path if the app already resolves tenant from path). Never from request body or client-controlled input for scoping.
- Every query (customers, deals, inventory) is filtered by that `dealershipId`. No cross-tenant results; no endpoint returns or mutates another tenant’s data.

### 3.3 IDOR

- Search does not expose a direct resource-by-id access; IDOR risk is low. Mitigation: search only returns rows where `dealership_id` matches the authenticated user’s tenant. No need to validate resource id against tenant on this endpoint because results are already tenant-scoped.

---

## 4) SEARCH BEHAVIOR

### 4.1 Server-side only

- All matching is done on the server. Client sends `q` (and optional `limit`/`offset`) and receives a filtered list. No client-side filtering of a full dataset.

### 4.2 Matching (conceptual)

- **Customers:** Match when `q` (trimmed, case-insensitive) appears in: customer name, or any associated phone value, or any associated email value. Implementation: e.g. `ILIKE %q%` on name and on joined phone/email values (or equivalent).
- **Deals:** Match when `q` appears in deal stock number or in the related customer’s name (e.g. join deal → customer, `ILIKE %q%` on stock number and customer name).
- **Inventory:** Match when `q` appears in VIN or stock number (`ILIKE %q%` or equivalent).
- No fuzzy or ranking requirement for MVP; ordering can be natural (e.g. by relevance such as “starts with” first, or by created/updated date) or left implementation-defined.

### 4.3 Empty or short query

- If `q` is missing or length after trim &lt; 2: return **400 Bad Request** (do not run search). Do not return an empty result set for invalid input.

---

## 5) FRONTEND CONTRACT (for Step 3)

- **Input:** Single search input in the topbar. Debounce 300 ms; on committed input (after 300 ms idle), send `GET /api/search?q=<value>&limit=20` (and `offset` if pagination is used).
- **Output:** Typeahead dropdown:
  - Grouped or flat list by type: Customers, Deals, Inventory (each section shows items of that type).
  - Each row is keyboard focusable; arrow keys move focus; Enter selects and navigates to the entity (e.g. `/customers/[id]`, `/deals/[id]`, `/inventory/[id]`).
- **No API call when:** User has no read permission for any of customers, deals, or inventory — client must not send the request (e.g. hide search or disable it). Permission can be known from session/bootstrap or a small permissions endpoint.
- **States:** Loading (show spinner/skeleton), error (show message or retry), empty (no results message).

---

## 6) INTEGRATION TEST REQUIREMENTS (for Step 4)

- **Tenant isolation:** User in Dealer A must not see Dealer B’s customers, deals, or inventory in search results. Assert: search as Dealer A user with a known term that exists only for Dealer B returns no matches for that data.
- **Permission gating:** User without `customers.read` must not receive customer results; backend must not run the customers search when the user lacks that permission. Similar for `deals.read` and `inventory.read`. Assert: with permissions selectively removed, response contains only the types the user is allowed to read.
- **Limit and offset safety:** Request with `limit=51` is capped to 50; `offset=-1` or invalid `limit` returns 400. No unbounded result set for any valid or invalid input.

---

## Deliverables checklist

- [x] SCOPE: Single aggregated endpoint; search fields defined; in/out of scope; performance and scalability notes.
- [x] API CONTRACT: Path, method, query params; request/response and error shapes; pagination and safety.
- [x] RBAC + TENANT: Permission rules per resource; tenant from auth; no cross-tenant data; IDOR note.
- [x] SEARCH BEHAVIOR: Server-side only; matching concept; empty/short query → 400.
- [x] FRONTEND CONTRACT: Input (debounce, params); output (dropdown, keyboard); when not to call API; loading/error/empty.
- [x] INTEGRATION TEST REQUIREMENTS: Tenant isolation, permission gating, limit/offset safety.

**Next step:** Backend implements search API, validation (Zod at edge), and tests (RBAC + tenant isolation + limit/offset).
