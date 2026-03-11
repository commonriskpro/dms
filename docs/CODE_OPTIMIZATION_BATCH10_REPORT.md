# DMS Code Optimization Batch 10 Report

Date: 2026-03-10
Batch: Dealer API query-parse dedup completion (`getQueryObject`)

## Scope
Completed the remaining dealer API route migration from repeated:
- `Object.fromEntries(request.nextUrl.searchParams)`

to shared helper:
- `getQueryObject(request)` from `apps/dealer/lib/api/query.ts`

This batch was a dealer-only consolidation pass with no contract changes.

## Files changed

### Route files migrated (31)
- `apps/dealer/app/api/reports/salesperson-performance/route.ts`
- `apps/dealer/app/api/reports/export/inventory/route.ts`
- `apps/dealer/app/api/reports/export/sales/route.ts`
- `apps/dealer/app/api/reports/sales-by-user/route.ts`
- `apps/dealer/app/api/search/route.ts`
- `apps/dealer/app/api/reports/finance-penetration/route.ts`
- `apps/dealer/app/api/reports/dealer-profit/route.ts`
- `apps/dealer/app/api/reports/mix/route.ts`
- `apps/dealer/app/api/reports/pipeline/route.ts`
- `apps/dealer/app/api/reports/inventory-aging/route.ts`
- `apps/dealer/app/api/reports/inventory-roi/route.ts`
- `apps/dealer/app/api/reports/sales-summary/route.ts`
- `apps/dealer/app/api/compliance-alerts/route.ts`
- `apps/dealer/app/api/accounting/export/route.ts`
- `apps/dealer/app/api/admin/dealership/locations/route.ts`
- `apps/dealer/app/api/admin/memberships/route.ts`
- `apps/dealer/app/api/deals/[id]/finance/products/route.ts`
- `apps/dealer/app/api/admin/roles/route.ts`
- `apps/dealer/app/api/deals/[id]/trade/route.ts`
- `apps/dealer/app/api/compliance-forms/route.ts`
- `apps/dealer/app/api/documents/signed-url/route.ts`
- `apps/dealer/app/api/crm/lead-sources/route.ts`
- `apps/dealer/app/api/crm/inbox/conversations/route.ts`
- `apps/dealer/app/api/files/signed-url/route.ts`
- `apps/dealer/app/api/audit/route.ts`
- `apps/dealer/app/api/inventory/feed/route.ts`
- `apps/dealer/app/api/inventory/pricing-rules/route.ts`
- `apps/dealer/app/api/inventory/alerts/route.ts`
- `apps/dealer/app/api/inventory/[id]/vin/route.ts`
- `apps/dealer/app/api/inventory/auctions/search/route.ts`
- `apps/dealer/app/api/inventory/[id]/valuations/route.ts`

## Contract / Behavior
- No RBAC changes.
- No tenant-scoping changes.
- No route response-shape changes.
- No async/workflow behavior changes.

## Migration notes
- A codemod insertion edge case was detected in multiline import blocks and corrected before validation.
- Post-migration verification confirms zero remaining dealer API uses of:
  - `Object.fromEntries(request.nextUrl.searchParams)`

## Validation Run (repo root)
1. `npm run test:dealer -- lib/api/query.test.ts lib/api/list-response.test.ts modules/inventory/tests/acquisition-serialize.test.ts` ✅
2. `npm run build:dealer` ✅
3. `npm run build:platform` ✅
4. `npm run audit:dead-code` ✅
   - artifact: `artifacts/code-health/2026-03-10T22-50-18-164Z`
   - dealer actionable: `246`
   - platform actionable: `2`
   - worker actionable: `109`
