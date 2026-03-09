# Permission Deprecation Plan

Historical note:
- This plan records the pre-normalization deprecation strategy.
- The current normalized dealer permission model is recorded in [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md).

This document converts the completed RBAC and permission-vocabulary audits into a safe, docs-only deprecation plan.

Scope:
- dealer permission catalog in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- dealer role templates and provisioning references in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), [`apps/dealer/modules/provisioning/service/provision.ts`](../../apps/dealer/modules/provisioning/service/provision.ts), and [`apps/dealer/scripts/repair-provisioned-roles.ts`](../../apps/dealer/scripts/repair-provisioned-roles.ts)
- active runtime enforcement summarized in [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md), [`RBAC_AUDIT_REPORT.md`](./RBAC_AUDIT_REPORT.md), and [`PERMISSION_VOCABULARY_AUDIT.md`](./PERMISSION_VOCABULARY_AUDIT.md)

This sprint does not change behavior.

## Executive Summary

Canonical dealer direction:
- Keep coarse business-domain permissions as the primary dealer RBAC model.
- Keep the small number of code-backed subfamilies that are actually enforced:
  - `inventory.acquisition.*`
  - `inventory.appraisals.*`
  - `inventory.auctions.read`
  - `inventory.pricing.*`
  - `inventory.publish.*`
  - `finance.submissions.*`
- Keep `dashboard.read` as a shell-access permission.
- Keep platform access role-based in the platform app, not dealer permission-string-based.

Main deprecation targets:
- dealer-seeded `platform.*` permissions are wrong-layer cleanup candidates
- dormant granular CRUD-style permissions are non-canonical and should be treated as reserved unless product explicitly wants fine-grained enforcement
- `audit.read` is already superseded and should remain documented only as a historical alias

Main hold points:
- `appointments.*`
- `bhph.*`
- `integrations.*`
- `integrations.quickbooks.*`

These families are seeded but not meaningfully enforced, and code alone does not prove whether they are roadmap vocabulary or stale leftovers.

## Inputs Used

Primary canonical inputs:
- [`PERMISSION_VOCABULARY_AUDIT.md`](./PERMISSION_VOCABULARY_AUDIT.md)
- [`RBAC_AUDIT_REPORT.md`](./RBAC_AUDIT_REPORT.md)
- [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md)
- [`RBAC_REMEDIATION_REPORT.md`](./RBAC_REMEDIATION_REPORT.md)

Primary code evidence:
- [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)
- [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts)
- [`apps/dealer/modules/provisioning/service/provision.ts`](../../apps/dealer/modules/provisioning/service/provision.ts)
- [`apps/dealer/scripts/repair-provisioned-roles.ts`](../../apps/dealer/scripts/repair-provisioned-roles.ts)

## Bucket Definitions

| Bucket | Meaning |
|---|---|
| `A. Canonical and keep` | Current code-backed vocabulary that should remain the documented dealer RBAC model. |
| `B. Reserved but not enforced` | Present in catalog/templates, not meaningfully enforced, but coherent enough to keep documented as future vocabulary. |
| `C. Legacy alias / superseded` | Historical name replaced by a canonical current name. |
| `D. Wrong architectural layer` | Present in the dealer permission catalog, but active architecture enforces the concern somewhere else. |
| `E. Deprecation candidate` | Non-canonical vocabulary that should be marked legacy in docs/tooling before any removal work. |
| `F. Removal candidate after migration verification` | Can only be removed after role-data and provisioning dependencies are verified and a migration plan exists. |
| `G. Needs human confirmation first` | Code does not establish whether the family is intentionally reserved, planned, or stale. |

## Canonical Dealer Vocabulary To Keep

Keep as bucket `A. Canonical and keep`:
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
- Shell:
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
- Customers / CRM / deals / docs / finance / lenders / reports:
  - `customers.read`
  - `customers.write`
  - `crm.read`
  - `crm.write`
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

Rationale:
- These permissions are the active dealer runtime vocabulary documented in [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md).
- This is the vocabulary that future dealer RBAC work should extend unless there is an approved redesign.

## Non-Canonical Families And Planned Handling

### 1. Dealer-seeded `platform.*`

Permissions:
- `platform.admin.read`
- `platform.admin.write`
- `platform.read`
- `platform.write`
- `platform.impersonate`

Classification:
- `D. Wrong architectural layer`
- `E. Deprecation candidate`
- `F. Removal candidate after migration verification`

Why non-canonical:
- Dealer runtime platform access is not enforced through these permission strings.
- Dealer-side privileged access uses [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts).
- Platform app access is role-based via [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts).

Current removal risk:
- Medium.
- Runtime references are absent, but historical role rows or user override data may still contain these keys.

Dependencies to verify before any removal:
- inspect live dealer `RolePermission` and user-override data in production/staging
- inspect whether any external provisioning/import process still assigns these keys
- confirm no downstream analytics, exports, or admin tooling expects them

Planned handling:
- Document them as wrong-layer legacy vocabulary now.
- Do not remove from seeds or existing data until migration verification is complete.

### 2. Dormant granular CRUD-style dealer permissions

Permissions:
- Inventory:
  - `inventory.create`
  - `inventory.update`
  - `inventory.delete`
  - `inventory.export`
- Customers:
  - `customers.create`
  - `customers.update`
  - `customers.delete`
  - `customers.export`
- CRM:
  - `crm.create`
  - `crm.update`
  - `crm.delete`
  - `crm.export`
- Deals:
  - `deals.create`
  - `deals.update`
  - `deals.delete`
  - `deals.export`
  - `deals.approve`
- Finance:
  - `finance.update`
  - `finance.approve`

Classification:
- `B. Reserved but not enforced`
- `E. Deprecation candidate` only if product explicitly rejects fine-grained permissions
- `F. Removal candidate after migration verification`

Why non-canonical:
- Current dealer runtime generally enforces coarse `*.read` and `*.write` pairs instead.
- These keys are catalog/template vocabulary, not the active enforcement model.

Current removal risk:
- High.
- These keys are present in seeded default roles in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts).
- They may already exist in persisted dealer roles or user overrides.

Dependencies to verify before any deprecation or removal:
- confirm whether product intends future fine-grained RBAC
- inspect persisted role and override data for assignment frequency
- inspect any onboarding/provisioning consumers that may assume these names
- confirm no UI copy or support tooling exposes them to admins

Planned handling:
- Keep documented as reserved vocabulary for now.
- Do not mark for removal until product explicitly chooses between:
  - staying coarse-grained long term
  - or implementing true fine-grained enforcement

### 3. Legacy alias `audit.read`

Permission:
- `audit.read`

Classification:
- `C. Legacy alias / superseded`
- `F. Removal candidate after migration verification`

Why non-canonical:
- Canonical name is `admin.audit.read`.
- The alias is already removed from the current dealer seed catalog per [`RBAC_REMEDIATION_REPORT.md`](./RBAC_REMEDIATION_REPORT.md).

Current removal risk:
- Low in code, unknown in data.

Dependencies to verify before final removal treatment:
- confirm no persisted roles or user overrides still contain `audit.read`
- confirm no external scripts or manual admin instructions still reference it

Planned handling:
- Keep documented only as a historical alias.
- If stale role data exists, migrate it to `admin.audit.read` before any hard cleanup of old records or tooling references.

### 4. `appointments.*`

Permissions:
- `appointments.read`
- `appointments.create`
- `appointments.update`
- `appointments.cancel`

Classification:
- `G. Needs human confirmation first`

Why unresolved:
- Seeded in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts)
- No meaningful runtime references in [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md)
- Code does not prove whether appointments are deferred roadmap, planned CRM scope, or stale vocabulary

Current removal risk:
- Medium to high because product intent is unknown.

Planned handling:
- Keep documented as ambiguous reserved vocabulary.
- Do not deprecate or remove until product confirms whether an appointments module will exist.

### 5. `bhph.*`

Permissions:
- `bhph.read`
- `bhph.write`

Classification:
- `G. Needs human confirmation first`

Why unresolved:
- Present in seed catalog only.
- No meaningful runtime references remain.
- Repo does not clearly show whether BHPH is abandoned, deferred, or handled outside this repository.

Current removal risk:
- High because product scope is unclear.

Planned handling:
- Hold for product/owner confirmation.
- If BHPH is no longer in scope, move to formal deprecation.
- If BHPH remains planned, document as reserved vocabulary instead.

### 6. `integrations.*` and `integrations.quickbooks.*`

Permissions:
- `integrations.read`
- `integrations.manage`
- `integrations.quickbooks.read`
- `integrations.quickbooks.write`

Classification:
- `G. Needs human confirmation first`

Why unresolved:
- The repo has real integration code for Twilio, SendGrid, Supabase, and other external systems.
- These specific permission keys are seeded but not meaningfully enforced in current dealer runtime.
- Code alone does not show whether these keys were meant for a future dealer integration-management UI.

Current removal risk:
- Medium to high.

Dependencies to verify before any deprecation:
- confirm whether a dealer-facing integrations admin surface is planned
- confirm whether QuickBooks remains a product commitment
- confirm whether any external integration tooling or support process expects these keys

Planned handling:
- Keep under human-confirmation hold.
- If confirmed planned, reclassify as reserved.
- If confirmed abandoned, move to formal deprecation.

## Recommended Bucket Assignment

Recommended classification right now:

| Bucket | Permissions / families |
|---|---|
| `A. Canonical and keep` | active dealer runtime permissions listed in the canonical section above |
| `B. Reserved but not enforced` | `inventory.create/update/delete/export`, `customers.create/update/delete/export`, `crm.create/update/delete/export`, `deals.create/update/delete/export/approve`, `finance.update/approve` |
| `C. Legacy alias / superseded` | `audit.read` |
| `D. Wrong architectural layer` | `platform.admin.read`, `platform.admin.write`, `platform.read`, `platform.write`, `platform.impersonate` |
| `E. Deprecation candidate` | dealer-seeded `platform.*`; granular CRUD keys only if product rejects future fine-grained RBAC |
| `F. Removal candidate after migration verification` | `audit.read`, dealer-seeded `platform.*`, any reserved family later approved for retirement |
| `G. Needs human confirmation first` | `appointments.*`, `bhph.*`, `integrations.*`, `integrations.quickbooks.*` |

## Phased Cleanup Plan

### Phase 0: Canonical Vocabulary Baseline

Status:
- Already completed in canonical docs.

Actions:
- keep [`PERMISSION_VOCABULARY_AUDIT.md`](./PERMISSION_VOCABULARY_AUDIT.md) and this plan as the current docs baseline
- keep coarse dealer permissions and the small set of real subfamilies as canonical

### Phase 1: Docs-Only Status Marking

Actions:
- mark dealer-seeded `platform.*` as wrong-layer legacy vocabulary
- mark dormant granular CRUD keys as reserved, not canonical
- mark `audit.read` as superseded alias only
- keep ambiguous families explicitly under confirmation hold

Risk:
- low

### Phase 2: Migration-Dependency Inspection

Actions:
- inspect live database role-permission rows and user overrides for all non-canonical keys
- inspect whether provisioning, imports, or admin tooling still assign or display them
- inspect whether support runbooks or customer-facing admin experiences depend on these names

Required before any behavior or seed cleanup:
- yes

### Phase 3: Optional Soft Deprecation

Actions:
- annotate non-canonical permissions in admin tooling or internal docs as legacy/reserved
- stop introducing them in future features unless explicitly approved
- optionally add validation/reporting that warns when new work uses wrong-layer or superseded keys

Risk:
- low to medium depending on tooling scope

### Phase 4: Removal Only After Explicit Approval And Migration Verification

Actions:
- remove wrong-layer or stale permissions from seed catalogs only after DB and provisioning verification
- migrate persisted role data and user overrides first
- update support docs, internal tooling, and any import/export paths

Required approvals:
- product/owner confirmation for ambiguous families
- explicit engineering approval for any seed/provisioning cleanup

## Human Confirmation Required Before Any Real Deprecation

These items cannot be safely deprecated or removed based on code inspection alone:

1. `appointments.read`
2. `appointments.create`
3. `appointments.update`
4. `appointments.cancel`
5. `bhph.read`
6. `bhph.write`
7. `integrations.read`
8. `integrations.manage`
9. `integrations.quickbooks.read`
10. `integrations.quickbooks.write`
11. whether dormant granular CRUD permissions are intended future granularity or long-term noise
12. whether any production roles or overrides still rely on dealer-seeded `platform.*`

## Recommended Safe Next Actions

1. Keep using the active coarse dealer vocabulary for all new dealer RBAC work.
2. Treat dealer-seeded `platform.*` as a cleanup target, but only after role-data verification.
3. Treat dormant granular CRUD keys as reserved until product makes an explicit call on fine-grained RBAC.
4. Resolve the product status of `appointments.*`, `bhph.*`, and `integrations.*` before any deprecation effort.
5. When cleanup begins, migrate data before deleting catalog entries.

## Bottom Line

The safe current direction is:
- canonical dealer RBAC stays coarse-grained
- real enforced subfamilies stay
- `audit.read` stays historical only
- dealer-seeded `platform.*` is wrong-layer legacy vocabulary
- granular CRUD keys stay reserved until product says otherwise
- `appointments.*`, `bhph.*`, and `integrations.*` remain blocked on human confirmation
