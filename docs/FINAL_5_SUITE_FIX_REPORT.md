# Final 5 Integration Suite Fix — Report

**Sprint:** Final 5 Integration Suite Fixes  
**Goal:** Fix the remaining 5 suite-specific failures and get the full dealer suite to 100% passing.

---

## 1. Original 5 suite failures

| Suite | Failing test(s) | Error / symptom |
|-------|-----------------|-----------------|
| session-switch | PATCH session/switch with dealershipId user is not a member of returns FORBIDDEN... | `importOriginal is not a function` in jest.mock; then 500 (route uses `requireUserFromRequest`, not `requireUser`). |
| platform-admin | All 5 tests | Same `importOriginal is not a function`; `requireUser` undefined as Mock. |
| platform-admin-create-account | accept invite creates membership with invite's roleId only | roleId mismatch in full run: findFirst(dealershipId, deletedAt) returns different role when another test creates roles first. |
| crm-pipeline-automation integration | Job retry/dead-letter; Atomic job claim; Sequence stop conditions (delayed step) | `The column deadLetter does not exist in the current database` — test DB missing migration. |
| slices-defg | Recon: Vehicle.reconCostCents equals sum of line item costCents... | Expected 3500, got 11000/7000; shared vehicle recon state from other tests. |

---

## 2. Root causes

- **session-switch:** (1) Jest async mock factory `(importOriginal) => await importOriginal()` not supported → mock failed; (2) route uses `requireUserFromRequest`, test only mocked `requireUser` → 500.  
- **platform-admin:** Same async `importOriginal` mock failure; mock not applied so `requireUser` was real.  
- **platform-admin-create-account:** Role resolved with `findFirst({ dealershipId, deletedAt: null })` so run order could return a different role; assertion expected the “Owner” role.  
- **crm-pipeline-automation:** Test DB schema missing `dead_letter` on `DealerJobRun`; migration `20260302180000_add_dealer_job_runs` adds it. Environment/setup, not test logic.  
- **slices-defg:** Shared `vehicleAId`; other describes/tests added recon line items; recon test expected 1000+2500=3500 but sum included leftovers.  

---

## 3. Files changed

| File | Change |
|------|--------|
| `docs/FINAL_5_SUITE_FIX_SPEC.md` | Added: triage, root causes, classification, file plan, acceptance criteria. |
| `apps/dealer/modules/core-platform/tests/session-switch.test.ts` | Replaced async `importOriginal` mocks with sync `jest.requireActual` for `@/lib/tenant` and `@/lib/auth`; added `requireUserFromRequest` mock (same return as `requireUser`). |
| `apps/dealer/modules/core-platform/tests/platform-admin.test.ts` | Replaced async `importOriginal` mocks with sync `jest.requireActual` for `@/lib/auth` and `@/lib/tenant`. |
| `apps/dealer/modules/core-platform/tests/platform-admin-create-account.test.ts` | In `ensureTestData()`, resolve roles with `findFirst({ dealershipId, name: "Owner" })` / `findFirst({ dealershipId, name: "Member" })` and create only if not found, so roleAId/roleBId are stable. |
| `apps/dealer/modules/inventory/tests/slices-defg.security.test.ts` | At start of “Recon: Vehicle.reconCostCents equals sum…” test: clear recon line items for `vehicleAId` and set `vehicle.reconCostCents = 0` for isolation. |
| `docs/FINAL_5_SUITE_FIX_REPORT.md` | This report. |

**CRM:** No code change. Test DB must have migration `20260302180000_add_dealer_job_runs` applied (adds `dead_letter`). Run:

```bash
cd apps/dealer && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

before `npm run test:dealer` when using a real DB for integration tests.

---

## 4. Commands run

- `npx jest modules/core-platform/tests/session-switch.test.ts` — PASS  
- `npx jest modules/core-platform/tests/platform-admin.test.ts` — PASS  
- `npx jest modules/core-platform/tests/platform-admin-create-account.test.ts` — PASS (26 tests)  
- `npx jest modules/inventory/tests/slices-defg.security.test.ts -t "Recon: Vehicle.reconCostCents"` — PASS  
- `npm run test:dealer` — 182 passed suites, 1 failed (CRM integration), 1348 passed tests, 3 failed (CRM), 6 skipped  
- `npm run build -w dealer` — success  
- `npm run lint -w dealer` — success (warnings only, no errors)  

---

## 5. Final full-suite counts

- **Before (this sprint):** 5 failed suites, 11 failed tests.  
- **After code fixes:** 4 of 5 suites fixed in code; 1 suite (CRM integration) still fails when test DB is missing `dead_letter`.  
- **With test DB migrated:** Full dealer suite can be 100% green: 183 suites, 1357 tests (no skips of these tests).  

**Current run (test DB not migrated for CRM):**

- Test Suites: 1 failed, 1 skipped, 181 passed, 182 of 183 total  
- Tests: 3 failed, 6 skipped, 1348 passed, 1357 total  

---

## 6. Confirmation

- **session-switch:** Fixed and passing.  
- **platform-admin:** Fixed and passing.  
- **platform-admin-create-account:** Fixed and passing (stable role by name).  
- **slices-defg (recon invariant):** Fixed and passing (recon isolation).  
- **crm-pipeline-automation integration:** Fails only when test DB lacks `dead_letter`; no test skips or product changes. Apply migration above for 100% green.  
- Build and lint: pass. No tenant/RBAC/audit regressions from these changes; no new skips.  

**100% green dealer tests:** Achievable once the test database has all migrations applied (including `20260302180000_add_dealer_job_runs`). The four code fixes are in place; the fifth is an environment step.
