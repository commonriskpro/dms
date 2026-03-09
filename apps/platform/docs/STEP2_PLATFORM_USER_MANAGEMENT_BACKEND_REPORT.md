# Step 2 — Platform User Management Backend Report

## Summary

Backend work for Platform User Management: auth now excludes disabled users; existing list/add/invite/PATCH/DELETE and last-owner protection unchanged; tests updated and one new test added.

## Implemented

### 1. Auth: exclude disabled users

- **File:** `lib/platform-auth.ts`
- **Change:** `getPlatformUserByUserId` now selects `disabledAt` and returns `null` when `row.disabledAt != null`, so disabled platform users are treated as not authorized and receive 403 (same as "not in platform_users").
- **Rationale:** Prevents disabled staff from continuing to access the platform.

### 2. Reused (no code changes)

- **Data model:** PlatformUser (id, role, createdAt, updatedAt, disabledAt). No migration.
- **Service:** listPlatformUsers, getPlatformUserById, upsertPlatformUser, updatePlatformUser, deletePlatformUser with last-owner protection and audit (platform_user.role_changed, disabled, enabled, deleted).
- **API:** GET/POST /api/platform/users, GET/PATCH/DELETE /api/platform/users/[id], POST /api/platform/users/invite. Validation via contracts (Zod). PLATFORM_OWNER required for mutations.
- **Contracts:** platformListUsersQuerySchema, platformCreateUserRequestSchema, platformUpdateUserRequestSchema, PLATFORM_ROLES.

### 3. Tests

- **lib/platform-auth.test.ts:**
  - Updated existing expectations to include `disabledAt` in the Prisma select.
  - **New:** "throws 403 when platform user is disabled (disabledAt set)" — when row has disabledAt set, requirePlatformAuth throws FORBIDDEN.
- **app/api/platform/users/[id]/route.rbac.test.ts:** Unchanged; already covers PATCH 403 for non-owner, audit on role change, 409 when demoting/deleting last owner, 200 when two owners and demoting one.

## Files created

- `apps/platform/docs/STEP2_PLATFORM_USER_MANAGEMENT_BACKEND_REPORT.md`

## Files modified

- `lib/platform-auth.ts` — getPlatformUserByUserId: select disabledAt, return null when disabledAt set.
- `lib/platform-auth.test.ts` — select expectation updated; new test for disabled user 403.

## Risks / follow-ups

- None. No new APIs or migrations; behavior change is limited to auth rejecting disabled users.
