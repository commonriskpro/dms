# Step 4 — Platform Onboarding + Subscription + Dealer Access: Security Matrix

**Sprint:** Platform Onboarding + Subscription + Dealer Access Lifecycle  
**Date:** 2026-03-14

---

## Threat / control matrix

| Threat / requirement | Control | Status |
|----------------------|--------|--------|
| Platform routes require platform auth/role | Platform routes use `requirePlatformAuth` / `requirePlatformRole`; internal routes use `verifyInternalApiJwt`. | ✓ Verified |
| Dealer routes remain tenant-scoped | Dealer routes use `getAuthContext`; `dealershipId` from session only. | ✓ Verified |
| No cross-tenant invite leakage | Invites created and listed by `ctx.dealershipId`; accept resolves invite by token, then uses invite’s dealershipId. | ✓ Verified |
| No subscription spoofing from dealer client | Dealer never accepts subscription or plan from client; entitlements from platform internal API only. | ✓ Verified |
| No entitlement spoofing from client | Entitlements fetched server-side from platform; `canAccessModule` uses server-fetched entitlements. | ✓ Verified |
| No unauthorized user-management actions | Invite/membership routes use `guardPermission` / `guardAnyPermission` (e.g. admin.users.read, admin.users.invite, admin.memberships.write). | ✓ Verified |
| No activation beyond seat limits | `assertSeatAvailableForActivation` runs before creating membership in accept flow; returns 409 SEAT_LIMIT_REACHED when at cap. | ✓ Verified |
| No owner invite bypass | Owner invite created only via platform internal call (dealer owner-invite endpoint) or platform UI; dealer employee invite requires admin permission. | ✓ Verified |
| Module visibility vs API | API can enforce entitlement in future per-route; UI module gating (nav) deferred. Backend `canAccessModule` available for use. | ✓ Documented |

---

## New / touched endpoints

| Endpoint | Auth | Scope | Notes |
|----------|------|--------|------|
| GET /api/platform/dealerships/[id] | Platform session + role | Platform dealership id from URL | Now includes subscription summary. |
| GET /api/internal/entitlements/[dealerDealershipId] | Internal JWT | dealerDealershipId from URL; platform resolves mapping | Returns entitlements for that dealer dealership only. |
| GET /api/admin/seat-usage | Dealer session + admin.users.read or admin.memberships.read | ctx.dealershipId | Returns usedSeats, maxSeats for current tenant. |

---

## Validation

- **Strict schema validation:** Platform internal entitlements response validated with `entitlementsResponseSchema`. Seat-usage and invite inputs use existing Zod/validation.
- **Invalid role assignment:** Rejected by existing role APIs (dealership-scoped roles).
- **Dealership mismatch:** Invite and membership operations use session dealershipId or invite-derived dealershipId; no client-supplied dealershipId for scope.
- **Invite acceptance:** Token validated; expired/cancelled handled by existing invite service; seat check added before membership creation.
