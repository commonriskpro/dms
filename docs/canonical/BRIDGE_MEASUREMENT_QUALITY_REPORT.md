# Bridge Measurement Quality Report

Date: March 10, 2026  
Scope: measurement-quality improvements only (no bridge architecture redesign).

## Goal

Improve bridge scenario observability so go/no-go decisions on future bridge optimization are based on segmented, tail-aware evidence.

## Changes Implemented

### 1. Worker bridge scenario quality upgrades

Files:
- [`apps/worker/src/dealerInternalApi.ts`](../../apps/worker/src/dealerInternalApi.ts)
- [`apps/worker/scripts/performance/run-worker-bridge-scenario.ts`](../../apps/worker/scripts/performance/run-worker-bridge-scenario.ts)

Implemented:
- Added `postDealerInternalJobWithProfile(...)` for scenario-level segmented timing.
- Worker bridge scenario now reports:
  - latency with `p50`, `p95`, `p99`
  - segmented timing:
    - `setup`
    - `signing`
    - `networkRequest`
    - `responseParse`
    - `handlerExecution` (when server headers exist)
    - `serviceExecution` (when server headers exist)
    - `dbExecution` (when server headers exist)

### 2. Platform bridge scenario quality upgrades

Files:
- [`apps/platform/lib/call-dealer-internal.ts`](../../apps/platform/lib/call-dealer-internal.ts)
- [`apps/platform/scripts/performance/run-platform-bridge-scenario.ts`](../../apps/platform/scripts/performance/run-platform-bridge-scenario.ts)

Implemented:
- Added profile-capable bridge calls:
  - `callDealerRateLimitsProfile(...)`
  - `callDealerJobRunsProfile(...)`
- Platform bridge scenario now reports the same percentile and segmented timing shape as worker bridge, making outputs directly comparable.

### 3. Dealer internal endpoint timing headers for observability

Files:
- [`apps/dealer/app/api/internal/jobs/vin-decode/route.ts`](../../apps/dealer/app/api/internal/jobs/vin-decode/route.ts)
- [`apps/dealer/app/api/internal/monitoring/rate-limits/route.ts`](../../apps/dealer/app/api/internal/monitoring/rate-limits/route.ts)
- [`apps/dealer/app/api/internal/monitoring/job-runs/route.ts`](../../apps/dealer/app/api/internal/monitoring/job-runs/route.ts)

Implemented response headers:
- `x-bridge-handler-ms`
- `x-bridge-service-ms`
- `x-bridge-db-ms` (where DB/service timing is directly observable)

Note:
- These headers are available when the target dealer runtime includes these route updates.

## Repeated Measurement Runs

Command pattern used (`3x` each):

```bash
DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:worker-bridge -- --dealership-id a1000000-0000-0000-0000-000000000001 --iterations 12
DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:platform-bridge -- --mode rate-limits --iterations 12
```

### Worker bridge (3-run means)

- `latency.avgMs = 228.42`
- `latency.p50Ms = 160`
- `latency.p95Ms = 845.67`
- `latency.p99Ms = 845.67`
- segmented means:
  - `setup.avgMs = 0.33`
  - `signing.avgMs = 0.28`
  - `networkRequest.avgMs = 226.97`
  - `responseParse.avgMs = 1.03`
  - `handlerExecution.avgMs = 0` (not observable from this remote target run)
  - `serviceExecution.avgMs = 0` (not observable from this remote target run)
  - `dbExecution.avgMs = 0` (not observable from this remote target run)

### Platform bridge (3-run means)

- `latency.avgMs = 145.44`
- `latency.p50Ms = 122.67`
- `latency.p95Ms = 301.67`
- `latency.p99Ms = 301.67`
- segmented means:
  - `setup.avgMs = 0.36`
  - `signing.avgMs = 0.28`
  - `networkRequest.avgMs = 143.47`
  - `responseParse.avgMs = 1.42`
  - `handlerExecution.avgMs = 0` (not observable from this remote target run)
  - `serviceExecution.avgMs = 0` (not observable from this remote target run)
  - `dbExecution.avgMs = 0` (not observable from this remote target run)

## Interpretation

1. Measurement quality is materially improved:
- bridge scenarios now provide comparable percentile + segmented output.

2. Tail risk is now visible:
- worker bridge shows heavy tail (`p95/p99` materially above median/avg in one run set).

3. Dominant measured segment is currently network/request:
- setup/sign/parse are small; request path dominates observed latency.

4. Handler/service/db segmentation is now instrumented in repo code, but not visible in this specific remote target sample:
- the measured remote target did not return bridge timing headers in these runs.
- local/staging environments running current code should expose these fields.

## What This Enables Next

With this instrumentation, the repo can now:
- compare worker vs platform bridge tails consistently,
- identify whether overhead is mostly network vs server execution (when headers present),
- make a higher-confidence decision on bridge optimization sequence before any broad redesign.
