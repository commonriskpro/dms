# Platform Admin Create Account Flow — Specification

**Scope:** Platform admin concept, two onboarding modes (invite-only and self-serve signup), bootstrap rules, schema changes, RBAC, API contract, UI map, audit events, and manual smoke checklist. Narrative and contracts only; no implementation code.

**References:** DMS Non-Negotiables, Coding Standards, `docs/specs/platform-admin-and-production-onboarding-spec.md`, `prisma/schema.prisma`.

---

## 1. Platform Admin Concept

### 1.1 Separation from Dealership Tenants

- **Platform admins** are distinct from dealership (tenant) users. They are identified solely by the **PlatformAdmin** table: a row linking `userId` (FK to Profile) indicates platform admin status. This is the **source of truth** for authorization on `/api/platform/*`.
- **No tenant leakage:** Platform admin status is not derived from any dealership membership or role. A user can be a platform admin with zero memberships, or both a platform admin and a member of one or more dealerships. Tenant-scoped data is never exposed to non–platform-admin users via platform routes; platform routes bypass tenant scope only for callers who are already verified as platform admins (DB check).
- **Platform owner** (or equivalent) is the persona that can create and manage dealerships and control who gets access to the platform (create dealerships, invite or approve users, link users to dealerships with roles). All such actions are performed via `/api/platform/*` and require PlatformAdmin membership.

### 1.2 PlatformAdmin Table (Existing)

- **Existing model:** `PlatformAdmin` with `id`, `userId` (unique, FK → Profile), `createdAt`, `createdBy` (optional, FK → Profile). No `dealership_id`; the table is global.
- **Usage:** Lookup by `userId` determines whether the user may access platform endpoints. No tenant context is stored or inferred from this table.

---

## 2. Two Onboarding Modes

### 2.1 Mode A — Invite-Only

**Concept:** A platform admin (or, if product allows, a dealership Owner/Admin acting within tenant scope) invites a user to a specific dealership with a role. The invitee may not yet have an account.

- **Invite creation:**
  - **Who:** Platform admin only (for first member / Owner) or platform admin / dealership Owner or Admin (for additional members, if product allows tenant-side invites). This spec focuses on **platform-admin–driven** invite creation for the create-account flow.
  - **Input:** Dealership (by id), email (invitee), role (Owner | Admin | Sales | Finance or custom role id), optional expiry (e.g. `expiresAt` datetime).
  - **Storage:** An **Invite** (or equivalent) record is created: dealershipId, email, roleId, optional expiresAt, status (e.g. pending), createdBy (platform admin userId), createdAt. Optional: idempotency key (e.g. (dealershipId, email, roleId) or a client-supplied idempotency key) to avoid duplicate invites.
  - **Idempotency:** If an invite already exists for the same (dealershipId, email) and is still pending and not expired, either return the existing invite (200) or reject duplicate (409). Same link used again for "accept" must be idempotent: accepting twice yields the same membership outcome (single Membership row).

- **Expiry (optional):**
  - If `expiresAt` is stored, any accept flow must reject expired invites (403 or 410 with a clear message). Platform admin may "resend" by creating a new invite (new token/link and new expiresAt) or extending expiry per product rules. Cleanup of expired invites (cron or on-read) is implementation detail.

- **Accept flow:**
  - User receives a link (e.g. `/accept-invite?token=<invite_token>` or `/accept-invite/<invite_id>?token=...`). Token is bound to the invite and optionally short-lived.
  - **If user has no account:** Redirect to Supabase sign-up (pre-fill email from invite where possible) or magic-link sign-up; after successful auth, create or link Profile, then consume invite: create Membership with the invited role, set `joinedAt`, mark invite as accepted (status), optionally clear token. Redirect to app with active dealership set to the invited dealership.
  - **If user has account:** Verify token; if valid and not expired, create Membership (or confirm existing), set `joinedAt`, mark invite accepted. Redirect into app for that dealership.
  - **Idempotency:** Accepting the same invite twice must not create duplicate memberships; second accept returns success and same membership (200).

### 2.2 Mode B — Self-Serve Signup

**Concept:** A user can create an account (e.g. Supabase sign-up) without an invite, but **cannot access any tenant data** until a platform admin approves and links them to a dealership (and role).

- **Pending-users concept:**
  - **Storage:** A **PendingUser** (or equivalent) record or a **pending-approval flag** on Profile. Option A: New table `PendingApproval` (or `PendingUser`): userId (FK Profile), email (denormalized for listing), createdAt, optional metadata. Option B: Profile column e.g. `approvalStatus` enum (`pending` | `approved`) where `approved` means "has at least one membership or has been explicitly approved"; "pending" means signed up but no membership and not yet approved. This spec uses a **PendingApproval** table for clarity: one row per user awaiting platform approval, removed when user is linked to a dealership (or explicitly rejected).
  - **Creation:** On first sign-up (Supabase auth + Profile creation), if the product requires platform approval, create a PendingApproval row for that userId (or set Profile to pending). No Membership is created.

- **What the user sees before approval:**
  - After sign-in, the user has no active dealership and no memberships. The app shows a **pending-approval** experience: e.g. "Your account is pending approval. A platform administrator will link you to a dealership shortly." No tenant data, no dealership list, no navigation to tenant-scoped pages. Optionally: link to support or contact.

- **Approval / link flow:**
  - **Who:** Platform admin only.
  - **Action:** Platform admin lists pending users (see API below). For a chosen pending user, platform admin selects a dealership and a role (Owner/Admin/Sales/Finance) and "approves" or "links": create Membership for (userId, dealershipId, roleId), set `joinedAt`, remove PendingApproval row (or mark Profile as approved). Optionally: notify user (out of scope for this spec).
  - **Result:** User now has a membership; on next login they see that dealership and can use the app as that role. No self-service "claim" or bootstrap without platform admin.

### 2.3 Bootstrap Rules

- **First user of a new dealership:** The first user linked to a dealership (e.g. as Owner) can **only** be linked by a **platform admin**. There is no public "claim this dealership" or open bootstrap. Creating a dealership (POST `/api/platform/dealerships`) does not automatically create any membership; the platform admin must explicitly invite or add the first member (e.g. Owner) via invite flow or approval/link flow.
- **No open bootstrap:** No endpoint or public page allows a non–platform-admin user to become Owner or to create a membership for a dealership without either (A) accepting a platform-admin–created invite, or (B) being approved and linked by a platform admin after self-serve sign-up.

---

## 3. Prisma Model Changes

### 3.1 New or Changed Tables

- **Invite (new table, recommend name `DealershipInvite` or `Invite`):**
  - **Purpose:** Store invite-only flow: who is invited, to which dealership, with which role, and optional expiry.
  - **Fields (contract):**
    - `id` — UUID, PK
    - `dealershipId` — UUID, FK → Dealership (required)
    - `email` — String (invitee email)
    - `roleId` — UUID, FK → Role (required)
    - `status` — Enum or String: e.g. `pending`, `accepted`, `expired`, `cancelled`
    - `expiresAt` — DateTime? (optional; if null, no expiry)
    - `createdBy` — UUID?, FK → Profile (platform admin or inviter)
    - `createdAt` — DateTime
    - `updatedAt` — DateTime
    - `acceptedAt` — DateTime? (when accepted)
    - `token` — String?, unique (optional; for accept-link idempotency and security; hashed or random)
  - **Indexes:**
    - `@@index([dealershipId])` — list invites by dealership
    - `@@index([email])` — lookup by invitee email
    - `@@index([dealershipId, email])` — idempotency / duplicate check (optional unique when status = pending)
    - `@@index([token])` — accept flow lookup (if token used)
    - `@@index([expiresAt])` — optional cleanup of expired
  - **Constraints:** Unique token if present; FK constraints. No PII beyond email (allowed for invite addressing).
  - **Token security:** Invite tokens MUST be unguessable: generated with a cryptographically secure random source (e.g. ≥128 bits entropy). Tokens MUST NOT be derived from predictable data (e.g. invite id or email alone).

- **PendingApproval (new table, or equivalent):**
  - **Purpose:** Self-serve signup: users who have an account but no membership until platform admin links them.
  - **Fields (contract):**
    - `id` — UUID, PK
    - `userId` — UUID, unique, FK → Profile
    - `email` — String (denormalized from Profile for list display; no unique here)
    - `createdAt` — DateTime
    - `updatedAt` — DateTime (optional)
  - **Indexes:**
    - `@@index([userId])` — lookup by user (unique)
    - `@@index([createdAt])` — list pending by date
  - **Constraints:** One row per user; remove when user is approved (membership created) or explicitly rejected.

### 3.2 Existing Table Tweaks (if needed)

- **Membership (existing):** Already has `invitedBy`, `invitedAt`, `joinedAt`. No schema change required for invite flow if Invite table holds invite state; Membership is created at accept time. Optional: add `inviteId` (FK → Invite) to link Membership to the invite that created it (audit/traceability).
- **Profile:** No SSN/DOB/income. If PendingApproval table is used, Profile needs no new columns. If product prefers a flag on Profile instead, add e.g. `approvalStatus` (enum) and document in spec.

### 3.3 Audit-Critical Tables

- **Invite:** Create, update (accept/cancel), and optionally "sent" (if email sent) are critical for audit.
- **PendingApproval:** Create (on sign-up) and delete (on approve/reject) are critical for audit.
- **Membership:** Already critical; create (especially first Owner for a dealership) must be audited with action indicating platform-admin link or invite accept.

---

## 4. RBAC — Platform Permissions and Route Access

### 4.1 Permission Codes (Platform-Only)

- **Codes (exact):** `platform.read`, `platform.write`, `platform.impersonate`. Stored in global **Permission** table (seed). They are **not** assigned to any dealership role; they are checked only for users who already have a **PlatformAdmin** row.
- **Mapping:**
  - **platform.read** — List/get dealerships, members, roles; list invites and pending users; view cross-tenant audit.
  - **platform.write** — Create/update/disable/enable dealerships; create/cancel invites; add/patch/disable members; approve/link pending users; create first Owner for a dealership.
  - **platform.impersonate** — Start and end impersonation (set/clear active-dealership cookie for a target dealership).

### 4.2 Which Routes Require Which

- **Require PlatformAdmin + platform.read (or implied):**  
  GET dealerships, GET dealerships/[id], GET dealerships/[id]/members, GET dealerships/[id]/roles, GET platform/audit, GET platform/invites (if any), GET platform/pending-users.
- **Require PlatformAdmin + platform.write (or implied):**  
  POST/PATCH dealerships, POST disable/enable, POST/PATCH members, POST platform/invites, PATCH/DELETE platform/invites/[id], POST platform/pending-users/[id]/approve (link to dealership + role).
- **Require PlatformAdmin + platform.impersonate:**  
  POST platform/impersonate, POST platform/impersonate/end.

If the project uses a single gate ("is platform admin"), then all three permissions can be implied for every platform admin; the spec only defines the codes and the intended mapping. Enforcement must be server-side (DB + optional Permission check); never client-only.

### 4.3 Tenant Admins Never Get Platform Access

- **Tenant (dealership) admins** (Owner, Admin, etc.) have **no** access to `/api/platform/*`. Only the presence of a row in **PlatformAdmin** grants platform access. No tenant permission (e.g. `admin.roles.write`) or role (e.g. Owner) grants platform.read / platform.write / platform.impersonate. Non–platform-admin users calling any platform route receive **403 FORBIDDEN**.

### 4.4 Authorization Rule (Tenant Isolation)

- **Authorization for platform routes** is based solely on PlatformAdmin membership (and, if used, platform permission codes). The `dealershipId` in path or body is the **target** of the operation only and must never be used for access control; platform routes must not trust any client-supplied dealership identifier for authorization.

---

## 5. API Contract (High Level)

All responses: success `{ data?, meta? }`, error `{ error: { code, message, details? } }`. Pagination: every list uses `limit` and `offset` (or cursor) with documented min/max and defaults. `dealershipId` for platform routes is taken **only** from path or body as the **target** of the action, never from cookie/header for authorization.

### 5.1 Existing Platform Endpoints (Reference — Unchanged or Extended)

| Method | Path | Purpose | Input (high level) | Output (high level) |
|--------|------|---------|---------------------|----------------------|
| GET | `/api/platform/dealerships` | List dealerships | Query: limit, offset, search? | `{ data: DealershipSummary[], meta }` |
| POST | `/api/platform/dealerships` | Create dealership + optional default location | Body: name, slug?, createDefaultLocation? | 201 `{ data: Dealership }` |
| GET | `/api/platform/dealerships/[id]` | Get one dealership | Path: id | `{ data: DealershipDetail }` |
| PATCH | `/api/platform/dealerships/[id]` | Update dealership | Path: id; Body: name?, slug?, isActive? | `{ data: Dealership }` |
| POST | `/api/platform/dealerships/[id]/disable` | Set isActive=false; optionally disable memberships | Path: id | 204 |
| POST | `/api/platform/dealerships/[id]/enable` | Set isActive=true | Path: id | 204 |
| GET | `/api/platform/dealerships/[id]/members` | List members (include disabled) | Path: id; Query: limit, offset | `{ data: MembershipSummary[], meta }` |
| POST | `/api/platform/dealerships/[id]/members` | Add member (by email + roleId); direct link if Profile exists | Path: id; Body: email, roleId | 201 `{ data: Membership }` or 200 existing |
| PATCH | `/api/platform/dealerships/[id]/members/[membershipId]` | Update role or disabled | Path: id, membershipId; Body: roleId?, disabled? | `{ data: Membership }` |
| GET | `/api/platform/dealerships/[id]/roles` | List roles for dropdown | Path: id | `{ data: { id, name }[] }` |
| GET | `/api/platform/audit` | Cross-tenant audit list | Query: dealershipId?, actorId?, action?, entity?, from?, to?, limit, offset | `{ data: AuditEntry[], meta }` |
| POST | `/api/platform/impersonate` | Start impersonation | Body: dealershipId | 204 |
| POST | `/api/platform/impersonate/end` | End impersonation | — | 204 |

### 5.2 Invite Flow (New)

| Method | Path | Purpose | Input (high level) | Output (high level) |
|--------|------|---------|---------------------|----------------------|
| POST | `/api/platform/dealerships/[id]/invites` | Create invite (email + roleId, optional expiresAt) | Path: id (dealershipId); Body: email, roleId, expiresAt? | 201 `{ data: Invite }` or 200 if idempotent existing |
| GET | `/api/platform/dealerships/[id]/invites` | List invites for dealership (pending, optional accepted/expired) | Path: id; Query: limit, offset, status? | `{ data: InviteSummary[], meta }` |
| PATCH | `/api/platform/dealerships/[id]/invites/[inviteId]` | Cancel or resend (e.g. extend expiry) | Path: id, inviteId; Body: cancel? or expiresAt? | `{ data: Invite }` or 204 |
| GET | `/api/platform/accept-invite` or public `/api/invite/accept` | Resolve invite by token (no auth required for lookup); returns invite details for UI (dealership name, role, expiry) or error | Query: token | `{ data: { inviteId, dealershipName?, roleName?, expiresAt? } }` or 404/410 |
| POST | `/api/platform/accept-invite` or public `/api/invite/accept` | Accept invite (auth required); create Membership, mark invite accepted | Body: token (or inviteId + token) | 200 `{ data: { membershipId, dealershipId } }` or 204; idempotent |

**Note:** Accept-invite may live under a **public** or **tenant-agnostic** path (e.g. `/api/invite/accept`) so that unauthenticated users can hit "resolve" to see invite details and then be redirected to sign-up/sign-in; after auth, same endpoint with session accepts. Alternatively, resolve can be public GET and accept be POST under `/api/platform/...` only if the platform is comfortable exposing that path to invitees. Spec leaves exact path to implementation; contract is: resolve by token, accept with auth, idempotent.

- **Resolve (GET) response and PII:** The resolve (GET) accept-invite response MUST NOT include invitee email or other PII in the response body; only non-PII invite details (e.g. dealership name, role name, expiry) necessary to render the accept page are permitted. If the product requires showing the invited email on the accept page, that exception MUST be documented and that is the only PII allowed there.

### 5.3 Approval Flow (Self-Serve) and Pending Users

| Method | Path | Purpose | Input (high level) | Output (high level) |
|--------|------|---------|---------------------|----------------------|
| GET | `/api/platform/pending-users` | List users pending approval (no membership yet) | Query: limit, offset, search? (email) | `{ data: PendingUserSummary[], meta }` |
| POST | `/api/platform/pending-users/[userId]/approve` | Approve and link to dealership: create Membership with roleId, remove PendingApproval | Path: userId; Body: dealershipId, roleId | 201 `{ data: Membership }` or 200 |
| POST | `/api/platform/pending-users/[userId]/reject` | Reject (remove PendingApproval; optional notify) | Path: userId | 204 |

### 5.4 Dealership Scoping and First Owner

- **POST `/api/platform/dealerships/[id]/members`** (existing): When adding by email + roleId, if the Profile does not exist, either fail with clear message or (if product allows) create Profile and then Membership. For **first member (Owner)** of a dealership, this is the only way to link: platform admin calls this (or invite + accept). No other endpoint allows creating the first Owner.
- **POST `/api/platform/dealerships/[id]/invites`**: Creates invite for first or subsequent members; accept flow creates the Membership (including first Owner). Both paths require platform admin.

---

## 6. UI Pages Map

### 6.1 Platform UI (`/platform`)

- **Layout:** All under `/platform`. Layout checks session: if user is not platform admin, show "You don't have access to platform admin" and do not call `/api/platform/*`.
- **Pages:**
  - `/platform` — Dashboard or redirect to dealerships list.
  - `/platform/dealerships` — List dealerships (table: name, slug, status, members count, etc.); filters; pagination; Create dealership, Disable/Enable, Impersonate.
  - `/platform/dealerships/[id]` — Dealership detail: Info, Locations, **Members**, **Invites** (new), Audit snippet, Enable/Disable.
  - **Members tab:** List members (GET members); "Add member" (email + role → POST members or create invite per product).
  - **Invites tab (new):** List invites for this dealership (GET dealerships/[id]/invites); "Create invite" (email + role + optional expiry → POST dealerships/[id]/invites); Cancel/Resend per invite.
  - `/platform/pending-users` (new) — List pending users (GET pending-users); per row: Approve (opens modal: select dealership + role, then POST approve) or Reject.
  - Impersonation banner (when active): "Viewing as [Dealership Name]" with "Exit" (POST impersonate/end).

### 6.2 Public or Tenant-Agnostic Pages

- **Accept invite:** `/accept-invite` (or `/invite/accept`) — Query: `token`. Page calls resolve endpoint (GET) to show invite details (dealership name, role, expiry). If not signed in: show "Sign up" / "Sign in" (link to Supabase auth, pre-fill email if available). If signed in: show "Accept" button; on submit, POST accept; on success, redirect to app with dealership context.

### 6.3 Tenant (Dealership) Pages

- **Pending-approval experience:** If the signed-in user has no memberships and has a PendingApproval row (or pending status), show a dedicated **pending-approval** page (e.g. at `/pending` or as the default landing when no active dealership): message "Your account is pending approval. A platform administrator will link you to a dealership shortly." No access to tenant data or dealership list.

### 6.4 Auth Flows (Reference Only)

- Sign-up: Supabase sign-up (or magic link); on success, create Profile; if self-serve mode, create PendingApproval. No tenant data until approved or invite accepted.
- Sign-in: Resolve active dealership from cookie/membership; if no membership and pending, show pending-approval page; if membership(s), show app.

---

## 7. Events / Audit Actions

All audit entries: append-only; no PII in metadata (no SSN, DOB, email, phone in metadata). Use consistent action strings.

- **Audit coverage:** Every platform write action (create/update/delete of dealership, invite, membership, or pending approval, plus impersonation start/end) MUST produce an audit entry with the defined action code and non-PII metadata.

### 7.1 Invite Flow

- **platform.invite.created** — Invite created; metadata: inviteId, dealershipId, roleId (no email in metadata if PII policy forbids; or hashed/redacted).
- **platform.invite.sent** — Optional: when invite email is sent (if implemented).
- **platform.invite.accepted** — Invite accepted; metadata: inviteId, membershipId, dealershipId.
- **platform.invite.expired** — Invite expired or marked expired (optional).
- **platform.invite.cancelled** — Invite cancelled by platform admin.

### 7.2 Approval Flow (Self-Serve)

- **platform.pending.signup** — User signed up and added to pending (PendingApproval created).
- **platform.membership.approved** — Pending user approved and linked to dealership; metadata: userId, dealershipId, roleId, membershipId.
- **platform.pending.rejected** — Pending user rejected (PendingApproval removed).

### 7.3 Existing Platform Actions (Reference)

- **platform.dealership.created** — Dealership (and optional default location) created.
- **platform.dealership.updated** — Dealership updated.
- **platform.dealership.disabled** — Dealership set inactive.
- **platform.dealership.enabled** — Dealership set active.
- **platform.membership.added** — Member added (direct add or after invite/approval).
- **platform.membership.updated** — Role or disabled state updated.
- **platform.impersonate.start** — Impersonation started; metadata: targetDealershipId.
- **platform.impersonate.end** — Impersonation ended.

Audit writes for platform actions should set `dealershipId` to the **target** dealership when applicable (e.g. invite, membership), or null for cross-tenant audit list; `actorId` is the platform admin (or system).

---

## 8. Manual Smoke Checklist

Use for QA and release verification. All steps assume a platform admin account exists and a test dealership can be created.

### Invite-Only Path

1. As platform admin, create a new dealership (no members).
2. Create an invite for a **new email** (no existing account): dealership, email, role (e.g. Owner), optional expiry. Confirm invite appears in Invites list for that dealership.
3. Open accept-invite link (with token) in incognito/anonymous window. Confirm invite details (dealership name, role) are shown; confirm "Sign up" / "Sign in" is offered.
4. Sign up with that email (Supabase). After sign-up, complete accept (same link or "Accept" on page). Confirm redirect to app with that dealership as active and one Membership (Owner).
5. As platform admin, create another invite for a **different email** that already has an account. Open link signed in as that user; accept. Confirm one additional Membership and no duplicate.
6. Attempt to accept the same invite again (same token/link). Confirm idempotent success (no duplicate membership).
7. If expiry is implemented: create invite with short expiry; wait or backdate; confirm accept returns 410 or 403 with "expired" message.
8. As platform admin, cancel a pending invite; confirm accept link no longer works (404 or 410).

### Self-Serve Signup Path

9. Sign up with a **new email** (no invite) via Supabase. Confirm Profile is created and PendingApproval row exists (or pending status).
10. Sign in as that user. Confirm **pending-approval** page is shown: no dealership list, no tenant data, message about awaiting approval.
11. As platform admin, open Pending users list. Confirm the new user appears. Approve: select dealership and role (e.g. Sales). Confirm Membership is created and user is removed from pending list.
12. Sign in again as the approved user. Confirm app shows the dealership and tenant navigation; no pending message.

### Bootstrap Rule Verification

13. Create a **new dealership** (no members). Confirm there is no "claim dealership" or public link that allows a non–platform-admin to become Owner.
14. Confirm the **only** way to add the first member (Owner) is: (A) platform admin creates invite and invitee accepts, or (B) platform admin adds member by email (POST members) or approves pending user with Owner role. No self-service "claim" or open bootstrap.

### Platform-Only and First-Owner Link

15. As a **tenant-only** user (e.g. dealership Admin, not platform admin), attempt to open `/platform/dealerships` or any `/api/platform/*` URL. Confirm 403 and no platform data returned.
16. As platform admin, add the first Owner to a new dealership via "Add member" (email + Owner role). Confirm one Membership; confirm that user can sign in and see that dealership as Owner. Confirm audit log shows platform.membership.added (or equivalent) with platform admin as actor.

---

## 9. Security Review Addendum

- **Tenant isolation:** Platform admin status is from PlatformAdmin only; for platform routes `dealershipId` is only from path or body as target; tenant admins have no access to `/api/platform/*` (see §4.3, §4.4).
- **RBAC:** `platform.read`, `platform.write`, `platform.impersonate` are platform-only and not assigned to any dealership role (§4.1).
- **Audit:** Append-only; no PII in metadata; every platform write action and impersonation start/end must produce an audit entry (§7).
- **Bootstrap:** First user (Owner) only via platform admin invite or add/approve; no public "claim dealership" (§2.3).
- **Invite token:** Unguessable, cryptographically secure (≥128 bits); not derived from invite id or email (§3.1).
- **Resolve response:** No PII in resolve (GET) response except any documented exception for showing invited email on accept page (§5.2).

### Optional hardening (implementation phase)

- **Rate limiting:** Implement rate limiting on resolve (GET) and accept (POST) invite endpoints (e.g. by IP and/or token) to prevent enumeration or brute-force; return 429 when exceeded.
- **Token storage:** Invite tokens SHOULD be at least 128 bits (e.g. 22+ character URL-safe base64) and stored hashed where feasible; accept flow uses constant-time comparison.
- **Single-use after accept:** After an invite is successfully accepted, the token SHOULD be invalidated or marked used so it cannot be reused for new lookups; idempotent accept may still return success for repeated requests.

---

**End of specification.** Implementation details (Zod schemas, exact field names, migration order) are left to the implementation phase; this document defines contracts and behavior only.
