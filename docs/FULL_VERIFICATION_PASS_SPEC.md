# Full Verification Pass — Spec

**Sprint:** Full Verification Pass — Tests, Bugs, Regressions, and Final Needed Fixes  
**Goal:** Run a full repo verification pass, identify real remaining issues, and fix only what is needed. No feature work.

---

## 1. Commands to run (in order)

| Step | Command | Scope |
|------|---------|--------|
| 1 | `npm run build` or `npm run build:dealer` | Root build / dealer build |
| 2 | `npm run lint:dealer` | Dealer ESLint |
| 3 | `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` | Unit / non-integration dealer tests (no DB) |
| 4 | `npm run test:dealer` (with `TEST_DATABASE_URL` in env, e.g. from `.env.local`) | Full dealer suite with integration |
| 5 | `npm run test:platform` (if part of release confidence) | Platform app tests |

**Environment:** Integration tests require `TEST_DATABASE_URL` set (e.g. via `.env.local` loaded by `jest.setup.ts`). No `SKIP_INTEGRATION_TESTS=1` for full pass.

---

## 2. Current expected test/build/lint paths

- **Build:** `apps/dealer`: `prisma generate && next build --webpack`. Root may use `scripts/vercel-build.js`.
- **Lint:** `apps/dealer`: `eslint .`.
- **Tests:** `apps/dealer`: Jest, single worker when `TEST_DATABASE_URL` set; `jest.setup.ts` loads `../../.env.local` and sets `DATABASE_URL` from `TEST_DATABASE_URL`.
- **Unit-only path:** Same Jest config; tests guarded by `hasDb` were removed (all run). To run without DB, use `SKIP_INTEGRATION_TESTS=1` and tests that hit DB will fail unless they are mocked.

---

## 3. Categories of issues to look for

| Category | Examples |
|----------|----------|
| **Failing tests** | Assertion failures, unhandled rejections, timeouts |
| **Flaky tests** | Order-dependent, timing-dependent, shared state |
| **Outdated assertions** | Expected code/API/error shape changed |
| **Mock wiring issues** | Wrong export mocked, `requireUser` vs `requireUserFromRequest`, async `importOriginal` in Jest |
| **Schema drift / DB env** | Missing column (`dead_letter`), migration not applied, wrong `TEST_DATABASE_URL` |
| **Accessibility / testability** | `act(...)` warnings, state updates not wrapped, missing `data-testid` |
| **Snapshot drift** | Snapshot outdated after intended UI/text change |
| **Type/build issues** | TS errors, missing deps, Prisma client out of date |
| **Lint violations** | New errors or warnings that block or should be fixed |

---

## 4. File plan

- **Spec:** `docs/FULL_VERIFICATION_PASS_SPEC.md` (this file).
- **Triage:** Group all findings by root cause before changing code.
- **Fixes:** Apply only targeted fixes (test fixtures, mocks, expectations, product bugs, timeouts, env, schema).
- **Report:** `docs/FULL_VERIFICATION_PASS_REPORT.md` — commands run, baseline, issues found/fixed, files changed, final counts, verdict.

---

## 5. Acceptance criteria for “verification complete”

- Build passes.
- Lint passes (no new errors; existing warnings documented if left as-is).
- Unit/non-integration path: no regressions (with `SKIP_INTEGRATION_TESTS=1` where applicable).
- Full dealer suite with integration: all suites pass, or remaining issues documented with root cause and recommended fix.
- No tenant/RBAC/audit/API shape regressions.
- No skip-based “solutions” for real failures.
- Report written with baseline, findings, fixes, and what remains (if anything).
