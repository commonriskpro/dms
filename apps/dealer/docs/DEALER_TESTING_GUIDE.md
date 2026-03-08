# Dealer App Testing Guide

**Document:** `apps/dealer/docs/DEALER_TESTING_GUIDE.md`

Use this guide when writing or changing tests in the dealer app.

---

## 1. Running tests

From **repo root**:

```bash
npm run test:dealer
```

This runs the full dealer Jest suite. From the `apps/dealer` directory you can also run:

```bash
npm run test
npm run test:watch
```

To run a single file:

```bash
npm -w dealer run test -- path/to/test-file.test.ts
```

---

## 2. Test environment: Node vs jsdom

- **Default:** All tests run in a **jsdom** environment (custom `jest.env.js` that adds Node-like `Request`, `Response`, `Headers`, `fetch`). This is correct for **unit tests** and **UI/component tests** that do not use Prisma or server-only code.

- **Node:** Any test file that imports **`@/lib/db`** or that loads **server-side Prisma/auth/Supabase** (e.g. route handlers that use the real handler) must run in **Node**, or you will see:
  - `PrismaClient is unable to run in this browser environment`

**Rule:** Add this as the **first line** of the test file:

```ts
/** @jest-environment node */
```

Examples: `modules/deals/tests/deal-desk.test.ts`, `app/api/health/route.test.ts`, `modules/dashboard/tests/getDashboardV3Data.test.ts`. See `DEALER_TEST_INFRA_HARDENING_SPEC.md` for the full list and rationale.

---

## 3. Test categories

| Category | Environment | DB required? | Notes |
|----------|-------------|--------------|--------|
| **Unit** | jsdom | No | Pure logic, schemas, math. No `@/lib/db`. |
| **UI / component** | jsdom | No | React components. Do not import Prisma or server-only paths. |
| **Route** | Node if handler uses DB/auth | Sometimes | Mock auth/handler when testing only route logic; use Node when using real handler. |
| **Integration / DB** | Node | Yes (when not skipped) | Import `@/lib/db` or services that use Prisma. Use `TEST_DATABASE_URL` and optional skip (see below). |

---

## 4. DB-backed tests (TEST_DATABASE_URL, SKIP_INTEGRATION_TESTS)

- **TEST_DATABASE_URL:** Set in `.env.local` (or env) to point to a test database. `jest.setup.ts` sets `DATABASE_URL` from it when present so Prisma and tests use the same DB.
- **Prisma client:** `npm run test` runs `prisma generate` before Jest (via `pretest`). If you run Jest another way, run `npm run db:generate` (from root) or `npx prisma generate` from `apps/dealer` first.
- **Migrations:** Apply dealer migrations to the test DB before running integration tests. Set `DATABASE_URL` (or `DIRECT_DATABASE_URL`) in `.env.local` to the same URL as `TEST_DATABASE_URL`, then from repo root run `npm run db:migrate`. Or run `cd apps/dealer && npx prisma migrate deploy` with `DATABASE_URL` pointing at the test DB.
- **SKIP_INTEGRATION_TESTS:** Set to `1` to skip integration describe blocks that guard with `hasDb`:

  ```ts
  const hasDb = process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL;
  (hasDb ? describe : describe.skip)("Integration …", () => { … });
  ```

- DB-backed tests should use **deterministic data** (fixed UUIDs, isolated ids per test) and avoid order-dependent assertions.

---

## 5. Writing new tests

- **Unit / UI:** Put the file in the usual places (`__tests__/*.test.ts(x)`, `**/*.test.ts(x)`). Do **not** import `@/lib/db` or server-only modules. No need for `@jest-environment node`.
- **Integration / route that use Prisma or real handler:** Put the file in the same patterns, but add **`/** @jest-environment node */**` at the very top. Use mocks where appropriate (e.g. `jest.mock("@/lib/db")` for unit-style tests that don’t need a real DB).
- **Naming:** Existing names are fine. New DB-backed tests are encouraged to use `*.integration.test.ts` or live under `**/tests/**`.

---

## 6. References

- **Spec:** `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_SPEC.md`
- **Backend report:** `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_BACKEND_REPORT.md`
- **Frontend report:** `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_FRONTEND_REPORT.md`
- **Security / smoke / perf:** `STEP4_DEALER_TEST_INFRA_*.md` in this folder.
