# Platform Residual Cleanup Report

This report records the completed dealer-side `PlatformAdmin` residual cleanup after the platform control-plane cutover.

Completion date:
- March 9, 2026

Result:
- Dealer `PlatformAdmin` runtime/state has been removed.
- `apps/platform` remains the only platform control plane.
- Dealer-side compatibility is now limited to dealer-owned invite/support bridge endpoints that `apps/platform` still calls.

## 1. Scope Completed

Completed items from the audit cleanup order:
1. Removed the dead `requirePlatformAdmin` export by deleting the dealer helper entirely.
2. Removed session payload exposure of `platformAdmin.isAdmin`.
3. Migrated dealer `/api/metrics` and `/api/cache/stats` off `PlatformAdmin` gating.
4. Removed tenant bypass compatibility tied to `isPlatformAdminUser`.
5. Removed dealer `PlatformAdmin` schema and seed path after runtime parity was confirmed.

## 2. Runtime Changes Made

### Removed dealer `PlatformAdmin` helper/runtime

Removed:
- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)
- [`apps/dealer/lib/platform-admin.test.ts`](../../apps/dealer/lib/platform-admin.test.ts)

Reason:
- No remaining runtime code required dealer-side `PlatformAdmin` row checks after the platform cutover and ops-gate migration.

### Removed session contract residue

Updated:
- [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)
- [`apps/dealer/app/api/auth/session/route.ts`](../../apps/dealer/app/api/auth/session/route.ts)
- [`apps/dealer/lib/types/session.ts`](../../apps/dealer/lib/types/session.ts)
- [`apps/dealer/contexts/session-context.tsx`](../../apps/dealer/contexts/session-context.tsx)
- [`apps/dealer/app/api/auth/session/route.test.ts`](../../apps/dealer/app/api/auth/session/route.test.ts)

Result:
- `/api/auth/session` no longer exposes `platformAdmin`.
- Dealer client session state no longer models a dealer-side platform-admin overlay.

### Replaced ops-route gating

Updated:
- [`apps/dealer/lib/operator-access.ts`](../../apps/dealer/lib/operator-access.ts)
- [`apps/dealer/app/api/metrics/route.ts`](../../apps/dealer/app/api/metrics/route.ts)
- [`apps/dealer/app/api/cache/stats/route.ts`](../../apps/dealer/app/api/cache/stats/route.ts)

Final operator access model:
- `Authorization: Bearer ${METRICS_SECRET}`
- or a valid dealer support-session cookie

Result:
- dealer ops routes no longer depend on dealer `PlatformAdmin` rows
- platform support staff can still reach dealer ops routes during a valid support session

### Removed tenant bypass compatibility

Updated:
- [`apps/dealer/lib/tenant.ts`](../../apps/dealer/lib/tenant.ts)
- call sites in:
  - [`apps/dealer/app/api/me/dealerships/route.ts`](../../apps/dealer/app/api/me/dealerships/route.ts)
  - [`apps/dealer/app/api/me/current-dealership/route.ts`](../../apps/dealer/app/api/me/current-dealership/route.ts)

Result:
- active dealership resolution is now membership-based only for dealer users
- the old dealer `isPlatformAdminUser` bypass path is gone

## 3. Persistence Cleanup

Updated:
- [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma)
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- added migration: [`apps/dealer/prisma/migrations/20260309223000_remove_platform_admin/migration.sql`](../../apps/dealer/prisma/migrations/20260309223000_remove_platform_admin/migration.sql)

Removed from dealer schema/seed:
- `PlatformAdmin` model
- `Profile.platformAdmin`
- `Profile.platformAdminsCreatedBy`
- env-driven dealer `PlatformAdmin` seeding from `SUPERADMIN_EMAILS` / `PLATFORM_ADMIN_EMAILS`

Result:
- dealer DB schema no longer models a second platform-admin authorization layer

## 4. What Still Intentionally Remains

These dealer-side paths were kept intentionally because they are dealer-owned bridge behavior, not legacy control-plane state:
- dealer invite/public invite flows under [`apps/dealer/app/api/invite`](../../apps/dealer/app/api/invite)
- dealer internal invite/owner-invite endpoints under [`apps/dealer/app/api/internal/dealerships`](../../apps/dealer/app/api/internal/dealerships)
- dealer support-session consume/end endpoints under [`apps/dealer/app/api/support-session`](../../apps/dealer/app/api/support-session)
- dealer invite module under [`apps/dealer/modules/platform-admin`](../../apps/dealer/modules/platform-admin) (legacy name only)

## 5. Validation Performed

Focused validation run:
- `npm -w dealer exec prisma generate`
- `npm -w dealer test -- --runInBand --runTestsByPath app/api/auth/session/route.test.ts app/api/metrics/route.test.ts app/api/cache/stats/route.test.ts lib/operator-access.test.ts app/api/me/dealerships/route.test.ts app/api/me/current-dealership/route.test.ts`

Validation goals:
- confirm Prisma client still generates after schema cleanup
- confirm session route/tests align with the removed `platformAdmin` contract
- confirm metrics/cache routes enforce the new operator gate
- confirm tenant call sites compile and mocked route tests still pass

## 6. Final State

Confirmed current state:
- `apps/platform` is the only platform control plane.
- Dealer no longer carries `PlatformAdmin` runtime logic, session state, tenant bypass logic, schema, or seed behavior.
- Remaining cross-app coupling is explicit dealer invite/support bridge behavior only.

## 7. Follow-Up Items

Remaining follow-up is narrower than before:
1. Consider renaming [`apps/dealer/modules/platform-admin`](../../apps/dealer/modules/platform-admin) so the module name reflects invite bridge responsibility instead of historical platform-admin terminology.
2. Continue platform/dealer bridge minimization only if product ownership of invite/support flows changes.
3. Keep historical audit docs as dated records; use this report plus current architecture/status docs as the current post-cleanup truth.
