# Step 4 — Platform Onboarding + Subscription + Dealer Access: Security & QA Report

**Sprint:** Platform Onboarding + Subscription + Dealer Access Lifecycle  
**Step:** 4 — Security & QA  
**Date:** 2026-03-14

---

## Final status: READY WITH FOLLOW-UPS

**Implemented:** Spec patch (five clarifications), backend (entitlements, seats, platform internal API, dealer seat check and module helper), frontend (subscription card on platform dealership detail, seat usage in dealer invite dialog), security checks, and seat-usage route tests.

**Follow-ups:**

- Subscription creation on provision (so Subscription card and seat cap are populated).
- Entitlement-aware nav (hide/lock modules not in `entitlements.modules` using `canAccessModule`).
- “Module not included” state for unlicensed module routes.
- Platform UI for editing maxSeats/entitlements.
- More tests (e.g. `assertSeatAvailableForActivation`, `canAccessModule`; invite-accept mocks) and fixing pre-existing dealer test failures.

---

## Security issues found / fixed

- **Platform internal entitlements route:** Requires `verifyInternalApiJwt`; only callable with shared `INTERNAL_API_JWT_SECRET`. Entitlements are resolved by `dealerDealershipId` via platform `DealershipMapping`; no client-supplied platform IDs. No issues found; no change.
- **Dealer seat-usage route:** Uses `getAuthContext` (session) and `guardAnyPermission(ctx, ["admin.users.read", "admin.memberships.read"])`; `usedSeats` and `maxSeats` are computed from server-side data (dealershipId from context, entitlements from platform). No client input affects subscription or entitlement. No issues found.
- **Dealer invite accept:** Seat check uses `assertSeatAvailableForActivation(dealershipId)` with `dealershipId` from the invite (server-resolved from token). No spoofing of dealership or subscription. No issues found.
- **Entitlement consumption:** Dealer never accepts subscription or entitlement from client; always fetches from platform internal API or uses server-side helper. No issues found.

---

## Tests added

- **apps/dealer/app/api/admin/seat-usage/route.test.ts** — GET /api/admin/seat-usage: 403 when user lacks permission; 200 with usedSeats/maxSeats when permitted; maxSeats undefined when entitlements have null maxSeats.

---

## Commands run

- `npm run build --workspace=@dms/contracts` — pass
- `npx prisma generate` (platform) — pass
- `npx prisma migrate deploy` (platform) — not run (requires DATABASE_URL)
- Dealer tests: full suite has pre-existing failures (e.g. CostLedgerCard, lender-integration path, OOM). New seat-usage test can be run in isolation.

---

## Pass/fail summary

| Check | Result |
|-------|--------|
| Platform schema + migration | Pass (migration file added; deploy requires env) |
| Contracts build | Pass |
| Platform Prisma generate | Pass |
| Dealer seat-usage route test | Pass (when run in isolation) |
| Dealer full test suite | Pre-existing failures (unchanged by this sprint) |
| Lint (edited files) | No linter errors reported |

---

## Blockers

- None. Platform migration must be run in an environment with DATABASE_URL when deploying.

---

## Recommended next follow-up sprint

1. **Subscription creation on provision:** Ensure a `PlatformSubscription` is created when a dealership is provisioned (or document that it is created elsewhere) so the Subscription card and seat cap are populated.
2. **Entitlement-aware nav:** Load entitlements in dealer layout/session and hide or lock nav items for modules not in `entitlements.modules` using `canAccessModule`.
3. **Module not included state:** Add a shared empty state or guard for routes that require an entitled module, with message "Module not included in your plan."
4. **Platform UI for maxSeats/entitlements:** Allow editing subscription maxSeats and entitlements (e.g. modules JSON) from platform dealership or subscription page.
5. **Tests:** Add unit tests for `assertSeatAvailableForActivation` and `canAccessModule`; mock `fetchEntitlementsForDealership` in invite-accept tests if they hit the service.
6. **Fix pre-existing dealer test failures** (CostLedgerCard text, lender-integration path, Jest OOM) so full suite is green.
