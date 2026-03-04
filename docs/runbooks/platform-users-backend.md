# Platform User Management — Backend (Step 2)

Backend-only implementation: CRUD for `platform_users` in `apps/platform`. No frontend UI in this step.

---

## API endpoints

Base path: **`/api/platform/users`**. All require platform auth (Supabase session in production; header/cookie in dev when `PLATFORM_USE_HEADER_AUTH=true`).

| Method | Path | RBAC | Description |
|--------|------|------|-------------|
| GET | `/api/platform/users` | OWNER, COMPLIANCE, SUPPORT | Paginated list. Query: `limit` (1–100, default 20), `offset` (default 0), `q` (optional exact id match). |
| POST | `/api/platform/users` | OWNER only | Create/upsert by id. Body: `{ id: uuid, role }`. Returns 201 + `{ data: platformUser }`. |
| GET | `/api/platform/users/[id]` | OWNER, COMPLIANCE, SUPPORT | Get one user. 404 if not found. |
| PATCH | `/api/platform/users/[id]` | OWNER only | Update role and/or disabled. Body: `{ role? }, { disabled? }`. At least one required. |
| DELETE | `/api/platform/users/[id]` | OWNER only | Remove user. 204 on success. |

Response shape: list returns `{ data, meta: { total, limit, offset } }`; single and POST/PATCH return `{ data }` with a platform user object (`id`, `role`, `createdAt`, `updatedAt`, `disabledAt`). Errors: `{ error: { code, message, details? } }` with status 401/403/404/409/422.

---

## RBAC rules

- **PLATFORM_OWNER**: Full CRUD (list, get, create, update, delete). Enforce **before** any DB read that could reveal existence (403 for non-owner on mutate routes).
- **PLATFORM_COMPLIANCE**, **PLATFORM_SUPPORT**: Read-only (list, get by id). No create/update/delete; return 403 before lookup if they hit mutate routes.

---

## Last owner rule

- **Never** allow removing or demoting the last active PLATFORM_OWNER (no delete, no PATCH to role ≠ OWNER, no PATCH to disabled = true for an owner if they are the last owner).
- When attempting that, API returns **409 CONFLICT** with message: `"Cannot remove or demote the last platform owner."`
- When at least two owners exist, demoting or disabling one owner is allowed.

---

## Audit (append-only)

All mutations write to `platform_audit_logs` via `platformAuditLog()`:

- **Actions**: `platform_user.created`, `platform_user.upserted`, `platform_user.role_changed`, `platform_user.disabled`, `platform_user.enabled`, `platform_user.updated`, `platform_user.deleted`.
- **Fields**: `actorPlatformUserId`, `action`, `targetType`: `"platform_user"`, `targetId`: user id, `beforeState`/`afterState` (role, disabledAt only). Optional `requestId` from `X-Request-Id` header.
- No emails, tokens, or secrets in audit.

---

## Local test commands

From repo root (or `apps/platform`):

```bash
# Build contracts and platform
cd packages/contracts && npm run build
cd ../.. && cd apps/platform && npx prisma generate && npm run test -- --run && npm run build
```

Run platform app (with env pointing at platform DB and optional header auth):

```bash
cd apps/platform && npm run dev
```

Example calls (replace `BASE` with `http://localhost:3001` and set auth per your setup — e.g. cookie after login or `X-Platform-User-Id` when using header auth):

```bash
# List users (any read role)
curl -s -X GET "$BASE/api/platform/users?limit=10&offset=0"

# Create user (owner only; id = Supabase auth user UUID)
curl -s -X POST "$BASE/api/platform/users" -H "Content-Type: application/json" \
  -d '{"id":"00000000-0000-0000-0000-000000000001","role":"PLATFORM_SUPPORT"}'

# Get one user
curl -s -X GET "$BASE/api/platform/users/00000000-0000-0000-0000-000000000001"

# Update role (owner only)
curl -s -X PATCH "$BASE/api/platform/users/00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" -d '{"role":"PLATFORM_COMPLIANCE"}'

# Delete (owner only)
curl -s -X DELETE "$BASE/api/platform/users/00000000-0000-0000-0000-000000000002"
```

---

## Schema (platform DB)

- **platform_users**: `id` (UUID, PK), `role` (enum), `created_at`, `updated_at`, `disabled_at` (nullable). Migration: `20260301120000_platform_users_updated_at_disabled_at`.
