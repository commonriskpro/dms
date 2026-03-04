# Platform Admin & Production Onboarding — Step 1 Spec (Architecture Only)

**Scope:** Platform Admin (Super Admin) domain model, RBAC, API/UI contracts, Security & QA requirements, and Deployment checklist structure. No implementation code.

**References:** DMS Non-Negotiables, Coding Standards, existing `docs/modules/platform-admin.md`, `docs/SECURITY.md`, `lib/platform-admin.ts`, `lib/tenant.ts`, `app/api/platform/*`.

---

## 1. Platform Admin Domain Model

### 1.1 PlatformUser / Profile scope

- **Distinct from dealership membership:** Platform admins are identified by a **separate store** (e.g. `PlatformAdmin` table: `userId` → Profile), not by any dealership role. A platform admin may have zero dealership memberships and still access platform routes; they may also be a member of one or more dealerships.
- **Where the platform-admin flag lives:**
  - **Primary:** DB table `PlatformAdmin` (or equivalent) with `userId` (FK to Profile), optionally `createdBy`, `createdAt`. Lookup by `userId` determines platform admin status. This is the source of truth for authorization on `/api/platform/*`.
  - **Optional (sync only):** Supabase custom claim (e.g. `app_metadata.platform_admin: true`) may be set for convenience (e.g. RLS or client-side UI hints), but **authorization must never rely solely on the claim**. Server must always verify against the DB (or a server-side cache of the DB) before allowing platform actions. This avoids tenant leakage if claims are misconfigured.
- **How it is set:** (1) **Manual in DB** — insert/delete rows in `PlatformAdmin`. (2) **Bootstrap/seed** — allowlist (e.g. `PLATFORM_ADMIN_EMAILS` env) used during seed to upsert `PlatformAdmin` for matching Profile emails. (3) **No** invite flow for platform admins in scope (only dealership owner/member invite). No RLS on `PlatformAdmin` for granting; only application code or seed.
- **No accidental tenant context:** Platform routes must **not** use the active-dealership cookie (or any client-supplied tenant) for authorization. For platform-scoped operations (list dealerships, create dealership, cross-tenant audit), the server uses only the authenticated user id and the `PlatformAdmin` lookup. When a platform admin **impersonates**, the target `dealershipId` is taken from the **request body** of the impersonation endpoint only (validated and then stored in cookie by the server); tenant routes later read the cookie and, for platform admins, allow that dealership as context without requiring membership. So: platform admin can operate with no dealership (platform UI only) or with an impersonated dealership (cookie set explicitly via impersonate endpoint).

### 1.2 PlatformAdmin abilities (contract only)

- **Create Dealership + default Location**
  - **Input:** Name (required, length limits), optional slug (unique globally), flag to create default location (default true).
  - **Validation:** Name non-empty, slug format/unique if provided. No PII.
  - **Behavior:** Create Dealership row; if default location requested, create one DealershipLocation (e.g. name "Main", isPrimary true). Audit: `platform.dealership.created` with dealership id and optional location id in metadata (no PII).

- **Invite / link Owner membership to a dealership (by email)**
  - **Flow:** Two supported patterns: (1) **Invite** — create a Membership row with `invitedAt` set, `joinedAt` null; optionally send email (out of scope for this spec); invite may have an **expiry** (e.g. `inviteExpiresAt` on Membership or a separate Invite table). (2) **Direct link** — if the user (Profile) already exists and optionally already signed in, platform admin can create Membership with role = Owner (e.g. "Owner" system role) and set `joinedAt` to now; idempotent by (dealershipId, userId): if active membership exists, return 200 with existing membership.
  - **Idempotency:** For "add member by email + roleId": if a Profile exists for that email and an active (non-disabled) Membership for that (dealershipId, userId) already exists, return success with existing membership (no duplicate). If Profile does not exist, either create Profile (if desired by product) or return 404/400 with clear message (spec to choose one).
  - **Expiry:** If invite expiry is implemented, document: expiry field, how expired invites are treated (e.g. cannot accept; platform can resend or create a new invite). Cleanup of expired invites (cron or on-read) is optional.

- **Disable / enable Dealership (isActive)**
  - **Disable:** Set `Dealership.isActive = false`. Behavior when disabled: (1) **Block tenant login/API for non–platform users:** When resolving active dealership from cookie, if the dealership is inactive, clear the cookie and treat as no context (tenant routes return FORBIDDEN). (2) **Optionally** soft-disable all Memberships for that dealership (set `disabledAt`/`disabledBy`) so users cannot switch back into it. (3) **Platform admins** can still list and view the dealership, and may impersonate it (for support); impersonation does not require membership.
  - **Enable:** Set `Dealership.isActive = true`. Does **not** automatically re-enable memberships; those stay disabled until explicitly re-enabled by platform or tenant admin if such an action is in scope.
  - **Audit:** `platform.dealership.disabled` / `platform.dealership.enabled` with dealership id.

- **View audit logs across dealerships**
  - **Filters:** dealershipId (optional), actorId (optional), action (optional, e.g. prefix or exact), entity (optional), date range (from/to), and pagination (limit, offset or cursor).
  - **Pagination:** Required. Limit cap (e.g. 1–100), offset or cursor; response includes total or next cursor per project standards.
  - **Retention:** Document policy (e.g. retain 90 days, 1 year); enforcement (e.g. cron job or TTL) is implementation.
  - **Data visible:** Only fields already present on AuditLog (e.g. id, dealershipId, actorId, action, entity, entityId, metadata, ip, userAgent, createdAt). **No PII in logs** per project rules: metadata must be sanitized (no SSN, DOB, email, phone in metadata); if any audit writer currently adds PII, it must be removed or redacted for cross-tenant view.

- **Impersonation (optional)**
  - **Timebox:** Optional max duration (e.g. 4 hours); after that, next request clears impersonation (clear cookie and optionally redirect to /platform). Implemented either by storing impersonation start time in cookie or server-side session and comparing on each request, or by a short-lived cookie TTL.
  - **Audit:** Every impersonation start (and optionally end) is audited: action e.g. `platform.impersonate.start` / `platform.impersonate.end`, metadata: `{ dealershipId, targetDealershipId }`, actorId = platform admin. No PII in metadata.
  - **UI banner:** When in impersonation mode, show a persistent banner (e.g. "Viewing as [Dealership Name] — Exit") so the user cannot forget they are impersonating.
  - **Revoke:** "Exit impersonation" clears the active-dealership cookie (and any impersonation-specific cookie/session) and redirects to /platform or home; audit `platform.impersonate.end` if not already logged on timebox expiry.

---

## 2. RBAC

### 2.1 Permissions

- **Permission codes (exact):** `platform.read`, `platform.write`, `platform.impersonate`. Stored in the global Permission table (seed). They are **not** assigned to any dealership role; they are used only to gate platform routes.
- **Where checked:** (1) **Route handler (required):** Before any platform action, the server must verify the user is a platform admin (e.g. `requirePlatformAdmin(userId)` which checks the `PlatformAdmin` table). (2) **Optional fine-grained:** After that, the route may additionally check: `platform.read` for GET list/detail (dealerships, members, audit); `platform.write` for create/update/disable/enable and member add/patch; `platform.impersonate` for POST impersonate and "exit impersonation". If the project prefers a single gate, then `requirePlatformAdmin` is sufficient and all three permissions can be implied for platform admins; the spec only defines the codes and where they *could* be checked (middleware or route handler, never client-only).

### 2.2 Route safety

- **Platform routes** under `/api/platform/*` **MUST NOT** accept `dealershipId` (or any tenant identifier) from the client for the purpose of **tenant data authorization**. They may accept:
  - **Path params:** e.g. `dealershipId` in `/api/platform/dealerships/[id]` or `[id]` as the dealership being managed — this is the **target** of the platform action (which dealership to view, disable, or add a member to), not the "current tenant" used for tenant-scoped data.
  - **Body for impersonation:** `dealershipId` in POST `/api/platform/impersonate` is the target to impersonate; server validates that the dealership exists (and optionally is active) and that the user has platform admin + `platform.impersonate`, then sets the cookie.
- **How target dealership is derived:** For list (e.g. list dealerships), no dealership in path. For single-dealership operations (get, patch, disable, enable, list members, add member, patch membership), `dealershipId` is taken **only** from the **path** (e.g. `[id]`). For impersonation, from the **request body** (validated UUID). Never from query, cookie, or header for "which dealership am I acting on" in platform routes; cookie is only **set** by the impersonate endpoint.

### 2.3 Tenant admin isolation

- **Tenant (dealership) admins** must **never** access platform endpoints. Distinction:
  - **Route prefix:** All platform routes live under `/api/platform/*`. Middleware or a shared wrapper can enforce: if path matches `/api/platform`, then require platform admin (DB check); otherwise continue with tenant auth.
  - **Role check before handler:** Before running any handler under `/api/platform/*`, call `requirePlatformAdmin(userId)` (or equivalent). Users who have only tenant roles (e.g. Admin, Manager) and no row in `PlatformAdmin` get **403 FORBIDDEN**; no tenant permission (e.g. `admin.roles.write`) grants access to platform routes.
- **No admin bypass:** There is no "if tenant admin then allow platform" — only the `PlatformAdmin` table (or equivalent) grants platform access.

---

## 3. API Contract

### 3.1 Route table

All routes require platform admin (and optionally the permission codes below). Pagination for all list endpoints (limit/offset or cursor; limit min/max and default as in project standards). Success/error shape: `{ data?, meta? }` and `{ error: { code, message, details? } }`.

| Method | Path | Purpose | Input | Output (high level) |
|--------|------|---------|--------|---------------------|
| GET | `/api/platform/dealerships` | List dealerships | Query: `limit`, `offset`, `search?` | `{ data: DealershipSummary[], meta: { total, limit, offset } }` |
| POST | `/api/platform/dealerships` | Create dealership + optional default location | Body: `name`, `slug?`, `createDefaultLocation?` | 201 `{ data: Dealership }` or error |
| GET | `/api/platform/dealerships/[id]` | Get one dealership | Path: `id` (dealershipId) | `{ data: DealershipDetail }` or 404 |
| PATCH | `/api/platform/dealerships/[id]` | Update dealership | Path: `id`; Body: `name?`, `slug?`, `isActive?` | `{ data: Dealership }` or error |
| POST | `/api/platform/dealerships/[id]/disable` | Set isActive=false; optionally disable memberships | Path: `id` | 204 or error |
| POST | `/api/platform/dealerships/[id]/enable` | Set isActive=true | Path: `id` | 204 or error |
| GET | `/api/platform/dealerships/[id]/members` | List members (include disabled) | Path: `id`; Query: `limit`, `offset` | `{ data: MembershipSummary[], meta }` |
| POST | `/api/platform/dealerships/[id]/members` | Add member (invite or direct link by email + roleId) | Path: `id`; Body: `email`, `roleId` | 201 `{ data: Membership }` or idempotent 200 with existing |
| PATCH | `/api/platform/dealerships/[id]/members/[membershipId]` | Update role or disabled | Path: `id`, `membershipId`; Body: `roleId?`, `disabled?` | `{ data: Membership }` or error |
| GET | `/api/platform/dealerships/[id]/roles` | List roles for dropdown | Path: `id` | `{ data: { id, name }[] }` |
| GET | `/api/platform/audit` | Cross-tenant audit list | Query: `dealershipId?`, `actorId?`, `action?`, `entity?`, `from?`, `to?`, `limit`, `offset` | `{ data: AuditEntry[], meta }` |
| POST | `/api/platform/impersonate` | Start impersonation (set active-dealership cookie) | Body: `dealershipId` | 204 or error |
| POST | `/api/platform/impersonate/end` | End impersonation (clear cookie) | — | 204 or error |

- **Dealership scoping:** For list/get/patch/disable/enable/members/roles, `dealershipId` is **only** from the path `[id]`. For audit, `dealershipId` is an optional **filter** (query param), not the auth context. For impersonate, `dealershipId` is from body only. Never from client-supplied header or cookie for authorization.

---

## 4. UI Contract

### 4.1 New area: `/platform`

- **Route layout:** All platform UI under `/platform` (e.g. `/platform`, `/platform/dealerships`, `/platform/dealerships/[id]`). Layout checks session: if user is not platform admin, render "You don't have access to platform admin" and do not call any `/api/platform/*` endpoints.
- **Dealer list:** Page at `/platform/dealerships`. Columns: name, slug, status (active/inactive), members count, locations count, created (date). Filters: search (name/slug), status (active/inactive). Pagination: limit/offset with controls. Actions per row or toolbar: Create dealership, Disable/Enable, Impersonate (with confirmation). No dealershipId from client for API calls; list uses GET `/api/platform/dealerships` with query params only.
- **Create-dealer wizard:** Multi-step or single form: Step 1 — dealership name, optional slug; Step 2 (optional) — create default location (yes/no, default yes). Submit calls POST `/api/platform/dealerships`. On success, redirect to dealer detail or list.
- **Dealer detail:** Page at `/platform/dealerships/[id]`. Tabs or sections: (1) **Info** — name, slug, isActive, createdAt; edit (PATCH). (2) **Locations** — list locations (read-only or link to tenant dealership settings if desired). (3) **Members** — list (GET members), add member (email + role), patch role/disabled. (4) **Audit snippet** — recent audit entries for this dealership (call GET `/api/platform/audit?dealershipId=<id>&limit=…`) or link to full audit with filter. (5) **Enable/Disable** — buttons with confirmation; after disable, show banner that dealership is inactive.
- **Impersonation:** When impersonating, show persistent banner: "Viewing as [Dealership Name]" with "Exit" button that calls POST `/api/platform/impersonate/end` and redirects to `/platform`.

### 4.2 AppShell / nav

- **When to show "Platform" nav item:** Only when the user has platform admin (e.g. `session.platformAdmin.isAdmin === true`). If fine-grained permissions are used, show when user has `platform.read` or `platform.write` (or both). Do not show for tenant-only admins.

---

## 5. Security & QA

### 5.1 Tests (spec only)

- **Tenant isolation (platform):** Platform user cannot be forced into another tenant via client. Tests: (1) Request to a tenant-scoped endpoint (e.g. GET `/api/customers`) with a forged or modified cookie/header that references a different dealership must not return that dealership's data when the user is a platform admin; the tenant route must use the server-resolved context (cookie validated by server). (2) Platform routes: sending a different `dealershipId` in body for impersonate must only set cookie for that id after server validates the user is platform admin and the dealership exists; no other platform route may accept dealershipId from body for authorization.
- **RBAC:** (1) User without platform admin gets 403 on every `/api/platform/*` route. (2) If permission codes are enforced: user with platform admin but without `platform.impersonate` gets 403 on POST impersonate; without `platform.write` gets 403 on create/patch/disable/enable and add/patch member. (3) Tenant admin (no PlatformAdmin row) gets 403 on all platform routes.
- **Impersonation audit:** Every impersonation start (and end) writes an audit entry; test that calling impersonate and impersonate/end produces the expected audit actions and metadata (no PII).
- **Cross-tenant audit:** Only platform admins can call GET `/api/platform/audit`; tenant users get 403. Response does not include PII in metadata; filters (dealershipId, actorId, action, entity, date range) and pagination work as specified.
- **No money/payment in platform:** Platform admin actions do not touch payment or deal totals; ensure no route under `/api/platform/*` modifies finance, payments, or inventory totals. Existing module invariants (e.g. deal totals, inventory) are unchanged by platform actions (disable/enable only affects access, not data).

### 5.2 Docs

- **docs/modules/platform-admin.md:** Update or create to include: scope (who is a platform admin, how granted), personas (platform admin vs tenant admin), flows (create dealer, invite/link owner, disable/enable, audit view, impersonation), API summary (route table), RBAC matrix (platform.read / platform.write / platform.impersonate and which routes require which), and safety (no client dealershipId for auth, tenant isolation).
- **docs/SECURITY.md:** Update with: platform admin model (DB-backed, no claim-only auth), impersonation policy (timebox, audit, UI banner, revoke), and audit requirements for platform actions (no PII in audit metadata).
- **MANUAL-SMOKE-TEST-CHECKLIST.md:** New section "Platform Admin" with checklists: create dealer (with default location), invite/link owner (by email), disable dealership (verify tenant cannot access), enable dealership, view cross-tenant audit (filters, pagination), impersonate (banner, exit), and deployment smoke steps (health, login, create dealership, invite owner, list dealers, disable/enable, audit).

---

## 6. Deployment Checklist Structure (doc outline for DEPLOYMENT-PROD.md)

The following is the **structure and section list** for `docs/DEPLOYMENT-PROD.md`. Content can be bullet or placeholder level.

1. **Overview**
   - Purpose of the document (production deployment for Vercel + Supabase).
   - Prerequisites (Supabase project, Vercel project, GitHub repo, secrets).

2. **Vercel**
   - Env vars list (with descriptions; required vs optional):
     - Required: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COOKIE_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, etc.
     - Optional: `PLATFORM_ADMIN_EMAILS` (for seed bootstrap of platform admins), `ALLOW_BOOTSTRAP_LINK`, `TEST_DATABASE_URL`, `SKIP_INTEGRATION_TESTS`, `NHTSA_API_URL`, etc.
   - Build and deploy steps (e.g. connect Git, set env, deploy).

3. **Supabase**
   - Project env / config: `DATABASE_URL` (direct and pooler), Supabase URL and anon/service keys.
   - Auth: Redirect URLs, Site URL, JWT/custom claims (if used for platform_admin hint only; authz remains server-side).
   - RLS considerations: Platform tables (e.g. `platform_admin`, `audit_log` for cross-tenant read) — whether RLS is used and how (e.g. service role for app, RLS for direct DB access if any).

4. **Prisma**
   - Migrations: Deploy order (e.g. run `prisma migrate deploy` in CI or manually before/after deploy).
   - Preview vs production: Use production DB URL for `migrate deploy`; no `migrate dev` or `db push` in production.

5. **Seed strategy**
   - Dev: Full seed (permissions, roles, sample dealerships, optional platform admin from allowlist).
   - Prod: What to seed (e.g. permissions only; no sample data). Platform admin bootstrap: use `PLATFORM_ADMIN_EMAILS` in seed or a one-off script to create initial platform admin(s); document that no default platform admin is created if allowlist is empty.

6. **Supabase Storage**
   - Buckets and policies: e.g. documents, uploads; RLS or policy so that app (service role or authenticated user) can read/write only within tenant-scoped paths (e.g. `dealership_id/...`). No public read for private buckets.

7. **Cron / worker**
   - CRM jobs (if any): How they run (Vercel Cron, Supabase Edge, or external worker). Env for workers: `CRON_SECRET`, `DATABASE_URL` (or same as app). No client-supplied dealership; job claims by dealership from DB.

8. **Post-deploy smoke**
   - Health: GET `/api/health` returns 200 and `db: "ok"`.
   - Login: Auth flow (password or magic link) and redirect.
   - Platform admin (if applicable): Create dealership, invite owner (by email), list dealers, disable/enable dealership, view audit.
   - Core flows: One tenant flow (e.g. list customers, create deal, upload document) to confirm tenant context and RBAC.

---

**End of Step 1 Spec.** Step 2 (Backend), Step 3 (Frontend), and Step 4 (Security & QA) implement from this spec.
