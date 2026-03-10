# Bridge Optimization Sprint Report

Date: March 10, 2026

## Scope

Selective bridge optimization on one candidate only.

Candidate audited:
- `bulkImport` worker path (`apps/worker/src/workers/bulkImport.worker.ts`)

Out of scope:
- broad bridge redesign
- CRM direct-execution migration
- dashboard/inventory read-path optimization

## 1. Audit Summary for bulkImport

Current bridge path before sprint:
- worker calls `POST /api/internal/jobs/bulk-import`
- route validates payload and delegates to `runBulkImportJob(...)` wrapped by `runTrackedInternalJob(...)`

Code-truth ownership:
- route layer is mostly auth/validation/JSON glue
- core business semantics live in reusable service:
  - `apps/dealer/modules/inventory/service/bulk.ts::runBulkImportJob`
- durable run tracking logic is reusable via:
  - `apps/dealer/lib/internal-job-run.ts::runTrackedInternalJob`

Conclusion:
- bulkImport is a viable selective direct-execution candidate now, with rollback safety required.

## 2. Decision

Chosen step:
- **Direct execution cutover for bulkImport (default)** with explicit rollback mode to bridge.

Why:
- removes worker->dealer internal HTTP hop for a still-bridged family
- preserves existing service behavior and tracked-run semantics
- follows the same successful selective pattern used for analytics, alerts, and vinDecode

## 3. Implementation

### Runtime changes

Added:
- `apps/worker/src/workers/bulkImport.direct.ts`

Updated:
- `apps/worker/src/workers/bulkImport.worker.ts`
  - default mode: `direct`
  - rollback mode: `bridge` via `WORKER_BULKIMPORT_EXECUTION_MODE=bridge`
  - logging now includes execution mode

### Test updates

Updated:
- `apps/worker/src/workers/worker-handlers.test.ts`

New coverage:
- bulk import uses direct execution by default
- bulk import falls back to bridge mode when env flag is set

## 4. Validation

Commands run:

```bash
npm -w apps/worker run test -- src/workers/worker-handlers.test.ts
npm run build:worker
```

Results:
- worker handler tests passed (`9/9`)
- worker TypeScript build passed

## 5. Bridge-Related Measurement Refresh

Repeated bridge scenario runs (`3x`) against deployed target:

```bash
DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:worker-bridge -- --dealership-id a1000000-0000-0000-0000-000000000001 --iterations 12
DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:platform-bridge -- --mode rate-limits --iterations 12
```

Worker bridge means:
- `avg=235.78ms`
- `p50=167ms`
- `p95=843.33ms`
- `p99=843.33ms`

Platform bridge means:
- `avg=153.86ms`
- `p50=137.33ms`
- `p95=253.33ms`
- `p99=253.33ms`

Interpretation:
- worker bridge tail remains meaningful.
- platform bridge remains materially lower than worker bridge.
- these measurements remain useful for bridge-priority decisions.

Measurement caveat:
- existing worker-bridge perf probe is endpoint-focused and not a pure bulkImport end-to-end benchmark.
- this sprint therefore used behavior-preserving code-path parity + focused tests as the primary correctness signal for cutover.

## 6. Result Classification

- Sprint outcome: **retained**
- Confidence: **moderate-high** (code-path parity + rollback switch + focused tests + unchanged architecture constraints)

## 7. Follow-up (Deferred)

Recommended next selective bridge candidate:
- `crmExecution` remains high risk for direct cutover; keep bridge for now.

Safer near-term bridge follow-up:
- continue bridge overhead reduction via measurement-first, narrow improvements on still-bridged paths without broad redesign.
