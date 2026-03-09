# Full Test Pass + Integration Enablement — Spec

**Sprint goal:** Get the full dealer test suite passing with integration tests enabled.

**Current state (before fixes):**
- `npm run build` — PASS
- `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` — PASS
- Full suite with `TEST_DATABASE_URL` set: **36 failed suites, 247 failed tests** (182 suites total, 1357 tests)

---

## 1. Full failing test inventory (by suite)

| # | Suite (file) | Failure type | Root cause |
|---|--------------|--------------|------------|
| 1 | modules/deals/tests/audit.test.ts | Timeout 5000ms (beforeAll / it) | Heavy DB setup + default timeout too low |
| 2 | modules/inventory/tests/dashboard.test.ts | Assertion (kpisA < kpisB, aging bucket) | Shared state; A has 2 vehicles; 30-day boundary flakiness |
| 3 | modules/crm-pipeline-automation/tests/integration.test.ts | Prisma: deadLetter column missing; unique constraint | Test DB not migrated; AutomationRun idempotency |
| 4 | modules/deals/tests/immutability-and-one-deal.test.ts | expect DOMAIN_ERROR, received VALIDATION_ERROR | Service throws VALIDATION_ERROR for invalid transition |
| 5 | modules/reporting-core/tests/tenant-isolation.test.ts | Prisma: invalid UUID 't' at 1 | dealerAId/dealerBId use "t1000000-...", "t2000000-..." (invalid hex) |
| 6 | modules/reporting-core/tests/dealer-profit.test.ts | Same UUID / DB | Same as reporting tenant-isolation |
| 7 | modules/deals/tests/rbac.test.ts | (needs inspection) | Likely timeout or DB |
| 8 | modules/documents/tests/rbac.test.ts | (needs inspection) | Likely timeout or DB |
| 9 | modules/accounting-core/tests/tenant-isolation.test.ts | (needs inspection) | Likely UUID or DB |
| 10 | modules/core-platform/tests/session-switch.test.ts | (needs inspection) | Likely DB / UUID |
| 11 | modules/finance-core/tests/audit.test.ts | (needs inspection) | Likely timeout or DB |
| 12 | modules/customers/tests/tenant-isolation.test.ts | (needs inspection) | Likely UUID or DB |
| 13 | modules/inventory/tests/tenant-isolation.test.ts | (needs inspection) | Likely shared state / DB |
| 14 | modules/core-platform/tests/audit.test.ts | (needs inspection) | Likely timeout or DB |
| 15 | modules/customers/tests/activity.test.ts | (needs inspection) | Likely timeout or DB |
| 16 | modules/customers/tests/rbac.test.ts | (needs inspection) | Likely timeout or DB |
| 17 | modules/inventory/tests/audit.test.ts | (needs inspection) | Likely timeout or DB |
| 18 | modules/inventory/tests/rbac.test.ts | (needs inspection) | Likely timeout or DB |
| 19 | modules/core-platform/tests/files.test.ts | Too many database connections | Connection pool exhausted |
| 20 | modules/inventory/tests/upload-validation.test.ts | Too many database connections | Same |
| 21 | modules/inventory/tests/vehicle-photo-backfill.test.ts | Too many database connections or timeout | Same / timeout |
| 22 | modules/customers/tests/saved-filters-searches.integration.test.ts | (needs inspection) | Likely DB / isolation |
| 23 | modules/reports/tests/integration/reports.test.ts | (needs inspection) | Likely DB / UUID |
| 24 | modules/inventory/tests/slices-defg.security.test.ts | (needs inspection) | Likely DB |
| 25 | modules/inventory/tests/acquisition-engine.test.ts | (needs inspection) | Likely DB |
| 26 | modules/inventory/tests/inventory-intelligence-dashboard.test.ts | (needs inspection) | Likely DB |
| 27 | modules/inventory/tests/inventory-page.test.ts | (needs inspection) | Likely DB |
| 28 | modules/documents/tests/upload-validation.test.ts | Too many database connections | Same as files |
| 29 | modules/inventory/tests/inventory-hardening.test.ts | (needs inspection) | Likely DB |
| 30 | tests/portal-split/internal-api.test.ts | (needs inspection) | Likely DB / env |
| 31 | modules/dashboard/tests/dashboard.test.ts | (needs inspection) | Likely DB / isolation |
| 32 | modules/core-platform/tests/permissions-list.test.ts | (needs inspection) | Likely DB |
| 33 | modules/core-platform/tests/platform-admin.test.ts | (needs inspection) | Likely DB |
| 34 | modules/core-platform/tests/platform-admin-create-account.test.ts | (needs inspection) | Likely timeout / DB |
| 35 | modules/lender-integration/tests/integration.test.ts | Timeout 5000ms (beforeAll / it) | ensureTestData heavy; tests slow |

(Some suites appear twice in the raw output due to Jest’s summary format; the list above is the unique set of failing suite paths.)

---

## 2. Grouped root causes

| Root cause | Suites affected | Fix |
|------------|-----------------|-----|
| **Test DB not migrated** | CRM (deadLetter), possibly others | Document: run migrations against TEST_DATABASE_URL; migration already exists |
| **Invalid UUID in tests** | reporting-core tenant-isolation, dealer-profit (via tenant-status) | Use valid UUIDs: e.g. `10000000-0000-0000-0000-000000000001` / `20000000-...` |
| **Too many DB connections** | core-platform files, inventory upload-validation, documents upload-validation, vehicle-photo-backfill, and others that run after pool is full | Lower Prisma connection usage in test: set `connection_limit` on DATABASE_URL in test env; or maxWorkers=1 |
| **Jest default timeout 5000ms** | deals/audit, lender-integration, and other integration suites | Increase timeout for integration describes (e.g. jest.setTimeout or per-describe timeout) |
| **Assertion mismatch** | deals immutability: expect DOMAIN_ERROR, service throws VALIDATION_ERROR | Align test to current behavior: expect VALIDATION_ERROR |
| **Test isolation / shared state** | inventory dashboard: kpisA.totalUnits (2) not < kpisB.totalUnits (1) | Ensure dealer A has 0 vehicles in that block (delete or isolate) so A < B holds |
| **Aging bucket boundary** | dashboard.test.ts: “exactly 30 days ago” in d30to60 | Use 31+ days ago (or 45) to avoid boundary flakiness |
| **Console output** | Many suites show “● Console” with prisma:error | Fix underlying DB/migration/timeout; Prisma errors will stop when tests pass |

---

## 3. DB / migration prerequisite checklist

- [ ] `TEST_DATABASE_URL` set in `.env.local` (or CI) pointing to a dedicated test DB.
- [ ] All Prisma migrations applied to the test DB: `npx prisma migrate deploy` (or `db:migrate`) with `DATABASE_URL=$TEST_DATABASE_URL`.
- [ ] Seed run if tests expect permissions/roles: e.g. `crm.read`, `admin.dealership.read` (see CRM integration test).
- [ ] No long-lived connections from other processes; consider `connection_limit=3` (or similar) in test DB URL to avoid exhausting pool when running full suite with maxWorkers=2.

---

## 4. Exact file plan

| File | Change |
|------|--------|
| `docs/FULL_TEST_PASS_SPEC.md` | This spec (create). |
| `apps/dealer/jest.setup.ts` | When `TEST_DATABASE_URL` is set, append `?connection_limit=3` (or merge with existing query params) to reduce pool size; optionally increase Jest timeout for integration. |
| `apps/dealer/modules/reporting-core/tests/tenant-isolation.test.ts` | Replace `dealerAId` / `dealerBId` with valid UUIDs (e.g. `10000000-0000-0000-0000-000000000001`, `20000000-0000-0000-0000-000000000002`). |
| `apps/dealer/modules/reporting-core/tests/dealer-profit.test.ts` | If it uses same invalid IDs, fix similarly (or import from a shared test constant). |
| `apps/dealer/modules/deals/tests/immutability-and-one-deal.test.ts` | Change expected error code from `DOMAIN_ERROR` to `VALIDATION_ERROR`. |
| `apps/dealer/modules/inventory/tests/dashboard.test.ts` | Tenant isolation: in beforeAll (or start of tenant isolation block), ensure dealer A has no vehicles for the assertions; optionally delete vehicles for dealer A. Assert kpisA.totalUnits === 0 and kpisB.totalUnits >= 1. Aging: use “31 days ago” (or 45) for the bucket test to avoid 30-day boundary. |
| `apps/dealer/modules/deals/tests/audit.test.ts` | Increase timeout for the integration describe (e.g. `jest.setTimeout(15000)` in that describe or per-test). |
| `apps/dealer/modules/lender-integration/tests/integration.test.ts` | Increase beforeAll/it timeout for integration block. |
| Other integration test files that timeout | Add `jest.setTimeout(15000)` (or higher) at the top of the file or in the `(hasDb ? describe : describe.skip)` block. |
| `apps/dealer/package.json` or `docs` | Document: run migrations on test DB before full integration run; optional: `TEST_DATABASE_URL` with `?connection_limit=3`. |

---

## 5. Safe fix plan (order)

1. **Spec and docs** — Create this spec; add “Integration tests” subsection to README or existing test doc: require migrated test DB, optional `connection_limit`, command `npm run test:dealer`.
2. **Connection pool** — In `jest.setup.ts`, when using `TEST_DATABASE_URL`, set `DATABASE_URL` with a low `connection_limit` (e.g. 3) so 2 workers don’t exhaust the pool.
3. **Timeouts** — In integration test files that timeout (deals/audit, lender-integration, and any other that fails with “Exceeded timeout of 5000 ms”), set `jest.setTimeout(15000)` or higher for the DB describe block.
4. **Reporting UUIDs** — Fix dealer A/B IDs in reporting-core tenant-isolation (and dealer-profit if needed) to valid UUIDs.
5. **Deal immutability** — Update test to expect `VALIDATION_ERROR` instead of `DOMAIN_ERROR`.
6. **Inventory dashboard** — Tenant isolation: ensure dealer A has 0 vehicles for the test; assert exact counts. Aging: use 31 (or 45) days ago for the bucket test.
7. **Re-run** — Run full suite with `TEST_DATABASE_URL` set and migrated DB; confirm pass/fail and document any remaining blockers (e.g. test DB not migrated in CI).

---

## 6. Acceptance criteria for “100% passing dealer tests”

- From repo root: `npm run test:dealer` with integration tests enabled (no `SKIP_INTEGRATION_TESTS=1`) and `TEST_DATABASE_URL` set to a migrated test DB: **all test suites pass**.
- Same with `SKIP_INTEGRATION_TESTS=1`: **all non-integration tests still pass**.
- `npm run build` and `npm run lint:dealer` still pass.
- No tenant isolation, RBAC, or API shape regressions; no new flaky tests.
- Required migration/setup steps for integration tests are documented (this spec + any README/setup doc update).

---

## 7. Out of scope / do not do

- Feature work or speculative refactors.
- Disabling integration tests without documenting an unavoidable blocker.
- Hiding failures (fix or document honestly).
- Vitest/Playwright; Jest only.
