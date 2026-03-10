# Project Status Async Delta

This delta records the project-status reconciliation after the completed CRM async execution cutover.

## 1. Previous Async Architecture State

Before the CRM cutover, the repository already had a real BullMQ worker for:
- bulk import
- analytics
- alerts
- VIN follow-up

Postgres was already the durable workflow and business-state source of truth for CRM automation through:
- `Job`
- `AutomationRun`
- `DealerJobRun`
- `DealerJobRunsDaily`
- `SequenceInstance`
- `SequenceStepInstance`

The main remaining architectural inconsistency was the CRM executor boundary:
- [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts) still triggered CRM execution directly
- [`apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts) still sat behind that public/cron execution path

Practical interpretation before cutover:
- the worker subsystem was real
- the async architecture decision was mostly implemented
- CRM was still the main code-backed exception to the BullMQ-first execution model

## 2. What The CRM Async Cutover Changed

The completed cutover moved the CRM execution trigger boundary onto BullMQ:
- added the `crmExecution` queue in [`apps/worker/src/queues/index.ts`](../../apps/worker/src/queues/index.ts)
- added the CRM consumer in [`apps/worker/src/workers/crmExecution.worker.ts`](../../apps/worker/src/workers/crmExecution.worker.ts)
- added the dealer internal execution endpoint in [`apps/dealer/app/api/internal/jobs/crm/route.ts`](../../apps/dealer/app/api/internal/jobs/crm/route.ts)
- changed [`apps/dealer/app/api/crm/jobs/run/route.ts`](../../apps/dealer/app/api/crm/jobs/run/route.ts) so public and cron triggers enqueue work instead of executing it inline

What did not change:
- Postgres remains the durable workflow-state source of truth
- the existing CRM claim/retry/dead-letter loop remains in [`job-worker.ts`](../../apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts)
- operator-visible CRM state still comes from Postgres-backed workflow rows

Net result:
- BullMQ now executes CRM at the system boundary where it should
- Postgres still remembers business state, retries, telemetry, and audit history

## 3. What Still Remains Unresolved

The remaining gaps are operational rather than architectural:
- worker deployment and supervision still need live-environment confirmation
- Redis-backed end-to-end CRM execution coverage is still limited
- the preserved `runJobWorker(...)` loop is still complex and has not been simplified yet
- the repo still does not prove full worker rollout discipline across every production-like environment

Important distinction:
- this is no longer primarily an async-model mismatch
- it is now mostly a rollout, observability, and integration-confidence problem

## 4. Maturity Re-evaluation

### Async architecture maturity

Current assessment:
- materially improved and now coherent in code
- the canonical split is implemented where it matters most:
  - BullMQ executes
  - Postgres stores durable workflow truth

### Worker / Jobs maturity

Current percentage:
- `78%`

Re-evaluation result:
- `unchanged`

Why it stays here:
- the current canonical docs already absorbed the CRM cutover improvement
- a higher score would require stronger deployment proof, broader Redis-backed integration testing, and better operational verification

### Architecture / Foundation maturity

Current percentage:
- `84%`

Re-evaluation result:
- `unchanged`

Why it stays here:
- the CRM cutover removed a meaningful architecture inconsistency
- but the current architecture score already reflects that gain
- CI, release automation, and live worker rollout confidence still limit a higher rating

### Overall project maturity

Current percentage:
- `78%`

Re-evaluation result:
- `unchanged`

Why it stays here:
- the project is more internally coherent after the CRM cutover
- but the largest remaining completion constraints are still outside this single area:
  - external integrations
  - billing/payment automation
  - mobile breadth
  - rollout and production-confidence gaps

## 5. Why There Is No Additional Percentage Increase In This Pass

The current canonical percentages already reflect the CRM async cutover.
This reconciliation pass did not find enough new rollout or production proof to justify another increase.

What would justify higher scores later:
1. verified worker deployment across production-like environments
2. stronger Redis-backed end-to-end coverage for worker-triggered flows
3. clearer health/alerting/runbook evidence for worker operations
4. reduced reliance on operator discipline for async rollout correctness

## 6. Practical Takeaway

Current project truth:
- the async architecture is now materially aligned to the chosen design
- the worker subsystem is real and product-backed
- the next async maturity gains should come from rollout verification and operations hardening, not from reopening the executor model
