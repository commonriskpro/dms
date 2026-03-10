# Legacy Systems Audit

This audit is the code-truth legacy inventory for this repository as inspected on March 9, 2026.

Primary source-of-truth order:
1. current code under `apps/*`, `packages/*`, `scripts/*`, Prisma schemas, and workflows
2. canonical docs under `docs/canonical/*`
3. non-canonical docs only as historical evidence

Supporting matrix:
- [LEGACY_SYSTEMS_MATRIX.md](./LEGACY_SYSTEMS_MATRIX.md)

## 1. Executive Summary

Top findings:
- The repo has a real canonical architecture, but still contains multiple intentional compatibility layers from recent migrations (RBAC normalization, inventory data-shape transitions, worker rollout fallbacks).
- The highest-risk active legacy areas are operational and architectural, not UI cosmetics:
  - obsolete rule guidance outside `.cursorrules`
  - legacy DB-runner execution alongside canonical BullMQ execution
  - cross-app dealer invite/support bridge coupling after the platform cutover
- Several passive/dead legacy artifacts are now clean-up candidates with low risk (stale helper files, deprecated wrappers, unused legacy UI implementations).

Net assessment:
- Legacy risk is moderate overall.
- Runtime/data-impacting legacy is concentrated in a small set of high-impact systems that require phased migration, not immediate deletion.

## 2. Legacy Classification Rules

A system/pattern is classified as legacy only if it is one of:
- superseded by a newer canonical path
- partially replaced but still present
- retained for backward compatibility
- stale/unused but still in repo
- deprecated in docs but still present in code/data paths
- ambiguous enough to require human confirmation before removal

Labels used in this audit:
- `active legacy`
- `passive legacy`
- `compatibility layer`
- `deprecated retained`
- `dead/stale candidate`
- `uncertain`

## 3. Method Used

Verification process:
- scanned canonical docs (`docs/canonical/*`) and non-canonical docs (`docs/*`, `apps/*/docs`, `docs/design/*`)
- inspected runtime code in:
  - dealer app (`apps/dealer/app`, `apps/dealer/modules`, `apps/dealer/lib`, `apps/dealer/prisma`, `apps/dealer/scripts`)
  - platform app (`apps/platform/app`, `apps/platform/lib`, `apps/platform/prisma`)
  - mobile app (`apps/mobile/app`, `apps/mobile/src`)
  - worker app (`apps/worker/src`)
- inspected root/tooling/deploy paths (`package.json`, `.github/workflows/deploy.yml`, `.cursorrules`, `agent_spec.md`, root scripts)

Facts vs inference policy:
- All findings below are grounded in current files.
- Where runtime usage cannot be proven from code alone, items are marked `uncertain` and called out in §9.

## 4. Legacy Systems by Domain

### 4.1 Documentation Legacy

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| Large non-canonical docs corpus still present (`docs/*`, `apps/dealer/docs/*`, `apps/platform/docs/*`, `docs/design/*`) | passive legacy | superseded headers exist in high-traffic docs, but hundreds of legacy spec/report docs remain | [`docs/canonical/INDEX.md`](./INDEX.md) | Medium (developer/agent drift) |
| Stale agent guidance in [`agent_spec.md`](../../agent_spec.md) still references `pg-boss`, Vitest, and old structure assumptions | active legacy | file content conflicts with current stack (`BullMQ`, Jest, workspace layout) | [`.cursorrules`](../../.cursorrules) plus canonical docs | High for agent/tooling behavior |
| Canonical-doc drift remains a recurring risk even after recent reconciliation | passive legacy | this repository has repeatedly needed doc-to-code correction passes across worker, RBAC, and ops topics | canonical docs plus periodic code-truth review | Low |

### 4.2 RBAC and Permission Migration Legacy

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| Legacy permission rename/removal maps retained in code | compatibility layer | [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts) exports `LEGACY_PERMISSION_RENAMES` and `REMOVED_DEALER_PERMISSION_KEYS` | normalized catalog in same file (`DEALER_PERMISSION_CATALOG`) | Medium |
| Legacy permission/data cleanup scripts still required for non-reset environments | compatibility layer | [`apps/dealer/scripts/normalize-rbac-permissions.ts`](../../apps/dealer/scripts/normalize-rbac-permissions.ts), [`repair-provisioned-roles.ts`](../../apps/dealer/scripts/repair-provisioned-roles.ts) | steady-state seeded canonical permissions | High (live data impact) |
| Historic wrong-layer and granular permission families still documented for migration provenance | deprecated retained | canonical RBAC docs + script logic remove/migrate old keys | keep as migration history until all environments verified | Medium |

### 4.3 API/Data-Shape Compatibility Legacy

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| Dashboard v1 route/service still present with v3 as main surface | compatibility layer | [`apps/dealer/app/api/dashboard/route.ts`](../../apps/dealer/app/api/dashboard/route.ts), [`apps/dealer/modules/dashboard/service/dashboard.ts`](../../apps/dealer/modules/dashboard/service/dashboard.ts), plus v3 route [`/api/dashboard/v3`](../../apps/dealer/app/api/dashboard/v3/route.ts) | v3 dashboard data model | Medium |
| Inventory response alias fields still emitted/consumed (`listPriceCents`, `purchasePriceCents`, etc.) | compatibility layer | [`apps/dealer/modules/inventory/api-response.ts`](../../apps/dealer/modules/inventory/api-response.ts), [`apps/dealer/modules/inventory/ui/types.ts`](../../apps/dealer/modules/inventory/ui/types.ts), [`apps/dealer/app/api/inventory/aging/route.ts`](../../apps/dealer/app/api/inventory/aging/route.ts) | canonical cents keys only | Medium |
| Dual VIN decode paths with inconsistent implementation maturity | active legacy | NHTSA/cache flow in [`vin-decode-cache.ts`](../../apps/dealer/modules/inventory/service/vin-decode-cache.ts) + [`/api/inventory/vin-decode`](../../apps/dealer/app/api/inventory/vin-decode/route.ts); vehicle-specific decode route uses mock-backed service [`vin-decode.ts`](../../apps/dealer/modules/inventory/service/vin-decode.ts) via [`/api/inventory/[id]/vin/decode`](../../apps/dealer/app/api/inventory/[id]/vin/decode/route.ts) | unified VIN decode/follow-up architecture | Medium |

### 4.4 Data Migration and Storage Legacy

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| Vehicle photo migration helpers and cleanup scripts retained | deprecated retained | [`apps/dealer/modules/inventory/db/vehicle-photo.ts`](../../apps/dealer/modules/inventory/db/vehicle-photo.ts) legacy query helpers; [`vehicle-photo-backfill.ts`](../../apps/dealer/modules/inventory/service/vehicle-photo-backfill.ts); scripts [`backfill-vehicle-photos.ts`](../../apps/dealer/scripts/backfill-vehicle-photos.ts), [`cleanup-legacy-vehicle-fileobjects.ts`](../../apps/dealer/scripts/cleanup-legacy-vehicle-fileobjects.ts) | pure `VehiclePhoto` runtime without migration utilities | Medium (data verification needed) |

### 4.5 Worker/Async Legacy and Overlap

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| No-Redis producer fallback behavior remains | compatibility layer | [`enqueueBulkImport.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts), [`enqueueAnalytics.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts), [`enqueueVinDecode.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts) | fully supervised BullMQ execution in all target envs | Medium |
| Dealer DB-runner execution still coexists with BullMQ execution | active legacy | DB runner path [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts), [`job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts) and BullMQ path [`apps/worker/src`](../../apps/worker/src) | BullMQ for execution, Postgres for durable workflow state | High |

### 4.6 Platform Control-Plane Legacy Overlap

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| Dealer-side invite/support bridge paths remain after platform cutover | compatibility layer | dealer-hosted platform pages/public routes were removed, but dealer-owned invite/support bridge code remains under [`apps/dealer/modules/platform-admin`](../../apps/dealer/modules/platform-admin) and dealer support-session/internal invite endpoints | canonical control plane in `apps/platform`; dealer internal bridge endpoints only | Medium |

### 4.7 UI/Code Stale Candidates

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| Multiple customer list/page implementations appear stale | dead/stale candidate | [`apps/dealer/modules/customers/ui/CustomersPage.tsx`](../../apps/dealer/modules/customers/ui/CustomersPage.tsx), [`CustomersListPage.tsx`](../../apps/dealer/modules/customers/ui/CustomersListPage.tsx), [`ListPage.tsx`](../../apps/dealer/modules/customers/ui/ListPage.tsx) exist, while route uses [`CustomersPageClient`](../../apps/dealer/app/(app)/customers/page.tsx) | keep route-backed implementation only | Low |
| Deprecated deal-desk wrapper `updateDealDesk` appears unused | dead/stale candidate | [`apps/dealer/modules/deals/service/deal-desk.ts`](../../apps/dealer/modules/deals/service/deal-desk.ts); code search shows route/tests use `saveFullDealDesk` | `saveFullDealDesk` only | Low |
| Deprecated mobile Supabase proxy export retained for compatibility | compatibility layer | [`apps/mobile/src/auth/supabase.ts`](../../apps/mobile/src/auth/supabase.ts) | `getSupabase()` | Low |

### 4.8 Ops/Tooling Legacy

| Legacy system | Classification | Evidence | Replacement / canonical target | Risk |
|---|---|---|---|---|
| [`agent_spec.md`](../../agent_spec.md) still appears actionable even though [`.cursorrules`](../../.cursorrules) is canonical | active legacy | obsolete rule file remains in repo and directly conflicts with current stack/rules | `.cursorrules` plus canonical docs | Medium |
| Stale duplicate tooling artifacts | dead/stale candidate | [`dms-package.json`](../../dms-package.json) (not referenced by current tooling), [`scripts/vitest-to-jest.js`](../../scripts/vitest-to-jest.js) (no active script reference) | root [`package.json`](../../package.json) + Jest-native stack | Low |

## 5. Runtime/Data Impact Summary

Highest runtime/data-impacting legacy:
1. RBAC migration compatibility and non-reset environment cleanup scripts.
2. Dealer-side invite/support bridge dependencies after the platform cutover.
3. Legacy CRM DB-runner execution.
4. Obsolete rule/source drift from `agent_spec.md`.
5. Inventory API compatibility aliases and VIN decode split paths.

Mostly passive/dead legacy:
1. Stale helper/tooling artifacts (`dms-package.json`, `scripts/vitest-to-jest.js`).
2. Unused customer UI implementations.
3. Deprecated wrappers retained for compatibility.
4. Large historical docs/spec/report corpus.

## 6. Safe Removal Candidates (Code-Truth, Low Risk)

These look safe to remove only after a quick final grep/test pass:
- [`scripts/vitest-to-jest.js`](../../scripts/vitest-to-jest.js)
- [`dms-package.json`](../../dms-package.json)
- deprecated wrapper `updateDealDesk` in [`apps/dealer/modules/deals/service/deal-desk.ts`](../../apps/dealer/modules/deals/service/deal-desk.ts)
- stale customer UI implementations not used by route composition (see §4.7)

Note:
- This audit does not remove them now.

## 7. Migration-First Targets (Do Not Remove Blindly)

These require migration/verification before removal:
- RBAC compatibility artifacts and normalization scripts.
- inventory alias fields in API/UI types.
- dashboard v1 route and service.
- vehicle photo backfill/cleanup paths.
- no-Redis fallback behavior in job producers.
- dealer-side invite/support bridge dependencies after platform cutover.

## 8. Replacement Mapping (Legacy -> Canonical)

- dashboard v1 service/API -> dashboard v3 service/API and layout model
- legacy inventory alias keys -> canonical cents keys
- legacy vehicle-photo FileObject-only references -> `VehiclePhoto`-linked photo model
- stale permission aliases/families -> normalized dealer permission catalog
- dealer-hosted platform control plane -> dedicated platform app role model
- dealer invite/support bridge paths -> internal-only support/bridge behavior
- outdated docs/specs -> canonical docs index and canonical domain docs

## 9. Requires Human Confirmation Before Migration/Removal

1. Is `/api/dashboard` v1 still consumed by any external client or integration not represented in repo tests?
2. Should the dealer invite/support bridge module be renamed now that it no longer represents dealer-hosted platform administration?
3. What is the correct BullMQ migration shape for CRM job dispatch while preserving current `Job` / `AutomationRun` semantics?
4. Can `agent_spec.md` be removed outright after the superseded notice, or does any local tooling still open it?
5. Have all non-reset environments already completed RBAC normalization and vehicle-photo legacy cleanup?
6. Are any mobile or external clients still relying on deprecated inventory alias fields?

## 10. Audit Conclusion

The repo is not dominated by dead legacy code; most remaining legacy is concentrated in a manageable set of compatibility and migration paths. The safest approach is phased cleanup with explicit data/runtime verification gates, documented in:
- [LEGACY_MIGRATION_PLAN.md](./LEGACY_MIGRATION_PLAN.md)
