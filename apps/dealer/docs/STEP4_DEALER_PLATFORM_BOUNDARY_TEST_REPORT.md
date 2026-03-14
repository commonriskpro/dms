# Step 4 Dealer / Platform Boundary Test Report

Sprint: Dealer / Platform Boundary Cleanup
Step: 4
Date: 2026-03-13
Status: Complete

## Test Scope

This Step 4 pass focused on the cleanup-specific boundary regressions introduced or clarified in this sprint.

Covered areas:

- dealer session payload cleanup
- dealer home/landing cleanup
- dealer navigation cleanup
- dealer support-session bridge continuity
- static verification of dealer route removal and platform route ownership
- canonical dealer module naming via `admin-core` and `invite-bridge` compatibility imports

## Tests Added Or Updated

### Updated

- `apps/dealer/app/__tests__/home-invite-cta.test.tsx`
  - retained invite CTA assertion
  - added assertion that the stale `Dealer Management System — Core Platform` tagline is gone

- `apps/dealer/app/api/auth/session/route.test.ts`
  - added assertions that `platformAdmin` is no longer returned in the session payload

### Added

- `apps/dealer/components/ui-system/__tests__/navigation-config.test.ts`
  - verifies the dealer navigation no longer has a `Platform` group
  - verifies Websites now lives under a `Websites` group

### Reused existing

- `apps/dealer/app/api/support-session/end/route.test.ts`

## Commands Run

Focused Jest:

```sh
npx jest --runInBand app/api/auth/session/route.test.ts app/__tests__/home-invite-cta.test.tsx app/api/support-session/end/route.test.ts components/ui-system/__tests__/navigation-config.test.ts
```

Static verification:

- searched dealer for `app/api/platform` and `app/platform`
- searched dealer for runtime `platformAdmin`, `isPlatformAdmin`, and `PlatformAdmin`
- inventoried platform page routes under `apps/platform/app/(platform)/platform`
- searched platform for `/api/platform/auth/*` and `/api/platform/impersonation/start`

Lints:

- checked Step 4 touched files with `ReadLints`

## Results

### Automated tests

Result:

- PASS
- 4 suites passed
- 9 tests passed
- 0 failures

Suites:

- `app/api/auth/session/route.test.ts`
- `app/__tests__/home-invite-cta.test.tsx`
- `app/api/support-session/end/route.test.ts`
- `components/ui-system/__tests__/navigation-config.test.ts`

### Static verification

Result:

- PASS

Verified outcomes:

- no live dealer `app/api/platform/*` route tree
- no live dealer `app/platform/*` page tree
- no runtime `PlatformAdmin` usage in current dealer code
- platform auth/account/session pages still live in `apps/platform`
- platform impersonation start route still lives in `apps/platform`

### Lint result

Result:

- PASS
- no linter errors reported in touched files
- active dealer runtime/tests now import canonical `apps/dealer/modules/admin-core` and `apps/dealer/modules/invite-bridge` paths

## Coverage Assessment

What this Step 4 pass proves well:

- current workspace dealer runtime no longer exposes the removed platform control-plane surface
- the cleaned dealer session/home/nav behavior is covered by focused tests
- intentional dealer support-session behavior still has basic regression coverage

What it does not prove:

- full browser navigation across both apps
- deployed environment correctness
- every platform-to-dealer bridge endpoint via integration tests

## Honest Remaining Risks

- the dealer/internal bridge remains intentionally broad and still includes provisioning, lifecycle sync, monitoring telemetry, and dealer-application onboarding routes
- no end-to-end platform -> dealer impersonation browser test was run
- if another local checkout or deployment is still running old dealer code, it can still hit removed `PlatformAdmin` paths even though this workspace is clean

## Repo-Baseline vs Sprint-Created Issues

Repo-baseline:

- broader integration coverage for the full platform -> dealer bridge is still limited
- browser E2E coverage is still absent

Sprint-created:

- none found in the current workspace during focused Step 4 verification
