# Async Convergence Migration Report

This report turns the async convergence audit into the concrete migration plan for moving the remaining DB-runner execution path toward BullMQ execution while preserving Postgres as durable workflow state.

Report date:
- March 9, 2026

Primary migration target:
- CRM automation/job execution in the dealer app

Current status:
- Completed at the execution-trigger boundary. BullMQ now triggers CRM execution; Postgres remains the durable state layer.

## 1. Migration Goal

Target end state:
- BullMQ owns execution dispatch, retries, and worker concurrency.
- Postgres owns workflow rows, scheduling intent, status, idempotency, telemetry, and user-visible operational history.

Explicit non-goal:
- Do not replace Postgres workflow tables with BullMQ-only payload state.

## 2. Scope In

Included in this migration plan:
- [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts)
- [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)
- [`apps/dealer/modules/crm-pipeline-automation/db/job.ts`](../../apps/dealer/modules/crm-pipeline-automation/db/job.ts)
- CRM durable-state tables and sequence/automation state they operate on
- current operator/cron trigger model for CRM execution

Out of scope for this migration report:
- redesigning worker-backed bulk import / analytics / alerts / VIN flows
- introducing a third async model
- deleting Postgres workflow state
- speculative workerization of intelligence cron routes in the same cutover

## 3. Final Durable-State Ownership

These remain canonical Postgres state after migration:
- `Job`
- `AutomationRun`
- `DealerJobRun`
- `DealerJobRunsDaily`
- `SequenceInstance`
- `SequenceStepInstance`

What these tables continue to do:
- schedule due work with `runAt` / `scheduledAt`
- record current status and terminal state
- hold retry/dead-letter status
- enforce idempotency where current code already relies on it
- preserve tenant ownership and operator-visible history

## 4. Recommended Migration Strategy

### Recommended target executor shape

Recommended, based on current code:
1. keep current Postgres claim-and-state logic for CRM jobs initially
2. move the trigger into BullMQ
3. have BullMQ workers invoke a dealer-internal CRM execution path that calls the existing claim/execute logic
4. after BullMQ execution is stable, demote the current route/cron runner from executor to enqueue/maintenance functionality

Why this is the safest path:
- it preserves the hardest semantics already encoded in the Postgres runner
- it avoids mixing a brand-new queue contract with a simultaneous rewrite of retries, idempotency, and sequence behavior
- it lets the system converge one boundary at a time

### Recommended first BullMQ migration unit

Recommended planned unit:
- one CRM execution queue whose jobs represent dealership-scoped execution ticks, not replacement workflow state

Inference from code:
- dealership-scoped execution fits the current `runJobWorker(dealershipId)` contract better than trying to convert every `Job` row into BullMQ’s primary source of truth on day one

## 5. Phased Cutover Plan

## Phase 0 - Freeze

Actions:
- do not add new DB-polling executors
- do not add new async features that bypass BullMQ for execution
- explicitly treat CRM runner as the remaining migration target

Success criteria:
- async growth stays on the worker/BullMQ path

## Phase 1 - Extract the CRM execution contract

Actions:
- document the exact contract currently embedded in `runJobWorker(...)`
- separate, at least conceptually, these responsibilities:
  - due-job claim
  - per-job execution
  - retry/dead-letter update
  - telemetry write
  - tenant lifecycle guard
- identify what can be reused unchanged behind a BullMQ-triggered wrapper

Why first:
- this lowers migration risk without changing runtime behavior

Success criteria:
- a BullMQ-triggered CRM executor can call into well-understood, testable units

## Phase 2 - Introduce BullMQ-triggered CRM execution

Actions:
- add a worker-backed CRM execution queue
- add a dealer internal CRM execution endpoint or extracted service entrypoint suitable for worker invocation
- keep Postgres as the due-work ledger and continue using `claimNextPendingJobs(...)`
- have BullMQ jobs trigger dealership-scoped execution runs

Expected result:
- BullMQ becomes the primary entrypoint for CRM execution
- Postgres remains the durable source of truth

Risk:
- Medium to high

Main dependencies:
- worker deployment confidence
- internal auth pattern consistent with existing worker-backed dealer endpoints

## Phase 3 - Repoint operator and cron surfaces

Actions:
- change `POST /api/crm/jobs/run` from “execute now” to “enqueue CRM execution now”
- change the cron/maintenance path from looping over dealerships inline to enqueueing dealership execution jobs
- keep the response contract operator-friendly if the UI still expects a trigger action

Expected result:
- route surfaces stop being the executor
- route surfaces become queue producers or maintenance tools

Risk:
- Medium

## Phase 4 - Validate semantics under BullMQ

Validation targets:
- no double execution across concurrent workers
- retries still advance `runAt` / retry state correctly
- dead-letter behavior still ends in Postgres `dead_letter`
- `AutomationRun` idempotency still holds
- sequence-step scheduling/stop conditions still hold
- `DealerJobRun` telemetry still reflects execution truth

Expected result:
- runtime behavior matches the current business semantics even though the execution entrypoint changed

## Phase 5 - Retire DB polling as the primary executor

Actions:
- remove or hard-demote the inline execution behavior from [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts)
- keep only explicitly justified repair/maintenance behavior if still needed
- update docs/runbooks to treat BullMQ as the only normal execution path

Expected result:
- the remaining DB-runner becomes historical or maintenance-only, not production-normal execution

## 6. Safe Migrations vs Deferred Risk

### Safe early moves
- docs and code comments that mark CRM runner as legacy execution
- extraction/refactoring inside CRM services without changing semantics
- worker/queue addition that still reuses current Postgres claim/state logic
- changing operator surfaces from inline execution to enqueue semantics

### Deferred/risky moves
- deleting the `Job` table
- deleting `AutomationRun` status transitions
- moving retry/dead-letter truth from Postgres into Redis/BullMQ only
- removing no-Redis fallbacks before env rollout is verified
- bundling intelligence route changes into the CRM migration

## 7. Recommended Test and Validation Plan

Existing tests that should anchor the migration:
- [`apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts`](../../apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts)
- [`apps/dealer/modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts`](../../apps/dealer/modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts)
- [`apps/dealer/app/api/crm/jobs/run/route.test.ts`](../../apps/dealer/app/api/crm/jobs/run/route.test.ts)

Focused additions recommended during implementation:
- BullMQ-triggered CRM execution tests that prove one queue tick claims and processes due Postgres jobs
- tests for route enqueue behavior after `POST /api/crm/jobs/run` is repointed
- tests proving `DealerJobRun` still records one run per triggered execution cycle
- tests for cron-triggered enqueue across multiple dealerships

## 8. Operational Dependencies

Required for final cutover:
- worker deployed and supervised in every target environment
- Redis available anywhere CRM async execution is expected to run canonically
- dealer internal auth pattern ready for worker-triggered CRM execution, consistent with existing worker-backed internal job routes
- rollout decision for when no-Redis compatibility paths can be retired

## 9. Recommended Immediate Next Actions

1. Treat the CRM runner as the only significant remaining DB-executor.
2. Keep Postgres workflow models intact.
3. Plan BullMQ dealership-scoped CRM execution as the first migration shape.
4. Repoint manual/cron CRM execution surfaces to enqueue semantics only after BullMQ execution is live.
5. Defer any broader async redesign until this convergence is complete.
