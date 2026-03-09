# Step 4 — Platform User Management Security Report

## 1. Platform-only access

- **Route protection:** All platform routes use `requirePlatformAuth()`. Unauthenticated requests get 401; authenticated users whose id is not in `platform_users` or whose row has `disabledAt` set get 403 (not authorized).
- **Dealership users:** Dealership (tenant) users exist only in the dealer app and dealer DB. They do not have rows in platform `platform_users` and cannot call platform APIs. No shared session or role table between platform and dealer for end-users.
- **Result:** Only internal staff with a platform_users row (and not disabled) can access /platform/users and related APIs.

## 2. Role safety

- **Mutation authority:** Only PLATFORM_OWNER can add users (POST /api/platform/users), change role or disabled (PATCH /api/platform/users/[id]), delete (DELETE), and invite (POST /api/platform/users/invite). All these routes call `requirePlatformRole(user, ["PLATFORM_OWNER"])`. PLATFORM_COMPLIANCE and PLATFORM_SUPPORT cannot escalate privileges.
- **Last active admin:** The service layer (`updatePlatformUser`, `deletePlatformUser`) counts active owners (role = PLATFORM_OWNER and disabledAt = null) excluding the target user. If that count would drop below 1, the operation is rejected with 409 CONFLICT and message "Cannot remove or demote the last platform owner."
- **Self-updates:** An owner can demote or disable themselves only if at least one other active owner exists. Disabling the last owner is blocked.

## 3. Data safety

- **Auth internals:** API responses do not expose Supabase internals, tokens, or secrets. List and GET return only id, role, createdAt, updatedAt, disabledAt (and serialized dates).
- **No cross-app contamination:** Platform roles (PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT) are separate from dealer roles and permissions. No merging of platform and dealer RBAC.
- **Serializers:** List and single-user responses use the same minimal shape; no extra fields from Prisma or auth.

## 4. Validation and response hygiene

- **Validation:** List query uses `platformListUsersQuerySchema` (limit, offset, q, role). Create uses `platformCreateUserRequestSchema` (id, role). Update uses `platformUpdateUserRequestSchema` (role optional, disabled optional; at least one required for PATCH). Invalid input returns 422 with validation details.
- **Errors:** `handlePlatformApiError` and `errorResponse` are used; no stack traces or raw errors in JSON. PlatformApiError and 404/409 return clean codes and messages.
- **No unsafe casts:** Role values are validated against PLATFORM_ROLES in contracts and service.

## 5. Audit

Audit events (platformAuditLog) are emitted for:

- platform_user.created
- platform_user.upserted
- platform_user.role_changed
- platform_user.disabled
- platform_user.enabled
- platform_user.deleted

All include actorPlatformUserId, targetType "platform_user", targetId, beforeState/afterState where applicable, and optional requestId.

## 6. Disabled user access

- **Fix applied:** `getPlatformUserByUserId` now selects `disabledAt` and returns null when `row.disabledAt != null`. Disabled users are therefore treated as not authorized and receive 403 when accessing any platform route that uses `requirePlatformAuth()`.
