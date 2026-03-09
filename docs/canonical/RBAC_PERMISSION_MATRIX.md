# RBAC Permission Matrix

Historical note:
- This matrix captures the pre-normalization dealer RBAC state after the targeted remediation sprint.
- The current normalized dealer permission model is recorded in [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md).

This matrix is derived from direct code scanning on March 9, 2026 after the targeted RBAC remediation sprint.

Columns:
- `Seeded`: present in `apps/dealer/prisma/seed.ts` `PERMISSIONS`.
- `Used`: referenced outside seed/templates/scripts in runtime dealer code.
- `Route/UI/Service/Test`: number of files with matching permission-string references in those buckets.

## admin

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `admin.audit.read` | Yes | Yes | 1 | 2 | 1 | 1 | `apps/dealer/app/api/audit/route.ts`<br>`apps/dealer/app/page.tsx`<br>`apps/dealer/modules/core-platform/tests/rbac.test.ts` | Canonical audit-log read permission; legacy `audit.read` alias has been removed from the dealer seed catalog. |
| `admin.dealership.read` | Yes | Yes | 5 | 3 | 1 | 9 | `apps/dealer/app/api/admin/dealership/locations/route.ts`<br>`apps/dealer/app/api/admin/dealership/route.ts`<br>`apps/dealer/app/api/customers/route.integration.test.ts` | Active runtime usage. |
| `admin.dealership.write` | Yes | Yes | 5 | 1 | 1 | 0 | `apps/dealer/app/api/admin/dealership/locations/[id]/route.ts`<br>`apps/dealer/app/api/admin/dealership/locations/route.ts`<br>`apps/dealer/app/api/admin/dealership/route.ts` | Active runtime usage. |
| `admin.memberships.read` | Yes | Yes | 4 | 8 | 1 | 1 | `apps/dealer/app/(app)/admin/users/[userId]/page.tsx`<br>`apps/dealer/app/api/admin/memberships/[id]/route.ts`<br>`apps/dealer/app/api/admin/memberships/route.ts` | Active runtime usage. |
| `admin.memberships.write` | Yes | Yes | 2 | 1 | 1 | 1 | `apps/dealer/app/api/admin/memberships/[id]/route.ts`<br>`apps/dealer/app/api/admin/memberships/route.ts`<br>`apps/dealer/modules/core-platform/tests/rbac.test.ts` | Active runtime usage. |
| `admin.permissions.manage` | Yes | Yes | 3 | 2 | 0 | 0 | `apps/dealer/app/(app)/admin/users/[userId]/page.tsx`<br>`apps/dealer/app/api/admin/inventory/vehicle-photos/backfill/apply/route.ts`<br>`apps/dealer/app/api/admin/inventory/vehicle-photos/backfill/preview/route.ts` | Active runtime usage. |
| `admin.permissions.read` | Yes | Yes | 1 | 0 | 0 | 2 | `apps/dealer/app/api/admin/permissions/route.ts`<br>`apps/dealer/modules/core-platform/tests/rbac-dealercenter.test.ts`<br>`apps/dealer/modules/core-platform/tests/rbac.test.ts` | Active runtime usage. |
| `admin.roles.assign` | Yes | Yes | 1 | 2 | 0 | 0 | `apps/dealer/app/(app)/admin/users/[userId]/page.tsx`<br>`apps/dealer/app/api/admin/users/[userId]/roles/route.ts`<br>`apps/dealer/modules/core-platform/ui/UsersPage.tsx` | Active runtime usage. |
| `admin.roles.read` | Yes | Yes | 2 | 3 | 1 | 0 | `apps/dealer/app/api/admin/roles/[id]/route.ts`<br>`apps/dealer/app/api/admin/roles/route.ts`<br>`apps/dealer/app/page.tsx` | Active runtime usage. |
| `admin.roles.write` | Yes | Yes | 5 | 1 | 1 | 1 | `apps/dealer/app/api/admin/inventory/vehicle-photos/backfill/apply/route.ts`<br>`apps/dealer/app/api/admin/inventory/vehicle-photos/backfill/backfill.route.test.ts`<br>`apps/dealer/app/api/admin/inventory/vehicle-photos/backfill/preview/route.ts` | Active runtime usage. |
| `admin.settings.manage` | Yes | Yes | 0 | 0 | 2 | 1 | `apps/dealer/modules/customers/service/saved-filters.ts`<br>`apps/dealer/modules/customers/service/saved-searches.ts`<br>`apps/dealer/modules/customers/tests/saved-filters-searches.integration.test.ts` | Used only inside customer saved-filter/search services, not at route boundary by design. |
| `admin.users.disable` | Yes | Yes | 1 | 0 | 0 | 0 | `apps/dealer/app/api/admin/memberships/[id]/route.ts` | Active runtime usage. |
| `admin.users.invite` | Yes | Yes | 1 | 1 | 0 | 0 | `apps/dealer/app/api/admin/memberships/route.ts`<br>`apps/dealer/modules/core-platform/ui/UsersPage.tsx` | Active runtime usage. |
| `admin.users.read` | Yes | Yes | 4 | 2 | 0 | 1 | `apps/dealer/app/(app)/admin/users/[userId]/page.tsx`<br>`apps/dealer/app/api/admin/memberships/[id]/route.ts`<br>`apps/dealer/app/api/admin/memberships/route.ts` | Active runtime usage. |
| `admin.users.update` | Yes | Yes | 1 | 0 | 0 | 0 | `apps/dealer/app/api/admin/memberships/[id]/route.ts` | Active runtime usage. |

## dashboard

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `dashboard.read` | Yes | Yes | 6 | 3 | 1 | 0 | `apps/dealer/app/(app)/dashboard/page.tsx`<br>`apps/dealer/app/api/dashboard/layout/reset/route.ts`<br>`apps/dealer/app/api/dashboard/layout/route.test.ts` | Canonical dashboard access permission across seed, page, nav, and dashboard APIs. |

## inventory

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `inventory.acquisition.read` | Yes | Yes | 4 | 3 | 0 | 0 | `apps/dealer/app/(app)/inventory/acquisition/page.tsx`<br>`apps/dealer/app/api/intelligence/jobs/run/route.ts`<br>`apps/dealer/app/api/intelligence/signals/route.ts` | Active runtime usage. |
| `inventory.acquisition.write` | Yes | Yes | 3 | 1 | 0 | 0 | `apps/dealer/app/(app)/inventory/acquisition/page.tsx`<br>`apps/dealer/app/api/inventory/acquisition/[id]/move-stage/route.ts`<br>`apps/dealer/app/api/inventory/acquisition/[id]/route.ts` | Active runtime usage. |
| `inventory.appraisals.read` | Yes | Yes | 2 | 1 | 0 | 0 | `apps/dealer/app/(app)/inventory/appraisals/page.tsx`<br>`apps/dealer/app/api/inventory/appraisals/[id]/route.ts`<br>`apps/dealer/app/api/inventory/appraisals/route.ts` | Active runtime usage. |
| `inventory.appraisals.write` | Yes | Yes | 6 | 2 | 0 | 0 | `apps/dealer/app/(app)/inventory/appraisals/page.tsx`<br>`apps/dealer/app/(app)/inventory/auctions/page.tsx`<br>`apps/dealer/app/api/inventory/appraisals/[id]/approve/route.ts` | Active runtime usage. |
| `inventory.auctions.read` | Yes | Yes | 2 | 1 | 0 | 0 | `apps/dealer/app/(app)/inventory/auctions/page.tsx`<br>`apps/dealer/app/api/inventory/auctions/[id]/route.ts`<br>`apps/dealer/app/api/inventory/auctions/search/route.ts` | Active runtime usage. |
| `inventory.create` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `inventory.delete` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `inventory.export` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `inventory.pricing.read` | Yes | Yes | 2 | 2 | 0 | 0 | `apps/dealer/app/(app)/inventory/pricing-rules/page.tsx`<br>`apps/dealer/app/api/inventory/[id]/pricing/preview/route.ts`<br>`apps/dealer/app/api/inventory/pricing-rules/route.ts` | Active runtime usage. |
| `inventory.pricing.write` | Yes | Yes | 4 | 3 | 0 | 0 | `apps/dealer/app/(app)/inventory/pricing-rules/page.tsx`<br>`apps/dealer/app/api/inventory/[id]/pricing/apply/route.ts`<br>`apps/dealer/app/api/inventory/[id]/valuation/recalculate/route.ts` | Active runtime usage. |
| `inventory.publish.read` | Yes | Yes | 1 | 0 | 0 | 0 | `apps/dealer/app/api/inventory/[id]/listings/route.ts` | Active runtime usage. |
| `inventory.publish.write` | Yes | Yes | 2 | 1 | 0 | 0 | `apps/dealer/app/api/inventory/[id]/publish/route.ts`<br>`apps/dealer/app/api/inventory/[id]/unpublish/route.ts`<br>`apps/dealer/modules/inventory/ui/components/VehicleMarketingDistributionCard.tsx` | Active runtime usage. |
| `inventory.read` | Yes | Yes | 44 | 22 | 5 | 17 | `apps/dealer/app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`<br>`apps/dealer/app/(app)/dashboard/__tests__/page.test.tsx`<br>`apps/dealer/app/(app)/inventory/[id]/page.tsx` | Active runtime usage. |
| `inventory.update` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `inventory.write` | Yes | Yes | 39 | 19 | 1 | 7 | `apps/dealer/app/(app)/@modal/(.)inventory/[id]/VehicleDetailModalClient.tsx`<br>`apps/dealer/app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`<br>`apps/dealer/app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx` | Active runtime usage. |

## customers

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `customers.create` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `customers.delete` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `customers.export` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `customers.read` | Yes | Yes | 22 | 10 | 4 | 15 | `apps/dealer/app/(app)/@modal/(.)customers/[id]/CustomerDetailModalClient.tsx`<br>`apps/dealer/app/(app)/@modal/(.)customers/[id]/__tests__/page.test.tsx`<br>`apps/dealer/app/(app)/@modal/(.)customers/[id]/page.tsx` | Active runtime usage. |
| `customers.update` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `customers.write` | Yes | Yes | 15 | 7 | 1 | 3 | `apps/dealer/app/(app)/@modal/(.)customers/[id]/CustomerDetailModalClient.tsx`<br>`apps/dealer/app/(app)/customers/page.tsx`<br>`apps/dealer/app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx` | Active runtime usage. |

## crm

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `crm.create` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `crm.delete` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `crm.export` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `crm.read` | Yes | Yes | 20 | 10 | 4 | 10 | `apps/dealer/app/(app)/@modal/(.)customers/[id]/CustomerDetailModalClient.tsx`<br>`apps/dealer/app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`<br>`apps/dealer/app/(app)/dashboard/__tests__/switchDealership-render.test.tsx` | Active runtime usage. |
| `crm.update` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `crm.write` | Yes | Yes | 23 | 7 | 1 | 3 | `apps/dealer/app/api/crm/automation-rules/[ruleId]/route.ts`<br>`apps/dealer/app/api/crm/automation-rules/route.ts`<br>`apps/dealer/app/api/crm/customers/[id]/sequences/route.ts` | Active runtime usage. |

## deals

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `deals.approve` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `deals.create` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `deals.delete` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `deals.export` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `deals.read` | Yes | Yes | 16 | 16 | 4 | 11 | `apps/dealer/app/(app)/@modal/(.)customers/[id]/CustomerDetailModalClient.tsx`<br>`apps/dealer/app/(app)/@modal/(.)customers/[id]/__tests__/page.test.tsx`<br>`apps/dealer/app/(app)/@modal/(.)deals/[id]/page.tsx` | Active runtime usage. |
| `deals.update` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `deals.write` | Yes | Yes | 16 | 7 | 1 | 2 | `apps/dealer/app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`<br>`apps/dealer/app/api/deals/[id]/delivery/complete/route.ts`<br>`apps/dealer/app/api/deals/[id]/delivery/ready/route.ts` | Active runtime usage. |

## documents

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `documents.read` | Yes | Yes | 6 | 11 | 1 | 5 | `apps/dealer/app/(app)/@modal/(.)inventory/[id]/VehicleDetailModalClient.tsx`<br>`apps/dealer/app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx`<br>`apps/dealer/app/api/documents/route.ts` | Active runtime usage. |
| `documents.write` | Yes | Yes | 11 | 6 | 1 | 4 | `apps/dealer/app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx`<br>`apps/dealer/app/api/documents/[documentId]/route.ts`<br>`apps/dealer/app/api/documents/upload/route.ts` | Active runtime usage. |

## finance

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `finance.approve` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `finance.read` | Yes | Yes | 4 | 3 | 1 | 3 | `apps/dealer/app/api/deals/[id]/finance/products/route.ts`<br>`apps/dealer/app/api/deals/[id]/finance/route.ts`<br>`apps/dealer/app/api/inventory/[id]/floorplan/route.ts` | Active runtime usage. |
| `finance.submissions.read` | Yes | Yes | 28 | 15 | 1 | 1 | `apps/dealer/app/(app)/accounting/layout.tsx`<br>`apps/dealer/app/api/accounting/accounts/route.ts`<br>`apps/dealer/app/api/accounting/export/route.ts` | Active runtime usage. |
| `finance.submissions.write` | Yes | Yes | 26 | 6 | 1 | 1 | `apps/dealer/app/api/accounting/accounts/route.ts`<br>`apps/dealer/app/api/accounting/transactions/[id]/entries/route.ts`<br>`apps/dealer/app/api/accounting/transactions/[id]/post/route.ts` | Active runtime usage. |
| `finance.update` | Yes | No | 0 | 0 | 0 | 0 | - | Catalog/template only; runtime mostly enforces coarse read/write keys instead. |
| `finance.write` | Yes | Yes | 7 | 2 | 1 | 3 | `apps/dealer/app/api/deals/[id]/finance/products/[productId]/route.ts`<br>`apps/dealer/app/api/deals/[id]/finance/products/route.ts`<br>`apps/dealer/app/api/deals/[id]/finance/route.ts` | Active runtime usage. |

## lenders

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `lenders.read` | Yes | Yes | 2 | 4 | 2 | 5 | `apps/dealer/app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`<br>`apps/dealer/app/api/lenders/[id]/route.ts`<br>`apps/dealer/app/api/lenders/route.ts` | Active runtime usage. |
| `lenders.write` | Yes | Yes | 2 | 1 | 1 | 1 | `apps/dealer/app/api/lenders/[id]/route.ts`<br>`apps/dealer/app/api/lenders/route.ts`<br>`apps/dealer/modules/lender-integration/tests/integration.test.ts` | Active runtime usage. |

## reports

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `reports.export` | Yes | Yes | 2 | 1 | 1 | 1 | `apps/dealer/app/api/reports/export/inventory/route.ts`<br>`apps/dealer/app/api/reports/export/sales/route.ts`<br>`apps/dealer/modules/provisioning/service/provision.ts` | Used for export routes only; navigation visibility is intentionally tied to `reports.read`. |
| `reports.read` | Yes | Yes | 6 | 2 | 1 | 1 | `apps/dealer/app/api/reports/finance-penetration/route.ts`<br>`apps/dealer/app/api/reports/inventory-aging/route.ts`<br>`apps/dealer/app/api/reports/mix/route.ts` | Required by the main reports page and reports navigation entry point. |

## appointments

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `appointments.cancel` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |
| `appointments.create` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |
| `appointments.read` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |
| `appointments.update` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |

## bhph

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `bhph.read` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |
| `bhph.write` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |

## integrations

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `integrations.manage` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |
| `integrations.quickbooks.read` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |
| `integrations.quickbooks.write` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |
| `integrations.read` | Yes | No | 0 | 0 | 0 | 0 | - | Seeded/cataloged but no runtime references found outside seed/templates. |

## platform

| Permission | Seeded | Used | Route | UI | Service | Test | Sample refs | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| `platform.admin.read` | Yes | No | 0 | 0 | 0 | 0 | - | Dealer seed only; runtime platform access uses `PlatformAdmin` helper or platform app roles. |
| `platform.admin.write` | Yes | No | 0 | 0 | 0 | 0 | - | Dealer seed only; runtime platform access uses `PlatformAdmin` helper or platform app roles. |
| `platform.impersonate` | Yes | No | 0 | 0 | 0 | 0 | - | Dealer seed only; runtime platform access uses `PlatformAdmin` helper or platform app roles. |
| `platform.read` | Yes | No | 0 | 0 | 0 | 0 | - | Dealer seed only; runtime platform access uses `PlatformAdmin` helper or platform app roles. |
| `platform.write` | Yes | No | 0 | 0 | 0 | 0 | - | Dealer seed only; runtime platform access uses `PlatformAdmin` helper or platform app roles. |
