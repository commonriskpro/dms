# Platform Onboarding + Subscription + Dealer Access Lifecycle — Spec

**Sprint:** Platform Onboarding + Subscription + Dealer Access Lifecycle  
**Mode:** Full 4-step implementation  
**Branch:** ui-remix  
**Status:** Step 1 — Spec only (no code changes)

---

## 1. Canonical ownership map

| Concern | Owner app | Notes |
|--------|-----------|--------|
| Dealership applications (review, approve, reject) | platform | `Application` + optional `PlatformDealerApplication` sync |
| Commercial onboarding & provisioning orchestration | platform | Platform creates `PlatformDealership`, calls dealer internal provision |
| Subscriptions, add-ons, module entitlements, seat limits | platform | `PlatformSubscription`; billing status; entitlements source of truth |
| Billing status, suspension flags | platform | Drives dealer lifecycle (ACTIVE/SUSPENDED) via status sync |
| First owner activation initiation | platform | Platform calls dealer internal owner-invite; dealer creates invite & accept URL |
| Tenant runtime dealership (memberships, roles, permissions) | dealer | After provisioning, dealer is source of truth for who belongs to the dealership |
| Invite acceptance, membership activation | dealer | Dealer owns `DealershipInvite`, `Membership`, accept flow |
| Employee invites | dealer | Dealership admins (owner/dealer admin) invite employees; same subscription/license |
| Active dealership selection, user administration | dealer | Dealer only |
| Module visibility/access | both | **Entitlement** (platform) **AND** **permission** (dealer) required |

---

## 2. Domain glossary

- **Application (platform):** Request to join as a dealership; has status APPLIED → UNDER_REVIEW → APPROVED | REJECTED. Platform `Application` model.
- **PlatformDealerApplication:** Dealer-side mirror of application with richer status (draft, invited, submitted, under_review, approved, rejected, activation_sent, activated); kept in sync via internal bridge.
- **Provisioning:** Creating the dealer tenant (Dealership + default roles, etc.) from an approved application. Platform orchestrates; dealer internal API performs DB writes.
- **PlatformDealership:** Platform-side dealership record; holds plan, limits, status (APPROVED, PROVISIONING, PROVISIONED, ACTIVE, SUSPENDED, CLOSED).
- **Dealership (dealer):** Tenant in dealer DB; runtime entity. Linked via `platformDealershipId` and `DealershipMapping`.
- **Owner invite:** First-user invite for a newly provisioned dealership; platform-initiated, dealer-materialized (invite row in dealer, accept URL from dealer).
- **Employee invite:** Invite created by a dealership admin (owner or dealer admin) for an additional user; dealer-only flow.
- **Subscription:** Platform entity; ties a platform dealership to a plan, billing status, and optional add-ons/entitlements.
- **Entitlement:** What the dealership is allowed to use (modules, features, seat cap); derived from subscription + add-ons; platform is source of truth; dealer consumes read-only snapshot.
- **Membership:** Dealer entity; links a user to a dealership with a role; can be invited, active, or disabled.
- **Seat / user license:** Max active users (or seats) allowed for the dealership under its subscription; enforced at activation (accept invite or enable user), not necessarily at invite creation.

### 2.1 Multi-dealership memberships (explicit support)

- **A single user may belong to one or more dealerships.** The dealer app already supports this via multiple `Membership` rows per user.
- **Membership, role assignment, overrides, and status are scoped per dealership.** Each membership has its own role and dealershipId; UserRole and UserPermissionOverride are global per user but evaluated in the context of the active dealership (or per-membership where applicable). Status (active/disabled) is per membership.
- **Entitlements are evaluated per active dealership context.** When the user switches active dealership, module visibility and seat limits are those of the active dealership’s subscription/entitlements.

### 2.2 Subscription scope (explicit)

- **Subscriptions are per PlatformDealership, not per PlatformAccount.** Each `PlatformDealership` has its own subscription and entitlements.
- **Preferred model:** `PlatformAccount` is the commercial parent (billing contact, account-level settings); each `PlatformDealership` under that account has its own `PlatformSubscription`, plan, seat cap, and module entitlements. This allows one account to hold multiple dealerships with different plans/entitlements.

---

## 3. State machines

### 3.1 Application (platform)

```
APPLIED → UNDER_REVIEW → APPROVED | REJECTED
```

- Transitions: platform admin moves to UNDER_REVIEW; approve or reject sets final state.
- Only APPROVED applications can be provisioned and receive owner invite.

### 3.2 Dealership provisioning (platform + dealer)

```
(no dealership) → PROVISIONING → PROVISIONED → ACTIVE | SUSPENDED
```

- **Platform:** Creating `PlatformDealership` starts as APPROVED then set to PROVISIONING; after dealer provision success → PROVISIONED; then can move to ACTIVE (or SUSPENDED). Current code uses APPROVED before provision; spec treats “UNPROVISIONED” as “no PlatformDealership yet” or status before PROVISIONING.
- **Dealer:** `Dealership` gets `lifecycleStatus`: ACTIVE (default), SUSPENDED, CLOSED. Platform pushes status via internal `POST /api/internal/dealerships/[id]/status`.

### 3.3 Owner activation (invite lifecycle)

```
NOT_SENT → PENDING → ACCEPTED | EXPIRED | CANCELLED
```

- **NOT_SENT:** No owner invite created yet.
- **PENDING:** Invite created in dealer; token sent (or link copied).
- **ACCEPTED / EXPIRED / CANCELLED:** Terminal states; dealer `DealershipInvite.status` (PENDING, ACCEPTED, EXPIRED, CANCELLED).

### 3.4 Employee membership (dealer)

```
INVITED → ACTIVE | DISABLED | REMOVED
```

- **INVITED:** `DealershipInvite` PENDING; no `Membership` or membership with no `joinedAt` / disabled.
- **ACTIVE:** Membership exists, `disabledAt` null.
- **DISABLED:** Membership has `disabledAt` set.
- **REMOVED:** Membership deleted or invite CANCELLED/EXPIRED and no active membership.

### 3.5 Subscription (platform)

```
TRIALING | ACTIVE | PAST_DUE | SUSPENDED | CANCELED
```

- Map to existing platform enums where present: `BillingStatus` (ACTIVE, TRIAL, PAST_DUE, CANCELLED). Add SUSPENDED if not present; TRIALING = TRIAL, CANCELED = CANCELLED.
- Subscription belongs to the dealership (platform dealership), not to the human owner.

### 3.6 Entitlements (platform → dealer)

- Per dealership: modules enabled/disabled, optional feature flags/add-ons, optional seat caps.
- Stored / computed in platform; exposed to dealer via internal API or shared contract (e.g. entitlements snapshot). No dealer write.

---

## 4. Data model changes — platform

- **Application:** Already has status (APPLIED, UNDER_REVIEW, APPROVED, REJECTED). No change required for core flow.
- **PlatformDealership:** Already has status (APPROVED, PROVISIONING, PROVISIONED, ACTIVE, SUSPENDED, CLOSED). Optional: add explicit UNPROVISIONED or keep “no record” as unprovisioned. No mandatory schema change.
- **PlatformSubscription:** Exists with plan, billingStatus. Add or clarify:
  - **Seat cap:** `maxSeats` or equivalent (int, nullable = unlimited). Optional add-on or plan-level.
  - **Add-ons / module flags:** Either JSON `entitlements` on subscription or separate `PlatformDealershipEntitlement` (e.g. `moduleKey`, `enabled`). Prefer one place (e.g. `limits` extended or new `entitlements` JSON) for modules + optional features.
- **BillingStatus:** Ensure SUSPENDED exists if subscription-level suspension is desired; today platform has ACTIVE, TRIAL, PAST_DUE, CANCELLED. Add SUSPENDED or map “suspended” to dealership status only.
- **Platform roles:** Already has PlatformRole (PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT). Add PLATFORM_ONBOARDING if needed for restricted onboarding-only access. Optional.

---

## 5. Data model changes — dealer

- **No dealer schema changes are currently required based on inspection.** Existing models (Dealership, DealershipInvite, Membership, Role, Permission, etc.) support the flows described in this spec. **Minimal additive dealer-side schema changes are allowed in Step 2 if implementation proves they are necessary** (e.g. a small cache or index); such changes must remain additive and non-breaking.
- **Dealership:** Already has `lifecycleStatus`, `platformDealershipId`. No mandatory change.
- **DealershipInvite:** Already supports owner (createdBy null, dealerApplicationId set) vs employee (createdBy set). No schema change required.
- **Membership:** Already has invitedBy, inviteId, disabledAt, joinedAt. No change. Multi-dealership memberships are already supported (one user, many memberships across dealerships).
- **Role / Permission / RolePermission / UserRole / UserPermissionOverride:** Keep as-is. Default roles: ensure system roles include OWNER, DEALERSHIP_ADMIN (map to existing “Owner”, “Dealer Admin”), SALES_MANAGER, SALES_ASSOCIATE, FINANCE_MANAGER, INVENTORY_MANAGER, BDC_AGENT, READ_ONLY. Current seed has Owner, Dealer Admin, Sales Manager, etc.; align keys/names with spec (OWNER, DEALERSHIP_ADMIN, etc.).
- **Entitlement consumption:** No new table. Dealer receives snapshot (e.g. from platform internal API or from dealer-side service that calls platform). Optional: cache in dealer (e.g. keyed by dealershipId) with TTL; no source-of-truth table in dealer.
- **Seat usage:** Computed from active memberships count. No new table; enforce at activation time using platform-provided maxSeats (or equivalent).

---

## 6. Internal API boundaries (platform ↔ dealer)

### 6.1 Platform → dealer (existing, keep)

- `POST /api/internal/provision/dealership` — idempotent; creates dealer Dealership + default data.
- `POST /api/internal/dealerships/[dealerDealershipId]/status` — set lifecycle status (ACTIVE/SUSPENDED/CLOSED).
- `POST /api/internal/dealerships/[dealerDealershipId]/owner-invite` — create owner invite; idempotent by idempotency key.
- `GET /api/internal/dealerships/[dealerDealershipId]/owner-invite-status` — status for application’s contact email.
- `GET /api/internal/dealerships/[dealerDealershipId]/invites` — list invites.
- `PATCH /api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]` — revoke/cancel invite.

### 6.2 New or extended (platform → dealer)

- **Entitlements:** Platform may expose `GET /api/internal/dealerships/[dealerDealershipId]/entitlements` (or dealer calls platform internal endpoint) so dealer can gate modules and seat count. If dealer calls platform: add platform internal route that returns entitlements for a platform dealership (authorized by internal JWT and dealership mapping). Prefer platform as the server for entitlement reads to avoid dealer storing commercial truth.

### 6.3 Dealer → platform

- Existing: dealer can push application state (e.g. `POST /api/internal/dealer-applications/sync`). No change required for this spec.

### 6.4 Contracts (packages/contracts)

- All cross-app payloads in shared contracts (Zod schemas + types). Existing: provision, owner-invite, status. Add: entitlements request/response (e.g. modules[], maxSeats, features).

---

## 7. Entitlement model

- **Source of truth:** Platform (subscription plan + add-ons + overrides if any).
- **Content:** At least: list of enabled module keys (e.g. inventory, crm, deals, reports, accounting, websites, …), optional `maxSeats`, optional feature flags.
- **Consumer:** Dealer app and dealer API. Use for: (1) hiding or locking nav/sections for unlicensed modules, (2) rejecting API access to unlicensed modules (403 with clear message), (3) enforcing seat cap on activation.
- **Rule:** Access to a module requires **entitlement enabled** (for that dealership) **AND** **permission granted** (for that user in that dealership). Both must be true.

---

## 8. Seat enforcement model (and consumption rules)

- Subscription (or plan/add-on) may define **max active users** (seat count). If absent, treat as unlimited.
- **Only active memberships consume seats.** A user with an active membership (Membership with `disabledAt` null for that dealership) counts as one seat.
- **Pending invites do not consume seats.** Until an invite is accepted and a membership is created (or an existing membership is activated), no seat is consumed. Invite creation may therefore be allowed even when at cap.
- **Disabled or removed users free a seat.** When a membership is disabled (`disabledAt` set) or removed, that seat is available again for another activation.
- **Seat limit enforcement occurs at activation/acceptance time**, not only at invite creation. When the user accepts an invite (or when an admin re-enables a disabled user), the system checks whether adding one more active membership would exceed the seat cap; if so, reject with a clear message. Optionally warn at invite creation if already at cap.
- **The owner counts as a seat under the dealership subscription.** Owner activation does not consume an extra plan; the owner is the first seat. After the owner accepts, any further activations (employees) consume additional seats up to maxSeats.

---

## 9. RBAC model for dealer admins inviting employees

- **Permission naming:** Use **canonical coarse permissions** consistent with the coarse RBAC model: e.g. `users.read`, `users.write`, `admin.read`, `admin.write`, plus the existing domain-level keys (dashboard.read, inventory.read/write, customers.read/write, crm.read/write, deals.read/write, reports.read, accounting.read/write, websites.read/write, settings.read/write). **Do not introduce finer-grained permission keys** (e.g. per-entity CRUD explosion) unless the current codebase already truly enforces them; where the code still uses legacy keys like `admin.users.invite` or `admin.memberships.read`, keep them and align to coarse equivalents only where there is a code-backed reason.
- **Who can invite:** Users who have permission to invite (e.g. `users.write` or existing `admin.users.invite`) **and** who are in a role that is considered “dealership admin” (e.g. OWNER, DEALERSHIP_ADMIN).
- **Scope:** Invites are always for the same dealership (ctx.dealershipId). No cross-tenant invite.
- **Role assignment:** Inviter chooses a dealership role for the invitee; only roles belonging to the same dealership; delegated admin capability can be represented by assigning DEALERSHIP_ADMIN (or “Dealer Admin”) role.
- **OWNER / DEALERSHIP_ADMIN:** Can invite employees; OWNER can transfer/delegate admin (e.g. assign DEALERSHIP_ADMIN role). READ_ONLY cannot mutate data. Dealer admins assign roles only within dealership scope.
- **Existing:** Role union + UserPermissionOverride remains; guardPermission(ctx, "users.write") or existing admin.users.invite on invite routes.

---

## 10. Default dealer roles (to ship / align)

- **OWNER** — full access; can invite, assign roles, delegate admin.
- **DEALERSHIP_ADMIN** — same as current “Dealer Admin”; can invite, assign roles.
- **SALES_MANAGER**, **SALES_ASSOCIATE**, **FINANCE_MANAGER**, **INVENTORY_MANAGER**, **BDC_AGENT** — as in current seed/templates; no invite by default.
- **READ_ONLY** — read-only; no write permissions.

Map to existing seed role names/keys (Owner, Dealer Admin, Sales Manager, …) so runtime and seed stay consistent.

---

## 11. Default platform roles

- **PLATFORM_OWNER** — full platform access (already exists).
- **PLATFORM_ADMIN** — (add if needed as alias or separate).
- **PLATFORM_SUPPORT** — (already exists).
- **PLATFORM_ONBOARDING** — (add if needed for onboarding-only staff). Do not derive platform access from dealership membership.

---

## 12. UI map

### 12.1 Platform UI

- **Application detail / review:** Application summary, review status, approve/reject actions, linked dealership summary, owner invite status. Routes: e.g. `/applications/[id]`, approve/reject, provision, invite-owner.
- **Provision dealership:** Action from application detail; idempotent; clear status (Provisioning / Provisioned).
- **Subscription / add-on management:** Plan summary, enabled modules, seat limits, status badges. Routes: e.g. `/dealerships/[id]` or `/dealerships/[id]/subscription`; edit plan, add-ons, view entitlements.
- **Owner activation:** Send invite, resend if allowed, show invite status (Pending / Accepted / Expired / Cancelled). Use existing invite-owner flow; surface status on application and/or dealership page.

### 12.2 Dealer UI

- **User directory:** Active / invited / disabled users, role chips, admin indicators, status badges. Under admin/users.
- **Invite employee:** Invite by email, choose dealership role, delegated-admin option; show license/seat messaging (e.g. “X of Y seats used”).
- **User detail:** Role assignment, per-user overrides, disable/remove. Under admin/users/[userId].
- **Entitlement-aware nav:** Hide or lock modules not enabled by subscription.
- **Module entry (unlicensed):** Clear “module not included in your plan” state when user has permission but entitlement is off.
- **Admin guards:** Only users with users.write / admin.users.invite (and effectively owner or dealer admin role) can manage invites/users.

---

## 13. Audit log requirements

**Platform:** Log application approved/rejected, dealership provisioned, owner invite sent/cancelled (and accepted if platform is notified), subscription changed, add-on changed, entitlement-related changes. Use existing `platformAuditLog`; include dealershipId where applicable.

**Dealer:** Log user invited, user activated (invite accepted), role changed, user disabled/removed, and platform.owner_invite.created (already present). Use existing `auditLog`; no PII in metadata.

---

## 14. Error scenarios and idempotency rules

- **Provision:** Idempotent by `Idempotency-Key`; same key returns 200 with existing result. Duplicate platformDealershipId → 409.
- **Invite-owner:** Idempotent by key (e.g. `app-invite-owner-{applicationId}-{hashEmail}`). Duplicate recent invite for same application/email → 200 with existing invite. Cannot invite owner before application APPROVED.
- **Employee invite:** Reject duplicate active/pending invite for same email + dealership (e.g. 409 or 200 idempotent). Check seat cap at acceptance, not necessarily at creation.
- **Activation (accept invite):** If dealership suspended (platform or dealer lifecycle) → reject with clear message. If seat cap exceeded → reject with “Seat limit reached”.
- **Module access:** If entitlement not enabled → 403 “Module not included in your plan”. If permission not granted → 403 “Insufficient permission”.

---

## 15. Migration / rollout / backfill notes

- **Platform:** Add subscription fields (maxSeats, entitlements) via migration; backfill existing subscriptions with default (e.g. unlimited seats, current plan modules). Add BillingStatus.SUSPENDED if used.
- **Dealer:** No mandatory schema change. Seed: ensure default roles match default dealer roles list; add READ_ONLY if missing. Align role keys (OWNER, DEALERSHIP_ADMIN) with display names.
- **Entitlements:** New platform endpoint or extension; dealer calls or receives push. Cache in dealer optional; short TTL.
- **Backward compatibility:** Do not break existing invite acceptance flows; unify owner vs employee paths where both use same accept endpoint with same token semantics.

---

## 16. Acceptance criteria

- Application can be approved/rejected; only approved applications can be provisioned and get owner invite.
- Provision is idempotent; owner invite is idempotent and safe against duplicate recent invites.
- Owner invite is platform-initiated and dealer-materialized; accept flow remains dealer-owned.
- Employee invites are created by dealer admins (owner/dealer admin with users.write or admin.users.invite); same dealership subscription.
- Seat cap enforced at activation; clear error when over cap.
- Module access requires entitlement + permission; unlicensed module returns clear 403 or UX message.
- Suspended dealership (platform or dealer lifecycle) blocks activation where policy says so.
- Platform and dealer responsibilities and boundaries match this spec; no subscription or entitlement writes in dealer; no membership/permission writes from platform after provisioning (except via defined internal APIs that delegate to dealer).

---

## Required design choices (summary)

- Owner invite: **platform-initiated, dealer-materialized.**
- Employee invites: **dealer-admin managed.**
- Subscription truth: **platform.**
- Membership truth: **dealer.**
- Entitlement gating: **platform-driven; enforced in dealer UI/API** (entitlement enabled && permission granted).
- Existing dealer RBAC **role-union + override** model remains unless code-backed reason to change.
