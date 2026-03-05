# DealerCenter-Style RBAC Spec (apps/dealer)

## Overview

Users in the dealer app have **multiple role templates**; effective permissions are the **union of all role permissions**, then **per-user overrides** (enabled true/false) are applied. **Default deny**: a permission is allowed only if it is granted by (role union) and not denied by an override, or explicitly granted by an override.

## Data Model

- **permissions**: Global catalog; `key` is unique (e.g. `inventory.read`, `admin.users.read`).
- **roles**: Per-dealership; optional `key` for template (e.g. `SALES_ASSOCIATE`, `DEALER_ADMIN`).
- **role_permissions**: Join (role_id, permission_id); unique(role_id, permission_id).
- **memberships**: One row per user per dealership (user belongs to exactly one dealership); links user to dealership; may retain legacy `role_id` for backward compatibility during migration.
- **user_roles**: Multi-role union; (user_id, role_id); unique(user_id, role_id). Roles must belong to the user’s dealership (enforced in app).
- **user_permission_overrides**: (user_id, permission_id, enabled boolean, created_by_user_id, created_at); unique(user_id, permission_id). Overrides apply to that user only.

Dealer app invariant: **1 user = 1 dealership** (one active membership). All admin actions are scoped by `dealership_id`; never accept `dealership_id` from client.

## Effective Permissions

1. **Base** = union of permissions from all roles assigned to the user (via `user_roles`) for that dealership. If no `user_roles` rows exist, fall back to the single role from `membership.roleId`. Roles are filtered by `role.dealershipId === user's dealershipId`.
2. **Overrides**:
   - If `user_permission_overrides.enabled === false` for a permission → **remove** it from effective set.
   - If `user_permission_overrides.enabled === true` → **add** it to effective set (even if not in any role).
3. **Default deny**: For any action, require the permission key to be in the effective set; otherwise return 403.

## Precedence (Summary)

- Role union grants a set of permission keys.
- Override `enabled: false` revokes a permission.
- Override `enabled: true` grants a permission (additive).
- No role grant and no override grant → denied.

## Canonical Permission Keys (seed)

Inventory (read/create/update/delete/export), Customers, CRM, Deals, Appointments, Finance, Reports, Admin (users.read/invite/update/disable, roles.assign, permissions.manage, settings.manage), Integrations, Audit.read. Legacy keys (admin.memberships.*, admin.roles.*, etc.) remain for backward compatibility.

## Role Templates (seed)

SALES_ASSOCIATE, SALES_MANAGER, ACCOUNTING, ADMIN_ASSISTANT, INVENTORY_MANAGER, DEALER_ADMIN, OWNER. See `prisma/seed.ts` ROLE_TEMPLATES.

## Enforcement

- Every dealer route must: (1) resolve session and active dealership (`getAuthContext` / `requireDealershipContext`), (2) call `requirePermission` or `guardPermission(ctx, permissionKey)` for the action. Use `guardAnyPermission(ctx, ["admin.users.read", "admin.memberships.read"])` when multiple keys allow the same action.
- All Prisma queries must filter by `dealership_id` where applicable; never trust client-supplied `dealership_id`.

## APIs

- **GET /api/admin/users** — List users with roleIds and permissionOverrides. Requires admin.users.read or admin.memberships.read.
- **GET /api/admin/users/[userId]** — Get one user. Requires admin.users.read or admin.memberships.read.
- **PATCH /api/admin/users/[userId]/roles** — Assign roles (body: `{ roleIds: string[] }`). Requires admin.roles.assign.
- **PATCH /api/admin/users/[userId]/permission-overrides** — Set override (body: `{ permissionKey, enabled }`). Requires admin.permissions.manage.
- Invite/disable: **POST/GET/PATCH/DELETE /api/admin/memberships** with admin.users.* or admin.memberships.*.

## Audit

Log: role assignment changes (`user_roles.assigned`), permission override changes (`user_permission_override.set`), user disabled/enabled (`membership.disabled`). No PII/secrets in logs.
