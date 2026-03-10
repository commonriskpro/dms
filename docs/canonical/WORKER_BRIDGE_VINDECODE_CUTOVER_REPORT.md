# Worker Bridge vinDecode Cutover Report

Date: March 10, 2026

## Goal

Cut over vinDecode worker execution from worker->dealer internal HTTP bridge to direct shared-service execution, while preserving semantics and rollback safety.

## Files Changed

Runtime:
- [`apps/worker/src/workers/vinDecode.worker.ts`](../../apps/worker/src/workers/vinDecode.worker.ts)
- [`apps/worker/src/workers/vinDecode.direct.ts`](../../apps/worker/src/workers/vinDecode.direct.ts) (new)

Tests:
- [`apps/worker/src/workers/worker-handlers.test.ts`](../../apps/worker/src/workers/worker-handlers.test.ts)

Docs:
- [`docs/canonical/WORKER_BRIDGE_VINDECODE_REVIEW.md`](./WORKER_BRIDGE_VINDECODE_REVIEW.md)
- [`docs/canonical/PERFORMANCE_RUN_REVIEW.md`](./PERFORMANCE_RUN_REVIEW.md)
- [`docs/canonical/NEXT_PERF_PRIORITY_REVIEW.md`](./NEXT_PERF_PRIORITY_REVIEW.md)
- [`docs/canonical/INDEX.md`](./INDEX.md)

## What Changed

1. Added direct executor:
- `executeVinDecodeDirect(...)` now calls:
  - `runTrackedInternalJob(...)`
  - `runVinFollowUpJob(...)`
- Summary derivation mirrors route behavior (`processed`, `failed`, `skippedReason`).

2. Updated worker mode model:
- `vinDecode.worker.ts` now supports:
  - default `direct`
  - rollback `bridge` via `WORKER_VINDECODE_EXECUTION_MODE=bridge`.

3. Preserved bridge endpoint:
- Dealer internal vinDecode route remains available for rollback/compatibility and measurement.

## Semantics Preservation

Preserved:
- tenant active enforcement (`requireTenantActiveForWrite`)
- VIN normalization/cache warm behavior
- attach/skip semantics (`vehicle_not_found`, `vehicle_vin_changed`, `already_attached`)
- durable `DealerJobRun` tracking via `runTrackedInternalJob`.

Not changed:
- queue contract (`VinDecodeJobData`)
- BullMQ retry behavior
- Postgres durable state model.

## Validation

Command run:
- `npm -w apps/worker run test -- src/workers/worker-handlers.test.ts`

Result:
- pass (`8/8` tests)
- includes new vinDecode cases:
  - default direct path assertion
  - rollback bridge path assertion.

Bridge probe runs (post-change, endpoint still present, repeated `3x` with `12` iterations):
- command:
  - `DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:worker-bridge -- --dealership-id a1000000-0000-0000-0000-000000000001 --iterations 12`
- run metrics:
  - run 1: `avg=271.42ms`, `p50=144ms`, `p95=1577ms`, `p99=1577ms`
  - run 2: `avg=170.75ms`, `p50=145ms`, `p95=381ms`, `p99=381ms`
  - run 3: `avg=157.67ms`, `p50=143ms`, `p95=216ms`, `p99=216ms`
- 3-run means:
  - `avg=199.95ms`, `p50=144ms`, `p95=724.67ms`, `p99=724.67ms`
  - network segment remains dominant.

Interpretation:
- endpoint bridge cost is still real when exercised.
- default vinDecode worker runtime no longer pays this HTTP hop.

## Rollback

Immediate rollback switch:
- set `WORKER_VINDECODE_EXECUTION_MODE=bridge`
- worker resumes internal HTTP path for vinDecode jobs.

## Deferred / Out of Scope

- no CRM direct-execution migration
- no bulk-import direct-execution migration
- no broad bridge architecture rewrite.
