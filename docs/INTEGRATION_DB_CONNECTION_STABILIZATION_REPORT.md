# Integration DB Connection Stabilization — Report

**Sprint:** Integration DB Connection Stabilization  
**Goal:** Reduce integration-test DB pressure so the full dealer suite can pass honestly.

---

## 1. Connection fixes applied

| Change | File | Description |
|--------|------|-------------|
| **Pool size** | `apps/dealer/lib/db.ts` | When `TEST_DATABASE_URL` is set, use `connection_limit=1` (was 2) so the test process uses at most one DB connection. |
| **Release between files** | `apps/dealer/jest.setup.ts` | Added `afterAll(async () => { ... await prisma.$disconnect(); })` so the shared Prisma client disconnects after each test file. The next file’s first use of `prisma` reconnects. Connections are no longer held for the entire run. |
| **maxWorkers** | `apps/dealer/jest.config.js` | No change; remains `maxWorkers: 1` when integration is enabled. |

---

## 2. Files changed

- `apps/dealer/lib/db.ts` — `connection_limit=2` → `connection_limit=1` for test DB.
- `apps/dealer/jest.setup.ts` — `afterAll` that calls `prisma.$disconnect()`.
- `docs/INTEGRATION_DB_CONNECTION_STABILIZATION_SPEC.md` — created (audit, plan, acceptance criteria).
- `docs/INTEGRATION_DB_CONNECTION_STABILIZATION_REPORT.md` — this report.

---

## 3. Commands run

| Command | Result |
|---------|--------|
| `npm run build` | **PASS** |
| `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` | **PASS** — 142 passed, 41 skipped, 0 failed. |
| `npm run test:dealer` (full suite, with `TEST_DATABASE_URL`) | **5 failed suites**, **11 failed tests**; 177 passed suites, 1340 passed tests. ~103 s. |

---

## 4. Final suite counts

| Metric | Before (post–schema-audit) | After (this sprint) |
|--------|----------------------------|----------------------|
| Failed suites | 20 | **5** |
| Failed tests | 87 | **11** |
| Passed suites | 162 | **177** |
| Passed tests | 1263 | **1340** |

Connection stabilization **materially improved** the suite: 15 fewer failed suites, 76 fewer failed tests.

---

## 5. Is the full suite green?

**No.** Five suites still fail:

| # | Suite | Failure type |
|---|-------|---------------|
| 1 | modules/core-platform/tests/session-switch.test.ts | Suite failed to run: `importOriginal is not a function` in jest.mock; `ApiError` instanceof check. Jest/mock or load-order issue. |
| 2 | modules/core-platform/tests/platform-admin.test.ts | `requireUser` undefined when calling `mockResolvedValueOnce` — mock not set up as expected. |
| 3 | modules/core-platform/tests/platform-admin-create-account.test.ts | One test failed: `roleId` expected `06b0bbd3-...` (roleAId), received `ee000000-...` — possible shared state or role from another test. |
| 4 | modules/crm-pipeline-automation/tests/integration.test.ts | Timeout or assertion (run ~19 s). |
| 5 | modules/inventory/tests/slices-defg.security.test.ts | Recon: `reconCostCents` expected 3500, received 7000 — possible shared state or test order. |

None of these are “too many database connections”; they are test isolation, mocks, or timeouts. No skip-based solutions were added; integration tests remain real.

---

## 6. Blockers remaining (exact)

- **session-switch.test.ts:** Test file fails to load (Jest mock factory `importOriginal` / ApiError). Needs Jest or mock fix; likely unrelated to DB connection.
- **platform-admin.test.ts:** Auth mock (`requireUser`) undefined when tests run. May be mock setup order or module re-evaluation.
- **platform-admin-create-account.test.ts:** Single test’s `roleId` assertion; `ensureTestData()` may be returning a different role in some run order.
- **crm-pipeline-automation integration:** Long-running; may need timeout bump or isolation (e.g. VIN uniqueness).
- **slices-defg.security.test.ts:** Recon cost assertion; possible cross-test vehicle/recon state.

---

## 7. Verdict

- **Connection fixes:** Effective. Reducing pool size to 1 and disconnecting after each file removed connection exhaustion as the dominant failure; 15 previously failing suites now pass.
- **Full suite green:** Not yet. Five suites still fail for non-connection reasons (mocks, isolation, timeout). Addressing them is out of scope for this sprint.
- **Security & QA:** No product or tenant/RBAC/audit changes; only connection and teardown behavior. Build and unit-only path pass.
