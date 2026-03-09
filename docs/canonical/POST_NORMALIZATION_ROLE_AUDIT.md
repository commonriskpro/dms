# Post-Normalization Role Audit

This document audits dealer roles after the RBAC normalization completed on March 9, 2026.

Scope:
- dealer system roles and provisioned roles
- DealerCenter template roles
- custom dealer roles created through dealer role-management APIs
- role-permission rows and user permission overrides affected by removed non-canonical permissions

Primary inputs:
- [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md)
- [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts)
- [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts)
- [`apps/dealer/modules/provisioning/service/provision.ts`](../../apps/dealer/modules/provisioning/service/provision.ts)
- [`apps/dealer/modules/core-platform/db/role.ts`](../../apps/dealer/modules/core-platform/db/role.ts)
- [`apps/dealer/modules/core-platform/db/user-roles.ts`](../../apps/dealer/modules/core-platform/db/user-roles.ts)

This is an audit only. No additional RBAC behavior changes were made in this sprint.

## 1. Executive Summary

Current state:
- Seeded default roles and DealerCenter template roles are already normalized in code.
- The normalization script explicitly re-syncs:
  - system roles by name: `Owner`, `Admin`, `Sales`, `Finance`
  - DealerCenter template roles by `Role.key`
- Arbitrary custom roles are not widened automatically.
- User permission overrides are only auto-migrated for direct alias replacements:
  - `audit.read` -> `admin.audit.read`
  - `inventory.publish.read` -> `inventory.read`

Main audit conclusion:
- Highest post-normalization risk is not seeded/provisioned roles.
- Highest post-normalization risk is custom dealer roles that previously held removed dormant CRUD/action keys and now may lack the intended canonical `*.write` permission.

## 2. Role Categories

### Auto-normalized roles

These are handled automatically by [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts):
- Default/system roles:
  - `Owner`
  - `Admin`
  - `Sales`
  - `Finance`
- DealerCenter template roles identified by `Role.key`:
  - `SALES_ASSOCIATE`
  - `SALES_MANAGER`
  - `ACCOUNTING`
  - `ADMIN_ASSISTANT`
  - `INVENTORY_MANAGER`
  - `DEALER_ADMIN`
  - `OWNER`

### Manual-review roles

These are not widened automatically:
- any `Role` with `isSystem = false`
- any historical custom role without a known DealerCenter `Role.key`
- any restored/imported role rows from older environments or backups

Reason:
- the normalization script intentionally avoids blanket-mapping dormant CRUD keys onto arbitrary custom roles because that could silently broaden access beyond original live runtime behavior

## 3. Affected Roles

### Default and provisioned roles

| Role | Status after normalization | Previous non-canonical permissions found | Canonical result | Automatic or human-approved |
|---|---|---|---|---|
| `Owner` | normalized | catalog had many removed keys historically because owner inherited all keys | now receives full canonical dealer catalog only | automatic |
| `Admin` | normalized | inherited historical pre-normalization catalog shape | now receives normalized admin/domain read-write set | automatic |
| `Sales` | normalized | no major dormant CRUD dependency in current provision path | unchanged canonical coarse-domain access | automatic |
| `Finance` | normalized | no dormant CRUD dependency in current provision path | unchanged canonical finance/deals/documents access | automatic |

### DealerCenter template roles

| Role template | Previous non-canonical permissions found | Current canonical replacement in code | Automatic or human-approved | Notes |
|---|---|---|---|---|
| `SALES_ASSOCIATE` | `customers.create`, `customers.update`, `crm.create`, `crm.update`, `deals.create`, `deals.update`, `appointments.*` | `customers.write`, `crm.write`, `deals.write` | automatic | appointments permissions were removed with no dealer replacement |
| `SALES_MANAGER` | `customers.create/update/delete/export`, `crm.create/update/delete/export`, `deals.create/update/delete/export/approve`, `appointments.*` | canonical `Sales` set plus `reports.export` | automatic | broad manager intent was normalized to coarse write permissions |
| `ACCOUNTING` | `deals.export`, `finance.update` | current template explicitly grants `deals.write`, `finance.write`, `finance.submissions.*`, `reports.export`, supporting finance/accounting workflows | automatic | this is a deliberate canonical template shape, not a direct one-to-one alias map |
| `ADMIN_ASSISTANT` | `customers.create`, `customers.update`, `crm.create`, `appointments.*` | `customers.write`, `crm.write` | automatic | appointments permissions were removed with no dealer replacement |
| `INVENTORY_MANAGER` | `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.export` | `inventory.write` plus inventory subdomain permissions | automatic | canonical inventory-manager shape is now explicit |
| `DEALER_ADMIN` | many historical dormant CRUD keys and removed families | full canonical dealer catalog | automatic | wrong-layer and dormant families removed |
| `OWNER` | inherited historical full catalog including removed keys | full canonical dealer catalog | automatic | same end-state as default `Owner` role for template path |

## 4. Previous Non-Canonical Permissions Found In Post-Normalization Audit

### Safe direct replacements

These have a direct canonical replacement and are safe to migrate automatically:

| Previous permission | Canonical replacement | Automatic or human-approved |
|---|---|---|
| `audit.read` | `admin.audit.read` | automatic |
| `inventory.publish.read` | `inventory.read` | automatic |

### Dormant CRUD/action keys with likely canonical replacement

These are the main custom-role review set:

| Previous permission family | Likely canonical replacement | Automatic or human-approved |
|---|---|---|
| `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.export` | `inventory.write` | human-approved for custom roles |
| `customers.create`, `customers.update`, `customers.delete`, `customers.export` | `customers.write` | human-approved for custom roles |
| `crm.create`, `crm.update`, `crm.delete`, `crm.export` | `crm.write` | human-approved for custom roles |
| `deals.create`, `deals.update`, `deals.delete`, `deals.export`, `deals.approve` | `deals.write` | human-approved for custom roles |
| `finance.update`, `finance.approve` | `finance.write` | human-approved for custom roles |

Important constraint:
- These replacements are appropriate when the business intent of the old role was "can perform writes in this domain".
- They should not be applied blindly to arbitrary custom roles because older dormant CRUD keys often had no live runtime effect before normalization.

### Removed families with no dealer canonical replacement

These do not have a direct dealer canonical replacement:

| Previous permission family | Recommended replacement | Automatic or human-approved |
|---|---|---|
| `platform.*` | none in dealer RBAC model | human-approved only |
| `appointments.*` | none | human-approved only |
| `bhph.*` | none | human-approved only |
| `integrations.*` | none | human-approved only |
| `integrations.quickbooks.*` | none | human-approved only |

Interpretation:
- If a custom role depended on one of these families, that should be treated as a manual product/ops decision, not as an automatic RBAC migration.

## 5. Recommended Canonical Replacements By Business Intent

Use this table when auditing custom dealer roles in live data.

| If the old role intent was... | Recommended canonical permission |
|---|---|
| create/update/delete vehicles or inventory data | `inventory.write` |
| manage acquisitions | `inventory.acquisition.write` |
| manage appraisals | `inventory.appraisals.write` |
| manage pricing rules or apply pricing | `inventory.pricing.write` |
| publish/unpublish listings | `inventory.publish.write` |
| create/update customer data or customer tasks/notes/outreach | `customers.write` |
| manage CRM pipelines/opportunities/inbox actions/automations | `crm.write` |
| create/update deals or move deal workflows | `deals.write` |
| update finance shell state | `finance.write` |
| manage credit applications, submissions, stipulations, funding | `finance.submissions.write` |
| manage lender records | `lenders.write` |
| export reports | `reports.export` |
| manage shared saved searches/filters | `admin.settings.manage` |

## 6. Automatic vs Human-Approved Replacement Policy

### Safe to treat as automatic

Only these categories are safe for automatic replacement:
- seeded system roles re-synced by name
- DealerCenter template roles re-synced by `Role.key`
- direct alias migrations:
  - `audit.read` -> `admin.audit.read`
  - `inventory.publish.read` -> `inventory.read`

### Must be human-approved

These should be reviewed intentionally before widening:
- any custom role with removed dormant CRUD/action keys
- any custom role with removed `platform.*` keys
- any custom role with removed `appointments.*`, `bhph.*`, or `integrations.*` keys
- any user override that previously used removed dormant CRUD/action keys and no longer has an equivalent live effect

Reason:
- the old non-canonical keys frequently did not correspond to live runtime enforcement before normalization
- automatic widening would change real behavior for custom roles in a way that may not match the original practical access level

## 7. Environments And Data Paths Requiring Manual Verification

These are the main places to check after normalization:

1. Non-reset dealer databases where [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts) has already run.
2. Non-reset dealer databases where the script has not run yet.
3. Custom `RolePermission` rows for `Role.isSystem = false`.
4. `UserPermissionOverride` rows that may have referenced removed dormant CRUD/action keys.
5. Restored database snapshots or seeded demo environments created before normalization.
6. Any external import or support tooling that may have inserted permission rows directly.

High-signal queries to run manually in a live environment:
- custom roles that previously held removed dealer keys
- users with overrides on removed dealer keys
- custom roles that now have read-only permissions in domains where product expected write capability

## 8. Practical Manual Review Checklist

Review these custom-role patterns first:

1. Roles that used only `customers.create/update/delete/export` and now have only `customers.read`.
2. Roles that used only `crm.create/update/delete/export` and now have only `crm.read`.
3. Roles that used only `deals.create/update/delete/export/approve` and now have only `deals.read`.
4. Roles that used only `inventory.create/update/delete/export` and now have only `inventory.read`.
5. Roles that used only `finance.update/approve` and now have only `finance.read`.
6. Roles that previously had `platform.*` and now have no replacement.
7. Roles that previously had `appointments.*`, `bhph.*`, or `integrations.*` and now have no replacement.

Recommended review decision pattern:
- if the role was intended to perform writes in a live dealer workflow, grant the corresponding canonical `*.write`
- if the role was only carrying dormant permissions that never had live runtime effect, leave it unchanged
- if the role depended on removed non-domain families with no replacement, escalate for human decision instead of guessing

## 9. Bottom Line

Post-normalization:
- seeded and provisioned dealer roles are already aligned
- the remaining audit work is custom-role review, not catalog cleanup
- the safest widening candidates are old dormant CRUD/action keys that clearly imply domain write intent
- those widenings should be human-approved for custom roles, not automatic
