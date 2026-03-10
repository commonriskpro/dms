# Async Convergence Audit

This audit captures the remaining async execution paths in the repository after worker completion, platform cutover, and dealer `PlatformAdmin` cleanup.

Audit date:
- March 9, 2026

Fixed architecture decision:
- BullMQ is the canonical execution engine.
- Postgres is the canonical durable workflow/business-state source of truth.

## 1. Executive Summary

Current code-backed conclusion:
- The repo already has a real BullMQ execution layer for bulk import, analytics, alerts, and VIN follow-up.
- CRM execution has now been cut over to BullMQ-triggered dealership-scoped execution.
- The durable Postgres tables used by CRM automation are not the problem; they remain the state layer by design.
- The preserved Postgres claim/execute loop in [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts) is now behind the worker-triggered dealer internal CRM endpoint instead of the public/cron route.

High-confidence findings:
1. Worker-backed async domains already align to the canonical split.
2. CRM automation still uses Postgres for due-work claim/state semantics, but BullMQ now owns the execution trigger boundary.
3. No other comparable DB-runner executor was found in current code.
4. Producer no-Redis fallbacks remain a compatibility path, not the canonical model.
5. Postgres must keep owning `Job`, `AutomationRun`, `DealerJobRun`, `DealerJobRunsDaily`, and the sequence state tables even after execution converges to BullMQ.

## 2. Method

Verified from code:
- `apps/worker/src/*`
- dealer BullMQ producers under [`apps/dealer/lib/infrastructure/jobs`](../../apps/dealer/lib/infrastructure/jobs)
- dealer internal job routes under [`apps/dealer/app/api/internal/jobs`](../../apps/dealer/app/api/internal/jobs)
- CRM job runner route and services under [`apps/dealer/app/api/crm/jobs`](../../apps/dealer/app/api/crm/jobs) and [`apps/dealer/modules/crm-pipeline-automation`](../../apps/dealer/modules/crm-pipeline-automation)
- Prisma models in [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma)
- current canonical async docs

Key searches performed:
- `BullMQ`, `Queue(`, `Worker(`, `enqueue`, `job-worker`, `jobs/run`, `claimNextPendingJobs`, `DealerJobRun`, `AutomationRun`

## 3. Current Async Inventory

### 3.1 Already-aligned BullMQ execution paths

| Domain | BullMQ producer/executor | Postgres durable state kept | Classification |
|---|---|---|---|
| Bulk import | [`enqueueBulkImport.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts), worker + [`internal/jobs/bulk-import/route.ts`](../../apps/dealer/app/api/internal/jobs/bulk-import/route.ts) | `BulkImportJob`, `DealerJobRun` | Implemented and aligned |
| Analytics | [`enqueueAnalytics.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts), worker + [`internal/jobs/analytics/route.ts`](../../apps/dealer/app/api/internal/jobs/analytics/route.ts) | domain caches/data + `DealerJobRun` | Implemented and aligned |
| Alerts | [`enqueueAnalytics.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts) `enqueueAlert`, worker + [`internal/jobs/alerts/route.ts`](../../apps/dealer/app/api/internal/jobs/alerts/route.ts) | dealer-side signal/alert state + `DealerJobRun` | Implemented and aligned |
| VIN follow-up | [`enqueueVinDecode.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts), worker + [`internal/jobs/vin-decode/route.ts`](../../apps/dealer/app/api/internal/jobs/vin-decode/route.ts) | VIN cache / vehicle updates + `DealerJobRun` | Implemented and aligned |

### 3.2 CRM execution after cutover

| Area | Execution files | Durable Postgres state | Current classification |
|---|---|---|---|
| CRM automation/job runner | public enqueue route [`app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts), worker [`apps/worker/src/workers/crmExecution.worker.ts`](../../apps/worker/src/workers/crmExecution.worker.ts), dealer internal endpoint [`app/api/internal/jobs/crm/route.ts`](../../apps/dealer/app/api/internal/jobs/crm/route.ts), preserved loop [`service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts) | `Job`, `AutomationRun`, `DealerJobRun`, `DealerJobRunsDaily`, `SequenceInstance`, `SequenceStepInstance` | BullMQ-triggered and aligned at the executor boundary; preserved Postgres claim/state loop remains intentionally in place |

### 3.3 Compatibility paths still present

| Path | Evidence | Classification |
|---|---|---|
| No-Redis sync fallback for bulk import | [`enqueueBulkImport.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts) | Compatibility-only |
| No-Redis no-op fallback for analytics/alerts | [`enqueueAnalytics.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts) | Compatibility-only |
| No-Redis no-op fallback for VIN follow-up | [`enqueueVinDecode.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts) | Compatibility-only |

### 3.4 Cron/admin execution paths that are not DB-runners

| Path | Evidence | Interpretation |
|---|---|---|
| Intelligence sweep route | [`apps/dealer/app/api/intelligence/jobs/run/route.ts`](../../apps/dealer/app/api/intelligence/jobs/run/route.ts) | Admin/cron-triggered immediate execution, but not backed by a persisted workflow queue/table |

This route may or may not deserve future workerization, but it is not the same architecture problem as the CRM DB-runner.

## 4. Durable Postgres State That Should Remain

These tables/model families are business state, not legacy execution scaffolding:

### CRM workflow backlog and status
- `Job` in [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma)
  - stores queue type, payload, `runAt`, `status`, retries, error message
  - this is the durable due-work ledger

### Automation idempotency and lifecycle
- `AutomationRun`
  - tracks idempotent execution per `(dealershipId, entityType, entityId, eventKey, ruleId)`
  - current code uses [`insertAutomationRunIdempotent`](../../apps/dealer/modules/crm-pipeline-automation/db/automation-run.ts) and [`tryTransitionAutomationRunToRunning`](../../apps/dealer/modules/crm-pipeline-automation/db/automation-run.ts)

### Operator telemetry
- `DealerJobRun`
- `DealerJobRunsDaily`
  - current writes come from [`job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts) and worker-backed internal jobs through [`internal-job-run.ts`](../../apps/dealer/lib/internal-job-run.ts)

### Sequence business state
- `SequenceInstance`
- `SequenceStepInstance`
  - these store scheduled step timing, execution status, and sequence stop/completion semantics
  - current enqueue points live in [`service/sequence.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/sequence.ts)

## 5. Legacy Execution Logic To Migrate

### 5.1 Public/cron CRM trigger route

Files:
- [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts)

Current behavior:
- `POST` enqueues dealership-scoped CRM execution for the authenticated dealership
- `GET` uses `CRON_SECRET` and enqueues CRM execution for all dealerships with `p-limit`

Classification:
- aligned with canonical executor boundary

### 5.2 Preserved CRM claim/state loop

Files:
- [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)
- [`apps/dealer/modules/crm-pipeline-automation/db/job.ts`](../../apps/dealer/modules/crm-pipeline-automation/db/job.ts)

Current execution semantics:
- reclaim stuck running jobs
- claim due pending jobs using `FOR UPDATE SKIP LOCKED`
- execute `automation` and `sequence_step` jobs
- retry with exponential backoff via `runAt`
- dead-letter after retry exhaustion
- record `DealerJobRun`
- respect tenant lifecycle guard

Current role:
- these semantics are preserved behind the worker-triggered dealer internal CRM endpoint
- this is now internal execution logic over canonical Postgres state, not a public route/cron executor

## 6. Safe vs Risky Migration Classification

### Safe migrations

These preserve current business semantics while changing only the execution entrypoint:
- keep `Job`, `AutomationRun`, `DealerJobRun`, `DealerJobRunsDaily`, `SequenceInstance`, and `SequenceStepInstance` in Postgres
- keep `claimNextPendingJobs(...)` / `reclaimStuckRunningJobs(...)` semantics initially
- replace route/cron-triggered execution with BullMQ-triggered execution that still claims from Postgres
- keep manual operator-trigger capability, but repoint it to enqueue BullMQ work instead of executing inline
- keep tenant lifecycle guard and current telemetry/audit behavior

### Risky migrations

These would change business semantics or operational safety and should not be bundled into the first cutover:
- deleting the `Job` table or replacing it with BullMQ payloads only
- deleting `AutomationRun` idempotency/state transitions
- replacing Postgres claim/lock semantics before BullMQ-driven execution is proven stable
- removing `/api/crm/jobs/run` entirely before operators have an alternate trigger path
- removing no-Redis fallbacks before worker/Redis rollout is confirmed in every target environment
- treating the intelligence cron route as the same problem as the CRM DB-runner without a separate audit

## 7. Recommended Target Shape

Recommended end state:
1. Postgres continues to store all CRM due-work and execution state.
2. BullMQ becomes the trigger/worker entrypoint for CRM execution.
3. BullMQ workers invoke dealer-internal CRM execution routes or extracted dealer services.
4. Dealer execution still claims due jobs from Postgres, updates `AutomationRun`, updates `Job`, and records `DealerJobRun`.
5. `/api/crm/jobs/run` stops being the primary executor and becomes either:
   - an operator enqueue endpoint, or
   - a maintenance/repair path only

Important distinction:
- this audit recommends migrating the executor boundary, not the durable state model.

## 8. Code-Backed Evidence for CRM Semantics That Must Survive

These behaviors are already asserted in current code/tests and should be preserved:
- atomic claim / no double execution:
  - [`apps/dealer/modules/crm-pipeline-automation/db/job.ts`](../../apps/dealer/modules/crm-pipeline-automation/db/job.ts)
  - [`apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts`](../../apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts)
- tenant lifecycle skip behavior:
  - [`apps/dealer/modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts`](../../apps/dealer/modules/crm-pipeline-automation/tests/job-worker-tenant.test.ts)
- retry/dead-letter handling:
  - [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)
  - [`apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts`](../../apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts)
- sequence stop/skip behavior:
  - [`apps/dealer/modules/crm-pipeline-automation/service/sequence.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/sequence.ts)
  - [`apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts`](../../apps/dealer/modules/crm-pipeline-automation/tests/integration.test.ts)

## 9. Audit Conclusion

Current async convergence result:
- CRM execution entrypoints now route through BullMQ
- Postgres workflow/business state remains intact

Not current targets for removal:
- `Job`
- `AutomationRun`
- `DealerJobRun`
- `DealerJobRunsDaily`
- `SequenceInstance`
- `SequenceStepInstance`
