# Integration Environment Stabilization Spec

**Sprint:** Integration Environment Stabilization + Remaining Suite Fixes  
**Goal:** Stabilize integration test environment and fix remaining suite-specific failures so the full dealer suite can pass.

**Current state (after prior triage):**
- 32 failed suites, 247 failed tests (150 passed, 1104 passed)
- Command: `npm run test:dealer` with `TEST_DATABASE_URL` set, `maxWorkers: 1`, `connection_limit=3` in lib/db

---

## 1. Remaining failing suites (unique)

| # | Suite | Primary cause |
|---|-------|----------------|
| 1 | modules/crm-pipeline-automation/tests/integration.test.ts | beforeAll timeout 5000ms (ensureTestData slow); Unique constraint (dealership_id, vin) from vehicle in another test |
| 2 | modules/inventory/tests/acquisition-engine.test.ts | **FIXED** — was table name drift (AuctionPurchase vs auction_purchase); schema @@map added; skip logic removed. In full run may still fail due to connection exhaustion. |
| 3 | modules/core-platform/tests/platform-admin.test.ts | Jest worker OOM |
| 4 | modules/core-platform/tests/session-switch.test.ts | Too many database connections |
| 5 | modules/deals/tests/deal-desk.test.ts | Too many database connections |
| 6 | modules/deals/tests/audit.test.ts | (connection or flaky) |
| 7 | modules/customers/tests/audit.test.ts | Too many database connections |
| 8 | modules/deals/tests/immutability-and-one-deal.test.ts | Too many database connections |
| 9 | modules/customers/tests/timeline-callbacks-lastvisit.test.ts | Too many database connections |
| 10 | modules/inventory/tests/vehicle-photo-backfill.test.ts | Too many database connections |
| 11 | modules/customers/tests/activity.test.ts | Too many database connections |
| 12 | modules/lender-integration/tests/integration.test.ts | Too many database connections |
| 13 | app/api/customers/route.integration.test.ts | Too many database connections |
| 14 | modules/inventory/tests/tenant-isolation.test.ts | Too many database connections |
| 15 | modules/finance-core/tests/deal-documents-tenant-isolation.test.ts | Too many database connections |
| 16 | modules/core-platform/tests/audit.test.ts | Too many database connections |
| 17 | modules/deals/tests/rbac.test.ts | Too many database connections |
| 18 | modules/core-platform/tests/rbac-dealercenter.test.ts | Too many database connections |
| 19 | modules/inventory/tests/rbac.test.ts | Too many database connections |
| 20 | modules/customers/tests/soft-delete.test.ts | Too many database connections |
| 21 | modules/accounting-core/tests/profit-calc.test.ts | (connection or shared state) |
| 22 | modules/inventory/tests/audit.test.ts | Too many database connections |
| 23 | modules/core-platform/tests/rbac.test.ts | Too many database connections |
| 24 | modules/accounting-core/tests/tenant-isolation.test.ts | (connection or unique constraint) |
| 25 | modules/core-platform/tests/tenant-isolation.test.ts | Too many database connections |
| 26 | modules/inventory/tests/slices-defg.security.test.ts | Too many database connections |
| 27 | modules/finance-core/tests/audit.test.ts | Too many database connections |
| 28 | modules/reporting-core/tests/dealer-profit.test.ts | Too many database connections |
| 29 | modules/reporting-core/tests/tenant-isolation.test.ts | Too many database connections |
| 30 | modules/inventory/tests/dashboard.test.ts | (connection or shared state) |
| 31 | modules/core-platform/tests/platform-admin-create-account.test.ts | **FIXED** — was: PII/metadata, FK signupUserId, Jest expect(msg), audit query; fixes applied. |

---

## 2. Test DB migration requirements

The test DB must have **all dealer Prisma migrations** applied. Suites that assume specific tables will fail until migrations are run.

- **Required for acquisition-engine:** Table exists as `auction_purchase` (migration `20260307160000_add_auction_purchase`). Prisma schema uses `@@map("auction_purchase")` (fixed in DB schema audit).
- **Required for job-run / dead_letter:** `DealerJobRun` / dead_letter (migration `20260302180000_add_dealer_job_runs`).
- From repo root: `cd apps/dealer && npx prisma migrate deploy` (against `TEST_DATABASE_URL`).

---

## 3. Grouped root causes

| Cause | Suites | Fix approach |
|-------|--------|--------------|
| **DB connection exhaustion** | Most of the above | Reduce connection_limit to 2; ensure single Prisma client; document test DB max_connections |
| **Missing migrations** | acquisition-engine (AuctionPurchase) | Document: run migrations; optionally skip integration when table missing |
| **OOM** | platform-admin.test.ts | maxWorkers already 1; document NODE_OPTIONS=--max-old-space-size |
| **beforeAll timeout** | CRM integration | jest.setTimeout(15000) for integration describes |
| **Suite-specific** | platform-admin-create-account: (1) metadata key not in allowed list or PII, (2) updateInviteStatus(..., signupUserId) when signupUserId not in Profile | Ensure Profile for signupUserId before updateInviteStatus; add allowed metadata key if needed |

---

## 4. File/config plan

| Item | Action |
|------|--------|
| docs/INTEGRATION_ENV_STABILIZATION_SPEC.md | This spec. |
| docs/INTEGRATION_ENV_STABILIZATION_FINAL_REPORT.md | Final report after fixes. |
| apps/dealer/lib/db.ts | When TEST_DATABASE_URL: use connection_limit=2 (smaller pool). |
| apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts | jest.setTimeout(15000) for integration describes. |
| apps/dealer/modules/inventory/tests/acquisition-engine.test.ts | Skip integration block when AuctionPurchase table missing (catch and skip) or document only. |
| apps/dealer/modules/core-platform/tests/platform-admin-create-account.test.ts | **Done:** Profile.upsert for signupUserId; allowedMetaKeys + user_id/platformActorId; Jest expect single-arg; requirePlatformAdminMock import; audit query entity+entityId + find by action; delete membership before acceptInvite audit test. |
| docs (README or runbook) | Document: apply all dealer Prisma migrations to test DB; optional NODE_OPTIONS; TEST_DATABASE_URL with connection_limit=2. |

---

## 5. Acceptance criteria for “full dealer suite green”

- From repo root, with `TEST_DATABASE_URL` set and test DB migrated: `npm run test:dealer` has 0 failed suites.
- With `SKIP_INTEGRATION_TESTS=1`: all non-integration tests still pass.
- Build and lint unchanged.
- No tenant/RBAC/audit/API regressions.
- Remaining blockers (if any) documented honestly.
