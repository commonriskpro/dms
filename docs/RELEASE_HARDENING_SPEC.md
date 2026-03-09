# Release Hardening & Test Stability — Spec

**Sprint:** Release Hardening & Test Stability  
**Date:** 2026-03-07  
**Scope:** Stabilize tests, fix lint/tooling if possible, align DB/schema/test expectations, document release readiness. No new features.

---

## 1. Repo inspection summary

### 1.1 Current state (post-stabilization)

| Area | Status | Notes |
|------|--------|--------|
| **Build** | Green | `npm run build` passes. |
| **Lint** | Broken | `next lint` reports "Invalid project directory provided, no such directory: …/apps/dealer/lint". |
| **Tests (unit, SKIP_INTEGRATION_TESTS=1)** | 5 suites fail, 8 tests fail | 137 suites pass, 866 tests pass; 41 suites skipped. |
| **Tests (full run)** | Many more failures | Integration/DB tests and platform-admin tests fail without migrated DB and env. |
| **Migrations** | Schema in sync with code | Deal tests include `deliveryStatus`/`deliveredAt`; integration tests require migrated DB. |

### 1.2 Baseline commands

- Build: `npm run build` (root)
- Lint: `npm run lint:dealer` (root) or `npm run lint` from `apps/dealer`
- Tests (unit-focused): `SKIP_INTEGRATION_TESTS=1 npm run test:dealer`
- Tests (full): `npm run test:dealer`

---

## 2. Failing test inventory

All failures below are with **SKIP_INTEGRATION_TESTS=1** (unit/non-DB baseline).

| # | Suite | Test(s) | Assertion / error |
|---|--------|---------|-------------------|
| 1 | `modules/dashboard/tests/getDashboardV3Data.test.ts` | 4 tests | (1) `logger.info` never called with `dashboard_v3_load_complete` — only `dashboard_v3_load_start` received. (2) `customersDb.listNewProspects` not called with `(dealershipId, 5)`. (3) No call found for `dashboard_v3_load_complete` (completeCall undefined). (4) `getDashboardV3Data` resolves instead of rejecting when `prisma.vehicle.count` is mocked to reject. |
| 2 | `app/api/inventory/vin-decode/route.test.ts` | 1 test | Expects status **502** (AbortError); received **429**. Rate-limit runs before handler; test may run after "returns 429 when rate limit exceeded" which sets rate-limit mock to false and leaves it that way. |
| 3 | `modules/customers/ui/__tests__/lead-action-strip.test.tsx` | 2 tests | getByRole("link", { name: /send email/i }) fails: accessible name is **"Open email client"**, not "send email". |
| 4 | `modules/customers/ui/__tests__/customers-ui.test.tsx` | 1 test | waitFor "No customers" times out; UI shows "Something went wrong" / "Failed to load customers" (error state). Mock fetch returns 200 with empty data; likely session/permission or fetch URL mismatch. |
| 5 | `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx` | 1 (suite) | Snapshot file header: Jest expects `https://jestjs.io/docs/snapshot-testing`, snapshot has `https://goo.gl/fbAQLP`. Suite fails to load before any test runs. |

---

## 3. Root-cause grouping

### 3.1 Dashboard V3 data tests (getDashboardV3Data.test.ts)

- **Cause:** `getDashboardV3Data` uses `withCache(cacheKey, 20, () => loadDashboardV3Data(...))`. On cache hit the callback is not run, so:
  - `dashboard_v3_load_complete` is never logged.
  - `loadDashboardV3Data` (and thus `listNewProspects`, `listMyTasks`, `getCachedFloorplan`, etc.) is never called.
- **Why cache hit:** First test in the file ("returns full DashboardV3Data shape...") runs with same `dealershipId` and permissions and populates the in-memory cache. Later tests (e.g. "logs dashboard_v3_load_start and dashboard_v3_load_complete") use the same key and get a cache hit.
- **Error test:** The rejection path is in `getDashboardV3Data` (try/catch around `withCache`). When the **callback** throws (e.g. prisma.vehicle.count rejects), `withCache` propagates the error, so `getDashboardV3Data` should reject. If the cache returns a previously stored value (from an earlier test), the callback is not run and the rejection never happens.
- **Fix direction:** Mock `withCache` in this test file so the loader callback always runs (e.g. `withCache = (_key, _ttl, fn) => fn()`), ensuring both logging and data-access calls occur and errors propagate.

### 3.2 VIN decode 502 test

- **Cause:** Route checks rate limit first and returns 429 before calling the decode service. In the test file, the test "returns 429 when rate limit exceeded" sets `checkRateLimitByDealership` to return `false`. `beforeEach` only does `jest.clearAllMocks()`, which clears call history but does **not** reset mock implementations. So the next test ("returns 502 with sanitized message when fetch times out") still sees the rate limit as failed and gets 429.
- **Fix direction:** In `beforeEach`, re-apply rate limit pass: `(checkRateLimitByDealership as jest.Mock).mockReturnValue(true)`. Or in the 502 test only, set `mockReturnValue(true)` before calling POST.

### 3.3 Lead-action-strip (accessible name)

- **Cause:** Test expects link name `/send email/i`; component uses aria-label **"Open email client"** (and visible text "Email"). Matcher fails.
- **Fix direction:** Update tests to use the actual accessible name: e.g. getByRole("link", { name: /open email client/i }) or getByRole("link", { name: "Open email client" }). Preserve UX; do not change component copy for tests.

### 3.4 Customers UI empty state

- **Cause:** Test expects "No customers" after a fetch that returns `{ data: [], meta: { total: 0 } }`. The component instead shows "Something went wrong" / "Failed to load customers", so the fetch may be failing (e.g. 401/403) or the session mock may not match what the component expects.
- **Fix direction:** Inspect how CustomersListPage gets session and which URL it fetches; align mock (global fetch, session provider, or both) so the request succeeds and the list renders empty state. If the component legitimately shows error for this setup, relax the test (e.g. assert error state or skip until session/fetch contract is clear).

### 3.5 Dashboard snapshot suite

- **Cause:** Jest snapshot format changed; snapshot file header still has old guide link `https://goo.gl/fbAQLP`. Jest 29+ expects `https://jestjs.io/docs/snapshot-testing`. Suite fails in `validateSnapshotHeader` before running tests.
- **Fix direction:** Update the snapshot file header to the new link and run tests. If snapshot content is still valid, no content change; if not, run `jest -u` for that suite and commit only if the new output is the intended UI.

---

## 4. Lint / tooling issue analysis

### 4.1 Symptom

- **Command:** `npm run lint` (in apps/dealer) or `npm run lint:dealer` (root).
- **Script:** `next lint` (from apps/dealer/package.json).
- **Error:** `Invalid project directory provided, no such directory: /Users/saturno/Desktop/dms/apps/dealer/lint`.

### 4.2 Analysis

- Next CLI is interpreting the first positional argument as a **directory**. When the script runs `next lint`, the Next binary may be receiving `lint` as the command and then treating a subsequent or default argument as the project directory. Some Next versions treat the first non-option argument after the command as the project path; if the runner passes "lint" twice or the CLI parses "lint" as the directory, we get "no such directory: .../lint".
- **Attempts:** Run from apps/dealer: `npm run lint` → same error. So the issue is not cwd but how `next lint` is invoked.
- **Possible fixes (minimal, no lint system change):**
  1. Explicit directory: change script to `next lint .` so the project directory is current dir.
  2. Use Next's documented form if different (e.g. `next lint --dir .` if supported).
  3. If Next 16 expects no directory for lint, ensure no extra argument is passed (e.g. npm might be appending something).

### 4.3 File plan (lint)

| Action | File | Change |
|--------|------|--------|
| Try explicit dir | `apps/dealer/package.json` | `"lint": "next lint ."` |
| If that fails | Same | Try `next lint --dir .` or inspect Next 16 lint docs. |
| Do not | — | Switch to standalone ESLint or change lint system in this sprint. |

---

## 5. DB migration / test-env consistency plan

### 5.1 Current state

- Prisma schema includes `Deal.deliveryStatus`, `Deal.deliveredAt`; deal create in tests already sets `deliveryStatus: null`, `deliveredAt: null` (stabilization pass).
- Integration tests guard on `SKIP_INTEGRATION_TESTS !== "1"` and `TEST_DATABASE_URL`; when skipped, they do not run.
- Full test run (without SKIP_INTEGRATION_TESTS) hits many failures: platform-admin invite tests (getCurrentUser mock, FK constraint), other integration suites (DB not migrated or env missing).

### 5.2 Plan

1. **No schema or migration changes** in this sprint; schema and code are aligned.
2. **Document** in release report and/or README:
   - For integration tests: set `TEST_DATABASE_URL` and run migrations for the dealer (and platform if needed) before running tests without `SKIP_INTEGRATION_TESTS=1`.
   - Command: `npm run db:migrate` (or equivalent) against the test DB.
3. **Optional:** Add a short note in `jest.setup.ts` or `docs/` that integration tests require a migrated DB and `TEST_DATABASE_URL`.

---

## 6. Exact file plan

### 6.1 Tests (release blockers)

| # | File | Change |
|---|------|--------|
| 1 | `apps/dealer/modules/dashboard/tests/getDashboardV3Data.test.ts` | Mock `@/lib/infrastructure/cache/cacheHelpers` `withCache` to invoke the callback only (e.g. `(_, __, fn) => fn()`). Restore or reset cache between tests if needed so error test sees rejection. |
| 2 | `apps/dealer/app/api/inventory/vin-decode/route.test.ts` | In `beforeEach`, set `(checkRateLimitByDealership as jest.Mock).mockReturnValue(true)` so the 502 test is not affected by the 429 test. |
| 3 | `apps/dealer/modules/customers/ui/__tests__/lead-action-strip.test.tsx` | Replace `/send email/i` with `/open email client/i` (or exact "Open email client") for the email link in both tests that assert it. |
| 4 | `apps/dealer/modules/customers/ui/__tests__/customers-ui.test.tsx` | Identify why fetch leads to error state (session, URL, or response). Fix mock or session so empty list renders "No customers", or adjust test to assert the actual outcome. |
| 5 | `apps/dealer/components/dashboard-v3/__tests__/__snapshots__/dashboard-snapshots.test.tsx.snap` | Update first line to `// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing`. Re-run snapshot test; if content diff, run `jest -u` for that suite only and accept only if correct. |

### 6.2 Lint

| # | File | Change |
|---|------|--------|
| 6 | `apps/dealer/package.json` | Try `"lint": "next lint ."` (or Next 16–supported form). |

### 6.3 Docs (release readiness)

| # | File | Change |
|---|------|--------|
| 7 | `docs/RELEASE_HARDENING_FINAL_REPORT.md` | Create after fixes: issues inspected, fixes applied, commands run, pass/fail counts, remaining blockers, release readiness verdict. |
| 8 | Optional: `apps/dealer/jest.setup.ts` or `docs/` | One-line note that integration tests need migrated DB and TEST_DATABASE_URL. |

---

## 7. Acceptance criteria for “release-ready”

1. **Build:** `npm run build` passes.
2. **Tests (unit baseline):** With `SKIP_INTEGRATION_TESTS=1`, `npm run test:dealer` has **0 failing tests** (allowed: skipped integration suites).
3. **Lint:** Either `npm run lint:dealer` passes, or the lint failure is documented as a known tooling limitation with a clear workaround (e.g. run ESLint directly if applicable).
4. **No regressions:** No intentional change to tenant isolation, RBAC, or audit behavior; tests that assert these remain passing.
5. **Docs:** Release hardening report exists; remaining blockers (if any) and integration-test prerequisites (migrated DB, env) are documented.
6. **No feature work:** Only test fixes, lint wiring, and docs; no new features or speculative refactors.

---

## 8. Out of scope (this sprint)

- Fixing all integration tests when DB is not migrated or env not set.
- Changing lint tooling (e.g. moving off Next lint).
- Performance optimization.
- New features or product changes.
