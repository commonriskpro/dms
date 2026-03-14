# Dealer / Platform Boundary Audit

Sprint: Dealer / Platform Boundary Cleanup
Status: Step 1 audit complete
Date: 2026-03-13

## Executive Summary

The current codebase already removed the old dealer-hosted platform app and public dealer `/api/platform/*` control-plane routes.

What remains in `apps/dealer` falls into three different categories:

1. stale boundary residue that should be removed
2. a small but real migration target that still belongs to platform control-plane ownership
3. intentional dealer-owned bridge and linkage behavior that must stay

The largest docs gap is that several canonical platform-cutover docs now under-report the live dealer bridge surface. Current code proves that `apps/platform` still depends on dealer for:

- provisioning
- lifecycle status sync
- health and monitoring telemetry
- support-session consumption
- owner-invite and invite management
- dealer-application review bridge

## Audit Method

Verified from code:

- `apps/dealer`
- `apps/platform`
- `packages/contracts`
- `apps/worker` where relevant to bridge verification
- canonical docs under `docs/canonical/*`

Primary checks performed:

- search for dealer `/api/platform/*` and dealer `/platform/*`
- inspect `apps/platform` fetch/wrapper callers into dealer
- inspect dealer bridge routes, support-session routes, invite/provisioning flows
- inspect schema/linkage fields
- inspect stale docs and nav/runtime assumptions inside dealer

## Current Route And Page Inventory

### Dealer platform-only public routes

Verified current state:

- no files exist under `apps/dealer/app/api/platform/*`

Decision:

- already removed

### Dealer platform-only pages and layouts

Verified current state:

- no dealer page tree exists under `apps/dealer/app/platform/*`
- no dealer platform-specific layout/provider files were found

Decision:

- already removed

### Dealer platform-related bridge and special-flow routes still present

These are the live dealer surfaces relevant to the boundary:

| Dealer surface | Type | Used by `apps/platform`? | Decision | Notes |
|---|---|---|---|---|
| `apps/dealer/app/api/internal/provision/dealership/route.ts` | internal API | yes | KEEP | Dealer creates dealer tenant records. |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/status/route.ts` | internal API | yes | KEEP | Dealer lifecycle state is dealer-owned. |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts` | internal API | yes | KEEP | Dealer owns invite acceptance state and accept URL. |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts` | internal API | yes | KEEP | Dealer owns invite status state. |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts` | internal API | yes | KEEP | Dealer owns invite list state. |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts` | internal API | yes | KEEP | Dealer owns invite revoke state. |
| `apps/dealer/app/api/internal/monitoring/job-runs/route.ts` | internal API | yes | KEEP | Dealer owns dealer job telemetry. |
| `apps/dealer/app/api/internal/monitoring/job-runs/daily/route.ts` | internal API | yes | KEEP | Dealer owns daily telemetry aggregates. |
| `apps/dealer/app/api/internal/monitoring/rate-limits/route.ts` | internal API | yes | KEEP | Dealer owns rate-limit telemetry. |
| `apps/dealer/app/api/internal/monitoring/rate-limits/daily/route.ts` | internal API | yes | KEEP | Dealer owns daily rate-limit aggregates. |
| `apps/dealer/app/api/internal/monitoring/maintenance/run/route.ts` | internal API | yes | KEEP | Dealer owns dealer telemetry maintenance. |
| `apps/dealer/app/api/internal/dealer-applications/[id]/platform-state/route.ts` | internal API | yes | KEEP | Dealer-side compatibility sync so platform canonical review state can still update dealer execution/linkage state. |
| `apps/dealer/app/api/support-session/consume/route.ts` | special-flow API | yes | KEEP | Dealer must consume token and set dealer cookie. |
| `apps/dealer/app/api/support-session/end/route.ts` | special-flow API | no direct caller found | KEEP | Dealer-side end of support session. |
| `apps/dealer/app/api/invite/resolve/route.ts` | public dealer API | indirect | KEEP | Dealer public invite acceptance flow. |
| `apps/dealer/app/api/invite/accept/route.ts` | public dealer API | indirect | KEEP | Dealer public invite acceptance flow. |
| `apps/dealer/app/accept-invite/page.tsx` | dealer page | indirect | KEEP | Final invite acceptance destination remains dealer-owned. |
| `apps/dealer/app/(app)/pending/page.tsx` | dealer page | no | KEEP | Dealer-facing pending/provisioning state, not a platform app page. |

## Apps/Platform -> Apps/Dealer Dependency Map

This table covers every dealer endpoint verified as still called from `apps/platform`.

| Dealer endpoint | Used by `apps/platform`? | Caller files | Purpose | Decision | Migration / refactor plan |
|---|---|---|---|---|---|
| `/api/health` | yes | `apps/platform/app/api/platform/monitoring/dealer-health/route.ts`, `apps/platform/lib/check-dealer-health-service.ts`, `apps/platform/app/api/platform/monitoring/check-dealer-health/route.ts` | Dealer liveness and DB health checks | KEEP | Document as intentional dealer-owned health surface. |
| `/api/support-session/consume` | yes | `apps/platform/app/api/platform/impersonation/start/route.ts` | Convert platform-issued support token into dealer cookie + redirect | KEEP | Keep dealer-owned; consider dedicated public dealer URL env later if internal/public origins diverge. |
| `/api/internal/provision/dealership` | yes | `apps/platform/app/api/platform/dealerships/[id]/provision/route.ts`, `apps/platform/lib/application-onboarding.ts`, `apps/platform/app/api/platform/applications/[id]/provision/route.ts`, `apps/platform/app/api/platform/applications/[id]/invite-owner/route.ts` | Provision dealer tenant from platform workflow | KEEP | Dealer must remain owner of dealer DB writes. |
| `/api/internal/dealerships/[dealerDealershipId]/status` | yes | `apps/platform/app/api/platform/dealerships/[id]/status/route.ts` | Sync platform lifecycle change into dealer DB | KEEP | Keep until/unless state sync is redesigned around events. |
| `/api/internal/dealerships/[dealerDealershipId]/owner-invite` | yes | `apps/platform/app/api/platform/dealerships/[id]/owner-invite/route.ts`, `apps/platform/lib/application-onboarding.ts`, `apps/platform/app/api/platform/applications/[id]/invite-owner/route.ts` | Create owner invite in dealer | KEEP | Dealer owns invite record and accept URL. |
| `/api/internal/dealerships/[dealerDealershipId]/owner-invite-status` | yes | `apps/platform/lib/application-onboarding.ts`, `apps/platform/app/api/platform/applications/[id]/onboarding-status/route.ts`, `apps/platform/app/api/platform/applications/[id]/route.ts` | Read invite acceptance / expiry state | KEEP | Keep and document; current canonical docs omit this route. |
| `/api/internal/dealerships/[dealerDealershipId]/invites` | yes | `apps/platform/app/api/platform/dealerships/[id]/invites/route.ts` | List dealer invites | KEEP | Intentional dealer bridge. |
| `/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]` | yes | `apps/platform/app/api/platform/dealerships/[id]/invites/[inviteId]/revoke/route.ts` | Revoke dealer invite | KEEP | Intentional dealer bridge. |
| `/api/internal/monitoring/job-runs` | yes | `apps/platform/app/api/platform/monitoring/job-runs/route.ts`, `apps/platform/scripts/performance/run-platform-bridge-scenario.ts` | Read dealer job-run telemetry | KEEP | Keep as dealer-owned operational data. |
| `/api/internal/monitoring/job-runs/daily` | yes | `apps/platform/app/api/platform/monitoring/job-runs/daily/route.ts` | Read daily job-run aggregates | KEEP | Keep as dealer-owned operational data. |
| `/api/internal/monitoring/rate-limits` | yes | `apps/platform/app/api/platform/monitoring/rate-limits/route.ts`, `apps/platform/scripts/performance/run-platform-bridge-scenario.ts` | Read dealer rate-limit telemetry | KEEP | Keep as dealer-owned operational data. |
| `/api/internal/monitoring/rate-limits/daily` | yes | `apps/platform/app/api/platform/monitoring/rate-limits/daily/route.ts` | Read daily rate-limit aggregates | KEEP | Keep as dealer-owned operational data. |
| `/api/internal/monitoring/maintenance/run` | yes | `apps/platform/app/api/platform/monitoring/maintenance/run/route.ts` | Trigger dealer telemetry maintenance | KEEP | Keep while dealer owns these rows/jobs. |
| `/api/internal/dealer-applications/[id]/platform-state` | yes | `apps/platform/lib/dealer-applications.ts` | Sync platform canonical review/linkage state back into dealer-owned execution records | KEEP | Dealer remains executor for activation/provisioning linkage, but platform is now canonical for review state. |

## Bucket A: REMOVE

These are dealer-side residues that should be deleted or refactored out in this sprint because they no longer represent a real boundary.

| Path | Type | Used by `apps/platform`? | Why it is residue | Decision |
|---|---|---|---|---|
| `apps/dealer/lib/platform-admin.ts` | dead stub helper | no | Removed in this sprint; the dealer app no longer carries the leftover stub. | REMOVE |
| `apps/dealer/components/auth-guard.tsx` | client runtime guard | no | Still treats `/platform` as a protected dealer path even though dealer has no such route tree. | REMOVE |
| `apps/dealer/components/ui-system/navigation/navigation.config.ts` | nav config | no | Dealer websites are grouped under `Platform`, which is stale dealer framing. | REMOVE |
| `apps/dealer/app/page.tsx` | dealer landing copy | no | Uses stale dealer copy: `Dealer Management System — Core Platform`. | REMOVE |
| `apps/dealer/docs/AUTH_IDENTITY_EXPANSION_V1_SPEC.md` | dealer-local doc | no | Documents platform pages and platform auth routes under dealer docs. | REMOVE or MOVE |
| `apps/dealer/docs/STEP2_AUTH_IDENTITY_EXPANSION_BACKEND_REPORT.md` | dealer-local doc | no | Same drift; platform-only details are stored under dealer docs. | REMOVE or MOVE |
| `apps/dealer/docs/STEP3_AUTH_IDENTITY_EXPANSION_FRONTEND_REPORT.md` | dealer-local doc | no | Same drift. | REMOVE or MOVE |
| `apps/dealer/docs/STEP4_AUTH_IDENTITY_EXPANSION_TEST_REPORT.md` | dealer-local doc | no | Same drift. | REMOVE or MOVE |
| `apps/dealer/docs/STEP4_AUTH_IDENTITY_EXPANSION_SECURITY_REPORT.md` | dealer-local doc | no | Same drift. | REMOVE or MOVE |
| `apps/dealer/docs/DEALER_TEST_INFRA_HARDENING_FRONTEND_REPORT.md` | dealer-local doc | no | Still references dealer `app/platform` test paths that no longer exist. | REMOVE or MOVE |

## Bucket B: MOVE

These findings still matter, but ownership should move away from dealer-hosted runtime behavior or dealer-local documentation.

| Path | Type | Used by `apps/platform`? | Why it should move | Decision |
|---|---|---|---|---|
| `apps/dealer/docs/DEALER_APPLICATION_APPROVAL_V1_SPEC.md` | doc | no | Superseded by platform canonical dealer-application ownership and boundary docs. | REMOVE |
| `apps/dealer/docs/DEALER_APPLICATION_APPROVAL_V1_PERF_NOTES.md` | doc | no | Superseded by platform canonical dealer-application ownership and boundary docs. | REMOVE |
| `apps/dealer/docs/DEALER_APPLICATION_APPROVAL_V1_SECURITY_QA.md` | doc | no | Superseded by platform canonical dealer-application ownership and boundary docs. | REMOVE |
| `apps/dealer/docs/DEALER_APPLICATION_APPROVAL_V1_FINAL_REPORT.md` | doc | no | Superseded by platform canonical dealer-application ownership and boundary docs. | REMOVE |

## Bucket C: KEEP

These are intentional dealer-owned bridge, linkage, or shared dealer-domain pieces and should not be removed.

### Dealer-owned bridge endpoints and flows

| Path | Type | Used by `apps/platform`? | Why it stays | Decision |
|---|---|---|---|---|
| `apps/dealer/app/api/internal/provision/dealership/route.ts` | internal API | yes | Dealer DB tenant creation belongs in dealer. | KEEP |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/status/route.ts` | internal API | yes | Dealer lifecycle state belongs in dealer. | KEEP |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route.ts` | internal API | yes | Dealer owns invite record and accept URL. | KEEP |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/owner-invite-status/route.ts` | internal API | yes | Dealer owns invite acceptance state. | KEEP |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/route.ts` | internal API | yes | Dealer invite list is dealer-owned state. | KEEP |
| `apps/dealer/app/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]/route.ts` | internal API | yes | Invite revoke acts on dealer-owned records. | KEEP |
| `apps/dealer/app/api/internal/monitoring/job-runs/route.ts` | internal API | yes | Dealer telemetry lives in dealer DB. | KEEP |
| `apps/dealer/app/api/internal/monitoring/job-runs/daily/route.ts` | internal API | yes | Dealer telemetry lives in dealer DB. | KEEP |
| `apps/dealer/app/api/internal/monitoring/rate-limits/route.ts` | internal API | yes | Dealer telemetry lives in dealer DB. | KEEP |
| `apps/dealer/app/api/internal/monitoring/rate-limits/daily/route.ts` | internal API | yes | Dealer telemetry lives in dealer DB. | KEEP |
| `apps/dealer/app/api/internal/monitoring/maintenance/run/route.ts` | internal API | yes | Dealer maintenance acts on dealer-owned telemetry. | KEEP |
| `apps/dealer/app/api/internal/dealer-applications/[id]/platform-state/route.ts` | internal API | yes | Dealer receives platform canonical review/linkage updates through this compatibility-only sync route. | KEEP |
| `apps/dealer/app/api/support-session/consume/route.ts` | special-flow API | yes | Dealer must set dealer support-session cookie. | KEEP |
| `apps/dealer/app/api/support-session/end/route.ts` | special-flow API | no direct caller found | Dealer-owned end of support session. | KEEP |
| `apps/dealer/app/api/invite/resolve/route.ts` | public dealer API | indirect | Invite acceptance belongs to dealer auth/membership flow. | KEEP |
| `apps/dealer/app/api/invite/accept/route.ts` | public dealer API | indirect | Invite acceptance belongs to dealer auth/membership flow. | KEEP |
| `apps/dealer/app/accept-invite/page.tsx` | dealer page | indirect | Final user acceptance page is dealer-owned UX. | KEEP |
| `apps/dealer/app/(app)/pending/page.tsx` | dealer page | no | Pending/provisioning state is part of dealer workflow. | KEEP |

### Shared dealer modules with stale names

| Path | Type | Used by `apps/platform`? | Why it stays | Decision |
|---|---|---|---|---|
| `apps/dealer/modules/admin-core/*` | dealer shared module | no | Canonical wrapper path for dealer-scoped admin/users/roles/files/audit/RBAC behavior. Legacy implementation alias remains `apps/dealer/modules/core-platform/*`. | KEEP |
| `apps/dealer/modules/invite-bridge/service/invite.ts` | dealer invite service | indirect | Canonical wrapper path for dealer-owned invite lifecycle behavior. Legacy implementation alias remains `apps/dealer/modules/platform-admin/service/invite.ts`. | KEEP |

Representative dealer imports proving `admin-core` is still dealer-local:

- `apps/dealer/app/(app)/admin/users/page.tsx`
- `apps/dealer/app/(app)/admin/roles/page.tsx`
- `apps/dealer/app/(app)/admin/dealership/page.tsx`
- `apps/dealer/app/(app)/admin/audit/page.tsx`
- `apps/dealer/app/(app)/files/page.tsx`
- `apps/dealer/app/api/admin/*`
- `apps/dealer/app/api/audit/route.ts`
- `apps/dealer/app/api/files/*`

### Linkage fields and config assumptions that remain valid

| Artifact | Why it stays | Decision |
|---|---|---|
| `Dealership.platformDealershipId` in `apps/dealer/prisma/schema.prisma` | Canonical cross-database linkage to platform dealership mapping. | KEEP |
| `DealerApplication.platformApplicationId` in `apps/dealer/prisma/schema.prisma` | Valid cross-system application linkage. | KEEP |
| `DealerApplication.platformDealershipId` in `apps/dealer/prisma/schema.prisma` | Valid cross-system linkage during approval/provisioning. | KEEP |
| `ProvisioningIdempotency.platformDealershipId` in `apps/dealer/prisma/schema.prisma` | Valid dealer provisioning idempotency linkage. | KEEP |
| `INTERNAL_API_JWT_SECRET` in dealer and platform | Required for signed internal bridge and support-session token verification. | KEEP |
| `DEALER_INTERNAL_API_URL` in platform | Required for platform -> dealer bridge calls. | KEEP |
| `NEXT_PUBLIC_APP_URL` in dealer invite/auth flows | Dealer builds accept/reset URLs from this base. | KEEP |
| `METRICS_SECRET` plus support-session cookie access for dealer ops routes | Dealer ops access model is intentional and no longer uses `PlatformAdmin`. | KEEP |

## Imports Of Platform-Looking Modules From Dealer

### `admin-core`

Assessment:

- this canonical module is not a dealer-hosted platform control plane
- it is a dealer-shared admin/files/audit/RBAC module
- current implementation is exposed through `apps/dealer/modules/admin-core` with legacy source files retained under `apps/dealer/modules/core-platform`

Decision:

- keep in Step 2
- canonicalize references on `admin-core` while retaining legacy implementation alias for low-risk compatibility

### `invite-bridge`

Assessment:

- current runtime behavior is dealer invite lifecycle and acceptance support
- canonical wrapper path is `apps/dealer/modules/invite-bridge`
- legacy implementation alias remains `apps/dealer/modules/platform-admin`

Decision:

- keep behavior
- keep canonical references on `invite-bridge` while retaining legacy implementation alias for low-risk compatibility

## Dealer Navigation, Layout, Provider, And UX Findings

### Verified clean state

- no dealer `/platform/*` page tree exists
- no dealer platform-specific layout/provider layer was found
- no `requirePlatformAuth`, `requirePlatformRole`, `PlatformAuthProvider`, or `PlatformShell` usage exists in dealer code

### Residual UX residue

| Path | Finding | Decision |
|---|---|---|
| `apps/dealer/components/auth-guard.tsx` | still special-cases `/platform` as a dealer protected path | REMOVE |
| `apps/dealer/components/ui-system/navigation/navigation.config.ts` | dealer websites grouped under `Platform` | REMOVE |
| `apps/dealer/app/page.tsx` | stale "Core Platform" dealer landing copy | REMOVE |

## Docs Drift Found During Audit

The biggest drift is between current code and several canonical platform-cutover docs.

### Current code disproves these older/current doc claims

Claim in docs:

- dealer compatibility is limited to invite/support only
- `apps/dealer/lib/platform-admin.ts` was removed

Current code shows:

- `apps/platform` still depends on dealer for provisioning, lifecycle status sync, health, monitoring telemetry, and dealer-application review bridge in addition to invite/support
- `apps/dealer/lib/platform-admin.ts` was stale residue before this sprint and has now been removed

### Docs that need correction in later steps

- `docs/canonical/ARCHITECTURE_CANONICAL.md`
- `docs/canonical/ARCHITECTURE_DECISIONS_CANONICAL.md`
- `docs/canonical/API_SURFACE_CANONICAL.md`
- `docs/canonical/KNOWN_GAPS_AND_FUTURE_WORK.md`
- `docs/canonical/PLATFORM_CUTOVER_REPORT.md`
- `docs/canonical/PLATFORM_SURFACE_MIGRATION_PLAN.md`
- `docs/canonical/PLATFORM_RESIDUAL_CLEANUP_AUDIT.md`
- `docs/canonical/PLATFORM_RESIDUAL_CLEANUP_REPORT.md`

Dealer-local docs that are stale or mislocated were listed in Bucket A and Bucket B above.

## Explicit Answers Required By Step 1

### 1. What dealer-side platform routes still exist?

Verified:

- no dealer public `/api/platform/*` routes remain
- no dealer `/platform/*` page surface remains

What does remain is the intentional dealer bridge/special-flow set:

- internal provisioning
- internal dealership status sync
- internal owner-invite and invite management
- internal monitoring telemetry and maintenance
- internal dealer-application compatibility sync
- support-session consume/end
- public invite acceptance

### 2. Which are dead or stale?

Confirmed dead or stale:

- `apps/dealer/lib/platform-admin.ts`
- `/platform` handling in `apps/dealer/components/auth-guard.tsx`
- dealer nav grouping labeled `Platform`
- stale dealer docs that still describe dealer-hosted platform auth/pages/APIs

### 3. Which should move to `apps/platform`?

Confirmed runtime move candidate:

- none that are safe to move in this sprint without re-homing dealer-owned data

Confirmed doc move/remove candidates:

- dealer-local auth identity docs that actually documented platform auth/pages
- stale dealer-local reports that referenced removed dealer `app/platform` paths

### 4. Which shared modules are actually platform-only and should be split or renamed?

Current answer:

- no currently verified dealer module is platform-only by behavior
- legacy `modules/core-platform` and `modules/platform-admin` are misnamed, not removable

Recommended later rename directions:

- canonical name: `admin-core` (legacy implementation alias: `core-platform`)
- canonical name: `invite-bridge` (legacy implementation alias: `platform-admin`)

### 5. What linkage fields remain valid and should stay?

Keep:

- `Dealership.platformDealershipId`
- `DealerApplication.platformApplicationId`
- `DealerApplication.platformDealershipId`
- `ProvisioningIdempotency.platformDealershipId`
- internal bridge auth/config and platform actor metadata used for invite/provisioning/support-session flows

## Thin QA Notes For Step 1

Audit-only step:

- no runtime code changed
- no tests run in Step 1
- verification was code inspection plus route/caller mapping

## Risks And Follow-Ups

Main risk:

- stale docs may suggest the removed dealer review bridge still exists even though platform now uses its own canonical dealer-application store

Follow-ups for Step 2:

- remove confirmed dead residue first
- preserve all KEEP bridge/linkage surfaces
- remove or rewrite any remaining docs that still describe the deleted dealer review bridge as the live platform review path
