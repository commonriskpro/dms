# Platform User Management Spec

**Goal:** Implement Platform User Management in apps/platform so platform admins can manage the small set of internal platform staff with proper platform-only RBAC. Platform app remains an internal super-admin console; no multi-tenant or dealer-user merge.

**Repo:** DMS monorepo · **Apps:** apps/platform, apps/dealer, packages/contracts.

---

## 1. CURRENT STATE AUDIT

### What exists today

| Area | Status | Location |
|------|--------|----------|
| **PlatformUser model** | Exists | `apps/platform/prisma/schema.prisma`: `id` (UUID, PK), `role` (PlatformRole), `createdAt`, `updatedAt`, `disabledAt`. `id` is the Supabase auth user id (no separate authUserId). |
| **Platform roles** | Exists | Enum `PlatformRole`: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT. Used in platform-auth and platform-users-service. |
| **Auth pattern** | Exists | Supabase session (production) or header/cookie (dev when PLATFORM_USE_HEADER_AUTH). `getPlatformUserIdFromRequest()` → Supabase user id. `getPlatformUserByUserId(userId)` looks up `platform_users` where `id = userId` and returns `{ userId, role }`. **Gap:** Lookup does not exclude rows with `disabledAt` set; disabled users can still access the app. |
| **Role editing** | Exists | `updatePlatformUser(actor, id, { role?, disabled? })` in platform-users-service. Last-owner protection: cannot demote or disable the last active PLATFORM_OWNER. Audit events: platform_user.role_changed, platform_user.disabled, platform_user.enabled. |
| **User list** | Exists | `listPlatformUsers({ limit, offset, q?, role? })`. GET /api/platform/users with pagination and filters. |
| **Add user** | Exists | POST /api/platform/users with body `{ id: uuid, role }` (add platform access for existing auth user by UUID). PLATFORM_OWNER only. Uses `upsertPlatformUser`. |
| **Invite by email** | Exists | POST /api/platform/users/invite (Supabase admin inviteUserByEmail, then upsert platform_users). PLATFORM_OWNER only. platform-invite-service + PlatformInviteLog. |
| **PATCH/DELETE user** | Exists | PATCH /api/platform/users/[id] (role, disabled), DELETE /api/platform/users/[id]. PLATFORM_OWNER only. Last-owner protection in service. |
| **Contracts** | Exists | packages/contracts: platformListUsersQuerySchema, platformCreateUserRequestSchema, platformUpdateUserRequestSchema, platformUserSchema, PLATFORM_ROLES. |
| **/platform/users page** | Exists | List with role filter and search by ID; Add user (by UUID); Invite by email; Role dropdown per row; Enable/Disable; Confirm dialog for demoting/disabling owner. Uses shadcn Card, Table, Select, Dialog, Button. |
| **Nav** | Exists | "Users" in platform shell nav. |
| **Audit** | Exists | platformAuditLog for created, upserted, role_changed, disabled, enabled, deleted. |
| **Rate limiting** | Exists | Platform rate limit for invite_owner; no specific limit for users API (low volume internal). |

### What should be reused

- PlatformUser table and Prisma client (no new tables).
- platform-auth (requirePlatformAuth, requirePlatformRole), platform-users-service (list, get, upsert, update, delete), api-handler (jsonResponse, errorResponse, handlePlatformApiError).
- Existing GET/POST/PATCH/DELETE users routes and POST users/invite.
- Contracts (platform users schemas and PLATFORM_ROLES).
- Existing /platform/users page structure (table, filters, add, invite, role change, disable/enable).
- Platform shell and layout.

### What to fix or add

1. **Auth:** Exclude disabled users in `getPlatformUserByUserId`: if `row.disabledAt != null`, return null so disabled users receive forbidden and cannot access platform.
2. **UX polish:** Add a short page description ("Internal platform staff and access control"); tighten empty state copy ("No platform users yet. Add by user ID or invite by email."); ensure role badge and status (Active/Disabled) are clear; confirm dialogs already present.
3. **Email/name:** Platform DB does not store email or full name; identity is in Supabase Auth. Current list shows id (truncated), role, status, created. Optional follow-up: server-side enrichment from Supabase Admin (getUserById or listUsers) to show email on the list—not required for this task; document as follow-up to avoid scope creep.
4. **Last sign-in:** Not stored in platform DB or Supabase by default. Omit from scope unless already available; document as optional follow-up.

---

## 2. ARCHITECTURE DECISION

- **Distinct platform-only layer:** Keep platform users and roles entirely separate from dealer app and dealer roles. No shared user table; no merging platform into dealer RBAC.
- **Internal staff only:** Platform app is the super-admin control panel for a very small set of internal staff. /platform/users manages only those staff.
- **Role naming (repo convention):** Keep existing enum: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT. Map to spec concepts: platform.admin = PLATFORM_OWNER, platform.support = PLATFORM_SUPPORT, platform.readonly = not in schema (lowest role is PLATFORM_SUPPORT; can add PLATFORM_READONLY later if needed).
- **Mutation authority:** Only PLATFORM_OWNER can add users, change roles, disable/enable, or delete. PLATFORM_COMPLIANCE and PLATFORM_SUPPORT can read the list and their own context only.

---

## 3. SCOPE

Implement / refine Platform User Management so that:

- **List internal platform users:** Already implemented (GET /api/platform/users, table with id, role, status, created).
- **View role and status:** Already implemented (role column, Active/Disabled).
- **View created date:** Already implemented.
- **View email / name:** Not in DB; show id (truncated). Optional enrichment from Supabase as follow-up.
- **Add platform access:** Already implemented (POST add by UUID, POST invite by email).
- **Change platform role:** Already implemented (PATCH with role; confirm when demoting owner).
- **Disable / remove platform access:** Already implemented (PATCH disabled, DELETE; last-owner protected).
- **Auth fix:** Disabled users must be denied access (return null in getPlatformUserByUserId when disabledAt is set).
- **UX polish:** Page header with description; clear empty state; consistent role/status display; confirm for risky actions (already present).

---

## 4. DATA MODEL PLAN

**No schema or migration changes.** Reuse existing:

- **PlatformUser:** id (Supabase user id), role, createdAt, updatedAt, disabledAt.

If future need arises for email/name/lastSignIn in platform, add columns or a separate enrichment path; not in this scope.

---

## 5. API / ACTION PLAN

| Method | Path | Purpose | Roles |
|--------|------|---------|--------|
| GET | /api/platform/users | List platform users (pagination, q, role) | OWNER, COMPLIANCE, SUPPORT |
| POST | /api/platform/users | Add/upsert by auth user UUID + role | OWNER |
| GET | /api/platform/users/[id] | Get one user | OWNER, COMPLIANCE, SUPPORT |
| PATCH | /api/platform/users/[id] | Update role and/or disabled | OWNER |
| DELETE | /api/platform/users/[id] | Remove platform access | OWNER |
| POST | /api/platform/users/invite | Invite by email (Supabase + upsert) | OWNER |

All already implemented. Validation: platformListUsersQuerySchema, platformCreateUserRequestSchema, platformUpdateUserRequestSchema (contracts). Ensure PATCH requires at least one of role or disabled (already enforced).

---

## 6. UX PLAN

- **Page:** /platform/users (existing).
- **Page header:** Title "Users"; short description "Internal platform staff and access control."
- **Table:** Columns: User ID (truncated + copy), Role (badge or label), Status (Active / Disabled), Created, Actions (role change, enable/disable for OWNER).
- **Role:** Badge or clear label (Owner, Compliance, Support). Change via dropdown (OWNER only); confirm when demoting owner.
- **Status:** Active / Disabled; Enable / Disable button (OWNER only); confirm when disabling owner.
- **Empty state:** "No platform users yet. Add by user ID or invite by email (Owner only)."
- **Confirm dialogs:** Already present for demoting owner and disabling owner.
- **Add/Invite:** Buttons visible to OWNER only (already via isInviteButtonVisible and isOwner).

---

## 7. SECURITY PLAN

- **Platform-only access:** All platform routes require requirePlatformAuth(); unauthenticated or user not in platform_users get 401/403. After fix, disabled users (disabledAt set) are treated as not in platform_users (getPlatformUserByUserId returns null) → 403.
- **Only PLATFORM_OWNER can mutate:** POST users, PATCH users/[id], DELETE users/[id], POST users/invite already guard with requirePlatformRole(user, ["PLATFORM_OWNER"]). Support and Compliance cannot escalate.
- **Self-demotion / self-lockout:** Service layer prevents demoting or disabling the last active PLATFORM_OWNER (countActiveOwners). Allowing self-demotion to support is allowed only if at least one other owner remains. Disabling self: same rule (cannot disable if you are the last owner).
- **Last platform owner:** Cannot remove, demote, or disable the last active owner; API returns 409 CONFLICT with message.
- **Response hygiene:** Use existing errorResponse; no stack traces; no sensitive auth internals in responses.
- **Audit:** platform_user.created, platform_user.upserted, platform_user.role_changed, platform_user.disabled, platform_user.enabled, platform_user.deleted (already in platform-users-service).
- **Validation:** Zod schemas for query and body; invalid input returns 422.

---

## 8. ACCEPTANCE CRITERIA

1. Disabled platform users cannot access the platform (getPlatformUserByUserId returns null when disabledAt is set).
2. List platform users: GET /api/platform/users returns data with id, role, createdAt, updatedAt, disabledAt; only platform roles can call it.
3. Only PLATFORM_OWNER can add users (POST), change role (PATCH), disable/enable (PATCH), delete (DELETE), and invite (POST invite).
4. PATCH/DELETE that would remove the last active owner return 409 with clear message.
5. /platform/users page shows title and description, table with Role and Status, and OWNER-only actions (add, invite, role change, enable/disable).
6. Confirm dialog is shown when demoting or disabling an owner.
7. Audit events are written for role change and disable/enable.
8. No dealer app or dealer RBAC changes; platform remains internal super-admin only.

---

## Document control

- Version: 1.0
- Next: Step 2 — Backend (auth fix, tests, doc).
