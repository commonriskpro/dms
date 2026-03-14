# Step 4 Dealer / Platform Boundary Security Report

Sprint: Dealer / Platform Boundary Cleanup
Step: 4
Date: 2026-03-13
Status: Complete

## Scope

This report verifies the final dealer/platform boundary from a security and exposure perspective.

Focus areas:

- dealer no longer exposes legacy platform-only public routes or page surfaces
- dealer session/runtime no longer depends on dealer `PlatformAdmin`
- platform-only auth/account/session behavior remains owned by `apps/platform`
- intentional dealer-owned bridge behavior remains narrow and explicit
- canonical dealer compatibility module names are now `admin-core` and `invite-bridge`, with legacy implementation aliases retained for low-risk compatibility

## Checks Performed

### 1. Dealer public platform surface removal

Static verification:

- searched `apps/dealer` for `app/api/platform` and `app/platform`
- result: no live dealer code files were found under those route/page trees
- remaining hits were only the new Step 1 audit/spec docs

Conclusion:

- dealer no longer exposes public `/api/platform/*`
- dealer no longer exposes dealer-hosted `/platform/*` pages

### 2. Dealer session/runtime removal of `PlatformAdmin`

Verified current dealer runtime:

- `apps/dealer/lib/platform-admin.ts` is removed
- `apps/dealer/lib/api/handler.ts` no longer imports or calls `isPlatformAdmin`
- `apps/dealer/app/api/auth/session/route.ts` no longer returns `platformAdmin`
- current `apps/dealer` code search returned no runtime `platformAdmin.findUnique`, `isPlatformAdmin`, or `PlatformAdmin` matches

Conclusion:

- the dealer app no longer depends on the removed `PlatformAdmin` table in the current workspace

### 3. Dealer navigation and landing cleanup

Verified:

- `apps/dealer/components/ui-system/navigation/navigation.config.ts` no longer groups Websites under `Platform`
- `apps/dealer/components/auth-guard.tsx` no longer special-cases `/platform`
- `apps/dealer/app/page.tsx` no longer renders the stale `Core Platform` tagline

Conclusion:

- dealer runtime and UX no longer imply that dealer hosts a platform app surface

### 4. Platform-only auth/account/session ownership

Verified in `apps/platform`:

- page routes still exist for:
  - `/platform/login`
  - `/platform/forgot-password`
  - `/platform/reset-password`
  - `/platform/account`
  - `/platform/forbidden`
  - `/platform/bootstrap`
- platform APIs still exist for:
  - `/api/platform/auth/*`
  - `/api/platform/impersonation/start`

Conclusion:

- platform-only auth/account/session behavior remains owned by `apps/platform`

### 5. Intentional dealer-owned bridge surface

Verified retained dealer-owned bridge behavior:

- public invite acceptance under `apps/dealer/app/api/invite/*`
- support-session consume/end under `apps/dealer/app/api/support-session/*`
- signed internal bridge endpoints under `apps/dealer/app/api/internal/*`

This includes:

- provisioning
- dealership lifecycle status sync
- invite and owner-invite flows
- dealer monitoring telemetry
- dealer-application onboarding bridge

Conclusion:

- the remaining dealer/platform coupling is explicit and dealer-owned
- it is not a second dealer-hosted platform control plane

## Commands And Checks Run

- static search: dealer `app/api/platform` and `app/platform` route/page presence
- static search: dealer runtime `platformAdmin`, `isPlatformAdmin`, `PlatformAdmin`
- static inventory: platform page routes under `apps/platform/app/(platform)/platform`
- static inventory: platform auth/account/session and impersonation paths in `apps/platform`
- focused tests:
  - `npx jest --runInBand app/api/auth/session/route.test.ts app/__tests__/home-invite-cta.test.tsx app/api/support-session/end/route.test.ts components/ui-system/__tests__/navigation-config.test.ts`

## Results

- static exposure checks passed
- focused automated tests passed: 4 suites, 9 tests
- no linter issues were present in the Step 4-touched files
- dealer runtime imports now reference canonical `apps/dealer/modules/admin-core` and `apps/dealer/modules/invite-bridge` wrapper paths

## Security Outcome

Pass with residual intentional bridge surface.

The dealer app no longer exposes the old integrated platform control-plane surface. The remaining cross-app boundary is limited to dealer-owned bridge behavior that is still required by `apps/platform`.

## Residual Risks

- canonical repo docs had drift before this sprint and were corrected, but any external notes/bookmarks/runbooks outside the repo may still reference removed dealer `/platform/*` paths
- the dealer internal bridge remains broader than invite/support alone because provisioning, monitoring, and dealer-application onboarding still cross the boundary
- this report did not include browser E2E validation; verification was static plus focused Jest coverage

## Repo-Baseline vs Sprint-Created Issues

Repo-baseline issues:

- prior canonical docs understated the remaining dealer bridge surface
- there may be out-of-repo environments or local clones still running pre-cleanup code

Sprint-created issues:

- none found in the current workspace during Step 4 verification
