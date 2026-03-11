# Dealer Test Infrastructure Hardening — Frontend Report

**Document:** `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_FRONTEND_REPORT.md`

---

## Summary

Frontend/UI test changes in this sprint were **minimal**. No product UI was redesigned; no component tests were refactored for style.

## What was checked

- **Environment:** Component and UI tests continue to run in the **default jsdom** environment (custom `jest.env.js`). They were not given `@jest-environment node` and must not import `@/lib/db` or server-only paths.
- **Imports:** No change was made to component test files. The only test-file edits were adding `/** @jest-environment node */` to **test files that import `@/lib/db`** or that use the real API handler; those are route/integration tests, not UI tests.
- **Representative UI suites:** After the backend changes, the following frontend-related suites **pass** (run in jsdom as intended):
  - `components/inventory/dashboard/__tests__/InventoryDashboardHeader.test.tsx`
  - `app/(app)/get-started/__tests__/GetStartedClient.test.tsx`
  - `app/(app)/dashboard/__tests__/switchDealership-render.test.tsx`
  - `app/(app)/dashboard/__tests__/page.test.tsx`
  - `app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`
  - `components/dashboard-v3/__tests__/dashboard-ui-tokens.test.ts`
  - `components/dashboard-v3/__tests__/dashboard-style-policy.test.ts`
  - `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx`
  - `components/app-shell/__tests__/topbar-lifecycle-badge.test.tsx`
  - `components/journey-bar/__tests__/SegmentedJourneyBar.test.tsx`
  - `modules/customers/ui/__tests__/lead-action-strip.test.tsx`
  - `modules/search/ui/__tests__/GlobalSearch.test.tsx`
  - `modules/crm-pipeline-automation/ui/__tests__/*` (multiple)
  - `modules/inventory/ui/__tests__/inventory-permissions.test.tsx`
  - `app/platform/__tests__/*`
  - `app/__tests__/home-invite-cta.test.tsx`
  - `contexts/__tests__/dealer-lifecycle-context.test.tsx`
  - `tests/ui-tokens-policy.test.ts`

## Failures that are frontend-related

Some **component/page tests** still fail; they are not due to the environment split and were not changed in this sprint:

- `app/(app)/@modal/(.)customers/profile/[id]/__tests__/page.test.tsx`
- `app/(app)/customers/__tests__/page.test.tsx` (marked PASS in the run; if it fails elsewhere, it’s a pre-existing issue)
- `modules/customers/ui/__tests__/customers-ui.test.tsx`
- `app/__tests__/accept-invite.test.tsx`

These should be fixed in a separate pass (mocking, async, or routing). They are **not** caused by the Node vs jsdom split.

## Guidance for future UI tests

- Keep component and UI tests in **jsdom** (no `@jest-environment node`).
- Do **not** import `@/lib/db`, Prisma, or server-only API/auth modules in UI test files. Mock handlers or use testing-library only.
- If a component test needs to render something that pulls in server code, mock that dependency at the boundary (e.g. mock the route or data-fetching hook) so the test file itself stays in jsdom.

---

*End of frontend report.*
