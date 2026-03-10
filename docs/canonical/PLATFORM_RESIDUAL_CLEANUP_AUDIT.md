# Platform Residual Cleanup Audit

Status note:
- This audit captured the pre-cleanup state on March 9, 2026.
- Current post-cleanup state is recorded in [PLATFORM_RESIDUAL_CLEANUP_REPORT.md](./PLATFORM_RESIDUAL_CLEANUP_REPORT.md).

This audit maps the dealer-side platform compatibility residue that remains after the platform control-plane cutover.

Reference state:
- [`apps/platform`](../../apps/platform) is the only platform control plane.
- Dealer-hosted `/platform/*` pages and public dealer `/api/platform/*` control-plane routes were removed.

Audit date:
- March 9, 2026

## 1. Executive Summary

Current conclusion:
- The dealer-side residue splits into two very different buckets:
  - still-required dealer bridge/support functionality that `apps/platform` actively depends on
  - dealer-only `PlatformAdmin` compatibility state that no longer powers the control plane and is now mostly an ops/session leftover

High-confidence findings:
1. `apps/platform` does **not** directly depend on dealer `PlatformAdmin` rows or `apps/dealer/lib/platform-admin.ts`.
2. `apps/platform` **does** directly depend on:
   - dealer internal invite/status endpoints
   - dealer internal provisioning/status endpoints
   - dealer support-session consume/end flow
3. Dealer `PlatformAdmin` persistence still affects current dealer runtime through:
   - session payload construction in [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)
   - metrics access in [`apps/dealer/app/api/metrics/route.ts`](../../apps/dealer/app/api/metrics/route.ts)
   - cache stats access in [`apps/dealer/app/api/cache/stats/route.ts`](../../apps/dealer/app/api/cache/stats/route.ts)
4. The `requirePlatformAdmin` export in [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts) appears unused after the cutover.

Practical result:
- Invite bridge and support-session paths should be kept.
- Dealer `PlatformAdmin` model/helper should be treated as transitional-only.
- One small dead helper surface likely exists already.

## 2. Method

Verified from code:
- dealer helper/runtime files
- dealer Prisma schema and seed
- dealer internal invite/support routes
- platform internal-bridge callers
- current canonical platform-cutover docs

Key searches performed:
- `PlatformAdmin`, `platform-admin`, `isPlatformAdmin`, `requirePlatformAdmin`, `platformAdmin`
- platform invite/internal bridge call sites in `apps/platform`
- support-session start/consume/end flow

## 3. Artifact Inventory

| Artifact | Exact files | Why it still exists | Does `apps/platform` still depend on it? | Classification | Recommendation |
|---|---|---|---|---|---|
| Dealer `PlatformAdmin` helper | [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts) | Used by dealer session building and ops routes to look up dealer-side platform-admin rows. | No direct dependency. | Transitional only | Keep temporarily; plan removal after session/ops migration. |
| Dealer `PlatformAdmin` persistence | [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma), [`apps/dealer/prisma/migrations/20260301081014_platform_admin_and_dealership_is_active/migration.sql`](../../apps/dealer/prisma/migrations/20260301081014_platform_admin_and_dealership_is_active/migration.sql) | Still backs the helper above. | No direct dependency. | Transitional only | Keep until helper/session/ops uses are removed. |
| Dealer `PlatformAdmin` seed path | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts) | Populates dealer `PlatformAdmin` rows from `SUPERADMIN_EMAILS` / `PLATFORM_ADMIN_EMAILS`. | No direct dependency. | Transitional only | Remove only after dealer `PlatformAdmin` runtime usage is retired. |
| Dealer session payload exposure of `platformAdmin` | [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts), [`apps/dealer/app/api/auth/session/route.ts`](../../apps/dealer/app/api/auth/session/route.ts), [`apps/dealer/lib/types/session.ts`](../../apps/dealer/lib/types/session.ts), [`apps/dealer/contexts/session-context.tsx`](../../apps/dealer/contexts/session-context.tsx) | Still returns `platformAdmin.isAdmin` in dealer session responses and client context. | No direct dependency. | Transitional only | Follow-up migration needed; shrink session contract after client verification. |
| Dealer tenant impersonation bypass logic keyed off platform-admin flag | [`apps/dealer/lib/tenant.ts`](../../apps/dealer/lib/tenant.ts), [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts) | Allows cookie-selected dealership to remain valid without membership when `isPlatformAdminUser` is true. | No direct dependency. | Transitional only | Follow-up migration needed; remove after session/ops compatibility decision. |
| Dealer ops routes gated by `PlatformAdmin` | [`apps/dealer/app/api/metrics/route.ts`](../../apps/dealer/app/api/metrics/route.ts), [`apps/dealer/app/api/cache/stats/route.ts`](../../apps/dealer/app/api/cache/stats/route.ts) | Current dealer-only operational access check uses `isPlatformAdmin`. | No direct dependency. | Transitional only | Migrate to a different operator access model before removing `PlatformAdmin`. |
| Dealer invite service and invite DB | [`apps/dealer/modules/platform-admin/service/invite.ts`](../../apps/dealer/modules/platform-admin/service/invite.ts), [`apps/dealer/modules/platform-admin/db/invite.ts`](../../apps/dealer/modules/platform-admin/db/invite.ts) | Dealer owns invite lifecycle state and public invite acceptance. | Yes. | Still required | Keep. This is dealer domain logic, not obsolete control-plane code. |
| Dealer public invite endpoints | [`apps/dealer/app/api/invite/resolve/route.ts`](../../apps/dealer/app/api/invite/resolve/route.ts), [`apps/dealer/app/api/invite/accept/route.ts`](../../apps/dealer/app/api/invite/accept/route.ts), [`apps/dealer/app/api/invite/schemas.ts`](../../apps/dealer/app/api/invite/schemas.ts) | Required for invite acceptance and owner/dealership invite flows. | Indirectly yes, because platform-created invites are accepted here. | Still required | Keep. |
| Dealer internal invite bridge | [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts), [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts), [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts), [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts) | Platform app uses these to manage dealership/owner invites through signed internal JWT. | Yes, directly. | Still required | Keep. |
| Platform internal-bridge callers for invite/provision/status | [`apps/platform/lib/call-dealer-internal.ts`](../../apps/platform/lib/call-dealer-internal.ts), platform API routes under [`apps/platform/app/api/platform/dealerships`](../../apps/platform/app/api/platform/dealerships) and [`apps/platform/app/api/platform/applications/[id]/onboarding-status/route.ts`](../../apps/platform/app/api/platform/applications/[id]/onboarding-status/route.ts) | Canonical platform workflows depend on dealer internal endpoints. | Yes. | Still required | Keep. |
| Dealer support-session consume/end | [`apps/dealer/app/api/support-session/consume/route.ts`](../../apps/dealer/app/api/support-session/consume/route.ts), [`apps/dealer/app/api/support-session/end/route.ts`](../../apps/dealer/app/api/support-session/end/route.ts), [`apps/dealer/lib/support-session-verify.ts`](../../apps/dealer/lib/support-session-verify.ts) | Platform “Open as dealer” flow ends here. | Yes, directly. | Still required | Keep. |
| Platform support-session start | [`apps/platform/app/api/platform/impersonation/start/route.ts`](../../apps/platform/app/api/platform/impersonation/start/route.ts), [`apps/platform/lib/support-session-token.ts`](../../apps/platform/lib/support-session-token.ts) | Creates dealer-consumable support-session token. | Yes. | Still required | Keep. |

## 4. Detailed Findings

### 4.1 Dealer `PlatformAdmin` helper is no longer a platform-app dependency

Current helper:
- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)

Current runtime use:
- [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)
- [`apps/dealer/app/api/metrics/route.ts`](../../apps/dealer/app/api/metrics/route.ts)
- [`apps/dealer/app/api/cache/stats/route.ts`](../../apps/dealer/app/api/cache/stats/route.ts)

Notably absent:
- no current `apps/platform` imports
- no remaining dealer public `/api/platform/*` route usage

Conclusion:
- This helper is now dealer-only residue.
- It should not be treated as part of the canonical platform architecture anymore.

Recommendation:
- `Keep temporarily`, but classify as transitional-only.

### 4.2 `requirePlatformAdmin` appears dead

File:
- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)

Finding:
- Code search found the definition, but no non-test runtime call site after dealer `/api/platform/*` removal.

Conclusion:
- This specific export looks safe to remove in a future tiny cleanup.

Recommendation:
- `Safe to remove now`, with low risk, because it no longer guards any runtime route in current code.

### 4.3 Dealer `PlatformAdmin` persistence still shapes dealer session state

Relevant files:
- [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)
- [`apps/dealer/app/api/auth/session/route.ts`](../../apps/dealer/app/api/auth/session/route.ts)
- [`apps/dealer/lib/types/session.ts`](../../apps/dealer/lib/types/session.ts)
- [`apps/dealer/contexts/session-context.tsx`](../../apps/dealer/contexts/session-context.tsx)
- [`apps/dealer/lib/tenant.ts`](../../apps/dealer/lib/tenant.ts)

What it does now:
- dealer session API still returns `platformAdmin.isAdmin`
- dealer tenant resolution still has an `isPlatformAdminUser` bypass branch for cookie-based dealership context

Observed client usage:
- the session context still carries `platformAdmin`
- current code scan did not show strong remaining UI usage after sidebar removal

Risk:
- this is a contract cleanup, not just a local helper deletion
- removing it blindly could break hidden UI or operator assumptions

Recommendation:
- `Follow-up migration before removal`

### 4.4 Dealer ops routes still use dealer `PlatformAdmin`

Routes:
- [`apps/dealer/app/api/metrics/route.ts`](../../apps/dealer/app/api/metrics/route.ts)
- [`apps/dealer/app/api/cache/stats/route.ts`](../../apps/dealer/app/api/cache/stats/route.ts)

Why they still exist:
- They use `isPlatformAdmin` as their authenticated operator gate.

Platform-app dependency:
- none

Meaning:
- these routes are not part of the platform control plane
- they are a dealer-local operational access policy choice

Recommendation:
- `Follow-up migration before removal`
- move these routes to either:
  - secret-only access
  - a platform-issued internal auth model
  - or platform-side monitoring only

### 4.5 Invite bridge is still required

Dealer files:
- [`apps/dealer/modules/platform-admin/service/invite.ts`](../../apps/dealer/modules/platform-admin/service/invite.ts)
- [`apps/dealer/modules/platform-admin/db/invite.ts`](../../apps/dealer/modules/platform-admin/db/invite.ts)
- [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts)
- [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts)
- [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts)
- [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts)

Platform files that call them:
- [`apps/platform/lib/call-dealer-internal.ts`](../../apps/platform/lib/call-dealer-internal.ts)
- [`apps/platform/app/api/platform/dealerships/[id]/invites/route.ts`](../../apps/platform/app/api/platform/dealerships/[id]/invites/route.ts)
- [`apps/platform/app/api/platform/dealerships/[id]/invites/[inviteId]/revoke/route.ts`](../../apps/platform/app/api/platform/dealerships/[id]/invites/[inviteId]/revoke/route.ts)
- [`apps/platform/app/api/platform/dealerships/[id]/owner-invite/route.ts`](../../apps/platform/app/api/platform/dealerships/[id]/owner-invite/route.ts)
- [`apps/platform/app/api/platform/applications/[id]/onboarding-status/route.ts`](../../apps/platform/app/api/platform/applications/[id]/onboarding-status/route.ts)

Conclusion:
- This is active canonical bridge behavior.
- It should stay in dealer because invite ownership and dealership membership state live in dealer DB.

Recommendation:
- `Keep`

### 4.6 Support-session flow is still required

Dealer files:
- [`apps/dealer/app/api/support-session/consume/route.ts`](../../apps/dealer/app/api/support-session/consume/route.ts)
- [`apps/dealer/app/api/support-session/end/route.ts`](../../apps/dealer/app/api/support-session/end/route.ts)
- [`apps/dealer/lib/support-session-verify.ts`](../../apps/dealer/lib/support-session-verify.ts)

Platform files that call/start it:
- [`apps/platform/app/api/platform/impersonation/start/route.ts`](../../apps/platform/app/api/platform/impersonation/start/route.ts)
- [`apps/platform/lib/support-session-token.ts`](../../apps/platform/lib/support-session-token.ts)
- platform dealership detail UI triggers `/api/platform/impersonation/start`

Conclusion:
- This remains part of the intended platform-to-dealer support flow.
- It is not legacy dealer-hosted control plane.

Recommendation:
- `Keep`

## 5. Bucketed Classification

### Still required

- dealer invite service/db:
  - [`apps/dealer/modules/platform-admin/service/invite.ts`](../../apps/dealer/modules/platform-admin/service/invite.ts)
  - [`apps/dealer/modules/platform-admin/db/invite.ts`](../../apps/dealer/modules/platform-admin/db/invite.ts)
- dealer internal invite/owner-invite endpoints:
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts)
  - [`apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts`](../../apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts)
- dealer public invite acceptance surface:
  - [`apps/dealer/app/api/invite/resolve/route.ts`](../../apps/dealer/app/api/invite/resolve/route.ts)
  - [`apps/dealer/app/api/invite/accept/route.ts`](../../apps/dealer/app/api/invite/accept/route.ts)
  - [`apps/dealer/app/api/invite/schemas.ts`](../../apps/dealer/app/api/invite/schemas.ts)
- dealer support-session flow:
  - [`apps/dealer/app/api/support-session/consume/route.ts`](../../apps/dealer/app/api/support-session/consume/route.ts)
  - [`apps/dealer/app/api/support-session/end/route.ts`](../../apps/dealer/app/api/support-session/end/route.ts)
  - [`apps/dealer/lib/support-session-verify.ts`](../../apps/dealer/lib/support-session-verify.ts)

### Transitional only

- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)
- dealer `PlatformAdmin` model in [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma)
- dealer `PlatformAdmin` seeding in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- dealer session contract exposure of `platformAdmin`
- dealer tenant impersonation-bypass branch tied to `isPlatformAdminUser`
- dealer metrics/cache-stats operator gating through `isPlatformAdmin`

### Safe to remove now

- `requirePlatformAdmin` export in [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)

Reason:
- no remaining non-test runtime call sites were found after public dealer `/api/platform/*` removal

### Requires follow-up migration before removal

- dealer `PlatformAdmin` model + helper as a whole
- dealer session contract fields exposing `platformAdmin`
- dealer tenant impersonation-bypass logic
- dealer metrics/cache-stats `PlatformAdmin` access model
- dealer seeding of `PlatformAdmin` rows from env

## 6. Safest Cleanup Order

1. Remove the dead helper export:
   - `requirePlatformAdmin` in [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)

2. Audit whether any dealer UI still consumes `platformAdmin.isAdmin` from session:
   - [`apps/dealer/app/api/auth/session/route.ts`](../../apps/dealer/app/api/auth/session/route.ts)
   - [`apps/dealer/lib/types/session.ts`](../../apps/dealer/lib/types/session.ts)
   - [`apps/dealer/contexts/session-context.tsx`](../../apps/dealer/contexts/session-context.tsx)

3. Migrate dealer ops routes off `PlatformAdmin`:
   - [`apps/dealer/app/api/metrics/route.ts`](../../apps/dealer/app/api/metrics/route.ts)
   - [`apps/dealer/app/api/cache/stats/route.ts`](../../apps/dealer/app/api/cache/stats/route.ts)

4. Remove tenant/session compatibility tied to `isPlatformAdminUser` once session/ops migration is done:
   - [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)
   - [`apps/dealer/lib/tenant.ts`](../../apps/dealer/lib/tenant.ts)

5. Only after steps 2-4 are complete, retire dealer `PlatformAdmin` persistence and seed path:
   - [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma)
   - [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
   - related migration history remains historical, but runtime dependence can then be removed

6. Keep invite bridge and support-session paths unless the platform/dealer boundary is redesigned:
   - these are still active architecture, not cleanup residue

## 7. Open Questions

1. Is there any dealer UI or external client still reading `platformAdmin.isAdmin` from `/api/auth/session`?
2. Should dealer `/api/metrics` and `/api/cache/stats` stay dealer-local, or should all operator observability move behind platform-only tooling?
3. Should the dealer invite module be renamed in a later cleanup sprint so `platform-admin` stops implying a second control plane?
