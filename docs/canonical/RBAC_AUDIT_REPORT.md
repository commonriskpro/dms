# RBAC Audit Report

Historical note:
- This file captures the pre-remediation audit state from March 9, 2026.
- Confirmed findings around `dashboard.read`, dealer `audit.read`, and Reports nav visibility were remediated afterward.
- Current post-remediation state is recorded in [`RBAC_REMEDIATION_REPORT.md`](./RBAC_REMEDIATION_REPORT.md) and [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md).

This report is a code-truth RBAC audit of the repository as inspected on March 9, 2026.

Scope and guardrails:
- Audit only. No runtime behavior, route guards, seed logic, or auth flows were changed in this sprint.
- `docs/canonical/INDEX.md` remains the canonical documentation entry point.
- Facts below are grounded in direct inspection of dealer and platform code, seeds, helpers, routes, UI guards, and RBAC-focused tests.

## 1. Executive Summary

Key facts:
- Dealer app RBAC is permission-string based.
- Dealer seed catalog currently defines `77` permissions in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts).
- Dealer code references `78` permission strings in runtime and tests.
- The only permission referenced in code but missing from the dealer seed catalog is `dashboard.read`.
- Platform app RBAC is role-based, not permission-string based. Its enforced roles are `PLATFORM_OWNER`, `PLATFORM_COMPLIANCE`, and `PLATFORM_SUPPORT` in [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts).
- Dealer-side "platform admin" access is a separate model backed by [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts), not by seeded `platform.*` permission strings.

Highest-signal mismatches:
1. `dashboard.read` is enforced by dashboard API routes but is not present in the dealer permission seed catalog.
2. The dashboard surface is internally inconsistent:
   - [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts) and [`apps/dealer/app/api/dashboard/v3/route.ts`](../../apps/dealer/app/api/dashboard/v3/route.ts) require `dashboard.read`.
   - [`apps/dealer/app/(app)/dashboard/page.tsx`](../../apps/dealer/app/(app)/dashboard/page.tsx) still grants access based on `customers.read` or `crm.read` and calls the dashboard service directly.
   - Dashboard layout/task endpoints still use `customers.read` / `crm.read` via `guardAnyPermission(...)`.
3. Multiple seeded permissions are catalog/template-only and are not enforced anywhere in runtime dealer code. The most obvious groups are `appointments.*`, `bhph.*`, `platform.*`, `integrations.*`, and many granular CRUD keys such as `inventory.create` or `customers.delete`.
4. `audit.read` exists in seed data, but runtime enforcement uses `admin.audit.read` instead.
5. The dealer UI/navigation contains a few looser visibility rules than the underlying page/API permission model. The clearest example is Reports navigation visibility.

## 2. Method Used

Primary source files inspected:
- Dealer seed/catalog: [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- Dealer RBAC helpers: [`apps/dealer/lib/rbac.ts`](../../apps/dealer/lib/rbac.ts), [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)
- Dealer platform-admin helper: [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)
- Dealer session/UI guard files:
  - [`apps/dealer/contexts/session-context.tsx`](../../apps/dealer/contexts/session-context.tsx)
  - [`apps/dealer/components/auth-guard.tsx`](../../apps/dealer/components/auth-guard.tsx)
  - [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts)
  - [`apps/dealer/components/ui-system/navigation/AppSidebar.tsx`](../../apps/dealer/components/ui-system/navigation/AppSidebar.tsx)
  - [`apps/dealer/components/ui-system/navigation/TopCommandBar.tsx`](../../apps/dealer/components/ui-system/navigation/TopCommandBar.tsx)
- Platform auth/roles: [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts), [`apps/platform/scripts/seed-owner.ts`](../../apps/platform/scripts/seed-owner.ts)
- Dealer and platform route trees under `apps/*/app/api/**`
- RBAC-related tests under `apps/dealer/modules/**/tests`, `apps/dealer/app/api/**/*.test.ts`, and `apps/platform/app/api/platform/**/*.test.ts`

Audit approach:
1. Extract dealer seeded permission keys from `PERMISSIONS` in `seed.ts`.
2. Extract platform role constants and role guards from platform auth code.
3. Scan dealer and platform code for permission-string and role usage in:
   - route guards
   - server services
   - page/UI conditionals
   - navigation visibility
   - tests
4. Compare seed/catalog inventory against actual code usage.
5. Manually review suspicious routes where a simple string scan could miss helper indirection.

Inference boundary:
- When a file directly calls `guardPermission`, `guardAnyPermission`, `requirePermission`, `requirePlatformRole`, or `requirePlatformAdmin`, this report treats that as a direct fact.
- When a route relies on a downstream service to filter by permissions instead of guarding at the route boundary, this report marks that explicitly as service-level gating.

## 3. Seeded / Catalog Permission Inventory

### Dealer seed catalog

Dealer permission source of truth:
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)

Dealer seed summary by prefix:

| Prefix | Count |
|---|---:|
| `admin` | 15 |
| `inventory` | 15 |
| `customers` | 6 |
| `crm` | 6 |
| `deals` | 7 |
| `finance` | 6 |
| `platform` | 5 |
| `appointments` | 4 |
| `integrations` | 4 |
| `documents` | 2 |
| `lenders` | 2 |
| `reports` | 2 |
| `bhph` | 2 |
| `audit` | 1 |

Dealer role catalogs in the same seed file:
- Default/system role sets: `Owner`, `Admin`, `Sales`, `Finance`
- DealerCenter role templates:
  - `SALES_ASSOCIATE`
  - `SALES_MANAGER`
  - `ACCOUNTING`
  - `ADMIN_ASSISTANT`
  - `INVENTORY_MANAGER`
  - `DEALER_ADMIN`
  - `OWNER`

Important implementation detail:
- Dealer permissions are stored as DB rows and evaluated dynamically.
- There is no central TypeScript enum for dealer permissions.
- Most dealer code passes raw permission strings through `string[]` collections.

### Dealer permission helper model

Dealer helper files:
- [`apps/dealer/lib/rbac.ts`](../../apps/dealer/lib/rbac.ts)
- [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)

Observed model:
- Effective permissions are the union of assigned role permissions.
- If `UserRole` grants are absent, code falls back to `Membership.role`.
- `UserPermissionOverride` rows can explicitly add or remove a permission.
- Default behavior is deny-by-absence.
- There is no aliasing or compatibility layer between old and new permission names.

### Platform catalog model

Platform source of truth:
- [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts)

Platform RBAC is role-based:
- `PLATFORM_OWNER`
- `PLATFORM_COMPLIANCE`
- `PLATFORM_SUPPORT`

Important separation:
- Platform app does not use the dealer seed permission catalog.
- Dealer-side seeded `platform.*` permissions are not the same thing as platform app roles.

## 4. Permission Constants, Types, and Guard Helpers Used in Code

Dealer-side access control artifacts:
- `loadUserPermissions(userId, dealershipId)`
- `requirePermission(userId, dealershipId, permissionKey)`
- `guardPermission(ctx, permissionKey)`
- `guardAnyPermission(ctx, permissionKeys)`
- `AuthContext.permissions: string[]`
- `SessionContext.hasPermission(key: string)`
- `RequirePermission` component in [`apps/dealer/components/auth-guard.tsx`](../../apps/dealer/components/auth-guard.tsx)

Dealer-side non-permission access helpers:
- `requirePlatformAdmin(userId)` in [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)
- Auth-only wrappers such as `requireUser()` and `requireUserFromRequest(...)`

Platform-side access control artifacts:
- `requirePlatformAuth()`
- `requirePlatformRole(user, allowedRoles)`
- `AllowedPlatformRole`

## 5. Permission Usage Inventory by Domain

Detailed row-by-row results live in [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md).

High-signal runtime usage patterns:

### Dealer admin
- `admin.dealership.*`, `admin.memberships.*`, `admin.roles.*`, `admin.users.*`, `admin.permissions.*`, and `admin.audit.read` are all genuinely used.
- `admin.settings.manage` is real, but its enforcement is service-level inside:
  - [`apps/dealer/modules/customers/service/saved-filters.ts`](../../apps/dealer/modules/customers/service/saved-filters.ts)
  - [`apps/dealer/modules/customers/service/saved-searches.ts`](../../apps/dealer/modules/customers/service/saved-searches.ts)

### Inventory
- Runtime enforcement is dominated by coarse keys:
  - `inventory.read`
  - `inventory.write`
- Granular inventory subdomain keys are genuinely enforced:
  - `inventory.acquisition.read/write`
  - `inventory.appraisals.read/write`
  - `inventory.auctions.read`
  - `inventory.pricing.read/write`
  - `inventory.publish.read/write`
- Seeded CRUD keys `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.export` are not runtime-enforced anywhere outside seed/template references.

### Customers / CRM
- Runtime enforcement is dominated by:
  - `customers.read`
  - `customers.write`
  - `crm.read`
  - `crm.write`
- Granular catalog keys such as `customers.create`, `crm.export`, `crm.delete`, and similar are seeded but not runtime-enforced.
- Inbox is notable:
  - Sidebar visibility is OR-based over `crm.read` and `customers.read`.
  - [`apps/dealer/app/api/crm/inbox/conversations/route.ts`](../../apps/dealer/app/api/crm/inbox/conversations/route.ts) enforces `customers.read`, not `crm.read`.

### Deals / finance / lenders
- Deal routes mostly use `deals.read` and `deals.write`.
- Finance shell routes use `finance.read` and `finance.write`.
- Lender submission and several finance-reporting routes use:
  - `finance.submissions.read`
  - `finance.submissions.write`
- Seeded granular keys such as `deals.create`, `deals.approve`, `finance.update`, and `finance.approve` are not runtime-enforced outside seed/template references.

### Reports
- Main reports page requires `reports.read` in UI logic.
- Export buttons are separately gated by `reports.export`.
- Some report families are not guarded by `reports.read`; they use `finance.submissions.read` instead:
  - dealer profit
  - inventory ROI
  - salesperson performance

### Platform
- Dealer-side platform routes use `requirePlatformAdmin(...)`, not seeded `platform.*` keys.
- Platform app routes use platform roles, not dealer permission strings.

## 6. Seed-vs-Code Mismatch Table

| Finding | Classification | Evidence |
|---|---|---|
| `dashboard.read` used in code but absent from dealer seed catalog | Missing in seed/catalog | Enforced in [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts) and [`apps/dealer/app/api/dashboard/v3/route.ts`](../../apps/dealer/app/api/dashboard/v3/route.ts); not present in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts) |
| `audit.read` seeded but runtime uses `admin.audit.read` | Naming drift / likely superseded alias | `audit.read` only appears in seed/template construction; runtime route is [`apps/dealer/app/api/audit/route.ts`](../../apps/dealer/app/api/audit/route.ts) with `admin.audit.read` |
| Seeded dealer `platform.*` permissions are not consumed by runtime enforcement | Catalog/runtime model drift | Dealer runtime uses [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts); platform app uses roles in [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts) |
| Many granular CRUD keys are catalog-only while routes enforce coarse `.write` or `.read` keys | Partial granularity drift | Examples: `inventory.create`, `customers.delete`, `crm.export`, `deals.approve`, `finance.update` |
| `appointments.*` seeded but not enforced anywhere in runtime dealer code | Seeded but unused | No runtime references found outside seed/template role definitions |
| Reports navigation visibility can be broader than page access | UI/guard drift | Sidebar uses OR semantics over `["reports.read", "reports.export"]` in [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts) and [`AppSidebar.tsx`](../../apps/dealer/components/ui-system/navigation/AppSidebar.tsx); page itself requires `reports.read` in [`apps/dealer/modules/reports/ui/ReportsPage.tsx`](../../apps/dealer/modules/reports/ui/ReportsPage.tsx) |
| Dashboard access model is internally inconsistent | Inconsistent guard pattern | Dashboard page and some dashboard APIs still rely on `customers.read` / `crm.read`, while top-level dashboard APIs require `dashboard.read` |
| `admin.settings.manage` is enforced in services but not at route boundary | Inconsistent guard placement | [`apps/dealer/modules/customers/service/saved-filters.ts`](../../apps/dealer/modules/customers/service/saved-filters.ts), [`saved-searches.ts`](../../apps/dealer/modules/customers/service/saved-searches.ts) |

## 7. Dealer vs Platform Separation

### Dealer app

Dealer app uses:
- membership + assigned roles + overrides
- permission strings
- tenant-scoped permission evaluation per dealership

Main helper path:
- [`apps/dealer/lib/rbac.ts`](../../apps/dealer/lib/rbac.ts)

### Dealer-side platform-admin overlay

Dealer app also has a separate cross-tenant admin concept:
- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)

That model is used for routes such as:
- [`apps/dealer/app/api/cache/stats/route.ts`](../../apps/dealer/app/api/cache/stats/route.ts)
- [`apps/dealer/app/api/metrics/route.ts`](../../apps/dealer/app/api/metrics/route.ts)
- dealer session/context helpers that still surface `platformAdmin.isAdmin`

This is not driven by seeded `platform.*` permission keys.

### Platform app

Platform app uses:
- authenticated platform users
- DB-backed role field on `PlatformUser`
- `requirePlatformRole(...)`

Observed role families in platform APIs:
- Read/reporting families commonly allow all three roles.
- Sensitive mutations are usually `PLATFORM_OWNER` only.
- Some provisioning/application lifecycle mutations allow `PLATFORM_COMPLIANCE` alongside `PLATFORM_OWNER`.
- Session/verification endpoints are auth-only and intentionally omit role restrictions.

## 8. `dashboard.read` Analysis

This permission is a real mismatch, not a scan artifact.

Direct evidence:
- Enforced in [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts)
- Enforced in [`apps/dealer/app/api/dashboard/v3/route.ts`](../../apps/dealer/app/api/dashboard/v3/route.ts)
- Absent from the dealer seed catalog in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)

Related inconsistency:
- [`apps/dealer/app/(app)/dashboard/page.tsx`](../../apps/dealer/app/(app)/dashboard/page.tsx) still allows access when the session has `customers.read` or `crm.read`.
- That same page calls [`apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`](../../apps/dealer/modules/dashboard/service/getDashboardV3Data.ts) directly, and that service derives visibility from the passed permission array rather than checking `dashboard.read`.
- Dashboard layout and customer-task endpoints also still use `guardAnyPermission(ctx, ["customers.read", "crm.read"])`.

Conclusion:
- `dashboard.read` is truly missing from seeds.
- The dashboard family currently mixes two access models:
  - new model: explicit `dashboard.read`
  - older model: `customers.read` / `crm.read`

## 9. Suspected Dead or Dormant Permissions

The following seeded dealer permissions have no runtime references outside seed/template/script/test scaffolding:

Clearly dormant families:
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
- `platform.admin.read`
- `platform.admin.write`
- `platform.read`
- `platform.write`
- `platform.impersonate`
- `audit.read`

Granular catalog keys that appear to be template/catalog-only in current runtime:
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

Interpretation:
- These keys are not necessarily mistakes.
- They may be intentional future-granularity targets or role-template vocabulary.
- They are not part of current runtime enforcement in a meaningful way.

## 10. Suspected Missing Permissions

Confirmed missing from seed/catalog:
- `dashboard.read`

No other dealer permission string was found to be enforced in runtime code while missing from the seed catalog.

## 11. Inconsistent Guard Patterns

These are the most important guard-shape inconsistencies found:

### Dashboard family

Files:
- [`apps/dealer/app/(app)/dashboard/page.tsx`](../../apps/dealer/app/(app)/dashboard/page.tsx)
- [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts)
- [`apps/dealer/app/api/dashboard/v3/route.ts`](../../apps/dealer/app/api/dashboard/v3/route.ts)
- [`apps/dealer/app/api/dashboard/layout/route.ts`](../../apps/dealer/app/api/dashboard/layout/route.ts)
- [`apps/dealer/app/api/dashboard/v3/customer-tasks/route.ts`](../../apps/dealer/app/api/dashboard/v3/customer-tasks/route.ts)

Observed drift:
- top-level dashboard APIs require `dashboard.read`
- page render and related widget/layout endpoints still use `customers.read` / `crm.read`

### Search

Files:
- [`apps/dealer/app/api/search/route.ts`](../../apps/dealer/app/api/search/route.ts)
- [`apps/dealer/modules/search/service/global-search.ts`](../../apps/dealer/modules/search/service/global-search.ts)

Observed pattern:
- route boundary is auth-only
- service filters searchable entity types by `customers.read`, `deals.read`, and `inventory.read`

Assessment:
- not an obvious data leak
- but permission enforcement sits in the service instead of the route boundary

### Reports nav vs page

Files:
- [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts)
- [`apps/dealer/components/ui-system/navigation/AppSidebar.tsx`](../../apps/dealer/components/ui-system/navigation/AppSidebar.tsx)
- [`apps/dealer/modules/reports/ui/ReportsPage.tsx`](../../apps/dealer/modules/reports/ui/ReportsPage.tsx)

Observed drift:
- sidebar arrays are OR-based
- Reports nav appears for `reports.read` or `reports.export`
- page access still requires `reports.read`

### Service-level `admin.settings.manage`

Files:
- [`apps/dealer/modules/customers/service/saved-filters.ts`](../../apps/dealer/modules/customers/service/saved-filters.ts)
- [`apps/dealer/modules/customers/service/saved-searches.ts`](../../apps/dealer/modules/customers/service/saved-searches.ts)

Observed pattern:
- routes around customer list/search surfaces are mostly guarded by `customers.read`
- shared-visibility mutations depend on service-level permission checks

### Platform access model split

Files:
- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)
- [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts)
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)

Observed drift:
- dealer seed contains `platform.*` strings
- dealer runtime platform actions use platform-admin table membership
- platform app uses role enums

## 12. Potentially Risky Under-Guarded Areas

These are not confirmed vulnerabilities, but they are the areas most worth human review:

1. Dashboard page/server rendering path
   - The page bypasses the new `dashboard.read` gate by calling the service directly with older permission checks.
2. Search route boundary
   - It is authenticated and tenant-scoped, but not explicitly route-guarded by any one permission.
   - Safety currently depends on the downstream service filtering result types by permission.
3. Reports navigation visibility
   - Users with `reports.export` but not `reports.read` can still discover the Reports page entry point.
4. Service-only `admin.settings.manage`
   - Enforcement exists, but not at a consistent route boundary.

## 13. Recommended Safe Next Actions

These are intentionally non-behavioral or low-risk planning actions.

1. Canonicalize the permission vocabulary.
   - Decide whether current runtime should center on coarse keys, granular CRUD keys, or both.
   - Mark dormant keys as intentional-reserved vs legacy.
2. Resolve the dashboard split explicitly.
   - Either add `dashboard.read` to seed and align all dashboard entry points around it, or remove it and return to the older permission model.
   - Do not do this silently; it changes who can access dashboard surfaces.
3. Produce a follow-up route-by-route permission normalization plan.
   - Focus on dashboard, reports, search, and service-level `admin.settings.manage`.
4. Decide what to do with seeded `platform.*` strings.
   - Keep as reserved vocabulary, or remove from the dealer catalog if they are obsolete.
5. Decide whether granular CRUD keys should become enforceable or remain template-only.
   - Today they create documentation and role-template complexity without corresponding runtime checks.

## 14. Open Questions Requiring Human Confirmation

1. Is `dashboard.read` intended to become the canonical dashboard permission, or was it added prematurely to only part of the stack?
2. Are seeded `platform.*` permissions intentionally reserved for a future dealer-side permission model, or are they stale leftovers now superseded by platform-admin/role helpers?
3. Are granular CRUD keys such as `inventory.create` and `customers.delete` intended roadmap permissions, or should the catalog be simplified to match current `.read` / `.write` enforcement?
4. Are `appointments.*`, `bhph.*`, and `integrations.*` intentionally dormant, or do they represent incomplete modules that still need runtime guards?
5. Should `reports.export` alone ever make the Reports nav visible, or should page discoverability be tightened to `reports.read`?

## 15. Supporting File

Full per-permission matrix:
- [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md)

This matrix includes:
- seeded status
- runtime usage status
- route/UI/service/test reference counts
- representative file references
- per-permission notes
