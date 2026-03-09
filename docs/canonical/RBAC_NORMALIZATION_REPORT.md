# RBAC Normalization Report

This report records the full dealer RBAC normalization completed on March 9, 2026.

Scope:
- dealer permission catalog
- dealer seed vocabulary
- default/system role seeds
- DealerCenter role templates
- provisioning and repair scripts
- runtime permission guards where naming changed
- canonical documentation

This report reflects the post-normalization state. Older RBAC audit and deprecation documents remain historical inputs.

## 1. Goals

Goals completed in this sprint:
- normalize dealer permission naming around `domain.read` / `domain.write`
- keep only code-backed `domain.subdomain.read` / `domain.subdomain.write` subfamilies
- preserve only rare justified one-sided exceptions
- remove non-canonical dealer permission families from the canonical model
- align seed vocabulary, role templates, provisioning, runtime guards, and docs
- add a repair path for existing databases that still contain old permission rows

## 2. Final Canonical Naming Rules

Dealer canonical rules:
- default:
  - `domain.read`
  - `domain.write`
- subdomain:
  - `domain.subdomain.read`
  - `domain.subdomain.write`
- intentional one-sided exceptions:
  - `inventory.auctions.read`
  - `inventory.publish.write`
- intentional non-read/write exceptions retained:
  - `reports.export`
  - `admin.settings.manage`

Canonical dealer catalog source:
- [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts)

## 3. Final Canonical Dealer Permission List

- Admin:
  - `admin.dealership.read`
  - `admin.dealership.write`
  - `admin.memberships.read`
  - `admin.memberships.write`
  - `admin.roles.read`
  - `admin.roles.write`
  - `admin.roles.assign`
  - `admin.permissions.read`
  - `admin.permissions.manage`
  - `admin.users.read`
  - `admin.users.invite`
  - `admin.users.update`
  - `admin.users.disable`
  - `admin.audit.read`
  - `admin.settings.manage`
- Dashboard:
  - `dashboard.read`
- Inventory:
  - `inventory.read`
  - `inventory.write`
  - `inventory.acquisition.read`
  - `inventory.acquisition.write`
  - `inventory.appraisals.read`
  - `inventory.appraisals.write`
  - `inventory.auctions.read`
  - `inventory.pricing.read`
  - `inventory.pricing.write`
  - `inventory.publish.write`
- Customers / CRM / deals:
  - `customers.read`
  - `customers.write`
  - `crm.read`
  - `crm.write`
  - `deals.read`
  - `deals.write`
- Documents / finance / lenders / reports:
  - `documents.read`
  - `documents.write`
  - `finance.read`
  - `finance.write`
  - `finance.submissions.read`
  - `finance.submissions.write`
  - `lenders.read`
  - `lenders.write`
  - `reports.read`
  - `reports.export`

## 4. Exact Files Changed

Runtime/catalog/migration files:
- [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts)
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- [`apps/dealer/modules/provisioning/service/provision.ts`](../../apps/dealer/modules/provisioning/service/provision.ts)
- [`apps/dealer/scripts/repair-provisioned-roles.ts`](../../apps/dealer/scripts/repair-provisioned-roles.ts)
- [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts)
- [`apps/dealer/app/api/inventory/[id]/listings/route.ts`](../../apps/dealer/app/api/inventory/[id]/listings/route.ts)
- [`apps/dealer/package.json`](../../apps/dealer/package.json)
- [`package.json`](../../package.json)

Focused tests:
- [`apps/dealer/lib/constants/permissions.test.ts`](../../apps/dealer/lib/constants/permissions.test.ts)
- [`apps/dealer/app/api/inventory/[id]/listings/route.test.ts`](../../apps/dealer/app/api/inventory/[id]/listings/route.test.ts)

Canonical docs:
- [`INDEX.md`](./INDEX.md)
- [`ARCHITECTURE_CANONICAL.md`](./ARCHITECTURE_CANONICAL.md)
- [`MODULE_REGISTRY_CANONICAL.md`](./MODULE_REGISTRY_CANONICAL.md)
- [`API_SURFACE_CANONICAL.md`](./API_SURFACE_CANONICAL.md)
- [`KNOWN_GAPS_AND_FUTURE_WORK.md`](./KNOWN_GAPS_AND_FUTURE_WORK.md)
- [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md)

## 5. Old-To-New Permission Mapping Applied

Direct runtime/catalog mappings:
- `audit.read` -> `admin.audit.read`
- `inventory.publish.read` -> `inventory.read`

Role-template normalization applied through exact seeded role/template sets:
- `customers.create`, `customers.update`, `customers.delete`, `customers.export` -> removed from canonical model; seeded roles/templates now use `customers.write` where write access is intended
- `crm.create`, `crm.update`, `crm.delete`, `crm.export` -> removed from canonical model; seeded roles/templates now use `crm.write`
- `deals.create`, `deals.update`, `deals.delete`, `deals.export`, `deals.approve` -> removed from canonical model; seeded roles/templates now use `deals.write`
- `finance.update`, `finance.approve` -> removed from canonical model; seeded roles/templates now use `finance.write`
- `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.export` -> removed from canonical model; seeded roles/templates now use `inventory.write`

Important migration boundary:
- The normalization script does not blanket-map dormant granular CRUD permissions onto arbitrary custom roles.
- Instead, it re-syncs deterministic seeded roles/templates and removes obsolete keys from the catalog and old assignments.
- This avoids silently broadening permissions for custom roles that previously held dormant keys with no live runtime effect.

## 6. Permissions Removed From The Dealer Canonical Model

Removed as wrong-layer or legacy:
- `audit.read`
- `platform.admin.read`
- `platform.admin.write`
- `platform.read`
- `platform.write`
- `platform.impersonate`

Removed as non-canonical dormant CRUD/action vocabulary:
- `inventory.create`
- `inventory.update`
- `inventory.delete`
- `inventory.export`
- `customers.create`
- `customers.update`
- `customers.delete`
- `customers.export`
- `crm.create`
- `crm.update`
- `crm.delete`
- `crm.export`
- `deals.create`
- `deals.update`
- `deals.delete`
- `deals.export`
- `deals.approve`
- `finance.update`
- `finance.approve`

Removed as non-canonical dormant families:
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

Removed as non-canonical one-sided read exception:
- `inventory.publish.read`

## 7. Compatibility And Migration Handling Added

Added:
- [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts)

Script behavior:
- upserts canonical permission rows
- migrates the two direct old-to-new aliases
- re-syncs seeded system roles by name:
  - `Owner`
  - `Admin`
  - `Sales`
  - `Finance`
- re-syncs deterministic DealerCenter template roles by `Role.key`
- removes obsolete role-permission rows and user overrides for deleted dealer permission keys
- deletes obsolete `Permission` rows

Operational commands:
- app-level: `npm run db:normalize-rbac --prefix apps/dealer`
- root-level: `npm run db:normalize:dealer-rbac`

## 8. Remaining Reserved Or Non-Canonical Families

Dealer runtime model:
- none

Historical-only items:
- older RBAC audit/deprecation docs in `docs/canonical` still describe the pre-normalization state for audit traceability

Platform note:
- platform access remains role-based in [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts), not permission-string-based

## 9. Focused Validation

Focused tests added or updated:
- [`apps/dealer/lib/constants/permissions.test.ts`](../../apps/dealer/lib/constants/permissions.test.ts)
- [`apps/dealer/app/api/inventory/[id]/listings/route.test.ts`](../../apps/dealer/app/api/inventory/[id]/listings/route.test.ts)

Focused test runs completed:
- `npm -w dealer test -- --runInBand 'apps/dealer/lib/constants/permissions.test.ts' 'apps/dealer/app/api/dashboard/layout/route.test.ts' 'apps/dealer/modules/core-platform/tests/rbac.test.ts'`
- `npm -w dealer test -- --runInBand --runTestsByPath 'app/api/inventory/[id]/listings/route.test.ts'`

Validated outcomes:
- canonical catalog contains only normalized dealer permission keys
- seeded role sets and DealerCenter templates reference only canonical keys
- dashboard permission remediation still passes
- inventory listings route now enforces `inventory.read`

## 10. Follow-Up Recommendations

1. Run the normalization script in every non-reset dealer environment before relying on the new catalog in role-admin workflows.
2. If needed, audit existing custom roles after normalization to decide whether any should be manually granted broader canonical `.write` permissions.
3. Keep new dealer modules on the normalized pattern instead of adding new action-specific keys.
