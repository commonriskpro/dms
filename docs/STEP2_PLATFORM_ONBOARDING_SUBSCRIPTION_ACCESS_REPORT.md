# Step 2 — Platform Onboarding + Subscription + Dealer Access: Backend Report

**Sprint:** Platform Onboarding + Subscription + Dealer Access Lifecycle  
**Step:** 2 — Backend  
**Date:** 2026-03-14

---

## Summary

Backend and contracts were implemented per the Step 1 spec (and patch): platform subscription entitlements and seat cap, platform internal entitlements API for dealer consumption, dealer seat enforcement at invite acceptance, and dealer module-access helper. No breaking changes to existing flows.

---

## Files changed

### Platform

- **apps/platform/prisma/schema.prisma** — Added `BillingStatus.SUSPENDED`; added `maxSeats` (Int?) and `entitlements` (Json?) to `PlatformSubscription`.
- **apps/platform/prisma/migrations/20260314180000_subscription_entitlements_seats/migration.sql** — New migration: add SUSPENDED to enum (safe), add `max_seats` and `entitlements` columns.
- **apps/platform/lib/db/subscriptions.ts** — `createSubscription` accepts `maxSeats` and `entitlements`; added `getSubscriptionByDealershipId(platformDealershipId)`; `updateSubscription` accepts `maxSeats` and `entitlements`.
- **apps/platform/lib/service/entitlements.ts** — New: `getEntitlementsForPlatformDealership`, `getEntitlementsForDealerDealershipId` (resolve via DealershipMapping); default modules by plan (STARTER, PRO, ENTERPRISE).
- **apps/platform/app/api/internal/entitlements/[dealerDealershipId]/route.ts** — New: GET internal entitlements by dealerDealershipId; JWT auth; returns `EntitlementsResponse` (modules, maxSeats, features).

### Dealer

- **apps/dealer/lib/call-platform-internal.ts** — Added `fetchEntitlementsForDealership(dealerDealershipId)` to call platform GET internal entitlements; returns `EntitlementsResponse | null` on success, null on 404/error.
- **apps/dealer/lib/entitlements.ts** — New: `countActiveMemberships`, `assertSeatAvailableForActivation` (throws SEAT_LIMIT_REACHED when at cap), `canAccessModule(entitlements, userPermissions, moduleKey)` for entitlement + permission gating.
- **apps/dealer/lib/api/errors.ts** — Map `SEAT_LIMIT_REACHED` to 409.
- **apps/dealer/modules/platform-admin/service/invite.ts** — Call `assertSeatAvailableForActivation(invite.dealershipId)` before `createMembershipFromInvite` in both `acceptInvite` and `acceptInviteWithSignup`.

### Contracts

- **packages/contracts/src/internal/entitlements.ts** — New: `entitlementsResponseSchema` (modules, maxSeats, features).
- **packages/contracts/src/index.ts** — Export `internal/entitlements`.

---

## New routes / services / models

- **Platform:** GET `/api/internal/entitlements/[dealerDealershipId]` — internal only; returns entitlements for dealer dealership (via mapping). Used by dealer server to fetch seat cap and modules.
- **Platform:** `getEntitlementsForPlatformDealership`, `getEntitlementsForDealerDealershipId` in `lib/service/entitlements.ts`.
- **Dealer:** `fetchEntitlementsForDealership`, `countActiveMemberships`, `assertSeatAvailableForActivation`, `canAccessModule` (see above). No new HTTP routes in dealer for entitlements (consumer only).

---

## Migration notes

- Run platform migrations when deploying: `npx prisma migrate deploy` in apps/platform (requires DATABASE_URL). New columns are nullable; existing rows unchanged.
- Backfill: optional. Existing subscriptions have `maxSeats: null` (unlimited) and `entitlements: null` (plan defaults used in entitlements resolution). No backfill required for correct behavior.

---

## Idempotency notes

- Provision and invite-owner flows unchanged; remain idempotent as before.
- Seat check is read-only (count + fetch entitlements); no new idempotency keys.

---

## Known follow-ups

- Platform UI for subscription maxSeats/entitlements (edit plan, set seat cap, toggle modules) — Step 3.
- Dealer UI: show “X of Y seats used” on invite form; entitlement-aware nav (hide/lock modules) — Step 3.
- Platform dashboard/application detail: ensure subscription is created when dealership is provisioned if not already (current flow may create subscription elsewhere or on first access); align with “subscription per PlatformDealership” model.
- Unit tests for `assertSeatAvailableForActivation` and `canAccessModule`; mock `fetchEntitlementsForDealership` in invite-accept tests if they hit the service — Step 4.
- Optional: dealer cache for entitlements (short TTL) to reduce platform calls.

---

## Backward compatibility

- Existing invite acceptance flows unchanged except for the seat check: when platform is unreachable or dealership has no mapping, `fetchEntitlementsForDealership` returns null and we allow activation (fail open). When platform returns entitlements with `maxSeats: null`, we allow. So existing dealers without a platform subscription or with unlimited seats are unaffected.
- Existing subscription create/update in platform do not yet pass maxSeats/entitlements; new columns default to null. Platform can later add UI/API to set them.
