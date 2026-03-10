# Optimization Quick Wins

These are the best low-risk, high-return optimization candidates found in the current repo.

## 1. Reuse BullMQ Queue Instances

Files:
- `apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueCrmExecution.ts`

Why:
- each enqueue path constructs a new `Queue` instance today
- this is avoidable allocation and setup on hot producer paths

## 2. Add Request-Scoped Auth/Tenant/Permission Memoization

Files:
- `apps/dealer/lib/api/handler.ts`
- `apps/dealer/lib/tenant.ts`
- `apps/dealer/lib/rbac.ts`

Why:
- current dealer requests repeat expensive resolution work
- many server pages and routes go through the same path in one request

## 3. Reduce Worker Success-Path Logging

Files:
- `apps/worker/src/index.ts`
- `apps/worker/src/workers/*.worker.ts`

Why:
- current logs are useful for development but noisy for sustained queue traffic
- reducing success-path chatter lowers log cost without losing failure visibility

## 4. Stop Regenerating Prisma Client On Every Dealer Test Run

Files:
- `apps/dealer/package.json`

Why:
- `pretest` always runs `prisma generate`
- this slows the common feedback loop even when schema is unchanged

## 5. Split Or Lazy-Load Chart-Heavy Reports UI

Files:
- `apps/dealer/modules/reports/ui/ReportsPage.tsx`

Why:
- `recharts` is statically imported into a large client page
- charts are a clear candidate for deferred loading

## 6. Rewrite Dashboard Trend Queries To Return Counts, Not Rows

Files:
- `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`

Why:
- current path fetches `createdAt` rows and aggregates in JS
- the same result can be computed closer to the DB

## 7. Reduce Redundant Report Widget Refetching

Files:
- `apps/dealer/modules/reports/ui/ReportsPage.tsx`

Why:
- one client page currently fires six API requests together for every date-range refresh
- some widgets can be isolated or updated independently
