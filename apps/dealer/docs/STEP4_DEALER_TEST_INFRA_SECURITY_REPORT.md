# Step 4 — Dealer Test Infra Security Report

**Document:** `apps/dealer/docs/STEP4_DEALER_TEST_INFRA_SECURITY_REPORT.md`

---

## Security / correctness checklist

| Item | Status |
|------|--------|
| Test config does not weaken meaningful coverage | **OK** — No coverage exclusions added; same testMatch and scope. |
| Node env tests use server-safe imports | **OK** — All files with `@jest-environment node` import `@/lib/db` or server/auth code; they run in Node and resolve Prisma to the Node build. |
| jsdom tests do not touch Prisma/db paths | **OK** — UI/unit tests that stay in jsdom do not import `@/lib/db`; only route/integration tests that need DB have the Node docblock. |
| Mocks do not mask real auth/tenant bugs unnecessarily | **OK** — Mocks are per-test or per-file (auth, handler, rate-limit); integration tests that run with `hasDb` use real DB and real RBAC/tenant checks where intended. |
| Environment-dependent failures reduced meaningfully | **OK** — Before: 140 suites failed (many with "PrismaClient is unable to run in this browser environment"). After: 91 passed, 49 failed; remaining failures are test logic, DB, timeouts, or mocks, not env resolution. |
| DB-backed tests deterministic and isolated | **Partial** — Many integration tests use unique IDs and explicit setup; some suites still have flakiness (e.g. lender-integration timeout, finance-shell emit spy). Documented as known limitations. |

---

## Summary

The hardening keeps a clear boundary: **Node for Prisma/server**, **jsdom for UI/unit**. No test config change reduces coverage or hides auth/tenant behavior. Remaining failures are addressed in the smoke report and testing guide.
