# DMS Code Optimization Consolidation Plan

Date: 2026-03-10
Based on: `docs/CODE_OPTIMIZATION_DUPLICATION_AUDIT.md`

## Plan Principles
- Preserve behavior, RBAC, tenant isolation, route contracts, async semantics.
- Migrate consumers first, then delete duplicates.
- Keep batches small and reversible.
- Validate each batch with build + targeted tests + dead-code audit.

## Batch 1 (Safest)

### What is duplicated
- Exact duplicated `serializeForm` implementation in 3 compliance-form routes.

### Canonical target location
- `apps/dealer/modules/finance-core/serialize.ts`

### Files to update
- Add shared serializer in:
  - `apps/dealer/modules/finance-core/serialize.ts`
- Migrate consumers:
  - `apps/dealer/app/api/compliance-forms/route.ts`
  - `apps/dealer/app/api/compliance-forms/generate/route.ts`
  - `apps/dealer/app/api/compliance-forms/[id]/route.ts`
- Add/extend serializer tests:
  - `apps/dealer/modules/finance-core/tests/serialize.test.ts`

### What will be deleted after migration
- Route-local duplicate `serializeForm` functions in the 3 routes.

### Risk level
- Low.

### Validation required
- `npm run build:dealer`
- `npm run build:platform`
- Targeted Jest: `npm run test:dealer -- finance-core/tests/serialize.test.ts`
- `npm run audit:dead-code`

## Batch 2 (Low Risk)

### What is duplicated
- Repeated query object extraction from URL search params:
  - `Object.fromEntries(request.nextUrl.searchParams)`.

### Canonical target location
- `apps/dealer/lib/api/query.ts` (new helper module)

### Files to update (initial slice)
- Create helper:
  - `apps/dealer/lib/api/query.ts`
- Migrate a narrow list-route slice:
  - `apps/dealer/app/api/vendors/route.ts`
  - `apps/dealer/app/api/lenders/route.ts`
  - `apps/dealer/app/api/lender-applications/route.ts`
  - `apps/dealer/app/api/expenses/route.ts`
  - `apps/dealer/app/api/accounting/accounts/route.ts`
  - `apps/dealer/app/api/accounting/transactions/route.ts`

### What will be deleted after migration
- Inline `Object.fromEntries(request.nextUrl.searchParams)` in the migrated routes only.

### Risk level
- Low.

### Validation required
- `npm run build:dealer`
- `npm run build:platform`
- Targeted Jest suites for touched domains:
  - accounting
  - vendors/lenders
  - finance-core API routes (if available)
- `npm run audit:dead-code`

## Deferred / Future Batches

### Batch 3 (Medium)
- Consolidate repeated `meta: { total, limit, offset }` response helper for list routes.
- Keep response shape identical; migrate domain by domain.

### Batch 4 (Medium)
- Consolidate shared cents coercion/date serialization helpers where strictly identical.
- Avoid merging domain-specific validation semantics.

### Batch 5 (Higher Risk, Defer)
- Platform service/db pass-through abstraction reduction.
- Only after explicit contract tests are added for platform APIs and audit logging behavior.

## Out of Scope for this sprint
- Auth core / tenant/session resolution.
- RBAC checks and permission semantics.
- Workflow/job orchestration semantics.
- Broad UI architecture reshaping.
