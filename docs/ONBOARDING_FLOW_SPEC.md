# Cross-App Onboarding Flow Spec (Platform → Dealer)

**Step 1 — Architecture & contracts only. No code changes.**

This document defines the complete lifecycle, endpoint contracts, data model validation, failure points, state machine, and minimal fix plan for the Platform → Dealer onboarding flow.

---

## 1. FLOW MAP

End-to-end onboarding lifecycle:

```
1. Application created (Platform)
   └─ Application row: status APPLIED | UNDER_REVIEW | APPROVED | REJECTED
   └─ legalName, displayName, contactEmail

2. Platform approval (Platform)
   └─ Application.status → APPROVED
   └─ (Optional) PlatformDealership created separately, or created at provision time

3. Provision dealership (Platform → Dealer)
   └─ Platform: POST /api/platform/applications/[id]/provision (or dealerships/[id]/provision)
   └─ If no linked PlatformDealership: create PlatformDealership (APPROVED → PROVISIONING)
   └─ Platform calls Dealer internal API

4. Dealer internal API — provision (Dealer)
   └─ POST /api/internal/provision/dealership
   └─ Headers: Authorization (JWT), Idempotency-Key, x-request-id
   └─ Body: platformDealershipId, legalName, displayName, planKey, limits

5. Create dealership tenant (Dealer)
   └─ provisionDealership(): ensure Permission rows, create Dealership, Role(s), Pipeline/Stages, ProvisioningIdempotency
   └─ Response: dealerDealershipId, provisionedAt

6. Platform stores mapping (Platform)
   └─ DealershipMapping(platformDealershipId, dealerDealershipId, provisionedAt)
   └─ PlatformDealership.status → PROVISIONED
   └─ Application.dealershipId → platformDealershipId (if application path)

7. Create owner invite (Platform → Dealer)
   └─ Platform: POST /api/platform/applications/[id]/invite-owner (or dealerships/[id]/owner-invite)
   └─ Platform calls Dealer internal API with contactEmail (application path) or body email

8. Dealer internal API — owner invite (Dealer)
   └─ POST /api/internal/dealerships/[dealerDealershipId]/owner-invite
   └─ Body: email, platformDealershipId, platformActorId
   └─ Dealer: resolve Owner role, create DealershipInvite (PENDING), OwnerInviteIdempotency
   └─ Response: inviteId, invitedEmail, createdAt, acceptUrl

9. Platform sends email (Platform)
   └─ sendOwnerInviteEmail(contactEmail, dealershipName, acceptUrl)
   └─ Audit: application.owner_invite_sent

10. Owner accepts invite (Dealer — public)
    └─ GET /api/invite/resolve?token=... (no auth) → invite details (dealershipName, roleName)
    └─ POST /api/invite/accept
        ├─ Authenticated: body { token } → acceptInvite()
        └─ Signup: body { token, email, password, confirmPassword?, fullName? } → acceptInviteWithSignup()

11. Membership created (Dealer)
    └─ Profile created/updated (getOrCreateProfile)
    └─ Membership(dealershipId, userId, roleId, inviteId) created
    └─ DealershipInvite.status → ACCEPTED, acceptedAt, acceptedByUserId
    └─ Response: { membershipId, dealershipId, alreadyHadMembership? }

12. User gains active dealership (Dealer)
    └─ After accept: signInWithPassword (signup path) then full-page redirect to /dashboard?switchDealership=[id]
    └─ Dashboard (or Get Started) calls PATCH /api/auth/session/switch { dealershipId }
    └─ setActiveDealershipCookie(dealershipId)

13. Dealer dashboard loads (Dealer)
    └─ GET /api/auth/session → activeDealership, permissions
    └─ Dashboard requires customers.read or crm.read; RBAC from Role → RolePermission → Permission
```

---

## 2. ENDPOINT CONTRACTS

### 2.1 Platform → Dealer internal APIs

**Auth:** `Authorization: Bearer <JWT>`. JWT signed with `INTERNAL_API_JWT_SECRET`, audience/issuer from `@dms/contracts`. Same secret on both apps.

| Platform calls | Dealer endpoint | Request | Response (success) |
|----------------|-----------------|---------|--------------------|
| callDealerProvision(...) | `POST /api/internal/provision/dealership` | Headers: `Idempotency-Key` (1–255), `x-request-id`. Body: `provisionDealershipRequestSchema` | `201` `{ dealerDealershipId: uuid, provisionedAt: iso8601 }` |
| callDealerOwnerInvite(...) | `POST /api/internal/dealerships/[dealerDealershipId]/owner-invite` | Headers: `Idempotency-Key`, `x-request-id`. Body: `dealerOwnerInviteRequestSchema` | `201` `dealerOwnerInviteResponseSchema` |
| callDealerOwnerInviteStatus(...) | `GET /api/internal/dealerships/[dealerDealershipId]/owner-invite-status?email=...` | — | `200` `dealerOwnerInviteStatusResponseSchema` |

**Contract schemas (packages/contracts):**

- **provision**  
  - Request: `provisionDealershipRequestSchema` — `platformDealershipId` (uuid), `legalName` (1–500), `displayName` (1–200), `planKey` (1–100), `limits` (record, optional), `primaryOwnerEmail` (email, optional), `initialConfig` (record, optional).  
  - Response: `provisionDealershipResponseSchema` — `dealerDealershipId` (uuid), `provisionedAt` (datetime string).

- **owner-invite**  
  - Request: `dealerOwnerInviteRequestSchema` — `email`, `platformDealershipId` (uuid), `platformActorId` (uuid).  
  - Response: `dealerOwnerInviteResponseSchema` — `inviteId` (uuid), `invitedEmail`, `createdAt` (datetime), `acceptUrl` (url, optional).

- **owner-invite-status**  
  - Response: `dealerOwnerInviteStatusResponseSchema` — `status` (PENDING | ACCEPTED | EXPIRED | CANCELLED), `expiresAt`, `acceptedAt` (optional/nullable).

**Error shape (Dealer internal):** `{ error: { code: string, message: string } }` with appropriate status (401, 403, 404, 409, 422, 429, 502).

### 2.2 Dealer → Platform

Platform does not expose HTTP APIs for the dealer to call in this flow. Dealer is the callee; Platform is the caller. Session/auth is Supabase (dealer app); no Platform API calls from dealer during accept-invite or get-started.

### 2.3 Dealer public invite APIs (used by browser)

| Method | Path | Auth | Body / Query | Response |
|--------|------|------|--------------|----------|
| GET | `/api/invite/resolve?token=...` | None | — | 200 `{ data: { inviteId, dealershipName, roleName, expiresAt?, emailMasked? } }` or 404/410 |
| POST | `/api/invite/accept` | Optional (for authenticated path) | Authenticated: `{ token }`. Signup: `{ token, email, password, confirmPassword?, fullName? }` (Zod: `acceptInviteBodySchema` / `acceptInviteSignupBodySchema`) | 200 `{ data: { membershipId, dealershipId, alreadyHadMembership? } }` |

### 2.4 Dealer auth/session (post accept)

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| PATCH | `/api/auth/session/switch` | Required | `{ dealershipId: uuid }` | 200 session payload |
| GET | `/api/auth/dealerships` | Required | — | 200 `{ data: { dealerships: [{ id, name }] } }` |

---

## 3. DATA MODEL VALIDATION

### 3.1 Platform DB (single-tenant)

| Table / model | Purpose |
|---------------|---------|
| **Application** | Onboarding application: status (APPLIED | UNDER_REVIEW | APPROVED | REJECTED), legalName, displayName, contactEmail, dealershipId (FK to PlatformDealership). |
| **PlatformDealership** | Platform-side dealership: legalName, displayName, planKey, limits, status (APPROVED | PROVISIONING | PROVISIONED | ACTIVE | SUSPENDED | CLOSED). |
| **DealershipMapping** | Links platform ↔ dealer: platformDealershipId, dealerDealershipId, provisionedAt. |
| **PlatformUser** | platform_users: id (uuid), role (PLATFORM_OWNER | PLATFORM_COMPLIANCE | PLATFORM_SUPPORT). |
| PlatformAuditLog | Audit for provision, invite, status changes. |
| PlatformEmailLog | Log owner-invite email sends. |

### 3.2 Dealer DB (multi-tenant, dealership_id on business data)

| Table / model | Purpose |
|---------------|---------|
| **Dealership** | Tenant: name, slug?, platformDealershipId?, lifecycleStatus (ACTIVE | SUSPENDED | CLOSED), isActive. |
| **Membership** | User ↔ Dealership ↔ Role: dealershipId, userId, roleId, inviteId?, disabledAt. |
| **Role** | Per-dealership: name (e.g. Owner, Admin, Sales, Finance), rolePermissions → Permission. |
| **Permission** | Global catalog of permission keys (must exist for provision to attach to roles). |
| **DealershipInvite** | Invite by dealership: email, roleId, status (PENDING | ACCEPTED | EXPIRED | CANCELLED), token, acceptedAt, acceptedByUserId. |
| **ProvisioningIdempotency** | idempotencyKey → platformDealershipId, dealerDealershipId, provisionedAt. |
| **OwnerInviteIdempotency** | idempotencyKey → dealerDealershipId, inviteId (for owner-invite dedupe). |
| Profile | User identity (id = Supabase user id), email, fullName. |

All required tables exist in the current Prisma schemas (platform: Application, PlatformDealership, DealershipMapping, PlatformUser; dealer: Dealership, Membership, Role, DealershipInvite, ProvisioningIdempotency, OwnerInviteIdempotency, Permission, Profile).

---

## 4. FAILURE POINTS

| # | Failure point | Cause | Observable |
|---|----------------|-------|------------|
| 1 | Provision fails to create dealership | Dealer internal API unreachable (DEALER_INTERNAL_API_URL / INTERNAL_API_JWT_SECRET wrong), dealer DB error, or Permission table empty so roles get no permissions. | Platform: 502, audit dealership.provision with dealerCallFailed. Dealer: Prisma errors or 500. |
| 2 | Invite-owner fails to create dealer invite | Dealer returns 404 (Owner role not found — e.g. Permission rows missing at provision time), 409 (idempotency/dedupe), or 4xx/5xx. | Platform: error toast; audit application.owner_invite_sent not written. |
| 3 | Accept-invite fails to create membership | Invalid/expired token, email mismatch (authenticated path), or EMAIL_ALREADY_REGISTERED (signup path). DealershipInvite not found or status not PENDING. | 400/403/404/409/410 from POST /api/invite/accept. |
| 4 | User has membership but no active dealership | Session/switch not called after accept (e.g. redirect before cookie is sent), or session/switch failed. Auth guard sees no activeDealership → redirect to /get-started. | User lands on Get Started with “Select your dealership” or “Link me as Owner (demo)”. |
| 5 | User has no dashboard access after selecting dealership | Role has no permissions: Permission table was empty at provision time, so Role.rolePermissions empty. | Dashboard: “You don’t have access to the dashboard.” |
| 6 | Audit log FK violation on provision | auditLog() called inside transaction with new dealershipId before commit; global Prisma client doesn’t see row. | Prisma P2003 AuditLog_dealership_id_fkey. (Mitigation: write audit after transaction commits.) |

---

## 5. STATE MACHINE

### 5.1 Application (conceptual lifecycle for onboarding)

| State | Description |
|-------|-------------|
| PENDING / APPLIED | Application submitted, not yet approved. |
| APPROVED | Application approved; eligible for provision. |
| PROVISIONED | PlatformDealership created and linked; DealershipMapping exists; dealer tenant created. |
| OWNER_INVITED | Owner invite created in dealer and (optionally) email sent. |
| OWNER_JOINED | Invite accepted; at least one membership exists for the dealer (inferrable via owner-invite-status or platform audit). |

Current schema: `Application.status` is APPLIED | UNDER_REVIEW | APPROVED | REJECTED. “PROVISIONED” / “OWNER_INVITED” / “OWNER_JOINED” are derived from presence of Application.dealershipId, DealershipMapping, DealershipInvite status, and (for owner joined) dealer membership, not stored as a single enum on Application. A future refinement could add an explicit onboarding state field if product needs it.

### 5.2 PlatformDealership.status

APPROVED → PROVISIONING (during dealer call) → PROVISIONED (mapping stored) or back to APPROVED (on dealer failure). Later: ACTIVE, SUSPENDED, CLOSED per lifecycle.

### 5.3 DealershipInvite.status (Dealer)

PENDING → ACCEPTED (one-time use) or EXPIRED / CANCELLED.

---

## 6. REQUIRED FIX PLAN (minimal backend changes)

### 6.1 Platform provisioning

- **Already in place:** Application → provision creates/links PlatformDealership, calls dealer, creates DealershipMapping, audit. Use Idempotency-Key and DIRECT_DATABASE_URL for scripts where applicable.
- **Ensure:** DEALER_INTERNAL_API_URL and INTERNAL_API_JWT_SECRET match dealer; dealer has Permission rows before or during provision (see 6.2).

### 6.2 Dealer provision

- **Already in place:** Provision ensures Permission rows exist (upsert) before creating roles so Owner/Admin/Sales/Finance get correct permissions.
- **Already in place:** Audit log written after transaction commit to avoid AuditLog_dealership_id_fkey.
- **Optional:** Document or run `db:repair-dealer-roles` for any dealerships provisioned before Permission fix; use DIRECT_DATABASE_URL for repair script.

### 6.3 Platform invite-owner

- **Already in place:** inviteOwnerForApplication (or dealership owner-invite) provisions if needed, then callDealerOwnerInvite; email send best-effort; audit application.owner_invite_sent.
- **Ensure:** Dealer Owner role exists (guaranteed if provision ensures permissions and creates Owner role).

### 6.4 Dealer accept-invite

- **Already in place:** POST /api/invite/accept with authenticated or signup path; create Profile, Membership, mark invite ACCEPTED; rate limits and Zod.
- **Already in place:** After signup, full-page redirect to /dashboard?switchDealership=[dealershipId] so cookie is sent; dashboard calls session/switch and strips query.

### 6.5 Dealer get-started UX

- **Already in place:** GET /api/auth/dealerships returns list of dealerships the user is a member of (no active dealership required).
- **Already in place:** Get Started page shows “Select your dealership” when user has memberships; selecting one calls PATCH /api/auth/session/switch then redirects to dashboard. “Link me as Owner (demo)” remains for dev/seed path.
- **Ensure:** Auth guard continues to send users without activeDealership to /get-started (or /pending when pendingApproval).

---

## References

- **Contracts:** `packages/contracts` — `provisionDealershipRequestSchema`, `provisionDealershipResponseSchema`, `dealerOwnerInviteRequestSchema`, `dealerOwnerInviteResponseSchema`, `dealerOwnerInviteStatusResponseSchema`.
- **Platform:** `apps/platform/lib/application-onboarding.ts`, `apps/platform/lib/call-dealer-internal.ts`, `apps/platform/prisma/schema.prisma`.
- **Dealer:** `apps/dealer/modules/provisioning/service/provision.ts`, `apps/dealer/app/api/internal/provision/dealership/route.ts`, `apps/dealer/app/api/internal/dealerships/[id]/owner-invite/route.ts`, `apps/dealer/app/api/invite/accept/route.ts`, `apps/dealer/app/get-started/page.tsx`, `apps/dealer/app/api/auth/dealerships/route.ts`, `apps/dealer/prisma/schema.prisma`.
- **Runbooks:** `docs/runbooks/application-dealership-onboarding-smoke.md`, `docs/runbooks/deploy-fresh.md`.
