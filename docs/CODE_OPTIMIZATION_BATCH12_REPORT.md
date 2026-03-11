# DMS Code Optimization Batch 12 Report

Date: 2026-03-10
Batch: Shared BigInt coercion helper rollout (dealer-only)

## Scope
Consolidated repeated nullable/optional BigInt coercion patterns:
- `x != null ? BigInt(x) : undefined`
- `x != null ? BigInt(x) : null`

into shared helper utilities:
- `toBigIntOrUndefined`
- `toBigIntOrNull`

## Canonical helper
- `apps/dealer/lib/bigint.ts`
- Tests: `apps/dealer/lib/bigint.test.ts`

## Files migrated
- `apps/dealer/app/api/inventory/route.ts`
- `apps/dealer/app/api/inventory/[id]/route.ts`
- `apps/dealer/app/api/inventory/acquisition/route.ts`
- `apps/dealer/app/api/inventory/acquisition/[id]/route.ts`
- `apps/dealer/app/api/inventory/appraisals/route.ts`
- `apps/dealer/app/api/inventory/appraisals/[id]/route.ts`
- `apps/dealer/app/api/inventory/auction-purchases/route.ts`
- `apps/dealer/app/api/inventory/auction-purchases/[id]/route.ts`
- `apps/dealer/modules/finance-core/service/credit-application.ts`
- `apps/dealer/modules/finance-core/service/lender-application.ts`

## Contract / Behavior
- No RBAC changes.
- No tenant-scoping changes.
- No route contract changes.
- No workflow/async semantics changes.
- Behavior preserved for nullish handling and BigInt conversion semantics.

## Notes
- A codemod import-placement edge case in multiline import blocks was detected and corrected before final gate run.
