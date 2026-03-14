# Dealer / Platform Boundary Cleanup Spec

Sprint: Dealer / Platform Boundary Cleanup
Status: Step 1 complete
Date: 2026-03-13

## Goal

Remove any remaining platform-only app, API, navigation, and runtime behavior from `apps/dealer` so that:

- `apps/platform` is the only platform control-plane app
- `apps/dealer` keeps only dealer-facing UX plus intentional dealer-owned bridge/linkage behavior
- canonical docs are updated to match the code, not the older cutover narrative

## Non-Goals

This sprint is not "delete everything with `platform` in the name."

The following are explicitly out of scope for blind removal:

- linkage fields such as `platformDealershipId` and `platformApplicationId`
- dealer-owned invite, provisioning, status-sync, monitoring, and support-session bridge paths
- shared dealer modules whose names are stale but whose behavior is still dealer-scoped

## Source Of Truth

This spec is based on direct inspection of:

- `apps/dealer`
- `apps/platform`
- `apps/worker`
- `packages/contracts`
- `docs/canonical/*`

Code wins over prior docs.

## Current Verified State

### Already removed from dealer

Verified current code state:

- no dealer `app/platform/*` page tree exists
- no dealer public `app/api/platform/*` API tree exists
- no dealer platform-only auth/account/session pages exist
- no dealer platform-specific layout/provider layer exists

### Platform-only behavior already lives in `apps/platform`

Verified platform-owned surface in `apps/platform`:

- platform auth/session pages and APIs
- platform users/accounts/dealerships/applications UI and APIs
- platform monitoring, audit, reports, billing, subscriptions
- platform impersonation start flow

### Dealer still exposes an intentional bridge surface

`apps/platform` still depends on dealer-owned routes for:

- dealer provisioning
- dealership lifecycle status sync
- owner-invite and invite management
- support-session consume/end
- dealer health and monitoring telemetry
- dealer-application review bridge

This is broader than several canonical docs currently claim.

## Bucketed Decision Summary

### Bucket A: REMOVE

Dealer-side residue that should be deleted in cleanup because it is stale boundary behavior or stale dealer framing:

- `apps/dealer/lib/platform-admin.ts`
- `apps/dealer/components/auth-guard.tsx` `/platform` special-casing
- dealer nav grouping that labels dealer Websites under `Platform`
- stale dealer docs that still describe dealer as hosting platform auth/pages/APIs

### Bucket B: MOVE

Move candidates in this sprint are documentation-only:

- stale dealer-local docs that actually document platform-only or cross-app flows

Runtime note:

- deeper inspection showed the dealer-application bridge is still part of the dealer-owned onboarding data model, not a safe cleanup deletion
- `apps/platform` remains the reviewer UI, but the dealer app still owns `DealerApplication` records and the internal review bridge around them

### Bucket C: KEEP

Intentional dealer-owned behavior that stays in `apps/dealer`:

- public invite acceptance flow under `apps/dealer/app/api/invite/*` and `apps/dealer/app/accept-invite/*`
- dealer internal invite/owner-invite/status/provision endpoints under `apps/dealer/app/api/internal/*`
- dealer support-session consume/end flow
- dealer monitoring/health endpoints that expose dealer runtime state
- dealer-side compatibility sync under `apps/dealer/app/api/internal/dealer-applications/[id]/platform-state`
- linkage fields in dealer schema and services
- dealer-scoped admin/files/audit logic now canonically referenced as `modules/admin-core` (legacy implementation alias: `modules/core-platform`)
- invite lifecycle logic now canonically referenced as `modules/invite-bridge` (legacy implementation alias: `modules/platform-admin`)

### Canonical bridge documentation

The single source of truth for the platform→dealer bridge surface is now:

- **Docs:** [docs/canonical/DEALER_PLATFORM_BRIDGE_SURFACE.md](../../docs/canonical/DEALER_PLATFORM_BRIDGE_SURFACE.md)
- **Registry (used by architecture tests):** `apps/dealer/lib/dealer-bridge-routes.ts`

When adding a new route under `app/api/internal/`, add it to the registry and run the architecture test `dealer-internal-routes-registered.test.ts`.

## Platform -> Dealer Dependency Map

Verified current dealer endpoints used by `apps/platform`:

| Dealer endpoint | Used by `apps/platform` | Decision | Why |
|---|---|---|---|
| `/api/health` | yes | KEEP | Dealer owns dealer health state. |
| `/api/support-session/consume` | yes | KEEP | Dealer must consume support-session token and set dealer cookie. |
| `/api/internal/provision/dealership` | yes | KEEP | Dealer must create dealer tenant records in dealer DB. |
| `/api/internal/dealerships/[dealerDealershipId]/status` | yes | KEEP | Dealer lifecycle state lives in dealer DB. |
| `/api/internal/dealerships/[dealerDealershipId]/owner-invite` | yes | KEEP | Dealer owns invite and membership acceptance state. |
| `/api/internal/dealerships/[dealerDealershipId]/owner-invite-status` | yes | KEEP | Dealer owns invite acceptance state. |
| `/api/internal/dealerships/[dealerDealershipId]/invites` | yes | KEEP | Dealer owns invite list state. |
| `/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]` | yes | KEEP | Dealer owns invite revoke state. |
| `/api/internal/monitoring/job-runs` | yes | KEEP | Dealer owns job telemetry rows. |
| `/api/internal/monitoring/job-runs/daily` | yes | KEEP | Dealer owns aggregated job telemetry. |
| `/api/internal/monitoring/rate-limits` | yes | KEEP | Dealer owns rate-limit telemetry. |
| `/api/internal/monitoring/rate-limits/daily` | yes | KEEP | Dealer owns aggregated rate-limit telemetry. |
| `/api/internal/monitoring/maintenance/run` | yes | KEEP | Dealer owns dealer telemetry maintenance. |
| `/api/internal/dealer-applications/[id]/platform-state` | yes | KEEP | Dealer receives compatibility updates from the platform canonical dealer-application workflow. |

## Explicit Answers Required By Step 1

### 1. What dealer-side platform routes still exist?

Public dealer platform routes:

- none under `apps/dealer/app/api/platform/*`

Dealer platform-related bridge/special routes that still exist:

- `apps/dealer/app/api/internal/provision/dealership/route.ts`
- `apps/dealer/app/api/internal/dealer-applications/[id]/platform-state/route.ts`
- `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/status/route.ts`
- `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts`
- `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts`
- `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts`
- `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts`
- `apps/dealer/app/api/internal/monitoring/job-runs/route.ts`
- `apps/dealer/app/api/internal/monitoring/job-runs/daily/route.ts`
- `apps/dealer/app/api/internal/monitoring/rate-limits/route.ts`
- `apps/dealer/app/api/internal/monitoring/rate-limits/daily/route.ts`
- `apps/dealer/app/api/internal/monitoring/maintenance/run/route.ts`
- `apps/dealer/app/api/support-session/consume/route.ts`
- `apps/dealer/app/api/support-session/end/route.ts`
- dealer public invite routes under `apps/dealer/app/api/invite/*`

### 2. Which are dead or stale?

Verified stale/dead items:

- `apps/dealer/lib/platform-admin.ts`
- `/platform` handling inside `apps/dealer/components/auth-guard.tsx`
- dealer websites nav grouping labeled `Platform`
- dealer docs that still document dealer-hosted platform auth/pages/APIs

### 3. Which should move to `apps/platform`?

Confirmed runtime move candidate:

- the dealer-application review state move is now in scope and implemented via a platform canonical store plus dealer compatibility sync

Docs that should move or be removed:

- stale dealer-local platform auth/control-plane docs
- stale dealer-local reports that still describe removed dealer platform pages

### 4. Which shared modules are actually platform-only and should be split or renamed?

Verified not platform-only, but misnamed:

- `apps/dealer/modules/admin-core` (wrapper path over legacy `apps/dealer/modules/core-platform`)
- `apps/dealer/modules/invite-bridge` (wrapper path over legacy `apps/dealer/modules/platform-admin`)

Current recommendation:

- keep behavior in dealer for this sprint
- use low-risk compatibility wrappers so canonical names reflect current ownership:
  - `admin-core` for dealer admin/files/audit/RBAC shared behavior
  - `invite-bridge` for dealer invite bridge behavior

### 5. What linkage fields remain valid and should stay?

Keep:

- `Dealership.platformDealershipId`
- `DealerApplication.platformApplicationId`
- `DealerApplication.platformDealershipId`
- `ProvisioningIdempotency.platformDealershipId`
- invite/provisioning/support-session metadata that links platform actions to dealer state

## Step 2-4 Execution Plan

### Step 2: Backend cleanup

Planned scope:

- remove dead dealer platform stub/residue
- document and preserve dealer-owned internal bridge endpoints
- clean stale imports and doc assumptions that still point to removed dealer platform surfaces
- remove stale dealer-local docs that still treat dealer as the platform app

Do not delete in Step 2:

- provisioning bridge
- invite/owner-invite bridge
- support-session flow
- monitoring/health bridge
- valid linkage fields

### Step 3: Frontend / nav / UX cleanup

Planned scope:

- remove stale `/platform` handling from dealer auth guard
- rename/reframe dealer navigation labels that still imply dealer hosts a platform surface
- verify no dealer redirects or links point at removed platform paths
- verify dealer keeps only dealer-facing pending/invite UX

### Step 4: Security / QA / docs

Planned scope:

- confirm dealer exposes no platform-only public surface
- confirm `apps/platform` remains the only platform auth/account/session UI
- confirm dealer bridge endpoints kept are intentional and documented
- update canonical docs to reflect the real remaining bridge surface

## Risks

Main risk:

- several canonical docs currently understate the real remaining dealer bridge by saying only invite/support remain, while current code still uses provisioning, monitoring, health, status-sync, and dealer-application bridge routes

Secondary risk:

- legacy `modules/core-platform` and `modules/platform-admin` look removable by name but are not removable by behavior; canonical wrapper names now expose them as `modules/admin-core` and `modules/invite-bridge`

## Guardrails

- do not delete dealer bridge routes that `apps/platform` still calls
- do not remove linkage fields
- do not treat misnamed dealer modules as proof they are platform-only
- prefer rename/split over destructive deletion when behavior is still dealer-owned
