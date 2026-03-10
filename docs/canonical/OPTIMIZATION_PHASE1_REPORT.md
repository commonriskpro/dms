# Optimization Phase 1 Report

This report captures the implemented Phase 1 optimization slice completed on March 10, 2026.

Source-of-truth inputs:
- `docs/canonical/OPTIMIZATION_AUDIT.md`
- `docs/canonical/OPTIMIZATION_PLAN.md`
- `docs/canonical/OPTIMIZATION_MATRIX.md`
- `docs/canonical/OPTIMIZATION_QUICK_WINS.md`

## 1. Scope Completed

Implemented in this sprint:
1. request-scoped caching for dealer auth/tenant/permission resolution
2. BullMQ queue instance reuse for target enqueue helpers
3. worker success-path log volume reduction
4. dealer test-loop optimization (remove unconditional `pretest prisma generate`)
5. dashboard v3 trend query rewrite from row-fetch aggregation to grouped counts

## 2. Code Changes

### 2.1 Request-scoped auth/tenant/permission caching

Added:
- `apps/dealer/lib/request-cache.ts`

Updated:
- `apps/dealer/lib/api/handler.ts`
- `apps/dealer/lib/tenant.ts`
- `apps/dealer/lib/rbac.ts`
- `apps/dealer/app/api/auth/session/route.ts`

Implementation details:
- Introduced `WeakMap<NextRequest, Map<...>>` request cache utilities.
- `getAuthContext(...)` now uses a request cache and passes it to tenant + RBAC resolvers.
- Tenant read paths (`getActiveDealershipId`, `getStoredActiveDealershipId`, `getSessionDealershipInfo`) now use request-scoped memoization keys.
- RBAC effective permission resolution (`getDealerAuthContext`, `loadUserPermissions`) now supports request-scoped memoization.
- `GET /api/auth/session` now passes request context into `getSessionContextOrNull(request)` so it can participate in request-scoped caching.

Behavior note:
- Authorization semantics are unchanged; this is a read-path dedupe optimization.

### 2.2 BullMQ queue singleton reuse

Added:
- `apps/dealer/lib/infrastructure/jobs/queueSingleton.ts`
- `apps/dealer/lib/infrastructure/jobs/queueSingleton.test.ts`

Updated:
- `apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueCrmExecution.ts`

Implementation details:
- Producer helpers now call `getQueueSingleton(queueName)` instead of constructing `new Queue(...)` on every enqueue.
- Initialization failures clear singleton state so subsequent enqueue calls can retry initialization.

### 2.3 Worker success-path log reduction

Added:
- `apps/worker/src/workers/logging.ts`

Updated:
- `apps/worker/src/workers/alerts.worker.ts`
- `apps/worker/src/workers/analytics.worker.ts`
- `apps/worker/src/workers/bulkImport.worker.ts`
- `apps/worker/src/workers/crmExecution.worker.ts`
- `apps/worker/src/workers/vinDecode.worker.ts`

Implementation details:
- Introduced `logWorkerSuccess(...)` gate:
  - success logs are on when `WORKER_SUCCESS_LOGS=1`
  - default keeps success logs in non-production and suppresses them in production
- Removed per-job `completed` and `progress` listener logs to reduce high-volume noise.
- Failure logging (`console.error`) remains unchanged.

### 2.4 Dealer test loop optimization

Updated:
- `apps/dealer/package.json`

Implementation details:
- Removed `"pretest": "prisma generate"` from default dealer test path.
- Added opt-in `"test:with-generate"` for explicit regenerate + test runs.

### 2.5 Dashboard v3 grouped trend counts

Updated:
- `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`
- `apps/dealer/modules/dashboard/tests/getDashboardV3Data.test.ts`

Implementation details:
- Replaced `findMany(...createdAt)` row materialization with grouped day-count SQL queries (`$queryRaw`) for:
  - inventory trend
  - leads trend
  - deals trend
  - contracted deals (bhph trend)
- Trend arrays still return same shape and semantics.

## 3. Focused Validation

Tests run:
- `npm -w dealer run test -- --runTestsByPath app/api/auth/session/route.test.ts modules/dashboard/tests/getDashboardV3Data.test.ts modules/core/tests/jobs.test.ts lib/infrastructure/jobs/queueSingleton.test.ts`
- `npm -w @dms/worker run test -- --runTestsByPath src/workers/worker-handlers.test.ts`

Builds run:
- `npm run build:dealer` (pass; existing Supabase realtime webpack warnings remain)
- `npm run build:platform` (pass)

## 4. Reasoned Impact

Expected low-risk wins:
- fewer duplicate DB reads inside request auth/tenant/RBAC resolution paths
- lower enqueue-path allocation/initialization overhead on hot producer routes
- lower worker log ingestion volume on success-heavy traffic
- faster default dealer test loop by removing unconditional Prisma client generation
- lower dashboard cache-miss cost by grouping trend counts in DB instead of row fetch + JS aggregation

## 5. Deferred Intentionally

Not included in this phase:
- broader report page rendering/bundle optimizations
- inventory enrichment/query refactors outside dashboard trend aggregation
- worker bridge redesign or internal API hop elimination
- non-target enqueue helper migration (`enqueueVinDecode.ts`) to singleton reuse

## 6. Residual Risks / Follow-up

1. Request-scoped caching only applies where a request cache is available and passed through.
2. Worker success-log suppression in production depends on default env behavior; set `WORKER_SUCCESS_LOGS=1` when verbose success logs are needed.
3. Dashboard trend grouping keeps current semantics but should still be monitored in staging with realistic data volumes.
