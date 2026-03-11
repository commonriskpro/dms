# DMS Code Optimization Batch 9 Report

Date: 2026-03-10
Batch: Acquisition serializer dedup (dealer-only, no contract change)

## Scope
Consolidated duplicated acquisition lead/appraisal serialization from route-local implementations into a single shared dealer serializer module.

## Files changed

### Shared canonical serializer
- `apps/dealer/modules/inventory/serialize-acquisition.ts`
  - `serializeAcquisitionAppraisal`
  - `serializeAcquisitionLead`

### Route migrations
- `apps/dealer/app/api/inventory/acquisition/route.ts`
  - Migrated list and create responses to `serializeAcquisitionLead`.
- `apps/dealer/app/api/inventory/acquisition/[id]/route.ts`
  - Removed local `serializeAppraisal` + `toLeadResponse`.
  - Migrated GET/PATCH responses to `serializeAcquisitionLead`.

### New focused test coverage
- `apps/dealer/modules/inventory/tests/acquisition-serialize.test.ts`

## Contract / Behavior
- No RBAC changes.
- No tenant-scoping changes.
- No route contract changes (response shapes preserved).
- No async/workflow behavior changes.

## Validation Run (repo root)
1. `npm run test:dealer -- modules/inventory/tests/acquisition-serialize.test.ts` ✅
2. `npm run build:dealer` ✅
3. `npm run build:platform` ✅
4. `npm run audit:dead-code` ✅
   - artifact: `artifacts/code-health/2026-03-10T22-42-17-601Z`
   - dealer actionable: `246`
   - platform actionable: `2`
   - worker actionable: `109`

## Notes
- A transient malformed duplicate map line introduced during initial migration was corrected before validation.
- This batch is scoped to dealer acquisition API serializers only.
