# Release Hardening — Final Report

**Sprint:** Release Hardening & Test Stability  
**Date:** 2026-03-07  
**Scope:** Stabilize tests, document lint/tooling, align DB/test expectations, document release readiness.

---

## 1. Issues inspected

### 1.1 Failing tests (unit baseline: SKIP_INTEGRATION_TESTS=1)

| Suite | Root cause | Resolution |
|-------|------------|------------|
| **getDashboardV3Data.test.ts** | `getDashboardV3Data` uses `withCache`; on cache hit the loader callback never runs, so no `dashboard_v3_load_complete` log and no DB/customer/floorplan calls. First test populated cache; later tests got cache hit. | Mocked `@/lib/infrastructure/cache/cacheHelpers` so `withCache` always invokes the callback. |
| **vin-decode/route.test.ts** | Test "returns 429 when rate limit exceeded" sets `checkRateLimitByDealership` to return false. `beforeEach` only cleared mock calls, not implementations, so the next test still saw 429. | In `beforeEach`, re-apply `(checkRateLimitByDealership as jest.Mock).mockReturnValue(true)` after dynamic import of rate-limit. |
| **lead-action-strip.test.tsx** | Tests used getByRole("link", { name: /send email/i }); component uses aria-label "Open email client". | Updated all three assertions to use /open email client/i. |
| **customers-ui.test.tsx** | Mock returned a single `Response` for all fetch calls; `Response` body can be consumed only once, so later fetches (saved-filters, saved-searches, customers) failed when reading body. | Switched to `mockImplementation(() => Promise.resolve(emptyCustomersPayload()))` so each call gets a new Response. |
| **dashboard-snapshots.test.tsx** | Snapshot file header had old Jest guide link `https://goo.gl/fbAQLP`; Jest 30 expects `https://jestjs.io/docs/snapshot-testing`. Suite failed in header validation before running tests. | Updated first line of `dashboard-snapshots.test.tsx.snap` to the new guide URL. |

### 1.2 Lint / tooling

- **Symptom:** `npm run lint` (or `npm run lint:dealer`) runs `next lint` and fails with: `Invalid project directory provided, no such directory: …/apps/dealer/lint`.
- **Analysis:** Next CLI appears to treat the first argument as a project directory; with script `next lint`, "lint" is interpreted as the directory. Next.js 16 has moved toward removing `next lint` in favor of running ESLint directly; ESLint 9 in this repo expects flat config while the project uses `.eslintrc.json`.
- **Attempts:** Tried `next lint .` — same error. Tried running `eslint .` directly — ESLint 9 requires `eslint.config.*` (flat config), so legacy `.eslintrc.json` is not used by default.
- **Decision:** No change to lint script. Document as known limitation; fixing would require either fixing Next CLI usage or migrating to ESLint flat config.

### 1.3 DB / integration tests

- Schema and test data are aligned (deal creates include `deliveryStatus`/`deliveredAt`).
- Integration tests are gated on `SKIP_INTEGRATION_TESTS !== "1"` and `TEST_DATABASE_URL`; when run, they require a migrated DB.
- **Change:** Added a one-line note in `jest.setup.ts` that integration tests require a migrated DB (run `npm run db:migrate` against the test DB before running without SKIP_INTEGRATION_TESTS).

---

## 2. Fixes applied

### 2.1 Test fixes

| File | Change |
|------|--------|
| `apps/dealer/modules/dashboard/tests/getDashboardV3Data.test.ts` | Added `jest.mock("@/lib/infrastructure/cache/cacheHelpers", () => ({ withCache: (_key, _ttl, fn) => fn() }))` so the loader always runs and cache does not short-circuit logging or data access. |
| `apps/dealer/app/api/inventory/vin-decode/route.test.ts` | In `beforeEach`, dynamic import of `@/lib/api/rate-limit` and `(checkRateLimitByDealership as jest.Mock).mockReturnValue(true)` so each test starts with rate limit passing. |
| `apps/dealer/modules/customers/ui/__tests__/lead-action-strip.test.tsx` | Replaced `/send email/i` with `/open email client/i` for the email link in three places (two getByRole, one queryByRole). |
| `apps/dealer/modules/customers/ui/__tests__/customers-ui.test.tsx` | Replaced single `mockResolvedValue(Response(...))` with `mockImplementation(() => Promise.resolve(emptyCustomersPayload()))` so each fetch gets a new Response and body can be read. |
| `apps/dealer/components/dashboard-v3/__tests__/__snapshots__/dashboard-snapshots.test.tsx.snap` | First line updated from `// Jest Snapshot v1, https://goo.gl/fbAQLP` to `// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing`. |

### 2.2 Docs / setup

| File | Change |
|------|--------|
| `docs/RELEASE_HARDENING_SPEC.md` | Created: failing test inventory, root-cause grouping, lint analysis, DB plan, file plan, acceptance criteria. |
| `apps/dealer/jest.setup.ts` | Added sentence: "Integration tests require a migrated DB: run npm run db:migrate (or equivalent) against the test DB before running without SKIP_INTEGRATION_TESTS." |

---

## 3. Commands run

| Command | Result |
|---------|--------|
| `npm run build` | **PASS** (exit 0). |
| `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` | **PASS** — 142 suites passed, 41 skipped, 0 failed; 877 tests passed, 480 skipped, 0 failed; 3 snapshots passed. |
| `npm run lint:dealer` | **FAIL** — unchanged; "Invalid project directory" (documented). |

---

## 4. Final pass/fail counts

### 4.1 Unit test baseline (SKIP_INTEGRATION_TESTS=1)

- **Before:** 5 failed suites, 8 failed tests.  
- **After:** 0 failed suites, 0 failed tests.  
- **Suites:** 142 passed, 41 skipped, 183 total.  
- **Tests:** 877 passed, 480 skipped, 1357 total.  
- **Snapshots:** 3 passed.

### 4.2 Build

- **Status:** Green (unchanged).

### 4.3 Lint

- **Status:** Still failing (known tooling issue; no change).

---

## 5. Remaining blockers

1. **Lint:** `next lint` fails with "Invalid project directory". To fix properly would require either:
   - Correct invocation/configuration for Next 16 lint, or  
   - Migrating to ESLint flat config and running `eslint` directly.  
   Not done in this sprint to avoid scope creep.

2. **Full test run (no SKIP_INTEGRATION_TESTS):** Many integration and platform-admin tests fail without a migrated test DB and correct env (e.g. `TEST_DATABASE_URL`). This is expected; run with `SKIP_INTEGRATION_TESTS=1` for a green unit baseline, or run migrations against the test DB for full integration runs.

---

## 6. Release readiness verdict

- **Build:** Green.  
- **Unit tests (SKIP_INTEGRATION_TESTS=1):** Green; all previously failing unit tests fixed.  
- **Lint:** Red; documented as known tooling limitation.  
- **Integration tests:** Require migrated DB; documented in `jest.setup.ts` and this report.  
- **Security/QA:** No changes to tenant isolation, RBAC, or audit logic; only test and doc updates.

**Verdict:** The repo is **release-ready for the unit baseline**: build passes and all non-integration tests pass. Lint remains a known, documented blocker for "fully green" until the Next/ESLint wiring is fixed. Integration test runs are supported when the test DB is migrated and env is set; release process can either rely on the unit baseline or add a migrated test DB step for integration.
