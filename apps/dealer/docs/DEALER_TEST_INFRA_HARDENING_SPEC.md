# Dealer App Test Infrastructure Hardening — Spec

**Document:** `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_SPEC.md`  
**Sprint:** Standardize test environments, stabilize the dealer suite, remove env-driven flakiness, improve regression confidence.

---

## 1. Goal / scope

This sprint:

- **Standardize test environments** — Clear rule: Prisma/server/DB-backed tests run in Node; UI/component tests run in jsdom.
- **Stabilize the dealer suite** — Full `npm run test:dealer` (or equivalent from root) should complete with environment-driven failures removed or isolated.
- **Remove env-driven flakiness** — Prisma “browser environment” errors and Supabase/ESM resolution issues in tests are addressed by running affected tests in Node.
- **Improve regression confidence** — Future tests have a documented pattern; commands from repo root are predictable.

**Out of scope:** Product features, switching away from Jest, removing meaningful integration coverage to green CI, fragile hacks that hide real failures.

---

## 2. Current state audit

### Jest config

- **Primary config:** `apps/dealer/jest.config.js`
  - Uses `next/jest` via `createJestConfig({ dir: "./" })`.
  - **testEnvironment:** `"<rootDir>/jest.env.js"` (custom env).
  - **setupFilesAfterEnv:** `["<rootDir>/jest.setup.ts"]`
  - **testMatch:** `**/__tests__/**/*.[jt]s?(x)`, `**/?(*.)+(spec|test).[jt]s?(x)`.
  - **moduleNameMapper:** `"^@/(.*)$"` → `"<rootDir>/$1"`.
  - **testPathIgnorePatterns:** `.next/`, `node_modules/`.
  - When `TEST_DATABASE_URL` is set and `SKIP_INTEGRATION_TESTS !== "1"`: **maxWorkers: 2**.

### Custom environment (`jest.env.js`)

- Extends `jest-environment-jsdom`.
- Injects Node’s `Request`, `Response`, `Headers`, `fetch` into the jsdom global so Next.js API route code can load.
- **Default for all tests is therefore jsdom.**

### Setup (`jest.setup.ts`)

- Loads `../../.env.local` (repo root) so `TEST_DATABASE_URL` is available.
- If `TEST_DATABASE_URL` is set, overwrites `process.env.DATABASE_URL`.
- Imports `@testing-library/jest-dom`.
- Mocks `react` (adds `cache`), `next/cache` (`revalidatePath`, `revalidateTag`).

### Test categories (current)

- **Unit-style:** Pure logic, schemas, math (e.g. `deal-math.test.ts`, `calculations.test.ts`, `lead-action-strip-schemas.test.ts`). No DB; can run in jsdom.
- **UI/component:** React components (e.g. `__tests__/*.test.tsx`). Need jsdom; should not import Prisma/server-only code.
- **Route tests:** `app/api/**/route.test.ts`. Some call route handlers that (or whose deps) import `@/lib/db`, auth, Supabase.
- **Integration/DB:** Tests that `import { prisma } from "@/lib/db"` or services that use Prisma. Require Node so `@prisma/client` resolves to the Node build, not the browser build.

### Known failing suites and causes

1. **Prisma “unable to run in this browser environment”**  
   Any test file that imports `@/lib/db` (or a module that does) runs under the default jsdom env. Next’s Jest pipeline can resolve `@prisma/client` to the browser build in that context, causing the error at `lib/db.ts` when creating the client or attaching `$on`.
2. **Supabase/ESM “Cannot use import statement outside a module”**  
   Some route tests use `jest.requireActual("@/lib/api/handler")` (or similar). The handler chain loads auth and Supabase server code; in Jest’s CJS/jsdom context, Supabase ESM can fail to load.
3. **Result:** Many integration and route tests fail when run as part of the full suite, even when `TEST_DATABASE_URL` is set.

### Current use of `@jest-environment node`

- **Only one file:** `modules/deals/tests/deal-desk.test.ts` has `/** @jest-environment node */` at the top. Running that file alone succeeds; running the full suite still fails because other DB-using tests do not override the environment.

### TEST_DATABASE_URL / SKIP_INTEGRATION_TESTS

- **Setup:** `jest.setup.ts` sets `DATABASE_URL` from `TEST_DATABASE_URL` when present.
- **Convention:** Tests that need a DB often guard with `const hasDb = process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL` and use `(hasDb ? describe : describe.skip)`. This is retained; no change to skip semantics.

---

## 3. Test taxonomy

| Category | Naming | Environment | DB required | External mocks | Examples |
|----------|--------|-------------|-------------|----------------|----------|
| **Unit** | `*.test.ts` (no DB import) | jsdom (default) | No | Optional | `deal-math.test.ts`, `calculations.test.ts`, `lead-action-strip-schemas.test.ts` |
| **UI / component** | `*.test.tsx`, `__tests__/*.test.tsx` | jsdom | No | React, router, etc. as needed | `GlobalSearch.test.tsx`, `lead-action-strip.test.tsx` |
| **Route** | `route.test.ts`, `route.integration.test.ts` | **Node** if handler or deps use Prisma/auth/Supabase | Sometimes | Auth/handler when not testing full stack | `app/api/health/route.test.ts`, `app/api/customers/route.test.ts` |
| **Integration / DB** | `*.integration.test.ts`, `*.test.ts` in modules that use DB | **Node** | Yes (when not skipped) | Minimal; use real Prisma | `deal-desk.test.ts`, `finance-shell/tests/integration.test.ts`, `customers/tests/audit.test.ts` |

- **Environment rule:** Any test file that imports `@/lib/db` or that imports a module which (transitively) imports `@/lib/db` must run in **Node** so Prisma resolves to the Node client. Route tests that pull in the real handler (and thus auth/db/Supabase) should also run in Node to avoid ESM/browser resolution issues.
- **Naming:** No mandatory rename. Existing names stay; new DB-backed tests are encouraged to use `*.integration.test.ts` or to live under `**/tests/**` and carry the Node docblock.

---

## 4. Environment strategy

**Recommendation: per-file override with `@jest-environment node`**

- **Default:** Keep `testEnvironment: "<rootDir>/jest.env.js"` (jsdom) so UI and unit tests behave as today.
- **Override:** In every test file that (1) imports `@/lib/db`, or (2) imports a route handler or server code that transitively loads Prisma/auth/Supabase, add at the top of the file:
  - `/** @jest-environment node */`
- **Rationale:**
  - Minimal change: no Jest “projects” split, no new config files.
  - Explicit: each file declares it needs Node.
  - Repo-consistent: already used for `deal-desk.test.ts` and documented in Deal Desk V1.1 spec.
  - Predictable: same `npm run test` / `npm -w dealer run test`; Jest selects environment per file.
- **Alternative considered:** Two Jest projects (e.g. “node” vs “jsdom”) would require either renaming many files to match a pattern or maintaining a long list of paths; per-file docblock is simpler and more precise.

**Result:**

- **jsdom:** Unit tests, component tests, and any test that does not touch Prisma/server-only code.
- **node:** All integration/DB tests and route tests that load server-side code.

---

## 5. Prisma / Supabase import strategy

- **Tests that import `@/lib/db` or Prisma:** Must run in Node (docblock). No change to how production code imports Prisma.
- **Route tests:** Prefer testing the handler with mocks (e.g. mock `getAuthContext`, `guardPermission`) so the route file is not executed in a way that pulls in unmockable server deps. If the test intentionally uses the real handler or `requireActual` of handler/auth, run that test file in Node so that Prisma and Supabase server code resolve correctly.
- **Mocks:** Use `jest.mock("@/lib/db")` or `jest.mock("@/lib/api/handler")` etc. where the goal is to avoid hitting DB or auth. Avoid `requireActual` of modules that pull in Supabase/browser code unless the test file runs in Node.
- **When to use Node:** When the test file or any of its direct imports (or their transitive deps) use `@/lib/db`, Prisma, or server-side auth/Supabase. When in doubt for an integration or route test, use Node.

---

## 6. DB-backed test strategy

- **When TEST_DATABASE_URL is required:** All integration tests that perform real DB operations (create/read/update/delete via Prisma). These must run in Node and should retain the existing skip pattern: `(hasDb ? describe : describe.skip)` with `hasDb = process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL`.
- **When DB is absent:** Those describe blocks are skipped; no DB connection is attempted.
- **Determinism:** Use fixed UUIDs and known dealership/customer/vehicle ids where possible; avoid relying on global ordering or shared mutable state across tests.
- **Setup/teardown:** Use `beforeAll`/`beforeEach` for test data; avoid leaving orphan data that breaks other tests. No change to transaction/reset strategy in this sprint beyond what is already in use.
- **Documentation:** Document in the testing guide that DB-backed tests require `TEST_DATABASE_URL` and may be skipped with `SKIP_INTEGRATION_TESTS=1`.

---

## 7. Flakiness reduction plan

- **Unstable environment imports:** Resolved by running Prisma- and server-dependent tests in Node (docblock).
- **Non-deterministic order:** Avoid ordering-dependent assertions where possible; use deterministic ids and explicit setup.
- **Shared global mocks:** Keep mocks in setup or at top of file; avoid mutating global mocks in a way that affects other files. Document that each test file should not rely on another file’s mocks.
- **Lingering mock state:** Jest resets mocks between files by default; where a file uses `jest.clearAllMocks()` or similar, keep it. No new global state in this sprint.
- **Async timing:** Prefer `await` and deterministic setup over arbitrary `setTimeout`; no change unless a specific flaky test is identified.
- **DB isolation:** Use distinct ids per test or per file; avoid reusing the same row across unrelated tests in a way that causes order-dependent failures.

---

## 8. Acceptance criteria

- All test files that import `@/lib/db` (or that need Node for handler/auth/Supabase) have `/** @jest-environment node */` and run in Node.
- From repo root, `npm run test:dealer` runs the full dealer suite; environment-driven Prisma “browser” failures are gone (or reduced to a documented minimum).
- Representative suites from deals, customers, inventory, dashboard, documents, core-platform, finance-shell, reports, and route tests either pass or fail for real code reasons, not environment resolution.
- A short **Dealer Testing Guide** documents: environment rule (Node vs jsdom), when to use Node, TEST_DATABASE_URL / SKIP_INTEGRATION_TESTS, and how to add new tests.
- Any tests that must remain conditionally skipped are listed with a clear reason (e.g. “requires TEST_DATABASE_URL”).

---

## 9. File plan

**Step 1 (Spec)**  
- Add: `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_SPEC.md` (this file).

**Step 2 (Backend / Test infra)**  
- Add `/** @jest-environment node */` to every dealer test file that imports `@/lib/db` (see list below). Optionally add to route tests that use real handler/auth (e.g. `app/api/customers/route.test.ts`) if they currently fail due to Supabase/ESM.
- Update `jest.setup.ts` or `jest.env.js` with a one-line comment that tests importing `@/lib/db` must use `@jest-environment node`.
- Add or adjust npm scripts in `apps/dealer/package.json` and/or root if useful (e.g. `test:dealer:integration` already exists; keep it).
- Add: `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_BACKEND_REPORT.md`.

**Step 3 (Frontend)**  
- Confirm component/UI tests do not import Prisma or server-only paths; fix only if needed. Add `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_FRONTEND_REPORT.md` (can be minimal).

**Step 4 (Security & QA)**  
- Add: `STEP4_DEALER_TEST_INFRA_SECURITY_REPORT.md`, `STEP4_DEALER_TEST_INFRA_SMOKE_REPORT.md`, `STEP4_DEALER_TEST_INFRA_PERF_REPORT.md`, `DEALER_TESTING_GUIDE.md`.

**List of test files to annotate with `@jest-environment node`** (all that directly import `@/lib/db`; `deal-desk.test.ts` already has it):

- app/api/me/current-dealership/route.test.ts  
- app/api/me/dealerships/route.test.ts  
- app/api/auth/session/switch/route.test.ts  
- app/api/auth/onboarding-status/route.test.ts  
- app/api/health/route.test.ts  
- app/api/crm/jobs/run/route.test.ts  
- app/api/customers/route.integration.test.ts  
- lib/platform-admin.test.ts  
- lib/rate-limit-stats.test.ts  
- lib/job-run-stats.test.ts  
- lib/tenant-status.test.ts  
- lib/audit.test.ts  
- modules/dashboard/tests/dashboard-layout-persistence.test.ts  
- modules/dashboard/tests/dashboard.test.ts  
- modules/dashboard/tests/getDashboardV3Data.test.ts  
- modules/reports/tests/integration/reports.test.ts  
- modules/documents/tests/rbac.test.ts  
- modules/documents/tests/upload-validation.test.ts  
- modules/documents/tests/audit.test.ts  
- modules/documents/tests/tenant-isolation.test.ts  
- modules/finance-shell/tests/integration.test.ts  
- modules/core-platform/tests/rbac.test.ts  
- modules/core-platform/tests/session-switch.test.ts  
- modules/core-platform/tests/platform-admin.test.ts  
- modules/core-platform/tests/platform-admin-create-account.test.ts  
- modules/core-platform/tests/rbac-dealercenter.test.ts  
- modules/core-platform/tests/files.test.ts  
- modules/core-platform/tests/audit.test.ts  
- modules/core-platform/tests/tenant-isolation.test.ts  
- modules/customers/tests/rbac.test.ts  
- modules/customers/tests/timeline-callbacks-lastvisit.test.ts  
- modules/customers/tests/activity.test.ts  
- modules/customers/tests/audit.test.ts  
- modules/customers/tests/saved-filters-searches.integration.test.ts  
- modules/customers/tests/tenant-isolation.test.ts  
- modules/customers/tests/soft-delete.test.ts  
- modules/deals/tests/immutability-and-one-deal.test.ts  
- modules/deals/tests/rbac.test.ts  
- modules/deals/tests/audit.test.ts  
- modules/deals/tests/tenant-isolation.test.ts  
- modules/inventory/tests/rbac.test.ts  
- modules/inventory/tests/upload-validation.test.ts  
- modules/inventory/tests/vehicle-photo-backfill.test.ts  
- modules/inventory/tests/dashboard.test.ts  
- modules/inventory/tests/audit.test.ts  
- modules/inventory/tests/tenant-isolation.test.ts  
- modules/inventory/tests/slices-defg.security.test.ts  
- modules/lender-integration/tests/integration.test.ts  
- modules/search/tests/global-search.integration.test.ts  
- modules/crm-pipeline-automation/tests/integration.test.ts  
- modules/crm-pipeline-automation/tests/dealer-job-run.test.ts  
- tests/portal-split/internal-api.test.ts  

Optionally (if they fail due to handler/auth/Supabase when run in jsdom):  
- app/api/customers/route.test.ts  

---

*End of spec. Implementation follows Steps 2–4.*
