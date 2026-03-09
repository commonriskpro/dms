# Step 4 — Platform User Management Test Report

## Scope

Jest tests relevant to Platform User Management (auth and users API).

## Tests updated / added

| File | Description |
|------|-------------|
| lib/platform-auth.test.ts | requirePlatformAuth: 401 when unauthed; 403 when not in platform_users; **403 when platform user is disabled (disabledAt set)**; 200 when in platform_users and not disabled. getPlatformUserIdFromRequest cases. Prisma select now includes disabledAt. |
| app/api/platform/users/route.rbac.test.ts | GET/POST RBAC (403 for non-owner on POST). |
| app/api/platform/users/[id]/route.rbac.test.ts | GET 200 for owner when user exists, 404 when not found. PATCH 403 for non-owner; PATCH writes audit platform_user.role_changed; PATCH 409 when demoting last owner; PATCH 200 when two owners and demoting one; DELETE 409 when deleting last owner. |

## Run command

From repo root:

```bash
npm run test --workspace=apps/platform -- --testPathPattern="platform-auth|users/route.rbac|users/\\[id\\]/route.rbac"
```

## Coverage summary

- **Auth:** Disabled user is rejected (403). Select includes disabledAt.
- **RBAC:** Only PLATFORM_OWNER can PATCH/DELETE; GET allowed for all platform roles.
- **Last-owner:** Demote and delete last owner return 409; service does not update/delete.
- **Audit:** PATCH role change triggers platformAuditLog with action platform_user.role_changed.

## Not covered by Jest (manual / integration)

- Full flow: invite by email → Supabase → upsert platform_users (depends on Supabase admin).
- UI: confirm dialogs, empty state, role/status badges (component or E2E if added later).
- Disabled user login flow end-to-end (auth unit test covers the lookup returning null).
