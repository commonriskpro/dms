# Test Failure Triage Spec

**Sprint:** Full Test Failure Triage + Correct Fixes  
**Goal:** Make failing tests pass by fixing root causes; no feature work, no speculative refactors.

---

## 1. Current failing test output summary

- **Command:** `npm run test:dealer` (from repo root, with `TEST_DATABASE_URL` set)
- **Result:** 36 failed suites, 146 passed, 1 skipped (182 total) | 263 failed tests, 1083 passed, 6 skipped (1352 total)
- **Time:** ~52 s

---

## 2. Exact failing suites (unique)

| # | Suite path | Primary failure type |
|---|------------|----------------------|
| 1 | modules/inventory/tests/dashboard.test.ts | Assertion: kpisB/sumB/d30to60 are 0 |
| 2 | modules/accounting-core/tests/profit-calc.test.ts | Assertion: backEndGrossCents expected 0n, received 300n |
| 3 | modules/inventory/tests/acquisition-engine.test.ts | Schema: table AuctionPurchase does not exist |
| 4 | modules/accounting-core/tests/tenant-isolation.test.ts | Unique constraint (dealership_id, code) |
| 5 | tests/portal-split/internal-api.test.ts | Console warn + timeout 5000ms |
| 6 | modules/deals/tests/audit.test.ts | Assertion: log.actorUserId undefined (schema field is actorId) — FIX: expect log.actorId |
| 7 | modules/crm-pipeline-automation/tests/integration.test.ts | Schema: deadLetter column missing + AutomationRun unique |
| 8 | modules/finance-core/tests/audit.test.ts | Too many database connections |
| 9 | modules/deals/tests/deal-desk.test.ts | (connection or other) |
| 10 | modules/search/tests/global-search.integration.test.ts | (connection or setup) |
| 11 | modules/core-platform/tests/rbac-dealercenter.test.ts | Too many database connections |
| 12 | modules/deals/tests/rbac.test.ts | Too many database connections |
| 13 | modules/finance-core/tests/deal-documents-tenant-isolation.test.ts | (connection or other) |
| 14 | modules/core-platform/tests/session-switch.test.ts | (connection or other) |
| 15 | modules/inventory/tests/tenant-isolation.test.ts | (connection or other) |
| 16 | modules/deals/tests/tenant-isolation.test.ts | (connection or other) |
| 17 | modules/customers/tests/audit.test.ts | (connection or other) |
| 18 | modules/customers/tests/timeline-callbacks-lastvisit.test.ts | (connection or other) |
| 19 | modules/deals/tests/immutability-and-one-deal.test.ts | (connection or assertion) |
| 20 | app/api/customers/route.integration.test.ts | (connection or other) |
| 21 | modules/customers/tests/activity.test.ts | (connection or other) |
| 22 | modules/customers/tests/rbac.test.ts | (connection or other) |
| 23 | modules/core-platform/tests/audit.test.ts | (connection or other) |
| 24 | modules/core-platform/tests/rbac.test.ts | (connection or other) |
| 25 | modules/inventory/tests/rbac.test.ts | (connection or other) |
| 26 | modules/inventory/tests/audit.test.ts | (connection or other) |
| 27 | modules/documents/tests/upload-validation.test.ts | (connection or other) |
| 28 | modules/documents/tests/rbac.test.ts | (connection or other) |
| 29 | modules/core-platform/tests/tenant-isolation.test.ts | (connection or other) |
| 30 | modules/reporting-core/tests/dealer-profit.test.ts | (connection or other) |
| 31 | modules/inventory/tests/vehicle-photo-backfill.test.ts | (connection or other) |
| 32 | modules/reporting-core/tests/tenant-isolation.test.ts | (connection or other) |
| 33 | modules/inventory/tests/slices-defg.security.test.ts | (connection or other) |
| 34 | modules/lender-integration/tests/integration.test.ts | Too many database connections |
| 35 | modules/core-platform/tests/platform-admin-create-account.test.ts | getCurrentUser undefined (mock) |
| 36 | modules/core-platform/tests/platform-admin.test.ts | Jest worker out of memory |

---

## 3. Grouped root causes

| Root cause | Category | Suites affected | Fix approach |
|------------|----------|-----------------|--------------|
| **Too many database connections** | Environment/infra | finance-core audit, rbac-dealercenter, deals rbac, lender-integration, and many others | maxWorkers=1 when integration; or document connection_limit + DB max_connections |
| **Missing migrations on test DB** | Environment | CRM (deadLetter), acquisition-engine (AuctionPurchase table) | Document: run migrations; or skip when table/column missing and document |
| **Unique constraint / shared test data** | Test isolation | accounting tenant-isolation (code B-1000), CRM (AutomationRun) | Use unique codes/ids per run or clean in beforeAll |
| **Wrong assertion field name** | Test bug | deals/audit: expects log.actorUserId, schema has actorId | Fix test: expect(log.actorId).toBe(userId) |
| **Assertion value mismatch** | Test or fixture | accounting profit-calc: backEndGrossCents 0n vs 300n | Align test expectation or fixture |
| **Dashboard tenant isolation** | Test data/order | dashboard: kpisB/sumB 0 after creating vehicle for B | Create vehicle in beforeAll so both tests see it; or ensure single test creates and asserts |
| **Aging bucket** | Test data/order | dashboard: d30to60 is 0 for 45-day vehicle | Same: ensure vehicle exists and bucket logic correct |
| **getCurrentUser mock undefined** | Mock wiring | platform-admin-create-account | Ensure mock is applied; use jest.mocked() or fix import |
| **portal-split** | Timeout + console | internal-api: 5000ms timeout, console.warn | Increase timeout; allow console.warn or suppress in test |
| **Jest worker OOM** | Infrastructure | platform-admin.test.ts | maxWorkers=1 or increase Node memory; or split suite |

---

## 4. Environment vs code/test

- **Environment/setup (document or infra only):** Test DB migrations (deadLetter, AuctionPurchase), connection pool exhaustion, worker OOM.
- **Code/test fixes (apply in repo):** deals audit actorId, accounting profit-calc expectation, dashboard vehicle creation in beforeAll, platform-admin getCurrentUser mock, portal-split timeout (and optional console), accounting/CRM unique constraint via unique test data or cleanup.

---

## 5. Exact file plan

| File | Change |
|------|--------|
| docs/TEST_FAILURE_TRIAGE_SPEC.md | This spec (create). |
| docs/TEST_FAILURE_TRIAGE_FINAL_REPORT.md | Final report (create after fixes). |
| apps/dealer/modules/deals/tests/audit.test.ts | Assert log.actorId instead of log.actorUserId. |
| apps/dealer/modules/accounting-core/tests/profit-calc.test.ts | Expect backEndGrossCents 300n or fix fixture to 0. |
| apps/dealer/modules/inventory/tests/dashboard.test.ts | Create vehicle for B in beforeAll (tenant isolation block) so kpisB/sumB >= 1; ensure aging vehicle created in beforeAll for aging block. |
| apps/dealer/modules/core-platform/tests/platform-admin-create-account.test.ts | Fix getCurrentUser mock usage (jest.mocked or ensure mock reference). |
| tests/portal-split/internal-api.test.ts | jest.setTimeout(15000) for integration tests; optionally suppress expected console.warn. |
| apps/dealer/jest.config.js | When TEST_DATABASE_URL set, use maxWorkers: 1 to reduce connection pressure. |
| apps/dealer/modules/accounting-core/tests/tenant-isolation.test.ts | Use unique account code per run (e.g. random or timestamp) to avoid unique constraint. |
| (Doc) | Document: run migrations on test DB; optional NODE_OPTIONS=--max-old-space-size for OOM. |

---

## 6. Safe fix order

1. **Deals audit** — Fix actorUserId → actorId (test bug, no behavior change).
2. **Accounting profit-calc** — Align expectation to current behavior (300n) or fix fixture.
3. **Inventory dashboard** — Create vehicle for B in beforeAll; create aging vehicle in beforeAll for aging test.
4. **platform-admin-create-account** — Fix getCurrentUser mock.
5. **portal-split** — Increase timeout; handle console if needed.
6. **accounting tenant-isolation** — Unique account code per run.
7. **Jest config** — maxWorkers: 1 when integration enabled.
8. **Document** — Migrations, connection limits, OOM.

---

## 7. Acceptance criteria for “full suite green”

- From repo root, with `TEST_DATABASE_URL` set and test DB migrated: `npm run test:dealer` has 0 failed suites (integration tests run and pass or are skipped with clear reason).
- With `SKIP_INTEGRATION_TESTS=1`: all non-integration tests still pass.
- Build and lint unchanged.
- No tenant/RBAC/audit/API regressions.
- Remaining blockers (if any) documented honestly.
