# Platform Surface Migration Plan

This file now serves as the migration record and residual-follow-up plan after the dealer-to-platform control-plane cutover.

Canonical control plane:
- [`apps/platform`](../../apps/platform)

Cutover status:
- Completed for dealer-hosted platform UI and public dealer `/api/platform/*` control-plane routes.

What was removed from `apps/dealer`:
- dealer-hosted pages under `apps/dealer/app/platform/*`
- dealer-hosted public platform routes under `apps/dealer/app/api/platform/*`
- dealer sidebar links that exposed `/platform/*`
- dealer tests that only covered the removed dealer-hosted platform stack

What remains in `apps/dealer` because `apps/platform` still depends on it:
- signed internal dealer bridge endpoints under `apps/dealer/app/api/internal/*`
- dealer invite/public invite flows under `apps/dealer/app/api/invite/*`
- dealer support-session endpoints under `apps/dealer/app/api/support-session/*`

## 1. Final Direction

Fixed rule:
- all platform/operator/control-plane UI and public APIs belong in [`apps/platform`](../../apps/platform)

No longer allowed:
- new platform pages in `apps/dealer`
- new public dealer `/api/platform/*` operator routes
- reintroducing dealer-side navigation to `/platform/*`

## 2. Cutover Result

### Removed dealer-hosted surfaces

Dealer UI removed:
- `apps/dealer/app/platform/layout.tsx`
- `apps/dealer/app/platform/dealerships/*`
- `apps/dealer/app/platform/invites/page.tsx`
- `apps/dealer/app/platform/users/page.tsx`

Dealer public platform routes removed:
- `apps/dealer/app/api/platform/dealerships/*`
- `apps/dealer/app/api/platform/pending-users/*`
- `apps/dealer/app/api/platform/impersonate/route.ts`

Dealer-only tests removed:
- `apps/dealer/app/platform/__tests__/*`
- `apps/dealer/modules/core-platform/tests/platform-admin.test.ts` (legacy implementation path for what is now canonically referenced as `admin-core`)
- `apps/dealer/modules/core-platform/tests/platform-admin-create-account.test.ts` (legacy implementation path for what is now canonically referenced as `admin-core`)

### Dealer capabilities intentionally retained

These are not alternate platform surfaces. They are dealer-owned support/bridge paths:
- public invite resolution/acceptance:
  - [`apps/dealer/app/api/invite/resolve/route.ts`](../../apps/dealer/app/api/invite/resolve/route.ts)
  - [`apps/dealer/app/api/invite/accept/route.ts`](../../apps/dealer/app/api/invite/accept/route.ts)
- signed dealer internal endpoints used by `apps/platform`:
  - [`apps/dealer/app/api/internal/provision/dealership/route.ts`](../../apps/dealer/app/api/internal/provision/dealership/route.ts)
  - [`apps/dealer/app/api/internal/dealer-applications/[id]/platform-state/route.ts`](../../apps/dealer/app/api/internal/dealer-applications/[id]/platform-state/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/status/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/status/route.ts)
  - [`apps/dealer/app/api/internal/monitoring/job-runs/route.ts`](../../apps/dealer/app/api/internal/monitoring/job-runs/route.ts)
  - [`apps/dealer/app/api/internal/monitoring/job-runs/daily/route.ts`](../../apps/dealer/app/api/internal/monitoring/job-runs/daily/route.ts)
  - [`apps/dealer/app/api/internal/monitoring/rate-limits/route.ts`](../../apps/dealer/app/api/internal/monitoring/rate-limits/route.ts)
  - [`apps/dealer/app/api/internal/monitoring/rate-limits/daily/route.ts`](../../apps/dealer/app/api/internal/monitoring/rate-limits/daily/route.ts)
  - [`apps/dealer/app/api/internal/monitoring/maintenance/run/route.ts`](../../apps/dealer/app/api/internal/monitoring/maintenance/run/route.ts)
- dealer support-session flow:
  - [`apps/dealer/app/api/support-session/consume/route.ts`](../../apps/dealer/app/api/support-session/consume/route.ts)
  - [`apps/dealer/app/api/support-session/end/route.ts`](../../apps/dealer/app/api/support-session/end/route.ts)

## 3. Residual Dealer-Side Compatibility Inventory

| Residual dealer-side surface | Status | Why it still exists | Recommended posture |
|---|---|---|---|
| Dealer invite service under [`apps/dealer/modules/invite-bridge/service/invite.ts`](../../apps/dealer/modules/invite-bridge/service/invite.ts) | keep | Still backs real invite acceptance plus platform-triggered owner/dealership invite flows. Legacy implementation alias remains `apps/dealer/modules/platform-admin/service/invite.ts`. | Keep as dealer-side invite domain logic. |
| Dealer internal invite/status endpoints under `apps/dealer/app/api/internal/dealerships/*` | keep | Required by platform owner-invite and invite-management flows. | Keep as internal bridge surface. |
| Dealer internal provisioning, lifecycle, monitoring, and dealer-application compatibility endpoints under `apps/dealer/app/api/internal/*` | keep | Required because dealer still owns tenant creation, dealer runtime telemetry, and dealer-side execution/linkage updates even though dealer-application review is now canonically owned in platform. | Keep as internal bridge surface. |
| Dealer support-session endpoints under `apps/dealer/app/api/support-session/*` | keep | Required for platform-to-dealer support access. | Keep as dealer-side support/session boundary. |

## 4. Migration Phases Remaining

Phase 0:
- completed for dealer-hosted platform UI/public route removal

Phase 1:
- verify no deployment, docs, or operator runbooks still point to removed dealer `/platform/*` or public dealer `/api/platform/*` paths

Phase 2:
- keep dealer compatibility limited to dealer-owned bridge endpoints only
- do not reintroduce dealer-side platform auth overlays or public control-plane surfaces

Phase 3:
- continue converging platform-to-dealer orchestration through signed internal endpoints only
- avoid reintroducing any public dealer platform surface

## 5. Risky Couplings Still Present

1. Platform operational flows still depend on dealer internal endpoints and support-session token exchange.
2. Invite lifecycle logic still lives in the dealer app because dealership membership/invite state is dealer-owned data.
3. Provisioning and monitoring still cross the app boundary because dealer remains the system of record for those dealer-owned records. Dealer-application review now lives in platform, with only dealer compatibility sync remaining.

## 6. Open Questions

1. Are any external docs, bookmarks, or operator habits still hitting removed dealer `/platform/*` routes?
2. Keep canonical references on `apps/dealer/modules/invite-bridge` and only remove the legacy `apps/dealer/modules/platform-admin` implementation alias in a future cleanup sprint if the repo is ready for a higher-risk move.
