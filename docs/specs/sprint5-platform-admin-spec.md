# SPRINT 5 — Platform Admin (Spec)

Structured spec confirming scope and existing contract for the Platform Admin feature. No code; contract and behavior only.

---

## Scope

SPRINT 5 scope covers:

- **Data**: PlatformAdmin table (already exists); seed allowlist via env (see Data).
- **Routes**: All platform routes under `/api/platform/*`; require platform admin; no dealership scoping on these routes; tenant scoping unchanged for all other app APIs.
- **UI**: `/platform/dealerships` (list), `/platform/dealerships/[id]` (detail + membership management), Impersonate action; sidebar "Platform Admin" only when session indicates platform admin.
- **Security**: Only platform admins can access platform routes (403 otherwise); platform admin does not bypass tenant scoping for regular APIs; audit for platform actions.
- **Tests**: Non-admin gets 403 on platform routes; impersonation sets active-dealership cookie.

---

## Data

- **PlatformAdmin table**: Exists. Holds which users are platform admins (e.g. `userId`, `createdBy`, timestamps). No dealership_id; platform admins are global.
- **Seed allowlist**: Seed should populate platform admins from a comma-separated list of emails.
  - **Primary**: Read **SUPERADMIN_EMAILS** (comma-separated emails). For each email, resolve Profile by email and upsert a PlatformAdmin row for that user.
  - **Backward compatibility**: Optionally support **PLATFORM_ADMIN_EMAILS** as fallback when SUPERADMIN_EMAILS is not set. Document both so deployers can use either.

---

## Routes

All of the following require platform admin (`requirePlatformAdmin(userId)`). No dealership scoping on these routes (they operate across tenants).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/platform/dealerships` | List dealerships (paginated). |
| POST | `/api/platform/dealerships` | Create dealership. |
| GET | `/api/platform/dealerships/[id]` | Get single dealership. |
| PATCH | `/api/platform/dealerships/[id]` | Update dealership. |
| POST | `/api/platform/dealerships/[id]/disable` | Disable dealership. |
| POST | `/api/platform/dealerships/[id]/enable` | Enable dealership. |
| GET | `/api/platform/dealerships/[id]/members` | List members (paginated). |
| POST | `/api/platform/dealerships/[id]/members` | Add member. |
| PATCH | `/api/platform/dealerships/[id]/members/[membershipId]` | Update or disable/enable membership. |
| GET | `/api/platform/dealerships/[id]/roles` | List roles for the dealership. |
| POST | `/api/platform/impersonate` | Set active dealership (impersonate); body `{ dealershipId }`; sets active-dealership cookie. |

Pagination: list endpoints use limit/offset (or equivalent); never unbounded. Dealership ID in path/body is validated (e.g. UUID). `dealership_id` for these routes is never taken from auth/context; it is from path or body only. All other app APIs (e.g. `/api/customers`, `/api/deals`) remain tenant-scoped; they use `ctx.dealershipId` from session/cookie and are unchanged.

---

## UI

- **List**: `/platform/dealerships` — list of dealerships (filters/pagination as implemented).
- **Detail**: `/platform/dealerships/[id]` — single dealership detail and membership management (view/edit members, roles, disable/enable).
- **Impersonate**: Action available to platform admins (e.g. from list or detail); calls POST `/api/platform/impersonate` with `{ dealershipId }`; then user uses app as that dealership.
- **Sidebar**: "Platform Admin" link/entry is shown only when `session.platformAdmin.isAdmin === true`. Otherwise it is hidden.

---

## Security

- **Platform routes**: Only platform admins may access `/api/platform/*`. Enforcement: `requirePlatformAdmin(userId)` at the start of each platform route handler; non-admin receives 403 (FORBIDDEN).
- **No tenant bypass on regular APIs**: Platform admin does **not** bypass tenant scoping for non-platform APIs. Routes such as `/api/customers`, `/api/deals` continue to use `ctx.dealershipId` from session/cookie (from `getAuthContext` / `requireDealershipContext`). So platform admin cannot see or mutate another tenant’s data through normal APIs without impersonating (which sets the active-dealership cookie).
- **Audit**: The following platform actions must be audit-logged (existing contract):
  - `platform.dealership.created` / `platform.dealership.updated` / `platform.dealership.disabled` / `platform.dealership.enabled`
  - `platform.membership.created` / `platform.membership.updated` / `platform.membership.disabled` / `platform.membership.enabled`
  - `platform.impersonate`
  Audit records use IDs only; no PII in metadata.

---

## Tests

- **Authorization**: A non–platform-admin user calling any platform route (e.g. GET `/api/platform/dealerships`) receives **403** and an error body with code FORBIDDEN.
- **Impersonation**: When a platform admin calls POST `/api/platform/impersonate` with body `{ dealershipId }`, the server sets the **active-dealership** cookie to that dealership ID (and returns 204). Tests verify that the cookie-setting function is invoked with the correct `dealershipId`.

---

## Existing Contract (Summary)

- **Platform admin check**:  
  - `isPlatformAdmin(userId)` returns whether the user has a PlatformAdmin record.  
  - `requirePlatformAdmin(userId)` throws (e.g. FORBIDDEN) if the user is not a platform admin.  
  - Session includes `platformAdmin: { isAdmin: boolean }` (from GET `/api/auth/session`).  

- **Impersonate**:  
  - POST body: `{ dealershipId }` (UUID).  
  - Server sets the **active-dealership** cookie to `dealershipId` (same cookie used by normal session switch).  
  - After that, the platform admin can use the app as that dealership: tenant routes resolve `dealershipId` from the cookie; for platform admins, membership is not required when the cookie is set (impersonation path).  

- **Regular tenant routes**:  
  - Never use platform admin to bypass tenant scoping.  
  - `getAuthContext` uses `requireDealershipContext(userId)` to obtain the active dealership (from cookie/membership). There is no special “platform bypass” that skips dealership context; the active dealership is still resolved from cookie or membership, with impersonation supported for platform admins by honoring the cookie without membership when applicable.

---

Next step: backend ensures SUPERADMIN_EMAILS in seed and tests; frontend and security-qa verify and add tests.
