# Final 5 Integration Suite Fix — Spec

**Sprint:** Final 5 Integration Suite Fixes  
**Goal:** Fix the remaining 5 suite-specific failures and get the full dealer suite 100% passing.

---

## 1. Exact remaining failing tests

| # | Suite | Failing test(s) | Error / symptom |
|---|-------|-----------------|------------------|
| 1 | session-switch.test.ts | PATCH session/switch with dealershipId user is not a member of returns FORBIDDEN... | (1) `importOriginal is not a function` in jest.mock("@/lib/auth") and jest.mock("@/lib/tenant"); (2) `Right-hand side of 'instanceof' is not an object` in isApiError (lib/api/errors.ts:17). |
| 2 | platform-admin.test.ts | All 5 tests (non-platform 403, list dealerships, create, disable, impersonate) | (1) Same `importOriginal is not a function` in jest.mock("@/lib/auth"); (2) `requireUser` is undefined when calling `(requireUser as jest.Mock).mockResolvedValueOnce`. |
| 3 | platform-admin-create-account.test.ts | accept invite creates membership with invite's roleId only | When run in full suite: roleId expected `06b0bbd3-...` (roleAId), received `ee000000-...`. Passes in isolation. |
| 4 | crm-pipeline-automation integration.test.ts | Job retry / dead-letter; delayed step after WON | `The column deadLetter does not exist in the current database` (Prisma: dealerJobRun.create uses deadLetter). Migration 20260302180000 adds dead_letter; test DB may not have it. |
| 5 | slices-defg.security.test.ts | Recon: Vehicle.reconCostCents equals sum of line item costCents... | Expected 3500, received 11000 or 7000 — shared vehicle/line-item state from other tests or describes. |

---

## 2. Root cause per suite

| Suite | Root cause | Category |
|-------|------------|----------|
| session-switch | jest.mock async factory receives no `importOriginal` in this Jest/Node setup; spreading `actual` fails so route throws and isApiError sees wrong ApiError reference. | Bad mock wiring |
| platform-admin | Same: async (importOriginal) => importOriginal() — importOriginal is not a function; mock never applied, requireUser is real and undefined as Mock. | Bad mock wiring |
| platform-admin-create-account | ensureTestData() uses findFirst for role; in full run another test can create a different role for same dealership, so roleAId differs. Assertion is correct; data setup is order-dependent. | Shared test data / isolation |
| crm-pipeline-automation | Test DB missing column dead_letter on dealer_job_runs (migration 20260302180000 adds it). Prisma schema has deadLetter. | Migration / env (not test bug) |
| slices-defg | vehicleAId is shared across describes; other tests add recon line items to same vehicle; recon test expects 3500 (1000+2500) but sum includes leftovers. | Shared test data / isolation |

---

## 3. Classification

- **Bad mock wiring:** session-switch, platform-admin — use `jest.requireActual` instead of async `importOriginal` so mocks apply; ensure ApiError reference is preserved for isApiError.
- **Outdated assertion:** None.
- **Timeout:** None (CRM fails on missing column, not timeout).
- **Shared test data / isolation:** platform-admin-create-account (stable role id/name for roleA); slices-defg (clear recon line items for vehicle at start of recon invariant test).
- **Real product bug:** None.
- **Migration/env:** CRM — test DB must have migration 20260302180000 applied (dead_letter column). Document; no code fix.

---

## 4. Exact file plan

| Item | Action |
|------|--------|
| docs/FINAL_5_SUITE_FIX_SPEC.md | This spec. |
| session-switch.test.ts | Replace async (importOriginal) => await importOriginal() with jest.requireActual("@/lib/auth") and jest.requireActual("@/lib/tenant") in sync factory. |
| platform-admin.test.ts | Same: jest.requireActual for @/lib/auth and @/lib/tenant. |
| platform-admin-create-account.test.ts | In ensureTestData(), use findFirst where (dealershipId, name: "Owner" / "Member") so roleAId/roleBId are stable; create only if not found. (Role has @@unique([dealershipId, name]).) |
| crm-pipeline-automation | No code change; document that test DB must have dealer_job_runs.dead_letter (run migration 20260302180000). If column exists and test still fails, triage separately. |
| slices-defg.security.test.ts | At start of "Recon: Vehicle.reconCostCents equals sum..." test, delete all VehicleReconLineItem for vehicleAId and set Vehicle.reconCostCents to 0 for vehicleAId so test starts from clean state. |
| docs/FINAL_5_SUITE_FIX_REPORT.md | Final report after fixes. |

---

## 5. Acceptance criteria

- Full dealer suite green: `npm run test:dealer` with TEST_DATABASE_URL has 0 failed suites, 0 failed tests.
- Build and lint unchanged; unit-only path passes.
- No skip-based solutions; no tenant/RBAC/audit/API regressions.
- CRM: if test DB has migration applied, CRM integration suite passes; if not, document as env requirement.
