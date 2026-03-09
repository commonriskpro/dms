# Testing and QA Canonical

## 1. Test Frameworks in Use

Current frameworks by workspace:
- `apps/dealer`: Jest via `next/jest`
- `apps/platform`: Jest via `next/jest`
- `apps/mobile`: Jest with `jest-expo`
- `packages/contracts`: Jest with `ts-jest`
- `apps/worker`: Jest is declared, but no meaningful worker test suite was found

Important correction:
- Current repository test runner is Jest, not Vitest.

## 2. Current Test Inventory

Observed counts from repository scan:
- Dealer test files: about 224
- Platform test files: about 51
- Mobile test files: about 9

Strongest automated coverage areas:
- Dealer tenant isolation
- Dealer RBAC
- Inventory
- Customers
- Deals
- Reports
- Platform user/dealership/application RBAC
- Platform monitoring routes

Lighter coverage areas:
- Mobile
- Worker app
- External integration end-to-end behavior
- Billing automation because billing automation is not really implemented

## 3. Dealer Test Strategy

Config:
- `apps/dealer/jest.config.js`
- custom jsdom environment in `apps/dealer/jest.env.js`
- setup in `apps/dealer/jest.setup.ts`

Current behavior:
- Uses `next/jest`
- Uses custom environment so `Request`, `Response`, `Headers`, and `fetch` exist for route tests
- Disconnects Prisma after tests
- When `TEST_DATABASE_URL` is set and integration tests are not skipped, `maxWorkers` is forced to `1` to reduce DB exhaustion

Representative dealer coverage:
- Route tests under `apps/dealer/app/api/**/*.test.ts`
- Module tests under `apps/dealer/modules/*/tests`
- UI tests under `components/**/__tests__` and module UI test folders

## 4. Platform Test Strategy

Config:
- `apps/platform/jest.config.js`
- `apps/platform/jest.heavy.config.js`
- `apps/platform/jest.env.js`
- `apps/platform/jest.setup.ts`

Current behavior:
- Main config excludes a small set of heavy RBAC tests
- Separate heavy config runs those tests serially
- Max workers are limited to reduce memory pressure

Representative platform coverage:
- Route tests for auth, users, applications, dealerships, subscriptions, monitoring, audit
- Service tests for auth helpers, user enrichment, monitoring retention, onboarding helpers

## 5. Mobile Test Strategy

Config:
- `apps/mobile/jest.config.js`

Current behavior:
- Uses `jest-expo`
- Focuses mostly on validation, utility, auth edge cases, and config flags

Gap:
- No broad integration or UI navigation test suite was found for mobile.

## 6. Contracts and Worker Tests

Contracts:
- `packages/contracts` uses `ts-jest`
- Coverage target is source files under `src/**/*.ts`

Worker:
- `apps/worker` declares Jest but current script is `jest --passWithNoTests`
- This is effectively a coverage gap

## 7. How to Run Tests

From repo root:

Dealer:

```bash
npm run test:dealer
```

Dealer unit-oriented run:

```bash
npm run test:dealer:unit
```

Dealer integration-oriented run:

```bash
npm run test:dealer:integration
```

Platform:

```bash
npm run test:platform
```

Full root test sweep:

```bash
npm run test:all
```

Mobile:

```bash
cd apps/mobile
npm run test
```

Platform heavy tests:

```bash
cd apps/platform
npm run test:heavy
```

## 8. Database-Backed Test Requirements

Dealer integration tests:
- Depend on `TEST_DATABASE_URL` or appropriate DB env setup
- Can be skipped with `SKIP_INTEGRATION_TESTS=1`
- Reuse Prisma and route-layer server code, so DB migrations must be current

Current risk:
- Legacy localhost docs still describe Vitest commands and older test expectations.

## 9. Manual QA Coverage

Useful existing reference document:
- `docs/MANUAL-SMOKE-TEST-CHECKLIST.md`

Treat it as reference, not canonical truth.

Recommended current manual QA paths:
1. Dealer auth: login, logout, reset password, session switch.
2. Dealer onboarding: apply/invite, owner accept, get-started flow.
3. Inventory: create vehicle, VIN decode, photos, costs, recon, pricing, publish/unpublish.
4. Customers/CRM: create customer, notes/tasks/callbacks, opportunity stage movement.
5. Deals/F&I: create deal, add fees/trade, finance products, title/funding/delivery transitions.
6. Platform: approve application, provision dealership, send owner invite, monitoring dashboard.
7. Mobile: login, fetch dashboard, create/edit inventory/customer/deal records against dealer backend.

## 10. Flaky or Sensitive Areas

Operationally sensitive:
- DB-backed dealer integration tests when connection pools are constrained
- Heavy platform RBAC suites
- Tests involving Next.js route environments and mocked server primitives

Structurally under-covered:
- Worker job execution
- Real third-party integration behavior
- Mobile end-to-end flows
- Deployment automation

## 11. CI State

What is present:
- GitHub Actions deploy workflow for migrations

What was not found:
- Dedicated test CI workflow
- Browser E2E framework

Implication:
- The repo relies heavily on local/agent test execution and targeted suites.

## 12. QA Summary

Current testing posture:
- Strong unit/integration coverage across core dealer and platform backend logic
- Good RBAC and tenant-isolation coverage
- Moderate component/UI test coverage for important dealer surfaces
- Light coverage for mobile
- Minimal meaningful coverage for worker behavior
