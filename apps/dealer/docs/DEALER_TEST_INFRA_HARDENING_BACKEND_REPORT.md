# Dealer Test Infrastructure Hardening — Backend Report

**Document:** `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_BACKEND_REPORT.md`

---

## 1. Final environment strategy

- **Default:** All dealer tests run with `testEnvironment: "<rootDir>/jest.env.js"` (custom jsdom that adds Node-like `Request`, `Response`, `Headers`, `fetch`).
- **Override:** Any test file that imports `@/lib/db` or that loads server-side Prisma/auth/Supabase (e.g. route tests using real handler) must declare **`/** @jest-environment node */`** at the top of the file. Jest then runs that file in Node, so `@prisma/client` resolves to the Node build and Prisma “browser environment” errors are avoided.
- **No Jest projects split:** A single Jest config is used; environment is selected per file via the docblock.

---

## 2. Categories and conventions

| Category | Environment | When to use |
|----------|-------------|-------------|
| Unit (no DB) | jsdom (default) | Pure logic, schemas, math; no `@/lib/db` or server-only imports. |
| UI / component | jsdom | React component tests; do not import Prisma or server-only paths. |
| Route (handler uses DB/auth) | **node** | Tests that import route handlers or use `requireActual` of handler/auth. |
| Integration / DB | **node** | Tests that `import { prisma } from "@/lib/db"` or services that use Prisma. |

**Naming:** No mandatory renames. Existing `*.test.ts`, `*.test.tsx`, `*.integration.test.ts`, `route.test.ts` remain. New DB-backed tests are encouraged to use `*.integration.test.ts` or live under `**/tests/**` and include the Node docblock.

---

## 3. Files / suites updated

**Jest setup**

- `apps/dealer/jest.setup.ts` — Comment added: tests importing `@/lib/db` or server-side code must use `@jest-environment node` (see spec).

**Test files given `/** @jest-environment node */`** (all that directly import `@/lib/db` or need Node for handler/auth):

- **API routes:**  
  `app/api/me/current-dealership/route.test.ts`, `app/api/me/dealerships/route.test.ts`, `app/api/auth/session/switch/route.test.ts`, `app/api/auth/onboarding-status/route.test.ts`, `app/api/health/route.test.ts`, `app/api/crm/jobs/run/route.test.ts`, `app/api/customers/route.integration.test.ts`, `app/api/customers/route.test.ts`
- **Lib:**  
  `lib/platform-admin.test.ts`, `lib/rate-limit-stats.test.ts`, `lib/job-run-stats.test.ts`, `lib/tenant-status.test.ts`, `lib/audit.test.ts`
- **Dashboard:**  
  `modules/dashboard/tests/dashboard-layout-persistence.test.ts`, `modules/dashboard/tests/dashboard.test.ts`, `modules/dashboard/tests/getDashboardV3Data.test.ts`
- **Reports:**  
  `modules/reports/tests/integration/reports.test.ts`
- **Documents:**  
  `modules/documents/tests/rbac.test.ts`, `upload-validation.test.ts`, `audit.test.ts`, `tenant-isolation.test.ts`
- **Finance-shell:**  
  `modules/finance-shell/tests/integration.test.ts`
- **Core-platform:**  
  `modules/core-platform/tests/rbac.test.ts`, `session-switch.test.ts`, `platform-admin.test.ts`, `platform-admin-create-account.test.ts`, `rbac-dealercenter.test.ts`, `files.test.ts`, `audit.test.ts`, `tenant-isolation.test.ts`
- **Customers:**  
  `modules/customers/tests/rbac.test.ts`, `timeline-callbacks-lastvisit.test.ts`, `activity.test.ts`, `audit.test.ts`, `saved-filters-searches.integration.test.ts`, `tenant-isolation.test.ts`, `soft-delete.test.ts`
- **Deals:**  
  `modules/deals/tests/deal-desk.test.ts` (already had it), `immutability-and-one-deal.test.ts`, `rbac.test.ts`, `audit.test.ts`, `tenant-isolation.test.ts`
- **Inventory:**  
  `modules/inventory/tests/rbac.test.ts`, `upload-validation.test.ts`, `vehicle-photo-backfill.test.ts`, `dashboard.test.ts`, `audit.test.ts`, `tenant-isolation.test.ts`, `slices-defg.security.test.ts`
- **Lender-integration:**  
  `modules/lender-integration/tests/integration.test.ts`
- **Search:**  
  `modules/search/tests/global-search.integration.test.ts`
- **CRM pipeline automation:**  
  `modules/crm-pipeline-automation/tests/integration.test.ts`, `dealer-job-run.test.ts`
- **Portal-split:**  
  `tests/portal-split/internal-api.test.ts`

No Jest config or `package.json` scripts were changed; the same `npm run test` / `npm -w dealer run test` is used from repo root.

---

## 4. Remaining known limitations

- **DB-backed tests:** Integration tests that hit the real DB still require `TEST_DATABASE_URL` and respect `SKIP_INTEGRATION_TESTS=1`. Those describe blocks are skipped when DB is not available; this is intentional and documented.
- **Supabase/auth in route tests:** Route tests that use `jest.requireActual("@/lib/api/handler")` (or similar) now run in Node, which should avoid ESM/Supabase resolution issues in the jsdom context. If any route test still fails due to Supabase/auth loading, it may need a full mock of the handler (no `requireActual`) or further isolation.
- **New tests:** Any new test file that imports `@/lib/db` or server-only code must add `/** @jest-environment node */` at the top; otherwise it may see “PrismaClient is unable to run in this browser environment” when run in the default jsdom env.

---

*End of backend report.*
