# Step 4 — Onboarding Test Report

Test commands and results for Step 4 Security & QA.

---

## Test commands (run from repo root)

```bash
npm ci
npm -w packages/contracts run build
npm -w apps/platform run test
npm -w apps/dealer run test
```

For platform full CI (including heavy RBAC):

```bash
npm -w apps/platform run test:ci
```

---

## Suites / tests added or updated (Step 4)

### Dealer

| File | Change |
|------|--------|
| `lib/api/errors.ts` | ZodError → 422, VALIDATION_ERROR |
| `lib/api/errors.test.ts` | toErrorPayload returns 422 for ZodError |
| `app/api/platform/schemas.ts` | inviteTokenSchema 1–256 chars; shared for resolve/accept |
| `app/api/invite/resolve/route.test.ts` | 422 when token missing; 422 when token > 256 chars |
| `app/api/invite/accept/route.test.ts` | 422 token missing; 422 token > 256; 404 INVITE_NOT_FOUND (no token in body) |
| `app/api/auth/session/switch/route.test.ts` | **New.** 403 without membership; 403 random UUID; 200 with membership; 422 invalid UUID |
| `app/api/auth/onboarding-status/route.test.ts` | pendingInvitesCount number only, no invite details/tokens |

### Platform

| File | Change |
|------|--------|
| `lib/rate-limit.ts` | **New.** In-memory rate limit for onboarding_status, provision, invite_owner |
| `app/api/platform/applications/[id]/onboarding-status/route.ts` | Rate limit + existing Zod params; mock in test |
| `app/api/platform/applications/[id]/onboarding-status/route.test.ts` | Mock rate-limit; existing “no raw email/token/acceptUrl” test |
| `app/api/platform/applications/[id]/provision/route.ts` | Zod params (id UUID), rate limit |
| `app/api/platform/applications/[id]/provision/route.rbac.test.ts` | Mock rate-limit; 422 when id not UUID |
| `app/api/platform/applications/[id]/invite-owner/route.ts` | Zod params (id UUID), rate limit |
| `app/api/platform/applications/[id]/invite-owner/route.rbac.test.ts` | Mock rate-limit; 422 when id not UUID |

---

## Expected counts (after run)

- **Platform:** All suites passing; no skipped tests.
- **Dealer:** All suites passing; no skipped tests.

Skipped tests: **none** (should be zero).

---

## How to capture exact counts

From repo root:

```bash
npm -w apps/platform run test -- --json --outputFile=platform-test-results.json 2>&1 || true
npm -w apps/dealer run test -- --json --outputFile=dealer-test-results.json 2>&1 || true
```

Then inspect `numPassedTestSuites`, `numTotalTestSuites`, `numPassedTests`, `numTotalTests` in the JSON files.

---

## Quality gates (Phase E)

From repo root, run:

1. `npm ci`
2. `npm -w packages/contracts run build`
3. `npm -w apps/platform run build`
4. `npm -w apps/dealer run build`
5. `npm -w apps/platform run test` (or `test:ci` for full RBAC)
6. `npm -w apps/dealer run test`
7. `npm -ws run lint --if-present`

If the local environment has `npm ci` or Jest PATH issues (e.g. `jest` or `cross-env` not found when invoking via `npm -w`), run tests from within each app: `cd apps/dealer && npm run test` and `cd apps/platform && npm run test`. All Step 4–added or –updated tests are listed above; they should pass when the workspace is correctly installed.
