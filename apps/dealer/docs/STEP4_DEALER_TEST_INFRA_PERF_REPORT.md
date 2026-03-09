# Step 4 — Dealer Test Infra Perf Report

**Document:** `apps/dealer/docs/STEP4_DEALER_TEST_INFRA_PERF_REPORT.md`

---

## Run configuration

- **Command:** `npm run test:dealer` from repo root (runs `npx jest` in `apps/dealer`).
- **Jest:** Single config; `maxWorkers` is reduced to 2 when `TEST_DATABASE_URL` is set and `SKIP_INTEGRATION_TESTS !== "1"` to avoid DB contention.

## Observed run (after hardening)

- **Wall time:** ~83 s for full suite (140 test suites).
- **Result:** 91 passed, 49 failed; 764 tests passed, 166 failed.
- No change was made to worker count or test timeouts in this sprint. Some integration suites (e.g. lender-integration) hit the default 5000 ms timeout; those are test-logic issues, not infra.

## Performance notes

- Per-file environment selection (`@jest-environment node`) adds negligible overhead.
- Running DB-backed tests in Node avoids the previous failure path (Prisma browser build), so total run time is now dominated by actual test execution rather than early suite failures.
- For faster feedback, consider running a subset locally, e.g. `npm -w dealer run test -- modules/deals/tests/deal-desk.test.ts`.
