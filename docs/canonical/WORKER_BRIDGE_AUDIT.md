# Worker Bridge Audit

Date: March 10, 2026

Update (March 10, 2026):
- `analytics` and `alerts` are now direct by default.
- `vinDecode` is now direct by default with bridge rollback mode.
- bridged-by-default families remaining: `bulkImport`, `crmExecution`.

## 1. Executive Summary

Current worker execution is fully HTTP-bridged for dealer job handlers:
- `apps/worker` workers call dealer internal endpoints via `postDealerInternalJob(...)` in [`apps/worker/src/dealerInternalApi.ts`](../../apps/worker/src/dealerInternalApi.ts).
- Dealer endpoints validate internal JWT + rate limit, parse payloads, then call dealer service modules.

Code-truth conclusion:
- The bridge is currently functional and consistent across all worker job families.
- Route handlers for `analytics`, `alerts`, `vin-decode`, and `bulk-import` are thin wrappers around dealer services plus `DealerJobRun` tracking.
- `crm` route is thin but invokes a sensitive DB-runner (`runJobWorker`) with claim/retry/dead-letter semantics.

Feasibility conclusion:
- Direct shared-service execution is feasible for selected jobs, but not as an all-at-once rewrite.
- Best first candidates are `analytics` and `alerts` (thin route glue, high frequency, measurable bridge cost).
- `crm` should remain bridged in the near term due higher migration risk and ongoing async convergence sensitivity.

Performance context used:
- latest valid runs show `worker-bridge` measurable overhead (`avg` roughly low-to-mid 300ms in current local+deployed-bridge runs).
- bridge remains a meaningful architectural cost vs local in-process execution.

## 2. Current Bridge Architecture

Worker-side bridge caller:
- [`apps/worker/src/dealerInternalApi.ts`](../../apps/worker/src/dealerInternalApi.ts)
  - signs HS256 JWT (`INTERNAL_API_JWT_SECRET`)
  - sets audience/issuer from `@dms/contracts`
  - sends POST JSON to `DEALER_INTERNAL_API_URL`
  - throws on non-2xx or missing `data` payload

Dealer-side bridge gate:
- [`apps/dealer/app/api/internal/jobs/route-helpers.ts`](../../apps/dealer/app/api/internal/jobs/route-helpers.ts)
  - `checkInternalRateLimit(...)`
  - `verifyInternalApiJwt(...)`
- JWT verification + replay protection:
  - [`apps/dealer/lib/internal-api-auth.ts`](../../apps/dealer/lib/internal-api-auth.ts)
- internal rate limiter:
  - [`apps/dealer/lib/internal-rate-limit.ts`](../../apps/dealer/lib/internal-rate-limit.ts)

## 3. Per-Job Bridge Inventory

### 3.1 Analytics
- Queue: `analytics` (`QUEUE_ANALYTICS`)
- Worker handler: [`apps/worker/src/workers/analytics.worker.ts`](../../apps/worker/src/workers/analytics.worker.ts)
- Endpoint: `POST /api/internal/jobs/analytics`
  - route: [`apps/dealer/app/api/internal/jobs/analytics/route.ts`](../../apps/dealer/app/api/internal/jobs/analytics/route.ts)
- Schema: `internalAnalyticsJobSchema` in [`apps/dealer/app/api/internal/jobs/schemas.ts`](../../apps/dealer/app/api/internal/jobs/schemas.ts)
- Underlying dealer logic: `runAnalyticsJob(...)` in [`apps/dealer/modules/intelligence/service/async-jobs.ts`](../../apps/dealer/modules/intelligence/service/async-jobs.ts)
- Tracking: `runTrackedInternalJob(...)` writes `DealerJobRun`
- Retry semantics:
  - producer attempts: 3 exponential (`enqueueAnalytics`)
  - worker failure handler logs; BullMQ retries by job options

### 3.2 Alerts
- Queue: `alerts` (`QUEUE_ALERTS`)
- Worker handler: [`apps/worker/src/workers/alerts.worker.ts`](../../apps/worker/src/workers/alerts.worker.ts)
- Endpoint: `POST /api/internal/jobs/alerts`
  - route: [`apps/dealer/app/api/internal/jobs/alerts/route.ts`](../../apps/dealer/app/api/internal/jobs/alerts/route.ts)
- Schema: `internalAlertJobSchema`
- Underlying dealer logic: `runAlertJob(...)` in `async-jobs.ts` (delegates to `runAnalyticsJob(..., "alert_check", ...)`)
- Tracking: `runTrackedInternalJob(...)`
- Retry semantics:
  - producer attempts: 3 fixed (`enqueueAlert`)

### 3.3 Bulk Import
- Queue: `bulkImport` (`QUEUE_BULK_IMPORT`)
- Worker handler: [`apps/worker/src/workers/bulkImport.worker.ts`](../../apps/worker/src/workers/bulkImport.worker.ts)
- Endpoint: `POST /api/internal/jobs/bulk-import`
  - route: [`apps/dealer/app/api/internal/jobs/bulk-import/route.ts`](../../apps/dealer/app/api/internal/jobs/bulk-import/route.ts)
- Schema: `internalBulkImportJobSchema`
- Underlying dealer logic: `runBulkImportJob(...)` in [`apps/dealer/modules/inventory/service/bulk.ts`](../../apps/dealer/modules/inventory/service/bulk.ts)
- Durable state used by service:
  - `BulkImportJob` status/progress updates
- Tracking: `runTrackedInternalJob(...)` + service-level job state updates
- Retry semantics:
  - producer attempts: 2 fixed (`enqueueBulkImport`)
  - row-by-row service progress persisted

### 3.4 VIN Decode Follow-up
- Queue: `vinDecode` (`QUEUE_VIN_DECODE`)
- Worker handler: [`apps/worker/src/workers/vinDecode.worker.ts`](../../apps/worker/src/workers/vinDecode.worker.ts)
- Endpoint: `POST /api/internal/jobs/vin-decode`
  - route: [`apps/dealer/app/api/internal/jobs/vin-decode/route.ts`](../../apps/dealer/app/api/internal/jobs/vin-decode/route.ts)
- Schema: `internalVinFollowUpJobSchema`
- Underlying dealer logic: `runVinFollowUpJob(...)` in [`apps/dealer/modules/inventory/service/vin-followup.ts`](../../apps/dealer/modules/inventory/service/vin-followup.ts)
- Tracking: `runTrackedInternalJob(...)`
- Retry semantics:
  - producer attempts: 3 exponential (`enqueueVinDecode`)

### 3.5 CRM Execution
- Queue: `crmExecution` (`QUEUE_CRM_EXECUTION`)
- Worker handler: [`apps/worker/src/workers/crmExecution.worker.ts`](../../apps/worker/src/workers/crmExecution.worker.ts)
- Endpoint: `POST /api/internal/jobs/crm`
  - route: [`apps/dealer/app/api/internal/jobs/crm/route.ts`](../../apps/dealer/app/api/internal/jobs/crm/route.ts)
- Schema: `internalCrmExecutionJobSchema`
- Underlying dealer logic: `runJobWorker(...)` in [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)
- Durable state owned by CRM runner:
  - `Job`, `AutomationRun`, `DealerJobRun` tables and claim/retry/dead-letter semantics
- Tracking: route does not use `runTrackedInternalJob`; `runJobWorker` records `DealerJobRun` directly.
- Retry semantics:
  - producer attempts: 3 exponential (`enqueueCrmExecution`)
  - runner-level retry/dead-letter also applies to claimed jobs.

## 4. Ownership Classification (Route Glue vs Real Business Logic)

### Analytics
- Classification: `A/C` (business logic in importable service, route auth/validation glue separate)
- Evidence: route delegates almost directly to `runAnalyticsJob(...)` wrapped by `runTrackedInternalJob(...)`.

### Alerts
- Classification: `A/C`
- Evidence: same pattern as analytics.

### VIN follow-up
- Classification: `A/C`
- Evidence: route delegates to `runVinFollowUpJob(...)` + tracking wrapper.

### Bulk import
- Classification: `A/C` (service importable, but heavy payload and progress semantics)
- Evidence: route is thin but job payload can be large (`rows` up to 500), and service updates durable import state row-by-row.

### CRM execution
- Classification: `C/D`
- Evidence: route is thin, but invoked `runJobWorker(...)` owns sensitive DB-runner semantics (claim, reclaim, retry/backoff, dead-letter, lifecycle skip, audit).

## 5. Direct Execution Feasibility

### Easy direct-execution candidates
- `analytics`
- `alerts`

Why:
- thin internal route wrappers
- core logic already in service module
- predictable payloads
- current performance evidence points to meaningful bridge overhead on worker bridge path

### Medium complexity candidates
- `vinDecode`
- `bulkImport`

Why:
- both are technically direct-callable
- `bulkImport` has higher semantic complexity (progress/state updates, larger request payload)
- `vinDecode` has lower complexity but likely lower absolute ROI than analytics/alerts

### Not worth migrating yet / should remain bridged now
- `crmExecution`

Why:
- CRM runner still carries critical concurrency/claim/retry/dead-letter semantics in one service
- migration mistakes here risk functional regressions in automation execution state
- better handled after dedicated CRM runner hardening/segmented profiling

## 6. Performance Value Assessment

## Where HTTP bridge is likely most expensive
- frequent, small-payload jobs (`analytics`, `alerts`) where transport/auth/route overhead is a larger share of total work
- runs with repeated internal bridge calls (worker performance scenarios show stable measurable bridge latency)

## Where bridge cost may be secondary
- `bulkImport`, where DB-heavy row processing likely dominates after dispatch
- `crmExecution`, where DB claim/run semantics likely dominate many executions

## Realistic performance upside if migrated selectively
- most likely first gains: lower per-job latency/jitter for `analytics` and `alerts` executions
- likely secondary gains: reduced internal JWT/replay/rate-limit overhead and fewer failure points from internal HTTP path

## Uncertainty to acknowledge
- Current bridge scenario reports `min/avg/max` (no built-in p95 in bridge scenario output).
- Production infra topology can reduce or amplify bridge overhead versus local simulations.

## 7. Pros/Cons: Keep Bridge vs Direct Execution

## Keep bridge (current)
Pros:
- strict service boundary remains explicit
- reuses internal JWT/rate-limit controls
- worker remains app-agnostic HTTP client

Cons:
- measurable latency overhead
- extra auth/replay/rate-limit roundtrip for trusted internal worker path
- duplicate request parsing/serialization and endpoint hop operational complexity

## Direct shared-service execution (selective)
Pros:
- removes internal HTTP hop for migrated jobs
- lower latency and fewer transport failure modes
- simpler tracing for in-process worker execution path

Cons:
- tighter coupling between worker and dealer service modules
- requires extracted shared execution surface (today worker does not import dealer app modules directly)
- requires careful preservation of durable run tracking and tenant safety checks

## 8. Highest-Value Migration Candidates

1. `analytics`
2. `alerts`

Rationale:
- high call frequency pattern
- thin dealer route wrappers
- same underlying `async-jobs` service family
- lower semantic risk compared to CRM

## 9. Jobs That Should Stay Bridged (Current Recommendation)

Keep bridged for now:
- `crmExecution`
- `bulkImport` (at least initial phase)

Reasoning:
- `crmExecution` has highest state-transition risk.
- `bulkImport` is more likely DB-bound; bridge removal is less certain ROI vs migration complexity.

## 10. Evidence and Uncertainties

Facts from code:
- all worker job handlers currently use `postDealerInternalJob(...)`.
- dealer internal routes are thin wrappers over service modules plus auth/validation/tracking.
- `crm` route semantics differ (direct `runJobWorker` call without `runTrackedInternalJob` wrapper).

Inference (explicit):
- selective direct execution should be viable with an extracted shared worker-executor package/module surface.
- broad direct-import today would require structural changes due current app/tsconfig boundaries.
