# Worker Bridge Analytics Cutover Report

Date: March 10, 2026

Measurement note:
- The worker-bridge benchmark details in this report were captured before the measurement refresh.
- Current canonical bridge measurement defaults are documented in `WORKER_BRIDGE_MEASUREMENT_REFRESH_REPORT.md`.

## 1. Scope

This sprint migrated **analytics worker execution only** from:
- worker -> dealer internal HTTP (`/api/internal/jobs/analytics`)

to:
- worker -> direct shared-service execution (`runAnalyticsJob` wrapped by `runTrackedInternalJob`)

No CRM direct-execution migration was included.

## 2. Files Changed

- `apps/worker/src/workers/analytics.worker.ts`
- `apps/worker/src/workers/analytics.direct.ts` (new)
- `apps/worker/src/workers/worker-handlers.test.ts`
- `apps/worker/tsconfig.json`

## 3. Implementation Details

### 3.1 Direct execution path

New direct executor:
- `executeAnalyticsDirect(...)` in `apps/worker/src/workers/analytics.direct.ts`

It calls dealer shared logic directly:
- `runAnalyticsJob(...)` from `apps/dealer/modules/intelligence/service/async-jobs.ts`
- `runTrackedInternalJob(...)` from `apps/dealer/lib/internal-job-run.ts`

### 3.2 Semantics parity preserved

The direct path mirrors dealer route summary behavior:
- `processed = skippedReason ? 0 : 1`
- `failed = 0`
- `skippedReason` passthrough

Returned payload shape remains:
- `dealershipId`
- `type`
- `invalidatedPrefixes`
- `signalRuns`
- optional `skippedReason`

### 3.3 Rollback path retained

`analytics.worker.ts` now supports:
- default mode: `direct`
- rollback mode: `bridge` via `WORKER_ANALYTICS_EXECUTION_MODE=bridge`

This preserves a low-risk rollback option while validating direct execution.

## 4. Validation

### 4.1 Focused tests

Run:
- `npm -w @dms/worker run test`

Result:
- pass (`worker-handlers.test.ts` updated)
- validates:
  - analytics uses direct execution by default
  - bridge fallback works when `WORKER_ANALYTICS_EXECUTION_MODE=bridge`

### 4.2 Worker build

Run:
- `npm -w @dms/worker run build`

Result:
- pass

## 5. Performance Re-Measurement

## 5.1 Post-cutover full perf artifact

Run:
- `DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:all -- --seed none`

Artifact:
- `artifacts/perf/2026-03-10T14-50-30-321Z`

Key results:
- inventory total p95: `316.2ms`
- worker-bridge latency avg: `264.67ms`
- platform-bridge latency avg: `123.33ms`
- reports p95: `<= 1ms`
- dashboard reads p95: `1ms`

## 5.2 Bridge comparison (baseline vs latest full run)

Baseline (latest stable full run before this cutover report context):
- `artifacts/perf/2026-03-10T14-32-47-394Z`
- worker-bridge avg: `316.92ms`
- platform-bridge avg: `131.5ms`

Latest full run:
- `artifacts/perf/2026-03-10T14-50-30-321Z`
- worker-bridge avg: `264.67ms`
- platform-bridge avg: `123.33ms`

Observed deltas:
- worker-bridge avg: `-52.25ms` (~16.5% faster)
- platform-bridge avg: `-8.17ms` (~6.2% faster)

Important interpretation:
- `worker-bridge` scenario still measures HTTP bridge endpoint latency itself.
- analytics direct-execution value is primarily runtime-path simplification for actual worker analytics jobs.
- bridge scenario variance can include network/deployment noise; this is directional, not proof alone.

## 6. Architecture Conformance

This cutover remains aligned with fixed architecture:
- BullMQ remains execution engine.
- Postgres remains durable workflow state source of truth.
- no durable state moved to Redis.

## 7. Deferred / Out of Scope

- CRM direct execution (explicitly deferred)
- alerts direct execution (next candidate per migration plan)
- removal of analytics internal endpoint (kept for rollback parity during phased migration)

## 8. Rollback

If rollback is needed:
- set `WORKER_ANALYTICS_EXECUTION_MODE=bridge` in worker runtime env

This restores previous worker->dealer internal HTTP behavior for analytics without code revert.
