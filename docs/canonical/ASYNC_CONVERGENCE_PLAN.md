# Async Convergence Plan

This plan applies the now-fixed async architecture decision:
- BullMQ is the canonical execution layer.
- Postgres is the canonical durable workflow-state layer.

Use together with:
- [ASYNC_CONVERGENCE_AUDIT.md](./ASYNC_CONVERGENCE_AUDIT.md)
- [ASYNC_CONVERGENCE_MIGRATION_REPORT.md](./ASYNC_CONVERGENCE_MIGRATION_REPORT.md)
- [CRM_ASYNC_CUTOVER_REPORT.md](./CRM_ASYNC_CUTOVER_REPORT.md)

This does not mean Postgres-backed workflow tables are legacy.
It means DB-polling and DB-runner execution should stop being the default execution pattern.

## 1. Canonical Async Model

Execution:
- BullMQ workers in [`apps/worker`](../../apps/worker)

Durable workflow state:
- Postgres models in the dealer DB, including:
  - `BulkImportJob`
  - `DealerJobRun`
  - `DealerJobRunsDaily`
  - `AutomationRun`
  - `Job`

Business rule:
- BullMQ runs work.
- Postgres remains the system of record for workflow status, progress, retries, auditability, and user-visible operational history.

## 2. Current Code Paths That Already Fit The Canonical Model

These already align well:

### Bulk import

Execution:
- BullMQ producer in [`enqueueBulkImport.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts)
- worker execution through [`apps/dealer/app/api/internal/jobs/bulk-import/route.ts`](../../apps/dealer/app/api/internal/jobs/bulk-import/route.ts)

Durable state:
- [`apps/dealer/modules/inventory/db/bulk-import-job.ts`](../../apps/dealer/modules/inventory/db/bulk-import-job.ts)
- `BulkImportJob` model in [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma)
- `DealerJobRun` telemetry through [`apps/dealer/lib/internal-job-run.ts`](../../apps/dealer/lib/internal-job-run.ts)

Classification:
- `aligned with canonical model`

### Analytics

Execution:
- BullMQ producer in [`enqueueAnalytics.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts)
- worker endpoint in [`apps/dealer/app/api/internal/jobs/analytics/route.ts`](../../apps/dealer/app/api/internal/jobs/analytics/route.ts)

Durable state:
- `DealerJobRun` telemetry through [`apps/dealer/lib/internal-job-run.ts`](../../apps/dealer/lib/internal-job-run.ts)
- domain data remains persisted in dealer Postgres models/caches

Classification:
- `aligned with canonical model`

### Alerts

Execution:
- BullMQ alerts queue from [`enqueueAnalytics.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts)
- worker endpoint in [`apps/dealer/app/api/internal/jobs/alerts/route.ts`](../../apps/dealer/app/api/internal/jobs/alerts/route.ts)

Durable state:
- `DealerJobRun` telemetry
- resulting alert/intelligence state remains dealer-side

Classification:
- `aligned with canonical model`

### VIN follow-up

Execution:
- BullMQ producer in [`enqueueVinDecode.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts)
- worker endpoint in [`apps/dealer/app/api/internal/jobs/vin-decode/route.ts`](../../apps/dealer/app/api/internal/jobs/vin-decode/route.ts)

Durable state:
- dealer-side VIN cache / vehicle updates
- `DealerJobRun` telemetry

Classification:
- `aligned with canonical model`, with intentionally selective async scope

## 3. Current DB-Backed Execution Paths Still Present

### CRM jobs runner

Execution path:
- API/cron trigger in [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts)
- runner service in [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)

Durable state:
- `Job`
- `AutomationRun`
- `DealerJobRun`

Classification:
- `execution logic to migrate`

Why:
- The persisted models are valuable and should remain.
- The poll-and-run execution model is the non-canonical part.

### No-Redis fallback execution in producers

Examples:
- [`enqueueBulkImport.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts)
- [`enqueueAnalytics.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts)
- [`enqueueVinDecode.ts`](../../apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts)

Classification:
- `compatibility path`

Why:
- These fallbacks preserve behavior in environments where Redis/worker rollout is incomplete.
- They are not the desired long-term execution model.

## 4. Classification Table

| Current async pattern | Keep as durable state | Migrate execution | Compatibility-only | Notes |
|---|---|---|---|---|
| `BulkImportJob` plus BullMQ execution | Yes | No | No | Already matches the target split. |
| Worker internal-job execution plus `DealerJobRun` telemetry | Yes | No | No | Canonical for worker-backed domains. |
| `Job` / `AutomationRun` / `DealerJobRun` CRM workflow tables | Yes | Yes | No | Keep the tables; migrate the runner. |
| `/api/crm/jobs/run` polling runner | No | Yes | Temporary | Replace execution with BullMQ-triggered processing when feasible. |
| Producer no-Redis fallbacks | No | Eventually | Yes | Transitional safety net only. |

## 5. Migration Direction

The target is not “move everything out of Postgres.”
The target is:
- BullMQ for dispatch, retries, concurrency, and worker execution
- Postgres for workflow rows, business state, audit, and operator-facing status

For CRM automation/jobs, the likely end state is:
1. Postgres continues storing `Job`, `AutomationRun`, and `DealerJobRun`.
2. Creation/scheduling of due work persists in Postgres first.
3. BullMQ enqueues execution of due jobs.
4. Worker-triggered dealer internal execution performs the business action.
5. Postgres rows remain the source of truth for status changes, retries, dead-letter, and audit.

## 6. Recommended Phases

## Phase 0 - Freeze New DB-Runner Patterns

Rule:
- no new background feature should introduce a DB-polling runner as its execution model

Success criteria:
- new async work uses BullMQ for execution and Postgres for state

## Phase 1 - Document Durable-State Ownership

Targets:
- explicitly document which Postgres models are durable state, not legacy
- document which execution paths are legacy

Success criteria:
- no canonical doc treats BullMQ and Postgres as competing alternatives

## Phase 2 - Inventory CRM Job Runner Semantics

Targets:
- classify everything currently handled by [`job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts):
  - due-job selection
  - claim/lock behavior
  - retries/backoff
  - dead-letter handling
  - audit rows

Success criteria:
- full execution contract is explicit before migration

## Phase 3 - Introduce BullMQ-Triggered CRM Execution

Targets:
- keep `Job` and `AutomationRun` persistence
- move actual execution dispatch off the polling route/cron path and onto BullMQ

Risk:
- High

Dependencies:
- idempotency review
- scheduling/claim semantics review
- operational rollout plan

Success criteria:
- CRM jobs execute through BullMQ without losing current DB-backed status/audit guarantees

## Phase 4 - Retire DB Polling As Primary Execution

Targets:
- demote [`/api/crm/jobs/run`](../../apps/dealer/app/api/crm/jobs/run/route.ts) from primary execution path
- keep only explicitly justified maintenance/repair functionality if still needed

Success criteria:
- DB polling is no longer the normal way background CRM jobs execute

## 7. What Remains Intentionally In Postgres

These are not migration targets for removal:
- workflow rows
- retry/dead-letter status
- job progress/status visible to users or operators
- audit and execution telemetry
- tenant ownership and scoping metadata

BullMQ should execute against these state models, not replace them.

## 8. Open Questions Requiring Human Confirmation

1. Should CRM job dispatch become fully event-driven/BullMQ-driven, or is there a required scheduled sweep component that still needs cron to discover due jobs?
2. Are there any production-like environments where the no-Redis producer fallbacks must remain long-term?
3. Is manual POST execution on [`/api/crm/jobs/run`](../../apps/dealer/app/api/crm/jobs/run/route.ts) still an operator feature that must survive after BullMQ convergence?

## 9. Recommended Next Steps

1. Treat the CRM job runner as the primary async migration target.
2. Preserve `Job`, `AutomationRun`, and `DealerJobRun` as durable Postgres workflow state.
3. Define the BullMQ dispatch contract for due CRM jobs before changing runtime behavior.
4. Remove no-Redis fallbacks only after worker deployment is verified in every target environment.
