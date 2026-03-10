# CRM Async Cutover Report

This report records the CRM async execution cutover from public/cron inline execution to BullMQ-triggered execution, while preserving Postgres as the durable workflow and business-state source of truth.

Cutover date:
- March 9, 2026

## 1. Goal Completed

Completed outcome:
- CRM execution is now BullMQ-triggered.
- Public and cron CRM trigger routes enqueue dealership-scoped CRM execution instead of executing the CRM worker inline.
- Postgres remains the source of truth for:
  - `Job`
  - `AutomationRun`
  - `DealerJobRun`
  - `DealerJobRunsDaily`
  - `SequenceInstance`
  - `SequenceStepInstance`

## 2. Files Changed

Dealer runtime:
- [`apps/dealer/lib/infrastructure/jobs/enqueueCrmExecution.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueCrmExecution.ts)
- [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts)
- [`apps/dealer/app/api/crm/jobs/run/route.test.ts`](../../apps/dealer/app/api/crm/jobs/run/route.test.ts)
- [`apps/dealer/app/api/internal/jobs/schemas.ts`](../../apps/dealer/app/api/internal/jobs/schemas.ts)
- [`apps/dealer/app/api/internal/jobs/crm/route.ts`](../../apps/dealer/app/api/internal/jobs/crm/route.ts)
- [`apps/dealer/modules/core/tests/jobs.test.ts`](../../apps/dealer/modules/core/tests/jobs.test.ts)
- [`apps/dealer/modules/crm-pipeline-automation/ui/JobsPage.tsx`](../../apps/dealer/modules/crm-pipeline-automation/ui/JobsPage.tsx)
- [`apps/dealer/modules/crm-pipeline-automation/ui/__tests__/error-handling.test.tsx`](../../apps/dealer/modules/crm-pipeline-automation/ui/__tests__/error-handling.test.tsx)
- [`apps/dealer/modules/crm-pipeline-automation/ui/__tests__/jobs-run-button.test.tsx`](../../apps/dealer/modules/crm-pipeline-automation/ui/__tests__/jobs-run-button.test.tsx)

Worker runtime:
- [`apps/worker/src/queues/index.ts`](../../apps/worker/src/queues/index.ts)
- [`apps/worker/src/workers/crmExecution.worker.ts`](../../apps/worker/src/workers/crmExecution.worker.ts)
- [`apps/worker/src/index.ts`](../../apps/worker/src/index.ts)
- [`apps/worker/src/workers/worker-handlers.test.ts`](../../apps/worker/src/workers/worker-handlers.test.ts)

Canonical docs:
- [`docs/canonical/ARCHITECTURE_CANONICAL.md`](./ARCHITECTURE_CANONICAL.md)
- [`docs/canonical/WORKFLOWS_CANONICAL.md`](./WORKFLOWS_CANONICAL.md)
- [`docs/canonical/PROJECT_STATUS_CANONICAL.md`](./PROJECT_STATUS_CANONICAL.md)
- [`docs/canonical/PROJECT_CHECKLIST_CANONICAL.md`](./PROJECT_CHECKLIST_CANONICAL.md)
- [`docs/canonical/KNOWN_GAPS_AND_FUTURE_WORK.md`](./KNOWN_GAPS_AND_FUTURE_WORK.md)
- [`docs/canonical/ASYNC_CONVERGENCE_PLAN.md`](./ASYNC_CONVERGENCE_PLAN.md)
- [`docs/canonical/ASYNC_CONVERGENCE_AUDIT.md`](./ASYNC_CONVERGENCE_AUDIT.md)
- [`docs/canonical/ASYNC_CONVERGENCE_MIGRATION_REPORT.md`](./ASYNC_CONVERGENCE_MIGRATION_REPORT.md)
- [`docs/canonical/INDEX.md`](./INDEX.md)
- this report

## 3. Final Execution Shape

### Public and cron triggers

[`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts) now:
- `POST`: enqueues dealership-scoped CRM execution and returns `202`
- `GET`: cron-authenticated bulk enqueue for all dealerships and returns `202` when all enqueue operations succeed
- returns `503` with `QUEUE_UNAVAILABLE` when Redis/BullMQ enqueue is unavailable

### BullMQ execution

New queue:
- `crmExecution`

Worker path:
- [`apps/worker/src/workers/crmExecution.worker.ts`](../../apps/worker/src/workers/crmExecution.worker.ts)

Dealer internal execution endpoint:
- [`apps/dealer/app/api/internal/jobs/crm/route.ts`](../../apps/dealer/app/api/internal/jobs/crm/route.ts)

### Preserved Postgres semantics

The worker-triggered CRM path still uses the existing dealer CRM execution loop:
- [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)
- [`apps/dealer/modules/crm-pipeline-automation/db/job.ts`](../../apps/dealer/modules/crm-pipeline-automation/db/job.ts)

Preserved semantics:
- reclaim stuck running jobs
- claim due jobs with `FOR UPDATE SKIP LOCKED`
- update `AutomationRun` status transitions
- retry/backoff via `runAt`
- dead-letter behavior in Postgres
- tenant lifecycle guard
- `DealerJobRun` telemetry creation

## 4. What Changed Behaviorally

Changed:
- CRM execution is no longer triggered inline by the public dealer route or cron route.
- Dealer UI now queues a worker run instead of executing it inline.

Not changed:
- the durable workflow tables
- claim/lock semantics
- retry/dead-letter semantics
- sequence-step and automation execution logic
- operator-visible CRM job list backed by `Job`

## 5. Compatibility and Remaining Limits

Still true after cutover:
- CRM execution now requires the worker/Redis path for the canonical trigger flow.
- If `REDIS_URL` is unavailable, the route returns `QUEUE_UNAVAILABLE` instead of falling back to inline execution.
- The internal CRM executor still uses the existing Postgres-backed claim loop; this sprint moved the executor boundary, not the durable-state model.

## 6. Validation Performed

Focused validation run:
- `npm -w dealer test -- --runInBand --runTestsByPath app/api/crm/jobs/run/route.test.ts app/api/internal/jobs/crm/route.test.ts modules/core/tests/jobs.test.ts modules/crm-pipeline-automation/ui/__tests__/error-handling.test.tsx modules/crm-pipeline-automation/ui/__tests__/jobs-run-button.test.tsx`
- `npm -w @dms/worker test -- --runInBand`
- `npm -w @dms/worker run build`

## 7. Follow-Up Still Deferred

Intentionally deferred:
1. Further decomposition/refactoring of `runJobWorker(...)` internals.
2. Intelligence cron route migration.
3. Removal of non-CRM no-Redis compatibility paths.
4. Redis-backed end-to-end CRM worker integration tests.
