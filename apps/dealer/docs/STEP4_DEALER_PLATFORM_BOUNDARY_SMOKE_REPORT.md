# Step 4 Dealer / Platform Boundary Smoke Report

Sprint: Dealer / Platform Boundary Cleanup
Step: 4
Date: 2026-03-13
Status: Complete

## Smoke Goals

Confirm the final high-level boundary works as expected:

- dealer does not own platform-only public routes or pages
- platform still owns platform auth/account/session pages
- dealer still owns invite acceptance and support-session bridge behavior
- dealer UX no longer suggests a dealer-hosted platform surface
- dealer runtime imports use canonical `admin-core` and `invite-bridge` compatibility paths

## Smoke Matrix

| Check | Result | Notes |
|---|---|---|
| Dealer `app/api/platform/*` tree removed | PASS | Static route search found no live dealer files under `app/api/platform`. |
| Dealer `app/platform/*` tree removed | PASS | Static route search found no live dealer files under `app/platform`. |
| Dealer session route no longer carries `platformAdmin` payload | PASS | Covered by updated `app/api/auth/session/route.test.ts`. |
| Dealer home page still exposes invite CTA | PASS | Covered by `app/__tests__/home-invite-cta.test.tsx`. |
| Dealer home page no longer shows stale `Core Platform` copy | PASS | Covered by updated `app/__tests__/home-invite-cta.test.tsx`. |
| Dealer nav no longer groups Websites under `Platform` | PASS | Covered by new `components/ui-system/__tests__/navigation-config.test.ts`. |
| Dealer support-session end route remains healthy | PASS | Covered by `app/api/support-session/end/route.test.ts`. |
| Platform auth/account/session pages still exist in `apps/platform` | PASS | Static platform route inventory found login, forgot-password, reset-password, account, forbidden, bootstrap pages. |
| Platform impersonation entrypoint remains in `apps/platform` | PASS | Static path check found `/api/platform/impersonation/start`. |
| Intentional dealer internal bridge endpoints remain present | PASS | Static inventory confirmed provisioning, status-sync, invite, monitoring, and dealer-application routes under `apps/dealer/app/api/internal/*`. |

## Commands And Checks Run

Focused Jest command:

```sh
npx jest --runInBand app/api/auth/session/route.test.ts app/__tests__/home-invite-cta.test.tsx app/api/support-session/end/route.test.ts components/ui-system/__tests__/navigation-config.test.ts
```

Static checks:

- dealer route/page inventory search for removed `app/api/platform` and `app/platform`
- platform route inventory search for auth/account/session pages
- platform path search for `/api/platform/auth/*` and `/api/platform/impersonation/start`

## Results

Automated result:

- 4 test suites passed
- 9 tests passed
- 0 failures

Static smoke result:

- all intended boundary conditions matched the current code
- canonical dealer module naming now routes active imports through `apps/dealer/modules/admin-core` and `apps/dealer/modules/invite-bridge`

## Notable Findings

- the remaining dealer/platform bridge is intentional and still wider than invite/support alone because it includes provisioning, lifecycle sync, monitoring telemetry, and dealer-application onboarding routes
- no dealer-hosted platform-only page or public API surface was found in the current workspace

## Residual Gaps

- no browser-driven smoke pass was run
- no live environment routing test was run against deployed apps
- no validation was performed for other local clones outside this workspace

## Repo-Baseline vs Sprint-Created Issues

Repo-baseline:

- documentation drift existed before Step 4 and was corrected in this workspace

Sprint-created:

- none found during smoke verification
