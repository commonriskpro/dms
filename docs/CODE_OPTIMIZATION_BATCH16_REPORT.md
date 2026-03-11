# DMS Code Optimization Batch 16 Report

Date: 2026-03-10
Batch: Dead export/schema/type cleanup (dealer-only)

## Scope
- Removed unused exported schemas/types/helpers that had no in-repo consumers.
- Kept runtime behavior unchanged (no route, RBAC, tenant, or workflow logic changes).

## Files updated
- `apps/dealer/lib/types/me.ts`
  - removed dead export: `meCurrentDealershipPayloadSchema`
- `apps/dealer/modules/finance-core/schemas-deal-documents.ts`
  - removed dead export: `createDealDocumentBodySchema`
- `apps/dealer/modules/lender-integration/schemas.ts`
  - removed dead export: `dealIdParamSchema`
- `apps/dealer/app/api/crm/schemas.ts`
  - removed dead export: `customerIdParamSchema`
- `apps/dealer/app/api/inventory/schemas.ts`
  - removed dead export: `costDocumentCreateBodySchema`
- `apps/dealer/modules/dashboard/ui/types.ts`
  - removed dead export: `DashboardApiResponse`
- `apps/dealer/modules/inventory/ui/types.ts`
  - removed dead exports: `InventoryListResponse`, `VinDecodeResponse`
- `apps/dealer/lib/ui/theme/theme-provider.tsx`
  - removed duplicate unused helper: `getThemeInitScript` (canonical helper remains in `theme-init-script.ts`)
- `apps/dealer/lib/ui/tokens.ts`
  - removed dead exports: `spacing`, `radius`, `shadow`
- `apps/dealer/modules/core/cache/ttl-cache.ts`
  - removed dead export: `INVENTORY_DASHBOARD_AGGREGATE_TTL_MS`

## Validation Run (single consolidated gate)
1. `npm run test:dealer -- lib/bigint.test.ts lib/api/query.test.ts lib/api/list-response.test.ts modules/inventory/tests/acquisition-serialize.test.ts modules/inventory/tests/serialize-shared.test.ts` ✅
2. `npm run build:dealer` ✅
3. `npm run build:platform` ✅
4. `npm run audit:dead-code` ✅
   - artifact: `artifacts/code-health/2026-03-10T23-26-47-488Z`
   - dealer actionable: `213` (down from `217`)
   - worker actionable: `108` (down from `109`)

## Notes
- This batch focused on low-risk dead export pruning only.
- No tests were deleted or modified.
