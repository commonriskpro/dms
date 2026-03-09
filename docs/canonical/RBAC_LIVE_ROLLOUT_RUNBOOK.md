# RBAC Live Rollout Runbook

This runbook covers live dealer-environment RBAC normalization rollout for staging, demo, restored, and production-like dealer databases.

Primary inputs:
- [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md)
- [`POST_NORMALIZATION_ROLE_AUDIT.md`](./POST_NORMALIZATION_ROLE_AUDIT.md)
- [`CUSTOM_ROLE_MIGRATION_REVIEW.md`](./CUSTOM_ROLE_MIGRATION_REVIEW.md)
- [`CUSTOM_ROLE_MIGRATION_MATRIX.md`](./CUSTOM_ROLE_MIGRATION_MATRIX.md)

Code-backed command and model sources:
- [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts)
- [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts)
- [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma)
- [`apps/dealer/package.json`](../../apps/dealer/package.json)
- [`package.json`](../../package.json)

This runbook is operational.
- It assumes the dealer RBAC vocabulary has already been normalized in code.
- It does not redesign permissions.
- It is intended for running the existing normalization script safely against live data.

## 1. Scope

Use this runbook when the target environment may still contain:
- obsolete `Permission.key` rows
- stale `RolePermission` rows on removed dealer permissions
- stale `UserPermissionOverride` rows on removed dealer permissions
- restored snapshots from pre-normalization data
- long-lived custom roles where `Role.isSystem = false`

Do not use this runbook for:
- platform-app role rollout
- broad user-management testing unrelated to dealer RBAC
- speculative custom-role widening without approval

## 2. Prerequisites

Required environment and tooling:
- Node `24.x` as required by [`package.json`](../../package.json)
- dealer dependencies installed in this repo
- working dealer `DATABASE_URL`
- ability to run dealer Prisma scripts against the target environment
- ability to query the target database directly with SQL

Recommended operator prerequisites:
- access to a recent database backup or restorable snapshot
- named owner for custom-role approval decisions
- change window for production-like environments

## 3. Environment Safety Checks

Before touching data:

1. Confirm the target database explicitly.
2. Confirm you are on code that includes [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts) and the normalized catalog in [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts).
3. Confirm a backup or restore point exists for the target environment.
4. Confirm whether the environment has long-lived custom roles or manual user overrides.
5. Confirm whether the environment was created from:
   - a fresh post-normalization seed
   - a restored snapshot
   - an imported or support-modified database

Minimum preflight command:

```bash
node -v
```

Expected result:
- Node major version `24`

Recommended repo sanity checks:

```bash
git rev-parse --short HEAD
npm run prisma:generate
```

## 4. Exact Normalization Command

Root-level wrapper using `.env.local`:

```bash
npm run db:normalize:dealer-rbac
```

Direct app-level command when `DATABASE_URL` is already set for the target environment:

```bash
npm run db:normalize-rbac --prefix apps/dealer
```

Direct script form:

```bash
cd apps/dealer
npx tsx scripts/normalize-rbac-permissions.ts
```

What the script does, from [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts):
- upserts canonical `Permission` rows
- migrates direct aliases:
  - `audit.read` -> `admin.audit.read`
  - `inventory.publish.read` -> `inventory.read`
- re-syncs known system roles by name
- re-syncs known DealerCenter template roles by `Role.key`
- removes obsolete role-permission rows, user overrides, and obsolete permission rows

## 5. What To Query Before Running

Run the preflight SQL in [`RBAC_LIVE_SQL_CHECKLIST.md`](./RBAC_LIVE_SQL_CHECKLIST.md).

Minimum pre-run checks:
- count obsolete `Permission.key` rows
- list custom roles with obsolete permission assignments
- list user overrides on obsolete permissions
- count system/template roles expected to be auto-normalized

Operator goal before running:
- understand whether the environment has only alias cleanup
- or whether it also has custom-role review work after the script runs

## 6. How To Detect Obsolete `Permission.key` Rows

Use the obsolete-key query in [`RBAC_LIVE_SQL_CHECKLIST.md`](./RBAC_LIVE_SQL_CHECKLIST.md).

Obsolete keys are defined from [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts), including:
- direct aliases:
  - `audit.read`
  - `inventory.publish.read`
- removed families:
  - `platform.*`
  - `appointments.*`
  - `bhph.*`
  - `integrations.*`
  - `integrations.quickbooks.*`
- removed dormant CRUD/action keys such as:
  - `inventory.create`
  - `customers.delete`
  - `deals.approve`
  - `finance.approve`

Expected post-run state:
- no obsolete `Permission.key` rows remain

## 7. How To Detect Custom `RolePermission` Rows On Removed Keys

Custom roles are rows in `Role` where:
- `"is_system" = false`

Relevant persisted surfaces from [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma):
- `Role`
- `RolePermission`
- `Permission`

Use the custom-role query in [`RBAC_LIVE_SQL_CHECKLIST.md`](./RBAC_LIVE_SQL_CHECKLIST.md).

Operator interpretation:
- if the row is only a direct alias, it is safe to auto-replace
- if the row is a removed dormant CRUD/action key, it needs human review before widening to canonical `*.write`
- if the row is in a removed family with no dealer replacement, do not auto-map it

## 8. How To Detect `UserPermissionOverride` Rows On Removed Keys

Relevant persisted surfaces:
- `UserPermissionOverride`
- `Permission`

Use the override query in [`RBAC_LIVE_SQL_CHECKLIST.md`](./RBAC_LIVE_SQL_CHECKLIST.md).

Operator interpretation:
- direct alias override rows are safe to auto-replace
- dormant CRUD/action override rows are per-user widening decisions and require approval
- removed-family override rows should stay unmapped unless policy changes

## 9. Safe Automatic Replacements

These are the only high-confidence automatic replacements for live custom-role and override data:

| Old permission | Canonical replacement | Why safe |
|---|---|---|
| `audit.read` | `admin.audit.read` | direct rename only |
| `inventory.publish.read` | `inventory.read` | direct rename only |

These are already handled in [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts).

## 10. Human-Approval-Required Replacements

These cases should not be auto-widened without explicit owner approval:

| Old permission family | Suggested canonical replacement | Why approval is required |
|---|---|---|
| `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.export` | `inventory.write` | converts dormant CRUD keys into active write access |
| `customers.create`, `customers.update`, `customers.delete`, `customers.export` | `customers.write` | converts dormant CRUD keys into active write access |
| `crm.create`, `crm.update`, `crm.delete`, `crm.export` | `crm.write` | converts dormant CRUD keys into active write access |
| `deals.create`, `deals.update`, `deals.delete`, `deals.export`, `deals.approve` | `deals.write` | converts dormant CRUD/action keys into active write access |
| `finance.update`, `finance.approve` | `finance.write` | converts dormant keys into active write access |

Approval rule:
- approve role by role and override by override
- do not bulk-map all custom roles automatically

## 11. No-Replacement Families

These removed families have no canonical dealer replacement and should not be auto-mapped:
- `platform.admin.read`
- `platform.admin.write`
- `platform.read`
- `platform.write`
- `platform.impersonate`
- `appointments.read`
- `appointments.create`
- `appointments.update`
- `appointments.cancel`
- `bhph.read`
- `bhph.write`
- `integrations.read`
- `integrations.manage`
- `integrations.quickbooks.read`
- `integrations.quickbooks.write`

If these keys still appear in a live environment:
- treat them as historical cleanup findings
- do not guess a dealer replacement
- escalate if a team claims current business access depends on them

## 12. Rollout Procedure

### Phase A: Pre-run capture

1. Record the target environment name and database connection target.
2. Record the current git SHA.
3. Run the preflight SQL from [`RBAC_LIVE_SQL_CHECKLIST.md`](./RBAC_LIVE_SQL_CHECKLIST.md).
4. Export or copy the result sets for:
   - obsolete `Permission.key` rows
   - custom-role obsolete assignments
   - user-override obsolete assignments
5. Classify findings into:
   - direct aliases
   - dormant CRUD/action keys
   - no-replacement families

### Phase B: Run normalization

Preferred command:

```bash
npm run db:normalize:dealer-rbac
```

Use the direct app command only when the environment is not using `.env.local`:

```bash
npm run db:normalize-rbac --prefix apps/dealer
```

### Phase C: Immediate post-run checks

1. Re-run the post-run SQL from [`RBAC_LIVE_SQL_CHECKLIST.md`](./RBAC_LIVE_SQL_CHECKLIST.md).
2. Confirm:
   - obsolete `Permission.key` rows are gone
   - obsolete `RolePermission` rows are gone
   - obsolete `UserPermissionOverride` rows are gone
3. Confirm known system/template roles still exist and still have permission assignments.
4. If custom roles lost only obsolete rows and now appear narrower, compare them to the pre-run capture and queue the widening decision for approval instead of changing them immediately.

### Phase D: Human review for custom roles

1. Review every custom role that previously had dormant CRUD/action keys.
2. Decide whether that role should receive the matching canonical `*.write`.
3. Review every user override that previously had dormant CRUD/action keys.
4. Do not map no-replacement families unless there is an explicit policy decision.

## 13. What To Query After Running

After the normalization script:
- verify obsolete keys are gone
- verify no custom-role obsolete rows remain
- verify no override obsolete rows remain
- verify canonical permission count matches the current catalog

The canonical dealer catalog currently contains the keys from [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts).

Use the post-run SQL in [`RBAC_LIVE_SQL_CHECKLIST.md`](./RBAC_LIVE_SQL_CHECKLIST.md) for:
- obsolete-key count
- canonical-key count
- remaining custom-role findings
- remaining override findings

## 14. Post-Migration Access Validation Steps

Validate with at least one known system role user and one affected custom-role user.

Minimum checks:
1. Admin role management page still loads for an admin user.
2. Dashboard still loads for a user with `dashboard.read`.
3. Reports page still loads for a user with `reports.read`.
4. A user with a reviewed custom role can still access the intended dealer domain surfaces.
5. A user who should not have widened access still remains read-only where expected.

High-signal dealer areas to verify after custom-role review:
- dashboard
- inventory
- customers
- CRM
- deals
- finance
- reports
- admin users/roles

## 15. Rollback And Recovery Notes

There is no code-level rollback command in the repository that restores prior custom-role state automatically.

Practical recovery options:
- restore the database from backup or snapshot taken before normalization
- reinsert or reconstruct prior permission rows only from a controlled recovery plan
- use pre-run SQL exports to rebuild custom-role and override decisions manually if a backup restore is not appropriate

Important constraint:
- once obsolete `Permission` rows are deleted by normalization, restoring previous non-canonical live assignments requires either a DB restore or a deliberate reconstruction plan

## 16. Signoff Checklist

Mark rollout complete only when all items below are true:

- target environment and database were explicitly verified
- backup or restore point exists
- pre-run SQL capture was saved
- normalization command completed without errors
- post-run SQL shows zero obsolete `Permission.key` rows
- post-run SQL shows zero obsolete custom-role `RolePermission` rows
- post-run SQL shows zero obsolete `UserPermissionOverride` rows
- any remaining custom-role narrowing cases were reviewed
- all dormant CRUD/action widening decisions were explicitly approved or explicitly declined
- no-replacement families were left unmapped unless an explicit policy decision exists
- post-migration access checks passed for system-role and custom-role users
- operator signoff notes were recorded for the environment
