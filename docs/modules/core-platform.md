# Core Platform Module

## Purpose and scope

- Multi-tenant model (dealerships, locations).
- User profiles (id = Supabase auth user id).
- Memberships (user ↔ dealership ↔ role).
- Roles and permissions (RBAC).
- Audit log (append-only).
- File metadata (Supabase Storage).
- Auth integration (Supabase).

## Routes

| Method | Path | Permission | Audit |
|--------|------|------------|--------|
| GET | /api/auth/session | (authenticated) | No |
| POST | /api/auth/logout | (authenticated) | No |
| PATCH | /api/auth/session/switch | (authenticated) | No |
| GET | /api/admin/dealership | admin.dealership.read | No |
| PATCH | /api/admin/dealership | admin.dealership.write | Yes |
| GET | /api/admin/dealership/locations | admin.dealership.read | No |
| POST | /api/admin/dealership/locations | admin.dealership.write | Yes |
| PATCH | /api/admin/dealership/locations/[id] | admin.dealership.write | Yes |
| GET | /api/admin/memberships | admin.memberships.read | No |
| POST | /api/admin/memberships | admin.memberships.write | Yes |
| GET | /api/admin/memberships/[id] | admin.memberships.read | No |
| PATCH | /api/admin/memberships/[id] | admin.memberships.write | Yes |
| DELETE | /api/admin/memberships/[id] | admin.memberships.write | Yes |
| GET | /api/admin/roles | admin.roles.read | No |
| POST | /api/admin/roles | admin.roles.write | Yes |
| GET | /api/admin/roles/[id] | admin.roles.read | No |
| PATCH | /api/admin/roles/[id] | admin.roles.write | Yes |
| DELETE | /api/admin/roles/[id] | admin.roles.write | Yes |
| GET | /api/admin/permissions | admin.permissions.read | No |
| POST | /api/admin/bootstrap-link-owner | (authenticated) | No |
| GET | /api/audit | admin.audit.read | No |
| POST | /api/files/upload | documents.write | Yes |
| GET | /api/files/signed-url | documents.read | Yes |

## Permissions (summary)

- **admin.*** — dealership, memberships, roles, audit, permissions.
- **documents.read** / **documents.write** — files.
- See docs/design/core-platform-spec.md §2 for the full catalog and default roles (Owner, Admin, Sales, Finance).

## Data model summary

- **Dealership** — Root tenant.
- **DealershipLocation** — Tenant-scoped locations.
- **Profile** — User profile (id = Supabase user id).
- **Permission** — Global catalog (seed).
- **Role** — Per-dealership; soft delete.
- **RolePermission** — Role ↔ Permission.
- **Membership** — User ↔ Dealership ↔ Role; soft disable.
- **AuditLog** — Append-only.
- **FileObject** — File metadata; soft delete. Optional **entityType** and **entityId** for linking files to entities (e.g. inventory vehicle photos). See docs/modules/inventory.md.

## Running integration tests

- Set **TEST_DATABASE_URL** to a dedicated test Postgres (e.g. local or CI). Do **not** use production `DATABASE_URL` for tests.
- Run `npm test`. Integration tests (tenant isolation, RBAC, audit, files, session switch) run when `TEST_DATABASE_URL` is set and **SKIP_INTEGRATION_TESTS** is not `1`.
- To skip DB-backed tests, set **SKIP_INTEGRATION_TESTS=1**. See `docs/DEPLOYMENT.md` for all env vars.

## Manual test steps

1. Run migrations and seed: `npm run db:migrate`, `npm run db:seed`.
2. Sign in with Supabase (e.g. login page or Supabase Auth).
3. Link as Owner: `POST /api/admin/bootstrap-link-owner` (with session cookie).
4. Set active dealership cookie (or call PATCH /api/auth/session/switch with `{ "dealershipId": "<demo-dealership-id>" }`).
5. GET /api/auth/session — expect user, activeDealership, permissions.
6. GET /api/admin/dealership — expect dealership and locations.
7. PATCH /api/admin/dealership — update name; GET /api/audit — expect dealership.updated.
8. POST /api/admin/dealership/locations — create location; GET list — expect new row.
9. GET /api/admin/memberships — list members; POST to invite (email + roleId); PATCH to change role; DELETE to disable.
10. GET /api/admin/roles — list; POST to create custom role with permissionIds; PATCH/DELETE.
11. GET /api/audit — filter by entity, action, date.
12. POST /api/files/upload (multipart file + bucket); GET /api/files/signed-url?fileId= — expect url and file.accessed in audit.
