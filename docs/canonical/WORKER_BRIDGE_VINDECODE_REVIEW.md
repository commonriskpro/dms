# Worker Bridge vinDecode Review

Date: March 10, 2026

## Executive Summary

Decision: **migrate vinDecode to direct shared-service execution by default**, with a rollback switch to bridge mode.

Rationale:
- Current perf evidence shows bridge latency is network-dominant with meaningful tail risk.
- vinDecode route logic is thin glue; business logic already exists in reusable dealer service code.
- This matches already-successful analytics and alerts cutovers.

## Current vinDecode Bridge Path (Before Cutover)

Worker path:
- [`apps/worker/src/workers/vinDecode.worker.ts`](../../apps/worker/src/workers/vinDecode.worker.ts)
  - called `postDealerInternalJob("/api/internal/jobs/vin-decode", payload)`.

Dealer endpoint:
- [`apps/dealer/app/api/internal/jobs/vin-decode/route.ts`](../../apps/dealer/app/api/internal/jobs/vin-decode/route.ts)
  - internal JWT auth + schema validation
  - `runTrackedInternalJob(...)`
  - delegates to `runVinFollowUpJob(...)`.

Reusable service logic:
- [`apps/dealer/modules/inventory/service/vin-followup.ts`](../../apps/dealer/modules/inventory/service/vin-followup.ts)
  - tenant active check
  - VIN normalization/cache warm/attach semantics
  - skipped-reason behavior.

## Route Glue vs Reusable Logic

Route-only glue:
- request auth/validation
- HTTP parsing/serialization
- response headers for bridge profiling.

Reusable logic:
- `runVinFollowUpJob(...)` business behavior
- `runTrackedInternalJob(...)` durable run tracking.

Code-truth conclusion:
- vinDecode is a **good direct-execution candidate** (low extraction risk, clear parity shape).

## Feasibility and Risk

Feasibility: **high**  
Risk: **low to medium**

Why risk is controlled:
- preserves same business service and tracked-run wrapper
- keeps a bridge rollback path
- no durable-state movement to Redis
- no CRM/bulk-import scope expansion.

## Decision

Chosen path: **Direct execution now (vinDecode only)**.

Not chosen:
- keep bridged as-is: rejected due measurable bridge overhead and low migration complexity.
- bridge-only micro-optimization: lower value than removing the hop for this job.

## Validation Evidence Used

Focused worker tests verify:
- default mode uses direct execution
- env rollback uses bridge mode
- no change to other worker job families.

Bridge measurement context (probe endpoint):
- latest run still shows network-dominant bridge overhead for vinDecode endpoint.
- this confirms why removing the hop on worker default path is valuable.

## Architectural Alignment

- BullMQ remains execution engine.
- Postgres remains durable workflow/business state source of truth.
- Migration remains selective (vinDecode only in this sprint).
