# Worker Bridge Alerts Cutover Report

Date: March 10, 2026

Measurement note:
- The worker-bridge benchmark details in this report were captured before the measurement refresh.
- Current canonical bridge measurement defaults are documented in `WORKER_BRIDGE_MEASUREMENT_REFRESH_REPORT.md`.

## 1. Scope

This sprint migrated **alerts worker execution only** from:
- worker -> dealer internal HTTP (`/api/internal/jobs/alerts`)

to:
- worker -> direct shared-service execution (`runAlertJob` wrapped by `runTrackedInternalJob`)

Out of scope:
- CRM direct execution
- bulk import direct execution
- VIN decode direct execution

## 2. Files Changed

- `apps/worker/src/workers/alerts.worker.ts`
- `apps/worker/src/workers/alerts.direct.ts` (new)
- `apps/worker/src/workers/worker-handlers.test.ts`

## 3. Implementation Details

### 3.1 Direct execution path

New direct executor:
- `executeAlertsDirect(...)` in `apps/worker/src/workers/alerts.direct.ts`

It reuses dealer shared logic directly:
- `runAlertJob(...)` from `apps/dealer/modules/intelligence/service/async-jobs.ts`
- `runTrackedInternalJob(...)` from `apps/dealer/lib/internal-job-run.ts`

### 3.2 Semantics parity preserved

The direct path mirrors dealer internal route semantics:
- `processed = skippedReason ? 0 : 1`
- `failed = 0`
- `skippedReason` passthrough

Returned payload shape remains:
- `dealershipId`
- `type`
- `invalidatedPrefixes`
- `signalRuns`
- optional `skippedReason`

### 3.3 Rollback switch

`alerts.worker.ts` now supports:
- default mode: `direct`
- rollback mode: `bridge` via `WORKER_ALERTS_EXECUTION_MODE=bridge`

This keeps parity rollback simple without code revert.

## 4. Validation

### 4.1 Focused tests

Run:
- `npm -w @dms/worker run test`

Result:
- pass (`7/7`)
- includes:
  - alerts uses direct execution by default
  - alerts falls back to bridge mode when `WORKER_ALERTS_EXECUTION_MODE=bridge`
  - existing analytics rollback behavior still passes

### 4.2 Worker build

Run:
- `npm -w @dms/worker run build`

Result:
- pass

## 5. Performance Re-Measurement

## 5.1 Post-cutover full run

Run:
- `DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:all -- --seed none`

Artifact:
- `artifacts/perf/2026-03-10T14-57-05-418Z`

Key results:
- inventory total p95: `314.35ms`
- worker-bridge latency avg: `388.5ms`
- platform-bridge latency avg: `147ms`
- reports p95: `<= 1ms`
- dashboard reads p95: `1ms`

## 5.2 Comparison vs prior analytics-cutover run

Prior run:
- `artifacts/perf/2026-03-10T14-50-30-321Z`
- worker-bridge avg: `264.67ms`
- platform-bridge avg: `123.33ms`

Current run:
- `artifacts/perf/2026-03-10T14-57-05-418Z`
- worker-bridge avg: `388.5ms`
- platform-bridge avg: `147ms`

Interpretation:
- Bridge scenario variance increased in this run.
- `worker-bridge` scenario targets `/api/internal/jobs/analytics`, so it does not directly benchmark alerts execution path.
- This sprint’s performance evidence is therefore primarily correctness/stability confirmation, not a direct alerts latency gain proof.

## 6. Architecture Conformance

The cutover remains aligned with fixed architecture:
- BullMQ remains execution engine.
- Postgres remains durable workflow state source of truth.
- no durable workflow state moved to Redis.

## 7. Deferred / Next

- keep `crmExecution` bridged (explicitly deferred)
- keep other job families unchanged in this sprint
- if direct alerts path needs isolated timing evidence, add an alerts-specific bridge-vs-direct benchmark scenario in a follow-up measurement sprint

## 8. Rollback

If rollback is needed:
- set `WORKER_ALERTS_EXECUTION_MODE=bridge` in worker runtime env

This restores previous worker->dealer internal HTTP behavior for alerts.
