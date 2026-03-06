# Step 4 — Security & QA: Customers Route Report

**Target:** `apps/dealer/app/api/customers/route.ts` (GET + POST)  
**Date:** 2026-03-04

## Summary

Security and QA hardening was applied to the Customers API route. All non-negotiables were verified or enforced: tenant isolation, RBAC (DealerCenter union + overrides), Zod validation, pagination, audit logging, and abuse protections. New Jest tests were added; rate limiting and body size limits were implemented.

---

## 1. Tests Added

### 1.1 Unit tests (`app/api/customers/route.test.ts`)

- **Rate limit 429**
  - GET returns 429 when `checkRateLimit(customers_list)` is false.
  - POST returns 429 when `checkRateLimit(customers_create)` is false.

Run: `npm -w apps/dealer run test -- app/api/customers/route.test.ts`

### 1.2 Integration tests (`app/api/customers/route.integration.test.ts`)

Require `TEST_DATABASE_URL` and `SKIP_INTEGRATION_TESTS` not set.

- **RBAC**
  - GET without `customers.read` → 403 FORBIDDEN.
  - POST without `customers.write` → 403 FORBIDDEN.
  - Override `enabled=false` removes `customers.read` (role-granted) → GET 403.
  - Override `enabled=true` grants `customers.read` (not in role) → GET 200.
- **Tenant isolation**
  - Customer created in Dealer A does not appear in Dealer B GET list/search.
  - POST as Dealer B creates customer scoped to Dealer B; body cannot set `dealershipId`.
- **Validation**
  - Invalid query: `limit` > 100 → 400 VALIDATION_ERROR.
  - Invalid query: `sortBy` not in whitelist (e.g. `name`) → 400.
  - POST missing `name` → 400.
  - POST invalid `emails`/`phones` (e.g. wrong type, empty value) → 400.
  - POST with `content-length` > 100KB → 413 PAYLOAD_TOO_LARGE.
- **Pagination**
  - GET returns `meta.total`, `meta.limit`, `meta.offset`; `limit` is respected (e.g. 2 → at most 2 items).
- **Audit**
  - POST creates `customer.created` audit log row; metadata includes `customerId` and `status` only (no PII: no name, email, phone in metadata).

Run: `npm -w apps/dealer run test -- app/api/customers/route.integration.test.ts` (with `TEST_DATABASE_URL` for integration).

---

## 2. Results

- **Unit tests:** 2/2 passed (rate limit 429 for GET and POST).
- **Integration tests:** 14 tests defined; run when `TEST_DATABASE_URL` is set. Without it, the suite is skipped (by design).

---

## 3. Handler/Schema Changes

### 3.1 Route (`route.ts`)

- **`dynamic = "force-dynamic"`** — Ensures no cross-tenant caching (tenant API rule).
- **Rate limiting**
  - GET: `customers_list` — key `customers:{dealershipId}:{userId}`, limit 120/min.
  - POST: `customers_create` — same key shape, limit 30/min.
  - Returns 429 with `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }` when over limit.
- **Body size**
  - POST rejects when `content-length` > 100KB with 413 and `{ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } }`.
  - Check is done before parsing JSON.

### 3.2 Rate limit module (`lib/api/rate-limit.ts`)

- New types: `customers_list`, `customers_create`.
- Limits: 120/min for list, 30/min for create (per user + dealership key).

### 3.3 Schemas

- No change. Already in place:
  - `listCustomersQuerySchema`: `sortBy` enum `["created_at", "updated_at", "status"]`, `limit` 1–100, `offset` ≥ 0.
  - `createCustomerBodySchema`: no `dealershipId`; `name` required; phone/email validated.

---

## 4. Hardening Check

| Check | Status |
|-------|--------|
| `listCustomersQuerySchema` whitelists `sortBy` | Yes — enum `created_at` \| `updated_at` \| `status`. |
| `listCustomersQuerySchema` caps `limit` | Yes — max 100, default 25. |
| Unbounded list prevented | Yes — limit required (default 25), max 100. |
| `customerService.listCustomers` always scoped by `dealershipId` | Yes — first argument is `dealershipId`; DB layer uses it in `where`. |
| `customerService.createCustomer` always scoped by `dealershipId` | Yes — first argument is `dealershipId`; DB uses it in `create`; body has no `dealershipId`. |
| Audit metadata for `customer.created` avoids PII | Yes — only `customerId` and `status` in metadata; no name/email/phone. |

---

## 5. Running Tests from Repo Root

```bash
# Unit tests (no DB)
npm -w apps/dealer run test -- app/api/customers/route.test.ts

# Integration tests (requires TEST_DATABASE_URL)
npm -w apps/dealer run test -- app/api/customers/route.integration.test.ts

# All customers API tests
npm -w apps/dealer run test -- app/api/customers/
```

---

## 6. Manual Test Checklist (PR)

- [ ] GET /api/customers without `customers.read` → 403.
- [ ] POST /api/customers without `customers.write` → 403.
- [ ] GET with valid auth returns paginated list and `meta.total`/`limit`/`offset`.
- [ ] POST with valid body creates customer and returns 201; audit log has `customer.created` without PII in metadata.
- [ ] Creating customer as Dealer A and listing as Dealer B does not show that customer.
- [ ] Sending `content-length` > 100KB on POST returns 413 (e.g. via devtools or curl).
- [ ] Invalid query (e.g. `limit=101`, `sortBy=name`) returns 400 with validation details.
- [ ] Invalid body (e.g. missing `name`, invalid email/phone) returns 400.
