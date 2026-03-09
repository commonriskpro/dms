# RBAC Remediation Report

This report records the targeted RBAC remediation sprint completed on March 9, 2026.

Scope:
- behavior-changing fixes only for the confirmed issues from the canonical RBAC audit
- no broad permission-system redesign
- no platform-role architecture changes

## 1. Files Changed

Code and seed changes:
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- [`apps/dealer/modules/provisioning/service/provision.ts`](../../apps/dealer/modules/provisioning/service/provision.ts)
- [`apps/dealer/scripts/repair-provisioned-roles.ts`](../../apps/dealer/scripts/repair-provisioned-roles.ts)
- [`apps/dealer/app/(app)/dashboard/page.tsx`](../../apps/dealer/app/(app)/dashboard/page.tsx)
- [`apps/dealer/app/api/dashboard/layout/route.ts`](../../apps/dealer/app/api/dashboard/layout/route.ts)
- [`apps/dealer/app/api/dashboard/layout/reset/route.ts`](../../apps/dealer/app/api/dashboard/layout/reset/route.ts)
- [`apps/dealer/app/api/dashboard/v3/customer-tasks/route.ts`](../../apps/dealer/app/api/dashboard/v3/customer-tasks/route.ts)
- [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts)
- [`apps/dealer/app/page.tsx`](../../apps/dealer/app/page.tsx)
- [`apps/dealer/modules/customers/service/saved-filters.ts`](../../apps/dealer/modules/customers/service/saved-filters.ts)
- [`apps/dealer/modules/customers/service/saved-searches.ts`](../../apps/dealer/modules/customers/service/saved-searches.ts)
- [`apps/dealer/app/api/dashboard/layout/route.test.ts`](../../apps/dealer/app/api/dashboard/layout/route.test.ts)

Canonical docs updated:
- [`INDEX.md`](./INDEX.md)
- [`API_SURFACE_CANONICAL.md`](./API_SURFACE_CANONICAL.md)
- [`MODULE_REGISTRY_CANONICAL.md`](./MODULE_REGISTRY_CANONICAL.md)
- [`KNOWN_GAPS_AND_FUTURE_WORK.md`](./KNOWN_GAPS_AND_FUTURE_WORK.md)
- [`ADOPTION_NOTES.md`](./ADOPTION_NOTES.md)
- [`RBAC_AUDIT_REPORT.md`](./RBAC_AUDIT_REPORT.md)
- [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md)

## 2. Exact Mismatches Remediated

### `dashboard.read`

Remediation:
- Added `dashboard.read` to the dealer seed catalog in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts).
- Added `dashboard.read` to the default seeded dealer roles that previously had dashboard access:
  - `Owner`
  - `Admin`
  - `Sales`
  - `Finance`
- Added `dashboard.read` to the DealerCenter role templates that previously had dashboard access:
  - `SALES_ASSOCIATE`
  - `SALES_MANAGER`
  - `ADMIN_ASSISTANT`
  - `DEALER_ADMIN`
- Added `dashboard.read` to dealer provisioning and the provisioned-role repair script so non-seeded provisioning paths stay aligned.

Runtime alignment:
- Dashboard page now checks `dashboard.read` in [`apps/dealer/app/(app)/dashboard/page.tsx`](../../apps/dealer/app/(app)/dashboard/page.tsx).
- Dashboard layout routes now require `dashboard.read`:
  - [`apps/dealer/app/api/dashboard/layout/route.ts`](../../apps/dealer/app/api/dashboard/layout/route.ts)
  - [`apps/dealer/app/api/dashboard/layout/reset/route.ts`](../../apps/dealer/app/api/dashboard/layout/reset/route.ts)
- Dashboard customer-task route now requires `dashboard.read`:
  - [`apps/dealer/app/api/dashboard/v3/customer-tasks/route.ts`](../../apps/dealer/app/api/dashboard/v3/customer-tasks/route.ts)
- Dashboard sidebar visibility now requires `dashboard.read` in [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts).
- Root landing redirect now explicitly routes users with `dashboard.read` to `/dashboard` in [`apps/dealer/app/page.tsx`](../../apps/dealer/app/page.tsx).

Intentional non-change:
- Dashboard widget visibility still depends on underlying domain permissions such as `inventory.read`, `customers.read`, `crm.read`, `deals.read`, and `lenders.read`.
- `dashboard.read` is an entry/access permission, not a substitute for domain data permissions.

### Audit permission naming

Canonical name chosen:
- `admin.audit.read`

Remediation:
- Removed legacy dealer seed alias `audit.read` from [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts).
- Updated seed role templates that still referenced `audit.read` to use `admin.audit.read`.

Result:
- Dealer seed/catalog and runtime enforcement now agree on a single audit-read permission name.

### Dashboard access consistency

Remediation:
- Eliminated the mixed `customers.read` / `crm.read` dashboard-substitute checks from:
  - dashboard page
  - dashboard layout routes
  - dashboard customer-task route

Result:
- Dashboard shell access is consistently modeled around `dashboard.read`.
- Dashboard content remains permission-filtered by the underlying domain permissions passed into dashboard services.

### Reports nav mismatch

Remediation:
- Changed Reports sidebar visibility from `["reports.read", "reports.export"]` to `["reports.read"]` in [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts).

Result:
- Navigation discoverability now matches the actual Reports page access model in [`apps/dealer/modules/reports/ui/ReportsPage.tsx`](../../apps/dealer/modules/reports/ui/ReportsPage.tsx).
- `reports.export` remains valid only for export endpoints and export UI inside the reports page.

### `admin.settings.manage` enforcement clarity

Decision:
- Kept service-level enforcement.

Reason:
- Shared-item authorization depends on requested visibility and on the ownership/visibility of an existing saved filter or saved search.
- Route-level `customers.read` remains the coarse boundary.
- Service-level `admin.settings.manage` checks remain the correct place for the shared-item elevation rule.

Clarification added:
- Added inline comments in:
  - [`apps/dealer/modules/customers/service/saved-filters.ts`](../../apps/dealer/modules/customers/service/saved-filters.ts)
  - [`apps/dealer/modules/customers/service/saved-searches.ts`](../../apps/dealer/modules/customers/service/saved-searches.ts)

## 3. Final Canonical Permission Names Affected

Canonicalized in this sprint:
- `dashboard.read`
- `admin.audit.read`
- `reports.read`
- `admin.settings.manage` (documented as service-level shared-item elevation, not route-boundary-only)

Removed from dealer seed catalog:
- `audit.read`

## 4. Validation Summary

Code-level validation performed:
- confirmed `dashboard.read` is now present in the dealer seed catalog
- confirmed `audit.read` is no longer present in active dealer code
- confirmed dashboard page, dashboard layout routes, and dashboard task route now use `dashboard.read`
- confirmed Reports nav visibility now requires `reports.read`
- confirmed `admin.settings.manage` remains service-level only by design

Targeted test update:
- updated [`apps/dealer/app/api/dashboard/layout/route.test.ts`](../../apps/dealer/app/api/dashboard/layout/route.test.ts) from `guardAnyPermission` to `guardPermission`

## 5. Intentionally Unresolved

Still intentionally not addressed in this remediation:
- broader cleanup of dormant seeded permissions such as `appointments.*`, `bhph.*`, `integrations.*`, and many granular CRUD keys
- dealer `platform.*` seeded permissions versus dealer/platform admin role-model separation
- search route permission-boundary shape
- global command-palette permission awareness

These remain follow-up items, not blockers for the targeted fixes above.
