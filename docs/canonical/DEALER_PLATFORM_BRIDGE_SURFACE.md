# Dealer / Platform Bridge Surface (Canonical)

**Status:** Implemented  
**Source of truth:** This doc plus `apps/dealer/lib/dealer-bridge-routes.ts` (registry used by architecture tests).

## Purpose

`apps/platform` is the only platform control-plane app. It does not import dealer code; it calls dealer over HTTP using `DEALER_INTERNAL_API_URL` and signed JWT (`INTERNAL_API_JWT_SECRET`). This document lists every dealer endpoint that platform (or platform-operated scripts) may call. Any new dealer route under `app/api/internal/` must be added to the registry in `apps/dealer/lib/dealer-bridge-routes.ts` as either a platform-called bridge route or a dealer-only internal route, and the architecture test `dealer-internal-routes-registered.test.ts` must pass.

## Dealer endpoints called by platform

| Dealer endpoint | Caller | Purpose |
|-----------------|--------|---------|
| `GET /api/health` | Platform monitoring (dealer-health, check-dealer-health) | Dealer liveness and DB health. |
| `POST /api/support-session/consume` | Platform impersonation start | Convert platform-issued support token into dealer cookie and redirect. |
| `POST /api/internal/provision/dealership` | Platform applications provision, invite-owner flow | Create dealer tenant records in dealer DB. |
| `POST /api/internal/dealerships/[dealerDealershipId]/status` | Platform dealerships status | Sync lifecycle status (ACTIVE/SUSPENDED/CLOSED) into dealer DB. |
| `POST /api/internal/dealerships/[dealerDealershipId]/owner-invite` | Platform dealerships owner-invite, applications invite-owner | Create owner invite in dealer; dealer owns accept URL. |
| `GET /api/internal/dealerships/[dealerDealershipId]/owner-invite-status` | Platform applications onboarding-status, application detail | Read invite acceptance/expiry state. |
| `GET /api/internal/dealerships/[dealerDealershipId]/invites` | Platform dealerships invites | List dealer invites. |
| `PATCH /api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]` | Platform invites revoke | Revoke/cancel invite (body: cancel + platformActorId). |
| `GET /api/internal/monitoring/job-runs` | Platform monitoring job-runs | Read dealer job-run telemetry. |
| `GET /api/internal/monitoring/job-runs/daily` | Platform monitoring job-runs daily | Read daily job-run aggregates. |
| `GET /api/internal/monitoring/rate-limits` | Platform monitoring rate-limits | Read dealer rate-limit telemetry. |
| `GET /api/internal/monitoring/rate-limits/daily` | Platform monitoring rate-limits daily | Read daily rate-limit aggregates. |
| `POST /api/internal/monitoring/maintenance/run` | Platform monitoring maintenance run | Trigger dealer telemetry maintenance (purge/aggregate). |
| `POST /api/internal/dealer-applications/[id]/platform-state` | Platform dealer-applications sync (canonical state push to dealer) | Sync platform review/linkage state into dealer-owned DealerApplication records. |

## Dealer-only internal routes (not called by platform)

These live under `app/api/internal/` but are used only by the dealer app or worker (e.g. job triggers). They are listed in `DEALER_ONLY_INTERNAL_ROUTES` in `apps/dealer/lib/dealer-bridge-routes.ts`:

- `internal/jobs/crm`
- `internal/jobs/vin-decode`
- `internal/jobs/bulk-import`
- `internal/jobs/analytics`
- `internal/jobs/alerts`

## Public dealer routes used in cross-app flows

- **Invite acceptance:** `GET /api/invite/resolve`, `POST /api/invite/accept` — used by dealer accept-invite page; platform sends users to dealer accept URL.
- **Support session:** `POST /api/support-session/end` — dealer-side end of support session (platform starts via impersonation redirect to `/api/support-session/consume`).

## Reverse direction: dealer → platform

- **Dealer application sync:** When dealer-owned `DealerApplication` state changes, dealer calls platform `POST /api/internal/dealer-applications/sync` (see `apps/dealer/lib/call-platform-internal.ts`). Platform is canonical for review/approval state; dealer pushes updates so platform store stays in sync.

## Guardrails

- **No dealer platform routes:** Dealer must not host `app/platform/*` pages or `app/api/platform/*` routes. Enforced by `tests/architecture/dealer-no-platform-routes.test.ts`.
- **All internal routes registered:** Every `app/api/internal/**/route.ts` must be in `lib/dealer-bridge-routes.ts`. Enforced by `tests/architecture/dealer-internal-routes-registered.test.ts`.
- **Platform must not import dealer:** Enforced by `tests/architecture/app-boundaries.test.ts`.

## References

- [ARCHITECTURE_CANONICAL.md](./ARCHITECTURE_CANONICAL.md) — app boundaries and module naming.
- [PLATFORM_CUTOVER_REPORT.md](./PLATFORM_CUTOVER_REPORT.md) — what was removed from dealer and what remains.
- `apps/platform/lib/call-dealer-internal.ts` — platform → dealer HTTP calls.
- `apps/dealer/docs/DEALER_PLATFORM_BOUNDARY_CLEANUP_SPEC.md` — cleanup spec and bucket decisions.
