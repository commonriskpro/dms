# Platform Admin (Super Admin)

Platform Admin is a global, non–dealership-scoped area for managing dealerships and their access across the DMS. Only users granted **Platform Admin** can see the sidebar link and call platform APIs. Full design: **docs/design/platform-admin-spec.md**.

## Permissions

- **platform.admin.read** — View platform data (dealerships, members). Stored in the Permission table but **not** assigned to any dealership role. Platform routes gate access by the **PlatformAdmin** table only.
- **platform.admin.write** — Write platform data. Same as above; platform routes use `requirePlatformAdmin(userId)` and do not check these permission keys for authorization.

## How to grant yourself Platform Admin

1. **Env allowlist (recommended)**  
   Set `PLATFORM_ADMIN_EMAILS` to a comma-separated list of emails (e.g. `a@b.com,c@d.com`). Run the seed (or bootstrap that runs the same logic):
   ```bash
   PLATFORM_ADMIN_EMAILS=your@email.com npx prisma db seed
   ```
   The seed upserts a **PlatformAdmin** row for each Profile whose email is in the list.

2. **Manual insert**  
   Insert into `platform_admin` for the desired `user_id` (Profile.id):
   ```sql
   INSERT INTO platform_admin (id, user_id, created_at)
   VALUES (gen_random_uuid(), '<profile-uuid>', NOW());
   ```

## Create Account Flow

Two onboarding modes (see spec):

- **Invite-only:** Platform admin creates an invite (dealership + email + role); invitee receives a link, resolves by token (public GET), then signs up/signs in and accepts (POST). Membership is created in the **invite’s** dealership only; no client-supplied `dealershipId` is used on accept.
- **Self-serve:** User signs up; a PendingApproval row is created. Platform admin lists pending users, then approves (links to dealership + role) or rejects. No tenant data until approved.

**Endpoints:**

- **Invites:** `POST/GET /api/platform/dealerships/[id]/invites`, `PATCH /api/platform/dealerships/[id]/invites/[inviteId]` (cancel or resend).
- **Resolve / Accept (public or tenant-agnostic):** `GET /api/invite/resolve?token=...` (no auth; returns non-PII invite details). `POST /api/invite/accept` (auth required; body `{ token }`; creates membership in invite’s dealership, idempotent).
- **Pending users:** `GET /api/platform/pending-users`, `POST /api/platform/pending-users/[userId]/approve` (body: `dealershipId`, `roleId`), `POST /api/platform/pending-users/[userId]/reject`.

**Audit:** All platform write actions produce an audit entry. **No PII in audit metadata** (no email, phone, etc.); only IDs and `changedFields`. Actions: `platform.invite.created`, `platform.invite.accepted`, `platform.invite.cancelled`, `platform.membership.approved`, `platform.pending.rejected`, plus existing platform.dealership.* and platform.impersonate.*.

## Routes (all require platform admin unless noted)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/platform/dealerships | List dealerships (limit, offset, search). Returns name, slug, isActive, locationsCount, membersCount, createdAt. |
| POST | /api/platform/dealerships | Create dealership (name, optional slug, createDefaultLocation). |
| GET | /api/platform/dealerships/[id] | Get one dealership (with counts). |
| PATCH | /api/platform/dealerships/[id] | Update name, slug, isActive. |
| POST | /api/platform/dealerships/[id]/disable | Set isActive=false; disable all memberships. 204. |
| POST | /api/platform/dealerships/[id]/enable | Set isActive=true. Does not re-enable memberships. 204. |
| GET | /api/platform/dealerships/[id]/members | List members (limit, offset). Includes disabled. |
| POST | /api/platform/dealerships/[id]/members | Add member by email + roleId (Profile must exist). |
| PATCH | /api/platform/dealerships/[id]/members/[membershipId] | Update roleId and/or disabled. |
| GET | /api/platform/dealerships/[id]/roles | List roles for dropdown (id, name). |
| GET | /api/platform/dealerships/[id]/invites | List invites (limit, offset, status?). |
| POST | /api/platform/dealerships/[id]/invites | Create invite (body: email, roleId, expiresAt?). |
| PATCH | /api/platform/dealerships/[id]/invites/[inviteId] | Cancel (body: cancel: true) or resend (body: expiresAt?). |
| GET | /api/platform/pending-users | List pending users (limit, offset, search?). |
| POST | /api/platform/pending-users/[userId]/approve | Approve and link (body: dealershipId, roleId). |
| POST | /api/platform/pending-users/[userId]/reject | Reject pending user. 204. |
| POST | /api/platform/impersonate | Body: `{ dealershipId }`. Sets active-dealership cookie and returns 204. |

**Public (no platform auth):**

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/invite/resolve | Query: token. Returns invite details (dealershipName, roleName, expiresAt); no PII. 404/410 if not found or expired/cancelled. |
| POST | /api/invite/accept | Auth required. Body: { token }. Creates membership in invite’s dealership; idempotent. |

## Session and impersonation

- **Session**  
  `GET /api/auth/session` includes `platformAdmin: { isAdmin: boolean }`. The UI shows the “Platform Admin” sidebar item only when `session.platformAdmin.isAdmin === true`.

- **Impersonation**  
  A platform admin can call `POST /api/platform/impersonate` with `{ dealershipId }`. The server sets the same **active-dealership** cookie used by the normal session switch. The platform admin can then use the app as that dealership (no membership check for platform admins when resolving the active dealership from the cookie). Use for troubleshooting only; all actions are audited (`platform.impersonate`).

## Safety notes

- Platform routes **must not** use client-supplied `dealershipId` for **authorization**. They use `dealershipId` from the path (or body where specified) only as the **target** of the operation (list/create/patch dealerships, members, invites; approve pending user; impersonate). Target comes from path only for platform auth purposes.
- Normal tenant routes keep strict scoping: `ctx.dealershipId` from `getAuthContext` (which uses `requireDealershipContext`). There is **no** platform-admin bypass on tenant routes.
- When a dealership is **disabled** (`Dealership.isActive = false`), tenant access for non–platform users is blocked: the session clears the active dealership and cookie; `requireDealershipContext` returns FORBIDDEN. Platform admins can still view the dealership in the platform area and can impersonate it if needed.
- **Audit:** Platform events are logged with the actions listed above. **Audit metadata must not contain PII or tokens** (no email, phone, SSN, DOB, token); only IDs (`inviteId`, `dealershipId`, `roleId`, `membershipId`, `userId`) and `changedFields` where applicable. `lib/audit` sanitizes metadata to redact these keys.

## Security (platform admin & invite flow)

- **Tenant isolation:** Non-platform users get **403 FORBIDDEN** on all `/api/platform/*` routes. `requirePlatformAdmin()` is called **before** any handler logic so dealership existence cannot be inferred (no 404 to non-platform users).
- **Rate limits:** Invite endpoints are rate limited per client (IP): **invite_create** 20/min, **invite_resend** 20/min, **invite_accept** 10/min, **invite_resolve** 60/min. Returns **429** when exceeded. See `lib/api/rate-limit.ts`.
- **Invite tokens:** Unguessable (crypto random); **one-time use** after accept—resolve returns **410 Gone** for ACCEPTED invites. Token is **never** included in audit metadata or logs; metadata sanitization redacts `token`.
- **Approval:** Only platform admins can approve/reject; approval uses explicit `dealershipId` and `roleId` from request body; role is validated against the dealership.

## UI

- **/platform/dealerships** — Table of dealerships (name, slug, active, members, locations, created); Create dealership modal; Disable/Enable and Impersonate with confirm dialogs.
- **/platform/dealerships/[id]** — Dealership detail; members list with add member, change role, disable/enable membership; **Invites** tab (list invites, create invite, cancel/resend); Disable/Enable dealership and Impersonate.
- **/platform/pending-users** — List pending users; Approve (select dealership + role) or Reject per user.
- **Accept invite (public):** `/accept-invite?token=...` — Resolve shows invite details (dealership name, role); sign up/sign in then Accept; redirect into app with that dealership.
- If the user is not a platform admin, the platform layout shows “You don’t have access to platform admin” and no platform API calls are made.
