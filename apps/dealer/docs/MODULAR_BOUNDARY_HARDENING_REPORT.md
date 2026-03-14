# Modular Boundary Hardening Report

## Files Changed

### Routes and pages

- `app/api/me/current-dealership/route.ts`
- `app/api/auth/session/switch/route.ts`
- `app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts`
- `app/api/public/websites/lead/route.ts`
- `app/api/websites/domains/route.ts`
- `app/api/me/route.ts`
- `app/api/me/dealerships/route.ts`
- `app/api/auth/dealerships/route.ts`
- `app/api/auth/onboarding-status/route.ts`
- `app/api/support-session/consume/route.ts`
- `app/api/internal/dealerships/[dealerDealershipId]/status/route.ts`
- `app/api/crm/jobs/run/route.ts`
- `app/api/intelligence/jobs/run/route.ts`
- `app/(app)/sales/page.tsx`
- `app/(app)/admin/users/[userId]/page.tsx`
- `app/api/customers/route.ts`
- `app/api/customers/[id]/route.ts`
- `app/(app)/@modal/(.)customers/profile/[id]/page.tsx`

### Services and serializers

- `modules/core-platform/service/session.ts`
- `modules/core-platform/service/dealership.ts`
- `modules/core-platform/db/dealership.ts`
- `modules/core-platform/service/permission.ts`
- `modules/admin-core/service/permission.ts`
- `modules/customers/service/task.ts`
- `modules/customers/service/customer.ts`
- `modules/deals/service/deal.ts`
- `modules/inventory/service/vehicle.ts`
- `modules/inventory/service/floorplan.ts`
- `modules/deals/service/deal-pipeline.ts`
- `modules/customers/service/team-activity.ts`
- `modules/integrations/service/webhooks.ts`
- `modules/search/service/global-search.ts`
- `modules/platform-admin/service/invite.ts`
- `modules/platform-admin/db/invite.ts`
- `modules/customers/serialize.ts`
- deleted `lib/serialization/customers.ts`

### Tests and docs

- `app/api/me/current-dealership/route.test.ts`
- `app/api/auth/session/switch/route.test.ts`
- `app/api/me/route.test.ts`
- `app/api/me/dealerships/route.test.ts`
- `app/api/auth/dealerships/route.test.ts`
- `app/api/auth/onboarding-status/route.test.ts`
- `app/(app)/sales/__tests__/page.test.tsx`
- `tests/portal-split/owner-invite-internal.test.ts`
- `tests/portal-split/internal-api.test.ts`
- `tests/architecture/modular-boundaries.test.ts`
- `docs/MODULAR_BOUNDARY_HARDENING_SPEC.md`
- `docs/MODULAR_BOUNDARY_HARDENING_REPORT.md`

## Violations Found

### Route layer

- `app/api/me/current-dealership/route.ts` mixed Prisma, dealership-switch rules, and audit handling.
- `app/api/auth/session/switch/route.ts` duplicated the same dealership-switch workflow and talked to Prisma directly.
- `app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts` contained idempotency, invite reuse, role lookup, invite creation, and audit behavior inline.
- `app/api/public/websites/lead/route.ts` resolved site ownership from hostname via Prisma in the route.
- `app/api/websites/domains/route.ts` looked up `websiteSite` via Prisma in the route.
- `app/api/me/route.ts` read dealership identity via Prisma in the route.
- `app/api/me/dealerships/route.ts` listed memberships via Prisma in the route.
- `app/api/auth/dealerships/route.ts` listed memberships via Prisma in the route.
- `app/api/auth/onboarding-status/route.ts` counted memberships and pending invites via Prisma in the route.
- `app/api/support-session/consume/route.ts` checked dealership lifecycle state via Prisma in the route.
- `app/api/internal/dealerships/[dealerDealershipId]/status/route.ts` updated dealership status and wrote audit data inline.
- `app/api/crm/jobs/run/route.ts` listed all dealership ids via Prisma in the cron path.
- `app/api/intelligence/jobs/run/route.ts` listed all dealership ids via Prisma in the cron path.

### UI/page layer

- `app/(app)/sales/page.tsx` imported `modules/customers/db/tasks`.
- `app/(app)/admin/users/[userId]/page.tsx` imported `modules/admin-core/db/permission`.

### Cross-module DB access

- `modules/search/service/global-search.ts` imported:
  - `modules/customers/db/customers`
  - `modules/deals/db/deal`
  - `modules/inventory/db/vehicle`

### Lib ownership

- `lib/serialization/customers.ts` was customer-domain serialization logic outside the owning module.

## Violations Fixed

### Route layer

- Extracted active-dealership read/switch logic into `modules/core-platform/service/session.ts`.
- Updated `app/api/me/current-dealership/route.ts` to call the new session service instead of Prisma directly.
- Updated `app/api/auth/session/switch/route.ts` to call the same session service instead of duplicating membership/dealership logic.
- Moved internal owner-invite orchestration behind `modules/invite-bridge/service/invite` via `modules/platform-admin/service/invite.ts`.
- Updated `app/api/public/websites/lead/route.ts` to resolve the published site through `modules/websites-public/service.ts`.
- Updated `app/api/websites/domains/route.ts` to resolve the dealer site through `modules/websites-core/service/site.ts`.
- Updated `app/api/me/route.ts` to read through `modules/core-platform/service/session.ts`.
- Updated `app/api/me/dealerships/route.ts` to read through `modules/core-platform/service/session.ts`.
- Updated `app/api/auth/dealerships/route.ts` to read through `modules/core-platform/service/session.ts`.
- Updated `app/api/auth/onboarding-status/route.ts` to read membership and invite state through session and invite services.
- Updated `app/api/support-session/consume/route.ts` to read dealership lifecycle state through the dealership service.
- Updated `app/api/internal/dealerships/[dealerDealershipId]/status/route.ts` to delegate lifecycle updates and audit behavior to the dealership service.
- Updated `app/api/crm/jobs/run/route.ts` and `app/api/intelligence/jobs/run/route.ts` to read dealership ids through the dealership service in cron mode.
- Updated `app/api/admin/bootstrap-link-owner/route.ts` to link the demo owner through a core-platform bootstrap service.
- Updated `app/api/health/route.ts` to read environment and database readiness through a core-platform health service.

### UI/page layer

- Replaced the `sales` page direct `db/*` import with `modules/customers/service/task.ts`.
- Replaced the admin user detail page direct `db/*` import with `modules/admin-core/service/permission.ts`.

### Cross-module DB access

- Reworked `modules/search/service/global-search.ts` to call customer, deal, and vehicle service functions instead of foreign `db/*` packages.
- Added narrow service wrappers for those search calls in:
  - `modules/customers/service/customer.ts`
  - `modules/deals/service/deal.ts`
  - `modules/inventory/service/vehicle.ts`
- Reworked `modules/platform-admin/service/invite.ts` to call admin-core membership and role services instead of foreign `db/*`.
- Reworked `modules/inventory/service/vehicle.ts` to validate locations through the dealership service boundary instead of `db/location`.
- Removed an unused foreign `db/*` import from `modules/finance-core/service/documents.ts`.
- Reworked `modules/customers/service/team-activity.ts` to use the deals service boundary.
- Reworked `modules/deals/service/deal-pipeline.ts` to use the customers service boundary.
- Reworked `modules/integrations/service/webhooks.ts` to resolve customers through the customers service boundary.
- Reworked `modules/inventory/service/floorplan.ts` to validate lenders through the lender service boundary.
- Reworked `modules/customers/service/inbox.ts` to read canonical inbox data through `modules/crm-inbox/service/conversations.ts` instead of foreign `db/*`.
- Reworked `modules/crm-pipeline-automation/service/command-center.ts` to read stale leads and due tasks through customer and task services.
- Reworked `modules/crm-pipeline-automation/service/journey-bar.ts` to read customer state through the customers service boundary.
- Reworked `modules/crm-pipeline-automation/service/stage-transition.ts` to update customer stage through the customers service boundary.
- Reworked `modules/dashboard/service/dashboard.ts` to read customer/task/pipeline data through service boundaries.
- Reworked `modules/dashboard/service/getDashboardV3Data.ts` to read customer/task data through service boundaries.

### Lib ownership

- Moved customer serialization helpers from `lib/serialization/customers.ts` to `modules/customers/serialize.ts`.
- Updated all known call sites to import from the owning module.
- Re-homed tracked internal job telemetry from `lib/internal-job-run.ts` to `modules/crm-pipeline-automation/service/dealer-job-run.ts`.

## Guardrails Added

Added `tests/architecture/modular-boundaries.test.ts` with explicit assertions for:

1. route files importing `@/lib/db`
2. UI files importing `modules/*/db/*`
3. module source files importing another module's `db/*`
4. `lib/` importing module-layer code

The guardrail test uses small explicit allowlists for legacy exceptions that remain outside the minimal safe refactor set.

## Tests Added Or Updated

- Updated `app/api/me/current-dealership/route.test.ts` to validate the refactored session-service-backed route behavior.
- Updated `app/api/auth/session/switch/route.test.ts` to validate the shared session-service-backed switch behavior.
- Added `app/api/me/route.test.ts` for the refactored session-backed current-user route.
- Updated `app/api/me/dealerships/route.test.ts` for the refactored session-backed dealership list route.
- Added `app/api/auth/dealerships/route.test.ts` for the refactored auth dealership list route.
- Updated `app/api/auth/onboarding-status/route.test.ts` for the refactored session/invite-backed onboarding route.
- Added `app/api/admin/bootstrap-link-owner/route.test.ts` for the refactored bootstrap-link-owner route.
- Updated `app/api/health/route.test.ts` for the refactored health route.
- Updated `app/(app)/sales/__tests__/page.test.tsx` to assert the page now uses the task service boundary.
- Updated `tests/portal-split/owner-invite-internal.test.ts` so the route test isolates auth/validation without traversing the full invite implementation tree.
- Reused `tests/portal-split/internal-api.test.ts` to verify the refactored internal dealership status route still updates lifecycle state and audit rows.
- Added `tests/architecture/modular-boundaries.test.ts` for import-boundary enforcement.

## Commands Run

### Successful commands

- `npx jest --runTestsByPath "app/api/me/current-dealership/route.test.ts" "app/api/auth/session/switch/route.test.ts" "app/(app)/sales/__tests__/page.test.tsx" "tests/architecture/modular-boundaries.test.ts" "tests/portal-split/owner-invite-internal.test.ts"`
  - Result: 5 suites passed, 22 tests passed.

- `npx jest --runTestsByPath "app/api/me/route.test.ts" "app/api/me/dealerships/route.test.ts" "app/api/auth/dealerships/route.test.ts" "tests/architecture/modular-boundaries.test.ts" "tests/portal-split/owner-invite-internal.test.ts" "app/api/me/current-dealership/route.test.ts" "app/api/auth/session/switch/route.test.ts"`
  - Result: 7 suites passed, 21 tests passed.

- `npx jest --runTestsByPath "app/api/auth/onboarding-status/route.test.ts" "tests/architecture/modular-boundaries.test.ts" "tests/portal-split/internal-api.test.ts"`
  - Result: 3 suites passed, 14 tests passed.

- `npx eslint "app/api/me/current-dealership/route.ts" "app/api/auth/session/switch/route.ts" "app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts" "app/api/public/websites/lead/route.ts" "app/api/websites/domains/route.ts" "app/(app)/sales/page.tsx" "app/(app)/admin/users/[userId]/page.tsx" "modules/core-platform/service/session.ts" "modules/platform-admin/service/invite.ts" "modules/search/service/global-search.ts" "modules/customers/service/task.ts" "modules/customers/service/customer.ts" "modules/deals/service/deal.ts" "modules/inventory/service/vehicle.ts" "modules/customers/serialize.ts" "tests/architecture/modular-boundaries.test.ts"`
  - Result: passed with no findings.

- `npm run build:dealer`
  - Result: passed after one local fix in `app/(app)/sales/page.tsx`.
  - Warnings only: existing Next/Supabase webpack critical dependency warnings from `@supabase/realtime-js`.

### Notable failed or non-trustworthy attempts

- `npm run test:dealer -- --runTestsByPath ...`
  - Initial attempt failed because the shell expanded the `app/(app)` path incorrectly.

- `npm --prefix apps/dealer run lint -- ...`
  - Not trustworthy for targeted verification because the package script expands to `eslint .` and surfaced unrelated pre-existing repo errors outside this sprint.
  - Replaced with direct `npx eslint <changed files>` for affected-file validation.

## Residual Exceptions / Accepted Deviations

### Route direct Prisma allowlist

- None.

### Cross-module `db/*` allowlist

- None.

### Lib allowlist

- None.

## Before / After Summary

### Route layer

- Before: multiple dealer routes talked to Prisma directly and duplicated business workflows.
- After: dealer routes now read and write through explicit service boundaries instead of importing `@/lib/db` directly.

### Service / DB split

- Before: search crossed directly into foreign module `db/*`.
- After: search, invite orchestration, inbox fallback reads, CRM automation reads/writes, dashboard aggregation, vehicle location validation, and document ownership all read through service boundaries, leaving no documented cross-module `db/*` exceptions.

### Cross-module calls

- Before: no static enforcement, so drift was convention-only.
- After: Jest guardrails codify the boundary rules with zero documented route, cross-module `db/*`, or `lib` exceptions.

### UI / domain leakage

- Before: two page surfaces imported `db/*` directly.
- After: those page surfaces now read through service boundaries.

### Lib ownership

- Before: customer serialization and tracked internal job telemetry lived in `lib/`.
- After: both now live under owning modules, and the `lib` guardrail has no remaining documented exceptions.
