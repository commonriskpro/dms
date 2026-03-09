# Permission Vocabulary Audit

Historical note:
- This audit records the pre-normalization dealer permission vocabulary.
- The current normalized dealer permission model is recorded in [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md).

This document is a non-behavioral audit of the current dealer/platform permission vocabulary after the targeted RBAC remediation completed on March 9, 2026.

Canonical scope:
- dealer permission vocabulary from [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- dealer runtime enforcement and UI usage across `apps/dealer`
- platform control-plane role vocabulary from [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts)

This audit does not change behavior. It classifies the current vocabulary into these buckets:
1. Actively enforced in runtime
2. Used only in UI visibility or navigation
3. Seeded but currently dormant / reserved for planned use
4. Legacy / likely stale
5. Wrong architectural layer
6. Needs human confirmation

## Executive Summary

Current state:
- Dealer app uses a permission-string catalog seeded from [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts).
- Platform app does not use that catalog. It is role-based via [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts).
- After the recent remediation, the dealer runtime vocabulary is internally consistent for the active surfaces:
  - `dashboard.read` is seeded and enforced
  - audit access is canonicalized on `admin.audit.read`
  - Reports nav now matches `reports.read`

Main remaining vocabulary issues:
- No current seeded dealer permission appears to be UI-only; bucket 2 is effectively empty.
- The biggest cleanup area is dormant seeded vocabulary, especially:
  - granular CRUD keys such as `inventory.create` and `customers.delete`
  - ambiguous dormant families such as `appointments.*`, `bhph.*`, and `integrations.*`
- Dealer-seeded `platform.*` keys live at the wrong architectural layer because dealer runtime platform access uses [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts) and platform app runtime uses platform roles in [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts).

## Method

Primary sources inspected:
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- [`apps/dealer/lib/rbac.ts`](../../apps/dealer/lib/rbac.ts)
- [`apps/dealer/lib/api/handler.ts`](../../apps/dealer/lib/api/handler.ts)
- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)
- [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts)
- current code references summarized in [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md)

Classification rules used:
- `Actively enforced in runtime`: referenced by route guards or service-level permission checks that affect live behavior.
- `Used only in UI visibility or navigation`: referenced only in UI components/navigation, with no route/service enforcement.
- `Seeded but dormant / reserved`: present in seed/templates but not meaningfully referenced by runtime enforcement.
- `Legacy / likely stale`: superseded or historical term, no longer part of the canonical current vocabulary.
- `Wrong architectural layer`: vocabulary exists, but current architecture enforces access using a different model.
- `Needs human confirmation`: dormant family exists, but code alone does not establish whether it is intentionally reserved or stale.

## Classification Table

| Bucket | Permission(s) | Why | Primary evidence |
|---|---|---|---|
| `1. Actively enforced in runtime` | `admin.dealership.read`, `admin.dealership.write`, `admin.memberships.read`, `admin.memberships.write`, `admin.roles.read`, `admin.roles.write`, `admin.roles.assign`, `admin.permissions.read`, `admin.permissions.manage`, `admin.users.read`, `admin.users.invite`, `admin.users.update`, `admin.users.disable`, `admin.audit.read` | These are enforced by dealer admin routes and supporting UI. | [`apps/dealer/app/api/admin/dealership/route.ts`](../../apps/dealer/app/api/admin/dealership/route.ts), [`apps/dealer/app/api/admin/memberships/route.ts`](../../apps/dealer/app/api/admin/memberships/route.ts), [`apps/dealer/app/api/admin/roles/route.ts`](../../apps/dealer/app/api/admin/roles/route.ts), [`apps/dealer/app/api/audit/route.ts`](../../apps/dealer/app/api/audit/route.ts) |
| `1. Actively enforced in runtime` | `admin.settings.manage` | This is not a route-boundary permission, but it is actively enforced in live service logic for shared saved filters/searches. | [`apps/dealer/modules/customers/service/saved-filters.ts`](../../apps/dealer/modules/customers/service/saved-filters.ts), [`apps/dealer/modules/customers/service/saved-searches.ts`](../../apps/dealer/modules/customers/service/saved-searches.ts) |
| `1. Actively enforced in runtime` | `dashboard.read` | Canonical dashboard access permission across seed, page, nav, and dashboard APIs. | [`apps/dealer/app/(app)/dashboard/page.tsx`](../../apps/dealer/app/(app)/dashboard/page.tsx), [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts), [`apps/dealer/app/api/dashboard/layout/route.ts`](../../apps/dealer/app/api/dashboard/layout/route.ts), [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts) |
| `1. Actively enforced in runtime` | `inventory.read`, `inventory.write`, `inventory.acquisition.read`, `inventory.acquisition.write`, `inventory.appraisals.read`, `inventory.appraisals.write`, `inventory.auctions.read`, `inventory.pricing.read`, `inventory.pricing.write`, `inventory.publish.read`, `inventory.publish.write` | Inventory runtime actually uses both coarse keys and a small set of real subdomain permissions. | [`apps/dealer/app/api/inventory/route.ts`](../../apps/dealer/app/api/inventory/route.ts), [`apps/dealer/app/api/inventory/acquisition/route.ts`](../../apps/dealer/app/api/inventory/acquisition/route.ts), [`apps/dealer/app/api/inventory/appraisals/route.ts`](../../apps/dealer/app/api/inventory/appraisals/route.ts), [`apps/dealer/app/api/inventory/[id]/publish/route.ts`](../../apps/dealer/app/api/inventory/[id]/publish/route.ts) |
| `1. Actively enforced in runtime` | `customers.read`, `customers.write`, `crm.read`, `crm.write` | Customers and CRM runtime still enforce the coarse read/write pairs, not the granular CRUD keys. | [`apps/dealer/app/api/customers/route.ts`](../../apps/dealer/app/api/customers/route.ts), [`apps/dealer/app/api/crm/opportunities/route.ts`](../../apps/dealer/app/api/crm/opportunities/route.ts), [`apps/dealer/app/api/crm/inbox/conversations/route.ts`](../../apps/dealer/app/api/crm/inbox/conversations/route.ts) |
| `1. Actively enforced in runtime` | `deals.read`, `deals.write` | Deal runtime uses the coarse read/write pair across the main deal surfaces. | [`apps/dealer/app/api/deals/route.ts`](../../apps/dealer/app/api/deals/route.ts), [`apps/dealer/app/api/deals/[id]/route.ts`](../../apps/dealer/app/api/deals/[id]/route.ts) |
| `1. Actively enforced in runtime` | `documents.read`, `documents.write` | Document and file operations enforce these directly. | [`apps/dealer/app/api/documents/route.ts`](../../apps/dealer/app/api/documents/route.ts), [`apps/dealer/app/api/documents/upload/route.ts`](../../apps/dealer/app/api/documents/upload/route.ts), [`apps/dealer/app/api/deal-documents/route.ts`](../../apps/dealer/app/api/deal-documents/route.ts) |
| `1. Actively enforced in runtime` | `finance.read`, `finance.write`, `finance.submissions.read`, `finance.submissions.write`, `lenders.read`, `lenders.write` | Finance shell, lender submission, accounting, and lender directory surfaces actively enforce these. | [`apps/dealer/app/api/deals/[id]/finance/route.ts`](../../apps/dealer/app/api/deals/[id]/finance/route.ts), [`apps/dealer/app/api/deals/[id]/applications/route.ts`](../../apps/dealer/app/api/deals/[id]/applications/route.ts), [`apps/dealer/app/api/accounting/accounts/route.ts`](../../apps/dealer/app/api/accounting/accounts/route.ts), [`apps/dealer/app/api/lenders/route.ts`](../../apps/dealer/app/api/lenders/route.ts) |
| `1. Actively enforced in runtime` | `reports.read`, `reports.export` | Reports page and report export routes actively enforce these; nav now aligns to `reports.read`. | [`apps/dealer/modules/reports/ui/ReportsPage.tsx`](../../apps/dealer/modules/reports/ui/ReportsPage.tsx), [`apps/dealer/app/api/reports/export/inventory/route.ts`](../../apps/dealer/app/api/reports/export/inventory/route.ts), [`apps/dealer/components/ui-system/navigation/navigation.config.ts`](../../apps/dealer/components/ui-system/navigation/navigation.config.ts) |
| `2. Used only in UI visibility or navigation` | None in current dealer seed catalog | After the March 9, 2026 remediation, no seeded dealer permission is referenced only in UI/nav without a corresponding runtime enforcement point. | [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) |
| `3. Seeded but currently dormant / reserved for planned use` | `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.export` | These describe fine-grained inventory CRUD semantics, but current runtime still enforces `inventory.read` / `inventory.write`. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/app/api/inventory/route.ts`](../../apps/dealer/app/api/inventory/route.ts), [`apps/dealer/modules/provisioning/service/provision.ts`](../../apps/dealer/modules/provisioning/service/provision.ts) |
| `3. Seeded but currently dormant / reserved for planned use` | `customers.create`, `customers.update`, `customers.delete`, `customers.export` | Catalog exists, but current runtime uses `customers.read` / `customers.write`. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/app/api/customers/route.ts`](../../apps/dealer/app/api/customers/route.ts) |
| `3. Seeded but currently dormant / reserved for planned use` | `crm.create`, `crm.update`, `crm.delete`, `crm.export` | Catalog exists, but current runtime uses `crm.read` / `crm.write`. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/app/api/crm/opportunities/route.ts`](../../apps/dealer/app/api/crm/opportunities/route.ts) |
| `3. Seeded but currently dormant / reserved for planned use` | `deals.create`, `deals.update`, `deals.delete`, `deals.export`, `deals.approve` | Catalog exists, but current runtime uses `deals.read` / `deals.write`. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/app/api/deals/route.ts`](../../apps/dealer/app/api/deals/route.ts) |
| `3. Seeded but currently dormant / reserved for planned use` | `finance.update`, `finance.approve` | Finance runtime still uses `finance.read` / `finance.write` and `finance.submissions.*`; the finer-grained finance keys are only seed/template vocabulary. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/app/api/deals/[id]/finance/route.ts`](../../apps/dealer/app/api/deals/[id]/finance/route.ts) |
| `4. Legacy / likely stale` | `audit.read` | Historical dealer alias. It is no longer part of the canonical current dealer vocabulary after the recent remediation. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`RBAC_REMEDIATION_REPORT.md`](./RBAC_REMEDIATION_REPORT.md) |
| `5. Wrong architectural layer` | `platform.admin.read`, `platform.admin.write`, `platform.read`, `platform.write`, `platform.impersonate` | These remain in the dealer seed catalog, but dealer runtime uses `PlatformAdmin` and platform runtime uses platform roles. They do not match the active enforcement architecture. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts), [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts) |
| `6. Needs human confirmation` | `appointments.read`, `appointments.create`, `appointments.update`, `appointments.cancel` | Seeded but no meaningful runtime references remain. Code alone does not establish whether this family is reserved for a future appointments module or stale. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) |
| `6. Needs human confirmation` | `bhph.read`, `bhph.write` | Seeded but no current runtime references. There is not enough active code to prove whether BHPH is deferred roadmap or abandoned vocabulary. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) |
| `6. Needs human confirmation` | `integrations.read`, `integrations.manage`, `integrations.quickbooks.read`, `integrations.quickbooks.write` | Seeded but dormant. The repo has real Twilio/SendGrid/webhook code, but these specific permission keys are not meaningfully enforced in current dealer runtime. | [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/modules/integrations`](../../apps/dealer/modules/integrations), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) |

## Recommended Canonical Vocabulary Direction

Recommended direction for the dealer app:
1. Treat the current actively enforced set as the canonical dealer vocabulary.
2. Treat `dashboard.read` as an access-shell permission, separate from underlying domain read permissions.
3. Keep `admin.settings.manage` as a scoped elevation permission for shared settings-like mutations, with service-level enforcement when the rule depends on visibility or ownership.
4. Keep the actually-enforced inventory subfamily keys:
   - `inventory.acquisition.*`
   - `inventory.appraisals.*`
   - `inventory.auctions.read`
   - `inventory.pricing.*`
   - `inventory.publish.*`
5. Keep `finance.submissions.read` / `finance.submissions.write` as a real subfamily distinct from `finance.read` / `finance.write`.

Recommended direction for the platform app:
1. Keep platform access role-based, not permission-string-based.
2. Do not grow the dealer seed catalog to mirror platform roles.
3. Treat dealer-seeded `platform.*` keys as an architectural mismatch pending explicit cleanup.

## Candidates to Keep

Keep as canonical active vocabulary:
- Admin core:
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
  - `inventory.publish.read`
  - `inventory.publish.write`
- Customers / CRM:
  - `customers.read`
  - `customers.write`
  - `crm.read`
  - `crm.write`
- Deals / documents / finance / lenders / reports:
  - `deals.read`
  - `deals.write`
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

## Candidates to Deprecate

Do not deprecate automatically. These are candidates only.

Strongest deprecation candidates:
- `platform.admin.read`
- `platform.admin.write`
- `platform.read`
- `platform.write`
- `platform.impersonate`

Reason:
- current architecture enforces this layer through `PlatformAdmin` and platform roles, not dealer permission strings

Historical/deprecated alias:
- `audit.read`

Reason:
- already superseded by `admin.audit.read`

## Candidates to Move to Future-Work / Reserved Status

Best fit for explicit `reserved` or `future-work` status:
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

Reason:
- these form a coherent future fine-grained permission layer
- current runtime does not enforce them
- they are more plausible as planned granularity than as accidental leftovers

## Open Questions Needing Human Confirmation

1. Should `appointments.*` become a real module with its own runtime guards, or should appointment behavior remain part of CRM/dashboard without dedicated permission keys?
2. Is BHPH still a planned product area for this repo, or are `bhph.read` / `bhph.write` stale leftovers?
3. Are `integrations.*` and `integrations.quickbooks.*` intentionally reserved for a future admin/integration surface, or should they be treated as stale?
4. Should the granular CRUD-style keys ever become enforceable, or should the dealer catalog be simplified around coarse `*.read` / `*.write` plus a few real subfamilies?
5. Should dealer-seeded `platform.*` keys be formally removed in a later migration once existing tenant role assignments are audited?
6. Is there any production data that still assigns dormant keys in roles or user overrides for expectations outside the current codebase?

## Bottom Line

The remaining vocabulary problem is mostly catalog hygiene, not runtime inconsistency.

Post-remediation, the canonical direction is:
- keep the currently enforced dealer vocabulary
- keep platform RBAC role-based
- treat granular dormant keys as reserved until product confirms otherwise
- treat dealer-seeded `platform.*` as a wrong-layer cleanup candidate
- require human confirmation before deleting the ambiguous dormant families
