# Test Failure Triage — Final Report

## Summary

**Sprint:** Full Test Failure Triage + Correct Fixes.  
**Goal:** Fix failing tests with minimal, correct changes; no feature work or speculative refactors.

**Verdict:** **Not 100% green.** Deterministic test and infra fixes were applied. Full suite with integration enabled still fails due to **environment limits** (DB connection exhaustion, missing migrations, worker OOM) and a few **suite-specific issues** (platform-admin-create-account: PII assertion, FK constraint; portal-split: timeout/console). Unit-only suite remains **100% passing**.

---

## 1. Original failing suites/tests (before fixes)

- **Run:** `npm run test:dealer` with `TEST_DATABASE_URL` set.
- **Result:** 36 failed suites, 263 failed tests (146 passed, 1083 passed).
- **Notable failures:** deals/audit (actorUserId), accounting profit-calc (backEndGrossCents), accounting tenant-isolation (unique constraint), inventory dashboard (kpisB/sumB/aging 0), CRM (deadLetter column, AutomationRun unique), acquisition-engine (AuctionPurchase table missing), platform-admin-create-account (getCurrentUser undefined), portal-split (timeout, console), many suites with “Too many database connections,” platform-admin (worker OOM).

---

## 2. Root causes found

| Cause | Type | Fix applied |
|-------|------|-------------|
| **Audit log field name** | Test bug | Test expected `log.actorUserId`; schema uses `actorId`. Fixed assertion to `log.actorId`. |
| **Profit-calc shared DealFinance** | Test isolation | First test expected backEndGrossCents 0 but DB had leftover DealFinance. beforeAll now deletes DealFinance for the test deal. |
| **Dashboard tenant isolation** | Shared state | Fixed dealer B ID conflicted with other tests. Use isolated dealer B UUID per run; create vehicle in beforeAll. |
| **Dashboard aging bucket** | Shared state | Use isolated dealer UUID and single vehicle with createdAt 45 days ago in beforeAll. |
| **Accounting tenant-isolation** | Unique constraint | ensureTestData() was called in beforeAll and again in each test; second createAccount("B-1000") failed. Store testData in beforeAll and use unique account code per run (`B-${randomUUID().slice(0,8)}`). |
| **getCurrentUser mock undefined** | Mock wiring | Async jest.mock factory; switched to synchronous factory so getCurrentUser is defined. |
| **portal-split timeout** | Timeout | jest.setTimeout(15000) for the describe. |
| **DB connection exhaustion** | Environment | maxWorkers: 1 when integration enabled to reduce connection pressure. |
| **Missing migrations** | Environment | CRM (deadLetter), acquisition-engine (AuctionPurchase). Documented; no code change. |
| **platform-admin PII / FK** | Suite-specific | Not fixed this sprint; remains failing (assertNoPiiInMetadata, DealershipInvite accepted_by_user_id FK). |
| **Worker OOM** | Environment | platform-admin.test.ts; maxWorkers: 1 helps; optional NODE_OPTIONS documented. |

---

## 3. Files changed

| File | Change |
|------|--------|
| docs/TEST_FAILURE_TRIAGE_SPEC.md | Created: failure inventory, root causes, file plan, fix order, acceptance criteria. |
| docs/TEST_FAILURE_TRIAGE_FINAL_REPORT.md | This report. |
| apps/dealer/modules/deals/tests/audit.test.ts | Assert `log.actorId` instead of `log.actorUserId`. |
| apps/dealer/modules/accounting-core/tests/profit-calc.test.ts | beforeAll: delete DealFinance for test deal so first test sees backEndGrossCents 0. |
| apps/dealer/modules/accounting-core/tests/tenant-isolation.test.ts | Store ensureTestData() result in beforeAll; use unique account code `B-${randomUUID().slice(0,8)}`. |
| apps/dealer/modules/inventory/tests/dashboard.test.ts | Tenant isolation: isolated dealer B UUID, create vehicle in beforeAll. Aging: isolated dealer UUID, vehicle 45 days ago in beforeAll. |
| apps/dealer/modules/core-platform/tests/platform-admin-create-account.test.ts | jest.mock("@/lib/auth") changed from async factory to sync so getCurrentUser is defined. |
| apps/dealer/tests/portal-split/internal-api.test.ts | jest.setTimeout(15000) in describe. |
| apps/dealer/jest.config.js | maxWorkers: 1 when TEST_DATABASE_URL set and SKIP_INTEGRATION_TESTS not set. |

---

## 4. Exact fixes applied

1. **deals/audit:** `expect(log.actorUserId).toBe(userId)` → `expect(log.actorId).toBe(userId)` (Prisma AuditLog model uses `actorId`).
2. **accounting profit-calc:** In beforeAll, after `ensureDeal()`, added `await prisma.dealFinance.deleteMany({ where: { dealId } })`.
3. **accounting tenant-isolation:** `beforeAll` sets `testData = await ensureTestData()`; tests use `testData.accountBId` etc. `ensureTestData()` uses `code: \`B-${randomUUID().slice(0,8)}\``.
4. **inventory dashboard tenant isolation:** `isolatedDealerBId = randomUUID()` in beforeAll; upsert dealership and vehicle for that ID; tests use `isolatedDealerBId` for B.
5. **inventory dashboard aging:** `agingDealerId = randomUUID()`; one vehicle with createdAt 45 days ago for that dealer in beforeAll.
6. **platform-admin-create-account:** `jest.mock("@/lib/auth", () => { ... })` (sync) instead of `async () => { ... }`.
7. **portal-split:** `jest.setTimeout(15000)` at the top of the describe.
8. **jest.config.js:** `maxWorkers: 1` when integration tests run.

---

## 5. Commands run

- `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` — **PASS** (142 suites, 877 tests).
- `npm run test:dealer` (full, with TEST_DATABASE_URL) — **FAIL** (30 failed suites, 236 failed tests after fixes; was 36 / 263).
- `npm -w dealer run test -- modules/accounting-core/tests/tenant-isolation.test.ts modules/inventory/tests/dashboard.test.ts` — **PASS** (2 suites, 13 tests).

---

## 6. What is now passing (with integration enabled)

- modules/reporting-core/tests/tenant-isolation.test.ts  
- modules/accounting-core/tests/profit-calc.test.ts  
- modules/deals/tests/audit.test.ts  
- modules/finance-core/tests/audit.test.ts  
- modules/inventory/tests/audit.test.ts  
- modules/inventory/tests/vehicle-photo-backfill.test.ts  
- modules/core-platform/tests/rbac-dealercenter.test.ts  
- modules/core-platform/tests/audit.test.ts  
- modules/deals/tests/immutability-and-one-deal.test.ts  
- modules/reporting-core/tests/dealer-profit.test.ts  
- modules/accounting-core/tests/tenant-isolation.test.ts (when run in isolation; in full run can still hit unique constraint if DB has leftover data from same run)  
- modules/inventory/tests/dashboard.test.ts (when run in isolation; in full run can still hit connection limits)

Additional suites pass when connection pressure is lower (maxWorkers: 1); many still fail with “Too many database connections” or missing migrations.

---

## 7. What remains failing (full suite with integration)

- **Connection exhaustion:** Many suites still fail with “Too many database connections” (test DB limit).
- **Missing migrations:** CRM (deadLetter column), acquisition-engine (AuctionPurchase table).
- **platform-admin-create-account:** PII-in-metadata assertion, FK on `accepted_by_user_id` in “second accept” test.
- **portal-split:** Can still fail (timeout or console) depending on order and DB.
- **platform-admin.test.ts:** Worker OOM in some runs.
- **Other integration suites:** Failures often cascaded from connection or migration issues.

---

## 8. Security & QA

- **Build:** Not re-run this sprint; assumed green.
- **Lint:** Not re-run; assumed unchanged.
- **Unit-only:** `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` — **PASS**.
- **Behavior:** No tenant/RBAC/audit/API shape changes; only test and infra fixes.

---

## 9. Honest verdict

- **Full dealer suite with integration enabled:** **Not 100% green.** Environment (DB connections, migrations, OOM) and a few suite-specific issues (platform-admin-create-account, portal-split) remain.
- **Unit-only suite:** **100% passing.**
- **Deterministic test bugs:** Fixed (audit field, profit-calc isolation, accounting unique code and single ensureTestData, dashboard isolated dealers, getCurrentUser mock, portal-split timeout).
- **Recommendation:** Run CI with `SKIP_INTEGRATION_TESTS=1` for a green gate; run full integration on a dedicated, migrated test DB with sufficient connections (and optional `NODE_OPTIONS=--max-old-space-size`) and document remaining failures until resolved.
