# Code Cleanup Phase 2 Report

Date: March 10, 2026

## Objective
Execute a conservative dealer-side utility pruning batch (non-route, non-framework symbols only) with full build/perf validation and no behavior changes.

## Files Changed
- [`apps/dealer/lib/db/date-utils.ts`](/Users/saturno/Downloads/dms/apps/dealer/lib/db/date-utils.ts)
- [`apps/dealer/lib/infrastructure/cache/cacheKeys.ts`](/Users/saturno/Downloads/dms/apps/dealer/lib/infrastructure/cache/cacheKeys.ts)
- [`apps/dealer/app/api/apply/schemas.ts`](/Users/saturno/Downloads/dms/apps/dealer/app/api/apply/schemas.ts)
- [`apps/dealer/lib/ui/recipes/table.ts`](/Users/saturno/Downloads/dms/apps/dealer/lib/ui/recipes/table.ts)

## Verified Unused Items Removed
- `daysBetween` from `date-utils.ts`
- `allCachePrefix` from `cacheKeys.ts`
- `CreateDraftBody` type alias from apply schemas
- `UpdateDraftBody` type alias from apply schemas
- `tableRoot` from table recipe exports
- `tableHeadCell` from table recipe exports
- `tableCell` from table recipe exports

All removed symbols were reference-checked before deletion and limited to utility/type/export surfaces.

## Validation
### Build and tests
- Dealer build:
  - `npm run build:dealer` ✅
- Focused apply API tests:
  - `npm -w dealer run test -- app/api/apply` ✅ (4 suites, 23 tests passed)

### Performance gate
- Full perf suite:
  - `npm run perf:all -- --seed none` ✅
  - Artifacts: `/Users/saturno/Downloads/dms/artifacts/perf/2026-03-10T19-55-13-378Z`
- No scenario failures in reports, inventory, dashboard, worker-burst, worker-bridge, or platform-bridge.

### Dead-code audit refresh
- `npm run audit:dead-code` ✅
- Latest artifact:
  - `/Users/saturno/Downloads/dms/artifacts/code-health/2026-03-10T19-55-12-948Z`
- Current counts:
  - Dealer: `total=2163`, `actionable=1010`
  - Platform: `total=141`, `actionable=5`
  - Worker: `total=370`, `actionable=109`

## Behavior and Risk Notes
- No route handlers, middleware boundaries, RBAC checks, tenancy guards, async execution paths, or schema behavior were changed.
- Removed table recipe exports were non-compact variants with zero in-repo consumers; compact table exports remain canonical.
- Apply schema runtime validation remains unchanged; only unused TypeScript alias exports were removed.

## Outcome
Phase 2 completed successfully with no build/test/perf regressions and a reduced dealer utility export surface.

## Recommended Next Step (Phase 3)
Proceed to UI barrel/component cleanup in small batches:
1. Remove dead UI exports first.
2. Delete dead UI files only after import-graph verification.
3. Keep build + perf gating after each batch.
