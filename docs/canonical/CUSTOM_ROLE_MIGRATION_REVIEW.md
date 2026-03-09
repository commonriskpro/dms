# Custom Role Migration Review

This document reviews live-data dealer RBAC migration risk after the March 9, 2026 normalization sprint.

Canonical source of truth:
- [`INDEX.md`](./INDEX.md)
- [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md)
- [`POST_NORMALIZATION_ROLE_AUDIT.md`](./POST_NORMALIZATION_ROLE_AUDIT.md)
- [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md)
- [`PERMISSION_DEPRECATION_PLAN.md`](./PERMISSION_DEPRECATION_PLAN.md)

This is a review only.
- No runtime behavior was changed.
- No seed, route-guard, or provisioning changes were made in this sprint.
- The repository cannot inspect production or staging database contents directly from code alone, so environment-specific verification is still required.

## 1. Executive Summary

Current state from code:
- Dealer permission vocabulary has already been normalized to the canonical catalog in [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts).
- System roles and DealerCenter template roles are re-synced by [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts).
- Direct alias replacements are already handled automatically:
  - `audit.read` -> `admin.audit.read`
  - `inventory.publish.read` -> `inventory.read`
- The remaining migration risk is persisted live data in:
  - custom roles where `Role.isSystem = false`
  - `UserPermissionOverride` rows on removed permission keys
  - restored or imported environments that still contain obsolete `Permission` rows

Main conclusion:
- Safe automatic replacement is limited to direct aliases.
- Old dormant CRUD/action keys on custom roles usually indicate write intent, but widening those roles to canonical `*.write` permissions should be human-approved.
- Removed permission families such as `platform.*`, `appointments.*`, `bhph.*`, and `integrations.*` have no current canonical dealer replacement.

## 2. Canonical Vocabulary Reminder

Dealer RBAC is normalized to:
- `domain.read`
- `domain.write`
- `domain.subdomain.read`
- `domain.subdomain.write`

Approved one-sided exceptions still in the canonical catalog:
- `inventory.auctions.read`
- `inventory.publish.write`
- `reports.export`
- `admin.settings.manage`
- selected admin action permissions such as `admin.roles.assign` and `admin.users.invite`

Canonical dealer permission catalog is defined in [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts).

## 3. Persisted Data Surfaces Reviewed

The persisted dealer RBAC surfaces that matter for this migration review are:

### Prisma models

Defined in [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma):
- `Permission`
  - unique permission vocabulary by `key`
- `Role`
  - includes `isSystem`, optional `key`, soft-delete fields, and dealership ownership
- `RolePermission`
  - join table between `Role` and `Permission`
- `UserRole`
  - direct role assignment for users
- `UserPermissionOverride`
  - per-user explicit enable/disable rows keyed by `(userId, permissionId)`
- `Membership`
  - includes `roleId` and still participates in effective access

### Write paths

Reviewed code paths:
- [`apps/dealer/modules/core-platform/db/role.ts`](../../apps/dealer/modules/core-platform/db/role.ts)
  - creates and updates arbitrary roles with supplied `permissionIds`
- [`apps/dealer/modules/core-platform/db/user-roles.ts`](../../apps/dealer/modules/core-platform/db/user-roles.ts)
  - creates and updates `UserPermissionOverride` rows from selected permission keys
- [`apps/dealer/modules/provisioning/service/provision.ts`](../../apps/dealer/modules/provisioning/service/provision.ts)
  - creates provisioned roles for new dealerships
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
  - seeds canonical permissions and default role sets
- [`apps/dealer/scripts/repair-provisioned-roles.ts`](../../apps/dealer/scripts/repair-provisioned-roles.ts)
  - re-syncs known provisioned roles
- [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts)
  - canonical RBAC normalization and cleanup script

### Admin surfaces

Reviewed UI/API entry points for persisted role data:
- [`apps/dealer/app/api/admin/roles/route.ts`](../../apps/dealer/app/api/admin/roles/route.ts)
- [`apps/dealer/app/api/admin/roles/[id]/route.ts`](../../apps/dealer/app/api/admin/roles/[id]/route.ts)
- [`apps/dealer/app/api/admin/users/[userId]/route.ts`](../../apps/dealer/app/api/admin/users/[userId]/route.ts)
- [`apps/dealer/app/api/admin/users/[userId]/permission-overrides/route.ts`](../../apps/dealer/app/api/admin/users/[userId]/permission-overrides/route.ts)
- [`apps/dealer/app/(app)/admin/users/[userId]/UserDetailClient.tsx`](../../apps/dealer/app/(app)/admin/users/[userId]/UserDetailClient.tsx)

## 4. Affected Custom-Role Categories

These categories remain relevant after normalization.

### Already handled by code

These are not open migration issues unless a target environment skipped the normalization run:
- system roles with `Role.isSystem = true`
- known seeded roles re-synced by name
- DealerCenter template roles re-synced by `Role.key`

Handled automatically by [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts):
- system roles by name:
  - `Owner`
  - `Admin`
  - `Sales`
  - `Finance`
- template roles by `Role.key`:
  - `SALES_ASSOCIATE`
  - `SALES_MANAGER`
  - `ACCOUNTING`
  - `ADMIN_ASSISTANT`
  - `INVENTORY_MANAGER`
  - `DEALER_ADMIN`
  - `OWNER`

### Still at risk

These categories need live-data review:
- custom roles where `Role.isSystem = false`
- custom roles without one of the known template `Role.key` values
- restored or imported historical roles from pre-normalization environments
- user overrides on obsolete permission rows
- environments that still contain removed `Permission.key` values because normalization has not been run or was only partially applied

## 5. Affected User-Override Categories

`UserPermissionOverride` is a live-data risk surface because overrides are stored independently of system/template role re-sync.

Safe auto-migrated override cases already handled by code:
- `audit.read` -> `admin.audit.read`
- `inventory.publish.read` -> `inventory.read`

Override categories that still require review in live environments:
- overrides on removed dormant CRUD/action keys
- overrides on removed no-replacement families
- overrides in restored environments where obsolete permission rows may still exist

## 6. Non-Canonical Permission Findings

The normalized codebase still tracks removed permissions as migration metadata in [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts). Those keys may still exist in live data even though they are no longer canonical.

### Direct alias findings

| Old permission | Canonical replacement | Replacement type | Notes |
|---|---|---|---|
| `audit.read` | `admin.audit.read` | Safe automatic replacement | Already handled by normalization script for roles and overrides |
| `inventory.publish.read` | `inventory.read` | Safe automatic replacement | Already handled by normalization script for roles and overrides |

### Dormant CRUD/action findings

| Old permission family | Suggested canonical replacement | Replacement type | Notes |
|---|---|---|---|
| `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.export` | `inventory.write` | Human-approved widening recommended | Old keys were removed from canonical dealer model |
| `customers.create`, `customers.update`, `customers.delete`, `customers.export` | `customers.write` | Human-approved widening recommended | Same pattern as inventory |
| `crm.create`, `crm.update`, `crm.delete`, `crm.export` | `crm.write` | Human-approved widening recommended | Same pattern as inventory |
| `deals.create`, `deals.update`, `deals.delete`, `deals.export`, `deals.approve` | `deals.write` | Human-approved widening recommended | `deals.approve` was not retained as canonical |
| `finance.update`, `finance.approve` | `finance.write` | Human-approved widening recommended | Only if business intent was true finance write access |

### No-replacement findings

| Old permission family | Canonical dealer replacement | Replacement type | Notes |
|---|---|---|---|
| `platform.admin.read`, `platform.admin.write`, `platform.read`, `platform.write`, `platform.impersonate` | none | No canonical dealer replacement | Wrong architectural layer; platform access is role-based in `apps/platform` |
| `appointments.read`, `appointments.create`, `appointments.update`, `appointments.cancel` | none | No canonical dealer replacement | Removed family; no code-backed dealer module remains |
| `bhph.read`, `bhph.write` | none | No canonical dealer replacement | Removed family |
| `integrations.read`, `integrations.manage` | none | No canonical dealer replacement | Removed family |
| `integrations.quickbooks.read`, `integrations.quickbooks.write` | none | No canonical dealer replacement | Removed family |

## 7. Replacement Recommendations

Apply these recommendations conservatively.

### A. Safe automatic replacement

These are safe because they are direct aliases, not real widenings:
- any custom-role `RolePermission` row referencing `audit.read` -> replace with `admin.audit.read`
- any custom-role `RolePermission` row referencing `inventory.publish.read` -> replace with `inventory.read`
- any `UserPermissionOverride` row referencing `audit.read` -> replace with `admin.audit.read`
- any `UserPermissionOverride` row referencing `inventory.publish.read` -> replace with `inventory.read`

### B. Human-approved widening recommended

These imply broader domain write access and should be approved role by role:
- `inventory.create|update|delete|export` -> `inventory.write`
- `customers.create|update|delete|export` -> `customers.write`
- `crm.create|update|delete|export` -> `crm.write`
- `deals.create|update|delete|export|approve` -> `deals.write`
- `finance.update|approve` -> `finance.write`

Recommended decision rule:
- if the custom role was intentionally designed to perform live write operations in that domain, grant the matching canonical `*.write`
- if the role only carried dormant keys that never had real runtime effect, leave it unchanged after alias cleanup

### C. No canonical dealer replacement

Do not guess replacements for these families:
- `platform.*`
- `appointments.*`
- `bhph.*`
- `integrations.*`
- `integrations.quickbooks.*`

These cases should be documented and left unmapped unless product/ops explicitly wants a different capability model.

### D. Historical data only, no action needed

No action is needed for seeded or known template roles if normalization has already run in the environment.

That includes roles re-synced by:
- system role name
- DealerCenter template `Role.key`

### E. Needs environment-specific inspection

The repository cannot determine whether a target environment still contains:
- obsolete `Permission` rows
- stale `RolePermission` rows for custom roles
- stale `UserPermissionOverride` rows
- imported backup data that bypassed current seed/provision flows

Those cases require environment-level queries before any migration is executed.

## 8. Safe Auto-Replace Candidates

High-confidence automatic cases:

| Entity type | Old permission | Canonical replacement | Why safe |
|---|---|---|---|
| custom role | `audit.read` | `admin.audit.read` | direct rename only |
| custom role | `inventory.publish.read` | `inventory.read` | direct rename only |
| user override | `audit.read` | `admin.audit.read` | direct rename only |
| user override | `inventory.publish.read` | `inventory.read` | direct rename only |

These are already covered in code by [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts). If they are still present in an environment, the first check is whether that script has actually been run there.

## 9. Human-Approval-Required Candidates

These are the main live custom-role review cases.

| Entity type | Old permission family | Suggested replacement | Why approval is required |
|---|---|---|---|
| custom role | `inventory.create/update/delete/export` | `inventory.write` | widening to real canonical write access |
| custom role | `customers.create/update/delete/export` | `customers.write` | widening to real canonical write access |
| custom role | `crm.create/update/delete/export` | `crm.write` | widening to real canonical write access |
| custom role | `deals.create/update/delete/export/approve` | `deals.write` | widening to real canonical write access |
| custom role | `finance.update/approve` | `finance.write` | widening to real canonical write access |
| user override | any dormant CRUD/action key above | matching canonical `*.write` | per-user access broadening |

Why this is conservative:
- several removed CRUD/action permissions were historically dormant and often did not correspond to live route enforcement
- mapping them automatically on arbitrary custom roles would convert latent intent into active access

## 10. No-Replacement Candidates

These removed families should not be auto-mapped inside dealer RBAC.

| Entity type | Old permission family | Recommendation |
|---|---|---|
| custom role or override | `platform.*` | no dealer replacement; escalate if business still expects platform access |
| custom role or override | `appointments.*` | no dealer replacement |
| custom role or override | `bhph.*` | no dealer replacement |
| custom role or override | `integrations.*` | no dealer replacement |
| custom role or override | `integrations.quickbooks.*` | no dealer replacement |

If these keys are still present in live data, treat that as a historical-data cleanup issue, not as a canonical permission gap.

## 11. Environment And Data-Path Risk Notes

Environment-specific risks that cannot be resolved from repository inspection alone:
- normalization script may not have been run in every dealer environment
- restored or support-created snapshots may reintroduce obsolete permission rows
- custom roles may have been created through older admin UIs or direct DB edits
- `UserPermissionOverride` rows may persist on now-removed `Permission` rows if a migration was skipped
- external scripts or support tooling may have inserted permissions directly without using current admin APIs

High-signal environment categories to inspect first:
- production dealers with long-lived custom roles
- staging or demo environments cloned from old production snapshots
- pilot dealerships using imported role data
- support-managed tenants with manual override history

## 12. Recommended Migration Procedure

Use this order for live environments.

1. Verify the target environment is running the normalized dealer code and that [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts) has been executed.
2. Query the environment for remaining non-canonical `Permission.key` rows, custom-role `RolePermission` rows, and `UserPermissionOverride` rows.
3. Partition findings into four groups:
   - direct aliases
   - dormant CRUD/action keys
   - no-replacement families
   - already-normalized rows
4. Auto-migrate only direct aliases if they still exist.
5. Produce a custom-role review sheet for dormant CRUD/action findings, with one row per role or override and the proposed canonical `*.write` mapping.
6. Get explicit approval before applying any widening from dormant CRUD/action keys to canonical `*.write` permissions.
7. Leave no-replacement families unmapped unless product/ops makes an explicit policy decision.
8. Recompute or manually inspect affected users after migration to confirm the effective role/override set matches intended business access.

## 13. Open Questions

Open items that require environment owners, not repository-only analysis:
- Which live custom roles were intentionally using dormant CRUD/action keys as placeholders for write access?
- Which environments still contain obsolete `Permission` rows after the normalization sprint?
- Whether any support or import tooling outside this repository can still insert removed permission keys.

## 14. Bottom Line

Code-backed conclusion:
- dealer canonical vocabulary is stable
- system roles and template roles are already handled
- live-data migration work is now a custom-role and override review problem
- safe automation should stay limited to direct aliases
- dormant CRUD/action keys should only be widened to canonical `*.write` with explicit human approval
- removed families without dealer replacements should remain unmapped
