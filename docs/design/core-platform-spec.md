# Core Platform Foundation — Full SPEC (Step 1/4)

**Module:** core-platform  
**Scope:** Tenancy, RBAC, audit, file metadata, auth integration. No implementation code in this step.

References: AGENT_SPEC.md, DONE.md, MODULES.md, DMS Non-Negotiables, Coding Standards.

---

## 1) Data Model (Prisma-Ready)

### 1.1 Table Summary

| Table | Tenant-scoped? | Soft delete? | Notes |
|-------|----------------|--------------|--------|
| Dealership | No (root tenant) | No | Top-level tenant entity |
| DealershipLocation | Yes | No | Child of Dealership |
| Profile | No | No | id = Supabase auth.users.id |
| Permission | No (global) | No | Seed-only, read by all |
| Role | Yes | Yes | Per-dealership roles |
| RolePermission | N/A (join) | No | Role ↔ Permission |
| Membership | Yes | Yes (disabled_at) | User ↔ Dealership ↔ Role |
| AuditLog | Yes | No | Append-only |
| FileObject | Yes | Yes | Metadata only; blob in Supabase Storage |

---

### 1.2 Dealership

- **Purpose:** Root tenant. One row per customer (dealer) organization.
- **Fields:**
  - `id` — UUID, PK
  - `name` — String, required
  - `slug` — String?, unique (for URLs/subdomains if needed)
  - `settings` — Json? (timezone, currency, feature flags, etc.)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Indexes:**
  - Unique on `slug` (if present) — lookups by slug.
- **No** `dealership_id` (this is the tenant root).

---

### 1.3 DealershipLocation

- **Purpose:** Physical or logical locations under a dealership (e.g. main lot, secondary lot).
- **Fields:**
  - `id` — UUID, PK
  - `dealershipId` — UUID, FK → Dealership
  - `name` — String, required
  - `addressLine1` — String?
  - `addressLine2` — String?
  - `city` — String?
  - `region` — String?
  - `postalCode` — String?
  - `country` — String?
  - `isPrimary` — Boolean, default false (one primary per dealership)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Indexes:**
  - `dealershipId` — tenant scoping and list-by-dealership.
  - Unique `(dealershipId, name)` — no duplicate location names per dealer.
- **Constraint:** At most one location per dealership with `isPrimary = true` (enforce in app or partial unique index).

---

### 1.4 Profile

- **Purpose:** Extended user profile; id matches Supabase `auth.users.id`.
- **Fields:**
  - `id` — UUID, PK (same as Supabase user id)
  - `email` — String, required, unique
  - `fullName` — String?
  - `avatarUrl` — String?
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Indexes:**
  - Unique on `email` — lookup by email, invite flows.
- **No** `dealership_id` — user can belong to many dealerships via Membership.

---

### 1.5 Permission

- **Purpose:** Global permission catalog; seed-only, no tenant.
- **Fields:**
  - `id` — UUID, PK
  - `key` — String, unique (e.g. `inventory.read`, `admin.roles.write`)
  - `description` — String?
  - `module` — String? (e.g. `inventory`, `admin`) for grouping
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Indexes:**
  - Unique on `key` — no duplicates; lookup by key for RBAC.
  - `module` — list permissions by module for admin UI.

---

### 1.6 Role

- **Purpose:** Named set of permissions per dealership. Default roles (Owner, Admin, Sales, Finance) + custom.
- **Fields:**
  - `id` — UUID, PK
  - `dealershipId` — UUID, FK → Dealership
  - `name` — String, required (e.g. "Sales", "Custom Manager")
  - `isSystem` — Boolean, default false (system roles are seeded, not user-deletable)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime?
  - `deletedBy` — UUID? (FK → Profile)
- **Indexes:**
  - `dealershipId` — tenant scoping; list roles by dealership.
  - `(dealershipId, name)` unique where deletedAt is null — no duplicate role names per dealer (partial unique or app-level).
- **Soft delete:** Use `deletedAt`/`deletedBy`; exclude from role lists and assignment.

---

### 1.7 RolePermission

- **Purpose:** Many-to-many: Role ↔ Permission.
- **Fields:**
  - `roleId` — UUID, FK → Role
  - `permissionId` — UUID, FK → Permission
  - `createdAt` — DateTime (optional, for audit)
- **Constraints:**
  - Composite PK `(roleId, permissionId)` — no duplicate assignments; efficient join.
- **Indexes:**
  - Reverse lookup: index on `permissionId` — “which roles have this permission” (optional, if needed for admin UI).

---

### 1.8 Membership

- **Purpose:** User ↔ Dealership ↔ Role. One membership per (user, dealership); “active dealership” is one of these.
- **Fields:**
  - `id` — UUID, PK
  - `dealershipId` — UUID, FK → Dealership
  - `userId` — UUID, FK → Profile (Supabase user id)
  - `roleId` — UUID, FK → Role
  - `invitedBy` — UUID? (FK → Profile)
  - `invitedAt` — DateTime?
  - `joinedAt` — DateTime?
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `disabledAt` — DateTime?
  - `disabledBy` — UUID? (FK → Profile)
- **Indexes:**
  - `dealershipId` — list members by dealership; tenant scoping.
  - `userId` — list memberships for current user (switch dealership).
  - Unique `(dealershipId, userId)` where disabledAt is null — one active membership per user per dealership.
- **Soft “disable”:** Use `disabledAt`/`disabledBy`; disabled members cannot sign in to that dealership.

---

### 1.9 AuditLog

- **Purpose:** Append-only trail for critical actions and sensitive reads.
- **Fields:**
  - `id` — UUID, PK
  - `dealershipId` — UUID, FK → Dealership (nullable only for system-level events if ever needed)
  - `actorId` — UUID? (FK → Profile)
  - `action` — String (e.g. `membership.role_changed`, `file.uploaded`, `file.accessed`)
  - `entity` — String (e.g. `Membership`, `FileObject`, `Role`)
  - `entityId` — UUID?
  - `metadata` — Json? (before/after, ids, no PII)
  - `ip` — String?
  - `userAgent` — String?
  - `createdAt` — DateTime
- **Indexes:**
  - `dealershipId` — tenant scoping; list audit by dealership.
  - `(dealershipId, createdAt)` — time-bounded list and filters.
  - `(dealershipId, entity, entityId)` — find audit for a specific entity.
  - `actorId` — optional: “what did this user do”.
- **No** updates or deletes; append-only.

---

### 1.10 FileObject

- **Purpose:** Metadata for files stored in Supabase Storage; no blob in DB.
- **Fields:**
  - `id` — UUID, PK
  - `dealershipId` — UUID, FK → Dealership
  - `bucket` — String, required (e.g. `deal-documents`, `inventory-photos`)
  - `path` — String, required (storage path)
  - `filename` — String, required (original name)
  - `mimeType` — String, required
  - `sizeBytes` — Int, required
  - `checksumSha256` — String? (optional integrity check)
  - `uploadedBy` — UUID, FK → Profile
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime?
  - `deletedBy` — UUID? (FK → Profile)
- **Indexes:**
  - `dealershipId` — tenant scoping; list files by dealership.
  - `(dealershipId, createdAt)` — list by time.
  - Unique `(bucket, path)` — prevent duplicate storage paths (optional if path is always generated uniquely).
- **Soft delete:** Use `deletedAt`/`deletedBy`; exclude from lists; retain for retention/audit.

---

## 2) RBAC Permission Catalog

### 2.1 Permission Keys (Grouped by Module)

- **admin**
  - `admin.dealership.read` — View dealership and location settings
  - `admin.dealership.write` — Update dealership and locations
  - `admin.memberships.read` — List members, view membership details
  - `admin.memberships.write` — Invite, update role, disable member
  - `admin.roles.read` — List roles and their permissions
  - `admin.roles.write` — Create/update/delete (non-system) roles, assign permissions
  - `admin.audit.read` — List and filter audit logs
  - `admin.permissions.read` — List global permission catalog (for role builder)

- **inventory**
  - `inventory.read` — View vehicles and inventory data
  - `inventory.write` — Create/update/delete vehicles, manage photos

- **customers**
  - `customers.read` — View customer profiles and activity
  - `customers.write` — Create/update customers, notes, tasks

- **deals**
  - `deals.read` — View deals and deal structure
  - `deals.write` — Create/update deals, fees, trade-ins

- **documents**
  - `documents.read` — List file metadata, get signed URLs (sensitive read — audit)
  - `documents.write` — Upload, delete files; manage metadata

- **finance**
  - `finance.read` — View finance app shell, lender status, stipulations (sensitive — audit)
  - `finance.write` — Update finance app, submit to lender, update status

- **reports**
  - `reports.read` — View sales, inventory, gross, finance penetration reports
  - `reports.export` — Export CSV/reports

- **bhph**
  - `bhph.read` — View BHPH contracts, ledger, delinquency
  - `bhph.write` — Manage contracts, payments, ledger

- **integrations.quickbooks**
  - `integrations.quickbooks.read` — View QuickBooks mapping and sync status
  - `integrations.quickbooks.write` — Configure mapping, trigger sync

*(Additional modules — crm-pro, website, syndication, valuations, credit-bureau — get permissions when those modules are built; same pattern: `module.read` / `module.write` or finer as needed.)*

---

### 2.2 Default Roles and Permissions

- **Owner**
  - All `admin.*`
  - All `inventory.*`, `customers.*`, `deals.*`, `documents.*`, `finance.*`, `reports.*`
  - All `bhph.*`, `integrations.quickbooks.*`
  - Effect: full access to dealership; typically one per dealership (or few).

- **Admin**
  - Same as Owner except: no `admin.roles.write` (optional: allow or deny role create/delete; spec: allow Admin to manage roles but not remove last Owner).
  - Can be restricted further per org; above is baseline.

- **Sales**
  - `inventory.read`, `inventory.write`
  - `customers.read`, `customers.write`
  - `deals.read`, `deals.write`
  - `documents.read`, `documents.write`
  - `finance.read` (view only)
  - `reports.read`
  - No admin.*, no bhph.write, no integrations.

- **Finance**
  - `inventory.read`
  - `customers.read`
  - `deals.read`, `deals.write`
  - `documents.read`, `documents.write`
  - `finance.read`, `finance.write`
  - `reports.read`, `reports.export`
  - No admin.*, no inventory.write, no customers.write (or add if needed for your workflow).

- **BHPH Manager** (optional)
  - `inventory.read`, `customers.read`, `deals.read`, `documents.read`, `finance.read`
  - `bhph.read`, `bhph.write`
  - `reports.read`, `reports.export`
  - No admin.*, no inventory/customers/deals write.

Permission assignment is via RolePermission; default roles are seeded with the above sets. Custom roles get permissions via admin.roles.write.

---

## 3) API Contract List (Core-Platform Only)

All responses use standard error shape when failing: `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, INTERNAL.

Pagination: `limit` (default 25, max 100), `offset` (0-based). Response includes `data` and `meta`: `{ total, limit, offset }` (or cursor-based `nextCursor` if chosen).

---

### 3.1 Auth / Session

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/auth/session | Return current user + active dealership + permissions | (authenticated) | No |
| POST | /api/auth/logout | Log out (clear session/cookies) | (authenticated) | No |

- **GET /api/auth/session**
  - Params: none. Query: none. Body: none.
  - Response: `{ user: { id, email, fullName?, avatarUrl? }, activeDealership: { id, name } | null, permissions: string[] }` or 401.
  - Permission: any valid session; no extra permission key.
  - Audit: not required.

- **POST /api/auth/logout**
  - Body: none.
  - Response: 204 or 200.
  - Permission: any authenticated user.
  - Audit: not required.

---

### 3.2 Admin — Dealership

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/admin/dealership | Get current dealership + locations | admin.dealership.read | No |
| PATCH | /api/admin/dealership | Update dealership (name, settings) | admin.dealership.write | Yes (dealership.updated) |
| GET | /api/admin/dealership/locations | List locations (paginated) | admin.dealership.read | No |
| POST | /api/admin/dealership/locations | Create location | admin.dealership.write | Yes (location.created) |
| PATCH | /api/admin/dealership/locations/[id] | Update location | admin.dealership.write | Yes (location.updated) |

- **GET /api/admin/dealership**
  - Response: `{ dealership: { id, name, slug?, settings?, createdAt, updatedAt }, locations?: Location[] }`.
  - Permission: `admin.dealership.read`.
  - Tenant: active dealership from session; no client-supplied dealership id.

- **PATCH /api/admin/dealership**
  - Body (Zod): `{ name?: string, slug?: string | null, settings?: object }`.
  - Response: updated dealership object.
  - Permission: `admin.dealership.write`.
  - Audit: entity Dealership, action `dealership.updated`, metadata safe diff.

- **GET /api/admin/dealership/locations**
  - Query: `limit`, `offset` (pagination).
  - Response: `{ data: Location[], meta: { total, limit, offset } }`.
  - Permission: `admin.dealership.read`.

- **POST /api/admin/dealership/locations**
  - Body (Zod): `{ name, addressLine1?, addressLine2?, city?, region?, postalCode?, country?, isPrimary?: boolean }`.
  - Response: created Location.
  - Permission: `admin.dealership.write`. Audit: `location.created`.

- **PATCH /api/admin/dealership/locations/[id]**
  - Params: `id` (UUID). Body: same shape as create, all optional.
  - Response: updated Location.
  - Permission: `admin.dealership.write`. Audit: `location.updated`.

---

### 3.3 Admin — Memberships

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/admin/memberships | List members (paginated, filterable) | admin.memberships.read | No |
| POST | /api/admin/memberships | Invite member (email + roleId) | admin.memberships.write | Yes (membership.created/invited) |
| GET | /api/admin/memberships/[id] | Get membership by id | admin.memberships.read | No |
| PATCH | /api/admin/memberships/[id] | Update role or disable | admin.memberships.write | Yes (membership.updated / disabled) |
| DELETE | /api/admin/memberships/[id] | Soft-disable membership | admin.memberships.write | Yes (membership.disabled) |

- **GET /api/admin/memberships**
  - Query: `limit`, `offset`, `roleId?` (UUID), `status?: 'active'|'disabled'`.
  - Response: `{ data: Membership[], meta: { total, limit, offset } }`. Membership includes user (id, email, fullName), role (id, name), invitedAt, joinedAt, disabledAt.
  - Permission: `admin.memberships.read`.
  - Tenant: active dealership only.

- **POST /api/admin/memberships**
  - Body (Zod): `{ email: string, roleId: UUID }`.
  - Response: created Membership (or existing if already member). Invite flow: create membership with invitedAt set; joinedAt when user first signs in (or link existing user).
  - Permission: `admin.memberships.write`.
  - Audit: `membership.created` or `membership.invited`.

- **GET /api/admin/memberships/[id]**
  - Params: `id` (UUID).
  - Response: single Membership with user and role.
  - Permission: `admin.memberships.read`. Tenant: membership must belong to active dealership.

- **PATCH /api/admin/memberships/[id]**
  - Params: `id`. Body (Zod): `{ roleId?: UUID, disabled?: boolean }`.
  - Response: updated Membership.
  - Permission: `admin.memberships.write`.
  - Audit: `membership.role_changed` or `membership.disabled` (with metadata: roleId, disabledAt).

- **DELETE /api/admin/memberships/[id]**
  - Params: `id`.
  - Response: 204 or 200. Semantics: set disabledAt (soft disable).
  - Permission: `admin.memberships.write`.
  - Audit: `membership.disabled`.

---

### 3.4 Admin — Roles

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/admin/roles | List roles (paginated) | admin.roles.read | No |
| POST | /api/admin/roles | Create custom role | admin.roles.write | Yes (role.created) |
| GET | /api/admin/roles/[id] | Get role + permission ids | admin.roles.read | No |
| PATCH | /api/admin/roles/[id] | Update name or permissions | admin.roles.write | Yes (role.updated) |
| DELETE | /api/admin/roles/[id] | Soft delete role | admin.roles.write | Yes (role.deleted) |

- **GET /api/admin/roles**
  - Query: `limit`, `offset`, `includeSystem?: boolean`.
  - Response: `{ data: Role[], meta }`. Role: id, dealershipId, name, isSystem, permissionIds or permissions array.
  - Permission: `admin.roles.read`.

- **POST /api/admin/roles**
  - Body (Zod): `{ name: string, permissionIds: UUID[] }`.
  - Response: created Role (isSystem: false).
  - Permission: `admin.roles.write`. Audit: `role.created`.

- **GET /api/admin/roles/[id]**
  - Params: `id`.
  - Response: Role with permissions (keys or full Permission objects).
  - Permission: `admin.roles.read`.

- **PATCH /api/admin/roles/[id]**
  - Params: `id`. Body (Zod): `{ name?: string, permissionIds?: UUID[] }`. Cannot change isSystem.
  - Response: updated Role.
  - Permission: `admin.roles.write`. Audit: `role.updated` (safe metadata: name, permissionIds).

- **DELETE /api/admin/roles/[id]**
  - Params: `id`. Only non-system roles; reject if in use (or reassign members first).
  - Response: 204. Audit: `role.deleted`.

---

### 3.5 Admin — Permissions (Catalog)

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/admin/permissions | List all permissions (for role builder) | admin.permissions.read | No |

- **GET /api/admin/permissions**
  - Query: `module?` (filter by module), optional `limit`/`offset` (or return all; catalog is small).
  - Response: `{ data: Permission[] }` (id, key, description, module).
  - Permission: `admin.permissions.read`.

---

### 3.6 Audit

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/audit | List audit logs (paginated, filterable) | admin.audit.read | No (reading audit is not re-audited) |

- **GET /api/audit**
  - Query: `limit`, `offset`, `entity?`, `entityId?`, `actorId?`, `action?`, `from?`, `to?` (ISO date).
  - Response: `{ data: AuditLog[], meta: { total, limit, offset } }`.
  - Permission: `admin.audit.read`.
  - Tenant: active dealership only; all results scoped to that dealership.

---

### 3.7 Files

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| POST | /api/files/upload | Upload file to Storage, create FileObject | documents.write | Yes (file.uploaded) |
| GET | /api/files/signed-url | Get signed URL for download | documents.read | Yes (file.accessed, sensitive read) |

- **POST /api/files/upload**
  - Body: multipart/form-data with `file` (file) and optional `bucket?` (default e.g. `deal-documents`), `pathPrefix?` (optional path prefix). Zod: validate `bucket` allowlist, `pathPrefix` format.
  - Validation: mime type allowlist, max size (e.g. 25MB). Store metadata in FileObject; blob in Supabase Storage.
  - Response: `{ id, bucket, path, filename, mimeType, sizeBytes, createdAt }`.
  - Permission: `documents.write`.
  - Tenant: active dealership; FileObject.dealershipId = active dealership.
  - Audit: `file.uploaded`, entity FileObject, entityId, metadata (no PII).

- **GET /api/files/signed-url**
  - Query: `fileId` (UUID) or `bucket` + `path` (if you support path-based lookup). Prefer fileId for tenant safety.
  - Response: `{ url: string, expiresAt: string }` (signed URL, short TTL).
  - Permission: `documents.read`.
  - Tenant: FileObject must belong to active dealership.
  - Audit: `file.accessed`, entity FileObject, entityId (sensitive read).

---

## 4) Tenant & Auth Resolution Rules

### 4.1 Get Current User from Supabase Session

- Read session server-side from cookies (Supabase client created from cookies in App Router).
- Session contains `user.id` (UUID). This is the same as `Profile.id`.
- If no session or session invalid → return 401 UNAUTHORIZED; do not use any client-sent user id.
- Load or create Profile by `user.id`; use Profile for display (email, fullName). Never trust client for identity.

### 4.2 Resolve “Active Dealership”

- User can have multiple memberships (one per dealership). “Active dealership” is the one used for tenant scoping and permission resolution.
- Strategy options (choose one and document):
  - **A) Last-visited:** Store `activeDealershipId` in session or in a small table/keyed by userId (e.g. user_preferences or session claim). On switch, validate membership then update.
  - **B) Header/cookie per request:** Client sends `X-Dealership-Id` or cookie; server validates that the current user has an active membership for that dealership, then uses it. Reject if not member.
- Recommendation: store in server session or encrypted cookie (e.g. `activeDealershipId`). On every request: validate that membership exists and is not disabled; then resolve permissions for that (userId, dealershipId, roleId).
- Never use client-sent dealership id without validation: always ensure (userId, dealershipId) has an active Membership row (disabledAt is null).

### 4.3 Prevent Client-Side Dealership Spoofing

- Never take `dealership_id` (or equivalent) from request body/query for authorization or tenant scoping. Only use:
  - Server-derived `user_id` from Supabase session, and
  - Server-resolved `active_dealership_id` from validated membership (stored in session/cookie and re-validated per request, or from header after membership check).
- For list/detail routes, always filter by this server-side `active_dealership_id`. For create/update, always set `dealershipId` to this value in the DB layer.

### 4.4 Enforce Tenant Scoping for Every Query

- In DB layer: every function that reads or writes business data receives `dealershipId: string` (UUID) and adds `where: { dealershipId }` (or equivalent) to Prisma queries.
- Route handlers never pass client-supplied dealership id into the DB layer; they pass only the active dealership id from auth resolution.
- Helpers: e.g. `withTenant(dealershipId, () => prisma.dealershipLocation.findMany({ where: { dealershipId } }))` or explicit param in every db call. No raw queries that omit dealershipId.

---

## 5) Events (Internal)

Use a lightweight in-process emitter (e.g. `/lib/events.ts`: `emit(name, payload)`, `register(name, handler)`). Payloads are typed by event name. Idempotency: handlers should be idempotent where possible (e.g. by entity id + action).

| Event | When | Payload | Idempotency note |
|-------|------|---------|-------------------|
| membership.created | After Membership row created (invite or join) | `{ membershipId, dealershipId, userId, roleId, invitedBy? }` | Handler can key off membershipId |
| membership.updated | After role change or other membership update | `{ membershipId, dealershipId, userId, previousRoleId?, roleId, disabled? }` | Key off membershipId + updatedAt or version |
| membership.disabled | When disabledAt set | `{ membershipId, dealershipId, userId, disabledBy }` | Key off membershipId |
| role.created | After Role created | `{ roleId, dealershipId, name, permissionIds }` | Key off roleId |
| role.updated | After Role name or permissions updated | `{ roleId, dealershipId, name?, permissionIds? }` | Key off roleId |
| role.deleted | After Role soft-deleted | `{ roleId, dealershipId, deletedBy }` | Key off roleId |
| file.uploaded | After FileObject created and blob stored | `{ fileId, dealershipId, bucket, path, uploadedBy }` | Key off fileId |
| file.accessed | When signed URL issued (sensitive read) | `{ fileId, dealershipId, requestedBy }` | Log-only; idempotent per request |
| audit.logged | Optional: when an audit row is written (for cross-module subscribers) | `{ auditLogId, dealershipId, action, entity, entityId, actorId }` | Key off auditLogId |

- **audit.logged** is optional; only needed if other modules need to react to audit entries. Core-platform can write AuditLog directly without emitting.

---

## Implementation Checklist for Backend Engineer

- [ ] Add all Prisma models (Dealership, DealershipLocation, Profile, Permission, Role, RolePermission, Membership, AuditLog, FileObject) with fields and relations as in §1.
- [ ] Add indexes and unique constraints as specified; add partial unique where applicable (e.g. active membership per user/dealership).
- [ ] Create and run migrations; ensure migrations apply cleanly.
- [ ] Implement seed: Permission rows (full catalog §2.1), default Roles per dealership with RolePermission, one demo Dealership + Location, and script or API to link first user as Owner.
- [ ] Implement `/lib` auth helpers: getCurrentUser(), getActiveDealership(), requirePermission(permissionKey), and tenant-scoped db pattern (withTenant or explicit dealershipId in every db call).
- [ ] Implement core-platform db layer under `modules/core-platform/db` for each entity (no raw Prisma in routes).
- [ ] Implement service layer under `modules/core-platform/service`; all business logic and audit writes here.
- [ ] Implement route handlers under `app/api/**` for: auth/session, auth/logout, admin/dealership, admin/dealership/locations, admin/memberships, admin/roles, admin/permissions, audit, files/upload, files/signed-url. Thin handlers: Zod parse → service → respond.
- [ ] Zod: define schemas for every route’s params, query, and body; validate at edge; use standard error shape on failure.
- [ ] Enforce RBAC: every route calls requirePermission with the required key(s) from §3.
- [ ] Enforce tenant scoping: all list/create/update/delete use active dealership from auth; never client-supplied dealership id.
- [ ] Audit: write to AuditLog for all actions marked “Yes” in §3; include actor_id, dealership_id, action, entity, entity_id, metadata (no PII).
- [ ] Files: validate mime and size on upload; store in Supabase Storage; create FileObject with dealershipId; signed URL endpoint with tenant check and file.accessed audit.
- [ ] Rate limiting: apply to auth endpoints and file upload (and optionally audit/files read).
- [ ] Add `/lib/events.ts` and emit events listed in §5 from service layer where appropriate.
- [ ] Tests: tenant isolation (Dealer A cannot read/update Dealer B memberships, roles, audit, files); RBAC (e.g. Sales cannot call admin.roles.write routes); audit (membership role change creates audit row). All pass with `npm test`.
- [ ] Lint and build pass; no TODOs or placeholders.

---

## UI Checklist for Frontend Engineer

- [ ] Use auth/session (GET /api/auth/session) to get user, activeDealership, permissions; show app shell only when session exists; otherwise redirect to login.
- [ ] Implement dealership switcher if user has multiple memberships: call API to switch active dealership (e.g. PATCH /api/auth/session or dedicated switch endpoint) then refetch session.
- [ ] Admin: Dealership — page to view/edit dealership (GET/PATCH /api/admin/dealership); list/create/edit locations using locations endpoints; loading, empty, error states.
- [ ] Admin: Users/Members — list members (GET /api/admin/memberships) with pagination and filters; invite (POST); edit role or disable (PATCH/DELETE); loading, empty, error states.
- [ ] Admin: Roles — list roles (GET /api/admin/roles); create role (POST) with permission picker (GET /api/admin/permissions); edit/delete role (PATCH/DELETE); loading, empty, error states.
- [ ] Admin: Audit — list audit logs (GET /api/audit) with filters (entity, action, date range, actor) and pagination; loading, empty, error states.
- [ ] Files: upload flow (POST /api/files/upload) with mime/size validation on client; download via GET /api/files/signed-url then redirect or open URL; respect documents.read/documents.write permissions.
- [ ] All tables: pagination (limit/offset), sort where specified, column visibility optional; all forms: validation and clear error messages; accessibility: labels, keyboard nav, focus states.
- [ ] Design: Notion-like neutrals, blue accent, shadcn/ui components; consistent with AGENT_SPEC §7.
- [ ] Manual smoke checklist: login, switch dealership (if 2+), edit dealership, add location, invite member, assign role, disable member, create custom role, view audit log, upload file, get signed URL; verify 403 for insufficient permission (e.g. Sales on admin page).
