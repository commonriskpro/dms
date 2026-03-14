# Step 3 — Platform Onboarding + Subscription + Dealer Access: Frontend Report

**Sprint:** Platform Onboarding + Subscription + Dealer Access Lifecycle  
**Step:** 3 — Frontend  
**Date:** 2026-03-14

---

## Summary

UI was extended per spec: platform dealership detail shows subscription (plan, billing status, max seats) when present; dealer admin users page shows seat usage in the invite-member dialog. Existing application detail, provision, and owner-invite flows were left as-is.

---

## Pages / components added or updated

### Platform

- **apps/platform/app/api/platform/dealerships/[id]/route.ts** — GET response now includes `subscription` (id, plan, billingStatus, maxSeats) when the dealership has a subscription.
- **apps/platform/lib/api-client.ts** — Added `DealershipSubscriptionSummary`; `DealershipDetail` now includes optional `subscription`.
- **apps/platform/app/(platform)/platform/dealerships/[id]/page.tsx** — Added a "Subscription" card when `d.subscription` is present, showing plan, billing status, and max seats.

### Dealer

- **apps/dealer/app/api/admin/seat-usage/route.ts** — New GET route: returns `{ usedSeats, maxSeats }` for the current dealership; guarded by `admin.users.read` or `admin.memberships.read`.
- **apps/dealer/modules/core-platform/ui/UsersPage.tsx** — Invite-member dialog: when open, fetches `/api/admin/seat-usage` and shows "X of Y seats used" or "X seats used (unlimited)" in the description.

---

## State handling notes

- Platform dealership detail: subscription is loaded with the existing dealership fetch; no extra request.
- Dealer seat usage: fetched when the invite dialog opens; not cached across dialog open/close. Optional follow-up: cache for the session or pass from a parent that fetches once.

---

## Entitlement UX notes

- **Seat usage:** Shown in the invite dialog so admins see current usage and limit before sending an invite. If the accept flow hits the seat cap, the backend returns 409 SEAT_LIMIT_REACHED with a clear message.
- **Entitlement-aware nav:** Not implemented in this step. The backend exposes `canAccessModule(entitlements, permissions, moduleKey)` in `lib/entitlements.ts`. A follow-up would: load entitlements in layout or session, and hide or lock nav items for modules not in `entitlements.modules` or where the user lacks the corresponding permission.
- **Module not included:** A dedicated "module not included in your plan" empty state for unlicensed modules was not added; can be added per-route using the same helper when needed.

---

## Unresolved UX tradeoffs

- Platform: Subscription card only appears when a subscription record exists. Dealerships created without a subscription (e.g. via application provisioning only) will not show the card until a subscription is created. Consider creating a default subscription on provision or showing a "No subscription" state.
- Dealer: Seat usage is fetched client-side when the dialog opens; a brief delay or empty state is possible if the request is slow. Optional: show a loading state or fetch on users page load.
- Entitlement-based nav hiding is deferred; until then, users may see nav entries for modules they cannot access (permission or entitlement still enforced in API).
