# Step 4 — Dealer Test Infra Smoke Report

**Document:** `apps/dealer/docs/STEP4_DEALER_TEST_INFRA_SMOKE_REPORT.md`

---

## Command and result

From **repo root**:

```bash
npm run test:dealer
```

- **Result (after hardening):** Test Suites: 49 failed, 91 passed, 140 total. Tests: 166 failed, 764 passed, 930 total.
- **Before hardening:** 140 suites failed (environment/Prisma resolution); 0 tests ran.

---

## Representative suites — passing

- **Deal-desk / deals:** `modules/deals/tests/deal-desk.test.ts`, `deal-math.test.ts`, `calculations.test.ts`, `validation.test.ts`, `rbac.test.ts`, `tenant-isolation.test.ts`, `deal-transitions.test.ts`
- **Route (API):** `app/api/health/route.test.ts`, `app/api/me/current-dealership/route.test.ts`, `app/api/me/dealerships/route.test.ts`, `app/api/auth/session/switch/route.test.ts`, `app/api/auth/onboarding-status/route.test.ts`, `app/api/crm/jobs/run/route.test.ts`, `app/api/customers/route.test.ts`, `app/api/customers/route.integration.test.ts`
- **Dashboard:** `modules/dashboard/tests/getDashboardV3Data.test.ts`, `dashboard-layout-persistence.test.ts`, `merge-dashboard-layout.test.ts`, `floorplan-cache.test.ts`, `dashboard-layout-schemas.test.ts`
- **Documents:** `modules/documents/tests/rbac.test.ts`, `upload-validation.test.ts`, `audit.test.ts`, `tenant-isolation.test.ts`
- **Reports:** `modules/reports/tests/integration/reports.test.ts`
- **Inventory:** `modules/inventory/tests/rbac.test.ts`, `upload-validation.test.ts`, `audit.test.ts`, `tenant-isolation.test.ts`, `vehicle-photo-backfill.test.ts`
- **Lib:** `lib/platform-admin.test.ts`, `lib/rate-limit-stats.test.ts`, `lib/job-run-stats.test.ts`, `lib/tenant-status.test.ts`, `lib/audit.test.ts`
- **CRM pipeline (unit):** `modules/crm-pipeline-automation/tests/dealer-job-run.test.ts`, `unit.test.ts`
- **Search:** `modules/search/tests/global-search.integration.test.ts`
- **UI:** Multiple component/dashboard/journey-bar/platform tests (see frontend report).

---

## Representative suites — failing (post-hardening)

Failures are **no longer** due to "PrismaClient is unable to run in this browser environment". They fall into:

1. **DB / integration:** Core-platform (rbac, session-switch, platform-admin, files, audit, tenant-isolation, platform-admin-create-account), customers (rbac, activity, audit, tenant-isolation, saved-filters-searches, soft-delete, timeline-callbacks-lastvisit), dashboard (dashboard.test.ts), CRM integration (integration.test.ts — e.g. dealerJobRun.create), finance-shell (integration — e.g. emit spy), lender-integration (integration — timeout), portal-split (internal-api, owner-invite-internal).
2. **Route / API:** Some route tests still fail (e.g. invite resolve/accept, deals [id], customers [id], inventory dashboard, book-values, vin-decode, backfill) — often due to mocks or handler setup, not env.
3. **Unit / other:** reports unit (aging, export, penetration), lib (errors, internal-rate-limit), inventory (inventory-page, inventory-intelligence-dashboard, inventory-hardening, dashboard, vin-decode-cache, floorplan-loans.interest), permissions-list, job-worker-tenant, deals (immutability-and-one-deal, audit), and a few UI tests (customers-ui, accept-invite, modal page).

These should be triaged as **real code or test logic issues** (DB state, timeouts, mocks, spies) in follow-up work.

---

## Regression checklist

| Check | Status |
|-------|--------|
| Representative UI tests still pass | **Yes** — See frontend report and passing list above. |
| Representative route/server tests still pass | **Yes** — Health, me/*, auth/session/switch, onboarding-status, crm/jobs/run, customers route (unit + integration) pass. |
| Representative DB-backed tests still pass | **Yes** — deal-desk, reports integration, documents tenant-isolation, inventory tenant-isolation, customers route.integration, deals tenant-isolation, vehicle-photo-backfill pass. |
| Deal-desk tests still pass | **Yes** — `modules/deals/tests/deal-desk.test.ts` passes. |

---

## Conditional skip

- **TEST_DATABASE_URL:** DB-backed integration tests that use `(hasDb ? describe : describe.skip)` are skipped when `TEST_DATABASE_URL` is not set or `SKIP_INTEGRATION_TESTS=1`. This is intentional and documented.
- No new conditional skips were introduced in this sprint.
