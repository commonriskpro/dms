# Step 1 — Platform Onboarding + Subscription + Dealer Access: Report

**Sprint:** Platform Onboarding + Subscription + Dealer Access Lifecycle  
**Step:** 1 — Spec only (no code changes)  
**Date:** 2026-03-14

---

## Deliverables

1. **Spec:** `apps/platform/docs/PLATFORM_ONBOARDING_SUBSCRIPTION_ACCESS_SPEC.md` — full spec covering ownership, glossary, state machines, data model changes, internal APIs, entitlements, seats, RBAC, UI map, audit, errors, migration, acceptance criteria.
2. **This report:** What already existed, what will be reused, what is new, assumptions.

---

## What already existed

### Platform

- **Application** model with status: APPLIED, UNDER_REVIEW, APPROVED, REJECTED; linked to PlatformDealership after provision.
- **PlatformDealership** with status: APPROVED, PROVISIONING, PROVISIONED, ACTIVE, SUSPENDED, CLOSED; planKey, limits (JSON).
- **PlatformSubscription** with plan (STARTER, PRO, ENTERPRISE), billingStatus (ACTIVE, TRIAL, PAST_DUE, CANCELLED), optional billing provider fields.
- **DealershipMapping** (platformDealershipId ↔ dealerDealershipId).
- **Platform roles:** PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT.
- **Application onboarding flow:** `provisionDealershipFromApplication`, `inviteOwnerForApplication`, `getOwnerInviteStatusForApplication` in `lib/application-onboarding.ts`; calls dealer internal provision and owner-invite.
- **Routes:** applications/[id] (GET), approve, reject, provision, invite-owner, onboarding-status; dealerships/[id] (status, owner-invite, invites, invites/[id]/revoke); provisioning idempotent via dealer; invite-owner uses idempotency key and dealer owner-invite.
- **Platform audit:** `platformAuditLog` for application.provision, application.owner_invite_sent.
- **PlatformEmailLog** for OWNER_INVITE; PlatformInviteLog (hash only).

### Dealer

- **Dealership** with lifecycleStatus (ACTIVE, SUSPENDED, CLOSED), platformDealershipId.
- **DealershipInvite** with status PENDING, ACCEPTED, EXPIRED, CANCELLED; dealerApplicationId for owner linkage; createdBy null for platform-created owner invite.
- **Membership** with roleId, inviteId, disabledAt, joinedAt, invitedBy.
- **Role, Permission, RolePermission, UserRole, UserPermissionOverride** — role-union + overrides; `loadUserPermissions`, `requirePermission`, `guardPermission` in handler/rbac.
- **ProvisioningIdempotency, OwnerInviteIdempotency** for idempotent provision and owner invite.
- **Internal routes:** provision/dealership, dealerships/[id]/status, owner-invite, owner-invite-status, invites, invites/[id] (revoke); auth via internal JWT.
- **Public invite:** resolve, accept; accept-invite page.
- **Admin users/memberships/roles:** admin.users.invite, admin.memberships.read/write, admin.roles.assign, etc.; RBAC permission matrix and seed roles (Owner, Dealer Admin, Sales Manager, Sales Associate, Accounting, Admin Assistant, Inventory Manager).
- **Dealer audit:** auditLog for platform.owner_invite.created, membership/invite actions.

### Contracts

- `provisionDealershipRequestSchema` / Response; `setDealershipStatusRequestSchema`; `dealerOwnerInviteRequestSchema` / Response / OwnerInviteStatusResponse in `packages/contracts`.

### Docs

- DEALER_PLATFORM_BOUNDARY_AUDIT.md, DEALER_PLATFORM_BOUNDARY_CLEANUP_SPEC.md, DEALER_PLATFORM_BRIDGE_SURFACE.md describe platform↔dealer boundary and bridge routes.

---

## What will be reused

- Entire platform application → provision → invite-owner flow (orchestration and dealer calls).
- Dealer internal provision, owner-invite, owner-invite-status, invites list/revoke; public invite resolve/accept.
- Dealer RBAC: role union + overrides; guardPermission; existing permission keys (dashboard.read, inventory.read/write, customers, crm, deals, reports, admin.*, etc.).
- Dealer seed roles: Owner, Dealer Admin, Sales Manager, etc.; map to spec names (OWNER, DEALERSHIP_ADMIN, …) by key/name.
- Platform PlatformSubscription and BillingStatus; extend for entitlements and seat cap rather than replace.
- All existing bridge routes and linkage fields (platformDealershipId, dealerApplicationId, etc.).

---

## What new entities / routes / services are required

### Platform

- **Data:** Optional new or extended fields: subscription `maxSeats` (or in limits); subscription or dealership-level entitlements (e.g. modules[], feature flags) — JSON or new table. BillingStatus.SUSPENDED if subscription-level suspension desired.
- **Routes:** Extend or add: dealerships/[id]/subscription (CRUD or update); dealerships/[id]/entitlements (GET for platform UI and/or for dealer consumption); dealerships/[id]/suspend, dealerships/[id]/activate if not already covered by status.
- **Services:** Entitlement resolution (plan + add-ons → modules, maxSeats); optional PLATFORM_ONBOARDING role.

### Dealer

- **Data:** No mandatory new tables. Optional: short-lived cache for entitlements snapshot keyed by dealershipId.
- **Routes:** Employee invite creation (likely already under admin/memberships); ensure seat check at accept/activation. New or extended: internal endpoint for dealer to get entitlements (or dealer calls platform internal GET entitlements by platformDealershipId via mapping).
- **Services:** Seat count for dealership; activation guard that checks seat cap and entitlement; module-access helper (entitlement enabled && permission granted).

### Contracts

- Entitlements response (and optionally request) schema: e.g. modules[], maxSeats, features.

---

## Assumptions made

1. **Application state:** Platform `Application` status (APPLIED → UNDER_REVIEW → APPROVED | REJECTED) is the canonical application lifecycle; no need to rename or split; PlatformDealerApplication remains compatibility/sync surface.
2. **Provisioning state:** “UNPROVISIONED” is represented by absence of PlatformDealership for that application or by status before PROVISIONING; platform may keep current APPROVED → PROVISIONING → PROVISIONED flow without adding a new enum value.
3. **Subscription vs billing:** Internal entitlement and subscription domain is sufficient for this sprint; external billing provider (e.g. Stripe) can be wired later; subscription fields (plan, billingStatus, maxSeats, entitlements) are the contract.
4. **Owner vs employee invite:** Same DealershipInvite model; owner invite has createdBy null and optionally dealerApplicationId; employee invite has createdBy set. No separate “OwnerInvite” table.
5. **Default dealer roles:** Existing seed (Owner, Dealer Admin, Sales Manager, Sales Associate, Accounting, Admin Assistant, Inventory Manager) is extended or renamed to include READ_ONLY, BDC_AGENT, FINANCE_MANAGER where missing; keys (OWNER, DEALERSHIP_ADMIN, etc.) used in code where needed; display names can stay human-friendly.
6. **Platform roles:** PLATFORM_ONBOARDING is optional; PLATFORM_ADMIN can be an alias or separate; platform access is never derived from dealership membership.
7. **Entitlement consumption:** Dealer gets entitlements via platform (dealer calls platform internal API or platform pushes); dealer does not store commercial truth; cache in dealer is optional and TTL-bound.
8. **Seat cap:** Stored on platform (subscription or plan); enforced in dealer at activation (accept invite or re-enable user); invite creation may allow pending invite even at cap.
9. **Backward compatibility:** Existing invite accept flow and bootstrap-link-owner (or similar) remain valid; any unification of owner vs employee accept is additive.
10. **Audit:** Existing platform and dealer audit hooks extended for new actions (subscription/entitlement changes, seat-related rejections); no PII in metadata.

---

## Step 1 patch (five clarifications)

The spec and this report were updated with the following:

1. **Multi-dealership memberships:** A single user may belong to one or more dealerships. Membership, role assignment, overrides, and status are scoped per dealership. Entitlements are evaluated per active dealership context. Added as §2.1 in the spec.

2. **Subscription scope:** Subscriptions are per PlatformDealership, not per PlatformAccount. Preferred model: PlatformAccount is the commercial parent; each PlatformDealership has its own subscription and entitlements. Added as §2.2 in the spec.

3. **Permission naming:** Use canonical coarse permissions (users.read, users.write, admin.read, admin.write, plus domain-level keys). Do not introduce finer-grained permission keys unless the codebase already enforces them. Reflected in §9 of the spec.

4. **Dealer schema:** No dealer schema changes are currently required based on inspection; minimal additive dealer-side schema changes are allowed in Step 2 if implementation proves they are necessary. Reflected in §5 of the spec.

5. **Seat consumption rules:** Only active memberships consume seats; pending invites do not; disabled or removed users free a seat; enforcement at activation/acceptance time; owner counts as a seat under the dealership subscription. Reflected in §8 of the spec.

---

## Next step

Step 2 — Backend: implement/extend platform and dealer backend and contracts per this spec; produce `docs/STEP2_PLATFORM_ONBOARDING_SUBSCRIPTION_ACCESS_REPORT.md`.
