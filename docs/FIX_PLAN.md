# DMS Audit — Prioritized Fix Plan

**Execution order:** Step 1 (this plan) → Step 2 Backend → Step 3 Frontend → Step 4 Security & QA.

---

## P0 — Blocking / compliance

### 1. Workspace dependency (platform)

- **Issue:** Platform uses `@dms/contracts` (transpilePackages + imports) but does not declare it in package.json. Constraint: no relying on hoisting.
- **File:** `apps/platform/package.json`
- **Change:** Add `"@dms/contracts": "file:../../packages/contracts"` to dependencies.
- **Verification:** From root: `npm ci` then `npm -w apps/platform run build`.

### 2. Auth / cookie (platform)

- **Status:** Already fixed. `apps/platform/lib/supabase/server.ts` uses `cookieStore.getAll()` with no filtering. No code change unless regression found.
- **Verification:** Login on /platform/login → redirect to /platform and persists on refresh.

### 3. Route compliance (backend)

- **Scope:** All API routes in dealer and platform.
- **Tasks (Step 2):**
  - Ensure auth before business logic; RBAC where required.
  - Ensure tenant scoping (dealership_id) on every dealer tenant query.
  - Ensure Zod at edge for params, query, body.
  - Ensure list endpoints have pagination + hard cap.
  - Consistent error envelopes; no internal leak.
- **Files:** Per-route in `apps/dealer/app/api/**/route.ts`, `apps/platform/app/api/**/route.ts`; shared in `lib/api/validate.ts`, `lib/api/pagination.ts`, `lib/api-handler.ts`, contracts schemas.

### 4. Service layer (dealer)

- **Tasks:** Services must require `dealershipId` (and permissions where needed); no optional dealershipId that allows cross-tenant; money in cents; Prisma unique clauses correct.
- **Files:** `apps/dealer/modules/*/service/*`, `apps/dealer/lib/*`.

---

## P1 — High priority

### 5. Platform routes missing Zod (if any)

- **Audit:** Applications approve route, applications [id] GET (params only), bootstrap body, etc. All must validate with Zod (contracts or local schema).
- **Files:** Platform API routes that read body/query/params without schema parse.

### 6. Dealer list pagination audit

- **Audit:** Every GET list (customers, deals, inventory, crm opportunities, reports, audit, admin list, etc.) must use limit/offset or cursor and a max cap.
- **Files:** Dealer list route handlers and `lib/api/pagination.ts`.

### 7. Jest tests for non-negotiables

- **Add/expand:** RBAC deny tests, tenant isolation tests, validation abuse tests (invalid UUID, oversized body, wrong type), pagination cap tests.
- **Keep:** test:heavy for heavy suites; deterministic; no OOM.
- **Files:** New or existing `*.test.ts` / `*.rbac.test.ts` in dealer and platform.

---

## P2 — Security & QA (Step 4)

### 8. Tenant isolation tests

- **Action:** Where feasible, tests that attempt cross-tenant read/write return 403 or 404.
- **Files:** Dealer API tests; platform (platform is single-tenant, no cross-dealership in same DB).

### 9. Rate limiting

- **Action:** Confirm auth endpoints and sensitive endpoints have rate limiting; add if missing.
- **Files:** `lib/api/rate-limit.ts`, route handlers (dealer); platform auth routes.

### 10. Log hygiene

- **Action:** Ensure tokens, cookies, Authorization headers never logged; sanitizeErrorForLog / redact consistent.
- **Files:** `lib/logger.ts`, `lib/redact.ts`, error handlers in both apps.

### 11. Step 4 reports

- **Deliverables:** STEP4_AUDIT_SMOKE_REPORT.md, STEP4_AUDIT_SECURITY_REPORT.md, STEP4_AUDIT_TEST_REPORT.md, STEP4_AUDIT_PERF_NOTES.md.

---

## P3 — Frontend (Step 3)

### 12. Next 16 / React 19

- **Action:** Fix server/client boundary if any; no fetch-on-mount when server provides data; correct noStore/force-dynamic where policy requires.
- **Files:** Page/layout components in dealer and platform.

### 13. Login and redirect

- **Action:** After login, redirect to intended page; avoid loops; distinct “not authorized” vs “not logged in.”
- **Files:** Platform login page; auth callback; layout redirect.

### 14. Bundle / performance

- **Action:** Avoid heavy client imports; router.replace where appropriate; no behavior change beyond fixes.

---

## Verification commands (recap)

| Phase | Commands |
|-------|----------|
| **Step 1 gate** | Plan complete; high-risk areas and verification commands documented (AUDIT_STACK_REPORT, FIX_PLAN). |
| **Step 2 gate** | `npm ci` → `npm -w packages/contracts run build` → `npm -w apps/platform run build` → `npm -w apps/dealer run build` → `npm -w apps/platform run test:ci` → `npm -w apps/dealer run test` (or test:ci). |
| **Step 3 gate** | Same builds; Jest for touched areas. |
| **Step 4 gate** | `npm ci` → `npm -ws run lint --if-present` → `npm -ws run test --if-present` → `npm -ws run build --if-present`. |

---

## Exact files to touch (minimal first pass)

1. **apps/platform/package.json** — add @dms/contracts dependency.
2. **apps/dealer/app/api/** and **apps/platform/app/api/** — only where audit finds missing validation, RBAC, tenant scope, or pagination.
3. **apps/dealer/modules/*/service/** and **lib/** — tenant and money correctness.
4. **apps/platform/lib/supabase/server.ts** — no change (already correct).
5. **Test files** — add/expand RBAC, tenant isolation, validation, pagination tests as per FIX_PLAN.

No Vercel config changes unless a new blocker appears. No business logic reversion. No TS strict loosening. No Vitest.
