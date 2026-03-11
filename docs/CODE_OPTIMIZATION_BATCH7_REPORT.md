# DMS Code Optimization Batch 7 Report

Date: 2026-03-10
Batch: Dealer-only shared helpers rollout (remaining low-risk list routes)

## Scope
Extended dealer-local helper adoption (`getQueryObject`, `listPayload`) to another low-risk list route slice.

## Routes Migrated
- `apps/dealer/app/api/customers/[id]/timeline/route.ts`
- `apps/dealer/app/api/credit-applications/route.ts`
- `apps/dealer/app/api/admin/permissions/route.ts`
- `apps/dealer/app/api/inventory/aging/route.ts`
- `apps/dealer/app/api/deals/funding/route.ts`
- `apps/dealer/app/api/admin/users/route.ts`
- `apps/dealer/app/api/customers/route.ts`

## What Changed
- Replaced inline `Object.fromEntries(request.nextUrl.searchParams)` with `getQueryObject(request)`.
- Replaced inline list response `{ data, meta: { total, limit, offset } }` with `listPayload(...)`.
- For routes using `parsePagination(...)`, the same query object now comes from `getQueryObject(request)`.

## Contract / Behavior
- No response shape changes.
- No RBAC/tenant/session/auth behavior changes.
- No async/workflow changes.

## Validation Run
Executed from repo root:
1. `npm run build:dealer` ✅
2. `npm run build:platform` ✅
3. `npm run test:dealer -- lib/api/list-response.test.ts lib/api/query.test.ts` ✅
4. `npm run audit:dead-code` ✅
   - artifact: `artifacts/code-health/2026-03-10T22-31-15-263Z`
   - dealer actionable: `246`
   - platform actionable: `2`

## Remaining Safe Candidates
- Any remaining dealer list routes still matching the exact parse+meta boilerplate pattern.
- Next phase can shift to serializer dedup clusters (route-local serializer extraction) in similarly small validated batches.
