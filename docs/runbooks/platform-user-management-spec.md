# Platform User Management UI — Spec (Step 1)

**Scope**: CRUD for platform users and roles in `apps/platform`. No code or schema changes in this step.

---

## 1. Goals & Non-goals

### Goals

- **PLATFORM_OWNER** can manage `platform_users`:
  - **View**: Paginated list of platform users (userId, role, createdAt, updatedAt if present, status if present).
  - **Add**: Add a platform user by **userId** (Supabase auth user UUID). Optionally support add-by-email (see Data model impacts).
  - **Change role**: Update a user’s role (PLATFORM_OWNER | PLATFORM_COMPLIANCE | PLATFORM_SUPPORT).
  - **Deactivate / remove**: Disable a user (optional, if status/disabledAt exists) or delete a user record (optional).
- All actions enforce RBAC; 403 before any DB read that could reveal existence.
- Validation at edge (Zod), pagination for lists, append-only audit for create/update/delete/role change.

### Non-goals

- Dealer users or dealer portal user management.
- Cross-portal or “unified” accounts (platform vs dealer identity remains separate).
- Advanced SCIM, directory sync, or bulk import.
- SSO / SAML configuration (auth remains Supabase; this spec is only for managing rows in `platform_users`).

---

## 2. UX Screens & Flows

### Navigation

- Add **“Users”** to the Platform sidebar in `platform-shell` (same pattern as Applications, Dealerships, Audit Logs).
- Route: `/platform/users` (list) and optionally `/platform/users/[id]` (detail) or inline edit on list.

### Users List Page (`/platform/users`)

- **Paginated list** columns:
  - `userId` (id)
  - `role`
  - `createdAt`
  - `updatedAt` (if added in schema)
  - `status` (e.g. active/disabled if we add status or disabledAt in schema)
  - `lastLogin` (optional future; not in current schema)
- **Search/filter**: By `userId` (UUID); optionally by email if we expose it (see Data model impacts — would require lookup or stored display field).
- **Actions** (for PLATFORM_OWNER only; read-only roles see no mutate actions):
  - **“Invite / Add user”** button opening a modal.
- **Add user modal**:
  - **Required input**: Either **userId** (Supabase auth user UUID) **or** **email** (if we support add-by-email in Step 2).
  - If **userId only**: Single field “User ID (Supabase auth UUID)” with short hint: “From Supabase Dashboard → Authentication → Users.”
  - If **email** supported: Field “Email” and backend resolves to userId via Supabase Admin API before insert; no raw email stored in `platform_users` unless we add a display-only field (see Data model impacts).
  - **Role** dropdown: PLATFORM_OWNER | PLATFORM_COMPLIANCE | PLATFORM_SUPPORT (default e.g. PLATFORM_SUPPORT).
  - Submit → POST to create/upsert; success toast and list refresh.

### User Detail or Inline Edit

- **Change role**: Dropdown or inline edit; PATCH with new role; confirmation if actor is changing their **own** role (“You are changing your own role. Continue?”).
- **Disable user** (optional): If schema gains `status` or `disabledAt`, a “Disable” action that PATCHes; confirm “Disable this user? They will no longer be able to sign in to the platform.”
- **Delete user** (optional): “Remove from platform” that DELETE; confirm “Remove this user? They will lose platform access.”
- **Guardrails**:
  - **Last PLATFORM_OWNER**: Never allow removing the last PLATFORM_OWNER (block delete and block role change that would leave zero owners). Show error: “Cannot remove or demote the last platform owner.”
  - **Self-role change**: Require explicit confirmation before applying.
  - Destructive actions (disable, delete): Always show clear warning and confirmation.

### Confirmations and guardrails (summary)

| Scenario                    | Behavior                                                                 |
|----------------------------|---------------------------------------------------------------------------|
| Remove or demote last owner| Reject with 403 or 422; message “Cannot remove or demote the last platform owner.” |
| Actor changes own role     | Require confirmation step before PATCH.                                  |
| Disable / delete user      | Modal or inline confirmation with short warning.                         |

---

## 3. RBAC Matrix for this module

| Role                | List users | Get user by id | Create user | PATCH (role/disable) | DELETE |
|---------------------|------------|----------------|-------------|----------------------|--------|
| PLATFORM_OWNER      | Yes        | Yes            | Yes         | Yes                  | Yes    |
| PLATFORM_COMPLIANCE | Yes        | Yes            | No          | No                   | No     |
| PLATFORM_SUPPORT    | Yes        | Yes            | No          | No                   | No     |

- **PLATFORM_OWNER**: Full CRUD on platform users (subject to “last owner” rule).
- **PLATFORM_COMPLIANCE**: Read-only (list + get by id).
- **PLATFORM_SUPPORT**: Read-only (list + get by id). Same as compliance for this module; no need to hide the section.

**Enforcement**: Every API route MUST:

1. Call `requirePlatformAuth()` then `requirePlatformRole(user, [...allowedRoles])` **before** any DB read that could reveal existence of a user (e.g. before `findUnique`/`findFirst` by id).
2. Return **403** for insufficient role; do not return 404 for “not found” when the real reason is “forbidden” (so 403 before lookup for mutate routes).

---

## 4. API Contracts (no code yet)

Base path: **`/api/platform/users`**.

### GET `/api/platform/users` (list)

- **Query (Zod)**:
  - `limit`: number, 1–100, default 20.
  - `offset`: number, ≥ 0, default 0.
  - `search` or `q`: optional string (match on userId; if email supported later, match on resolved or stored email).
- **Response**: `{ data: PlatformUserListItem[], meta: { total, limit, offset } }`.
- **ListItem shape**: `id`, `role`, `createdAt`, `updatedAt?`, `status?` (if schema has it). Optionally `email` or `emailHash` only if we add it (see Data model impacts).
- **Errors**: 401 unauthenticated, 403 forbidden (role not allowed), 422 validation (query params).
- **RBAC**: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT (read-only).

### POST `/api/platform/users` (create / upsert)

- **Body (Zod)**:
  - **Option A (userId only)**: `{ userId: string (UUID), role: PlatformRole }`.
  - **Option B (email)**: `{ email: string (email()), role: PlatformRole }` — backend resolves to userId via Supabase Admin API then upserts by userId.
- **Response**: 201 + `PlatformUserDetail` (id, role, createdAt, updatedAt?, status?).
- **Idempotency**: Optional `Idempotency-Key` header for POST; if supported, same key + same body → 200 with existing user instead of 201.
- **Errors**: 401, 403 (not PLATFORM_OWNER), 422 (validation; e.g. invalid UUID or email), 409 if “user already exists” and we use strict create (or 200/201 with upsert semantics).
- **RBAC**: PLATFORM_OWNER only. Check role **before** any DB or Supabase Admin call.

### GET `/api/platform/users/[id]` (get one)

- **Params**: `id` = platform user UUID (same as Supabase auth user id).
- **Response**: 200 + `PlatformUserDetail`.
- **Errors**: 401, 403 (role not allowed), 404 (user not in platform_users).
- **RBAC**: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT. Auth + role check before lookup.

### PATCH `/api/platform/users/[id]` (role change / disable)

- **Params**: `id` = platform user UUID.
- **Body (Zod)**:
  - `role?`: PlatformRole (optional; change role).
  - `status?`: e.g. `"active"` | `"disabled"` if we add status (optional).
  - Or `disabledAt?`: ISO datetime if we use soft-disable by timestamp.
- At least one of the allowed fields required. No PII in body.
- **Response**: 200 + updated `PlatformUserDetail`.
- **Errors**: 401, 403, 404, 422 (validation; including “cannot demote last owner” as 422 or 403).
- **RBAC**: PLATFORM_OWNER only. Enforce “last owner” rule: if current user is the last PLATFORM_OWNER and PATCH would demote or disable them, return 422 with code e.g. `LAST_OWNER_PROTECTION`.
- **Self-role change**: Allowed but should be confirmed in UI; backend does not block self-role change (optional: 422 when actor id === target id and role is being reduced — spec leaves this to implementation).

### DELETE `/api/platform/users/[id]` (optional)

- **Params**: `id` = platform user UUID.
- **Response**: 204 No Content.
- **Errors**: 401, 403, 404, 422 (e.g. “cannot delete last owner”).
- **RBAC**: PLATFORM_OWNER only. Enforce “last owner” rule: if target is the last PLATFORM_OWNER, return 422 with code `LAST_OWNER_PROTECTION`.
- **Idempotency**: Optional; 204 on already-deleted is acceptable.

### Shared validation rules

- **Pagination**: Same pattern as existing platform list routes: `limit` 1–100, `offset` ≥ 0; response `meta: { total, limit, offset }`.
- **Error shape**: `{ error: { code, message, details? } }` (consistent with existing platform API).
- **Zod**: All query params and request bodies validated at edge; invalid input → 422 with details.

---

## 5. Audit requirements (append-only)

Use existing `PlatformAuditLog` and `platformAuditLog()` helper. Every create/update/delete/role change MUST write an audit row.

**Fields** (same as existing platform audit):

- `actorPlatformUserId`: who performed the action
- `action`: one of the action names below
- `targetType`: `"platform_user"`
- `targetId`: the platform user’s id (UUID)
- `beforeState` / `afterState`: JSON with role (and status/disabledAt if added); **no secrets, no PII** (e.g. no email in audit)
- `requestId`: optional request correlation id
- `idempotencyKey`: optional, for POST if we use it

**Standardized action names**:

| Action                      | When |
|----------------------------|------|
| `platform_user.created`     | POST created a new platform user |
| `platform_user.role_changed`| PATCH changed role (include before/after role in states) |
| `platform_user.disabled`    | PATCH set status disabled / disabledAt (if we add it) |
| `platform_user.enabled`     | PATCH set status active / clear disabledAt (if we add it) |
| `platform_user.deleted`     | DELETE removed the user from platform_users |

All of these must include `beforeState`/`afterState` as appropriate (e.g. for role change: beforeState `{ role }`, afterState `{ role }`).

---

## 6. Data model impacts (spec-level only)

**Current schema** (`platform_users`): `id` (UUID), `role`, `createdAt`. No `updatedAt`, no `status`, no `disabledAt`, no email.

- **updatedAt**: Recommend adding in Step 2 for “last changed” and audit clarity. Spec assumes list/detail can expose it once present.
- **status / disabledAt**: Optional. If we want “disable” without delete, add either a `status` enum (e.g. ACTIVE, DISABLED) or `disabledAt` (nullable timestamp). Spec defines PATCH/audit for “disabled” once we have a field.
- **email**: Not in `platform_users` today. Options for “add by email” and list display:
  - **Option A — No email in DB**: “Add user” accepts only **userId**. List shows only userId; no email column. No privacy impact; email stays in Supabase Auth only.
  - **Option B — Resolve at add time only**: POST accepts `email`; backend uses Supabase Admin API to resolve email → userId, then insert by userId. We never store email in our DB. List does not show email unless we fetch on demand (expensive) or add a cached display field.
  - **Option C — Store display email**: Add optional `email` (or hashed) to `platform_users` for display and search. Privacy: store only what’s needed; consider access control (only PLATFORM_OWNER sees). Prefer hashed or minimal display if we store.

**Recommendation for Step 2**: Start with **userId-only** create and list (no email in DB). Optionally add “add by email” using Supabase Admin API (resolve to userId, no email stored). If we add email later, document privacy stance and restrict to necessary roles.

---

## 7. Test plan (high-level)

- **RBAC**:
  - PLATFORM_SUPPORT and PLATFORM_COMPLIANCE: GET list and GET by id return 200 when allowed; POST/PATCH/DELETE return 403. No DB read that reveals “user exists” before the 403 for mutate routes.
  - PLATFORM_OWNER: Can create, update, delete (subject to last-owner rule).
- **Last owner protection**:
  - PATCH to demote or disable the last PLATFORM_OWNER → 422 (or 403) with code `LAST_OWNER_PROTECTION`.
  - DELETE the last PLATFORM_OWNER → 422 (or 403) with same code.
- **Pagination and filtering**:
  - GET list with limit/offset returns correct slice and `meta.total`.
  - Invalid limit/offset → 422.
- **Audit**:
  - After create/update/delete/role change, one row in `platform_audit_logs` with correct `actorPlatformUserId`, `action`, `targetType` "platform_user", `targetId`, and `beforeState`/`afterState` containing role (and status if applicable); no secrets in audit.
- **Validation**: Invalid body or query (Zod) → 422 with details.

---

## 8. Deployed-only manual checklist

- [ ] Log in as PLATFORM_OWNER; open **Users** in sidebar; list loads with at least one user (you).
- [ ] Add a platform user (by userId or email if implemented); confirm they appear in list and can sign in to platform.
- [ ] Change the new user’s role (e.g. to PLATFORM_SUPPORT); confirm list and detail show new role.
- [ ] As PLATFORM_OWNER, attempt to remove or demote the last PLATFORM_OWNER; confirm error and that owner count never goes to zero.
- [ ] Open **Audit Logs**; filter by `targetType` = platform_user (or action contains “platform_user”); confirm create/role change/delete entries with correct actor, targetId, and before/after state (no secrets).
- [ ] Log in as PLATFORM_SUPPORT or PLATFORM_COMPLIANCE; confirm Users list and detail are visible but Add / Edit / Delete are not available or return 403.

---

**Document**: `docs/runbooks/platform-user-management-spec.md`  
**Step**: 1 — Spec only; no code or schema changes.
