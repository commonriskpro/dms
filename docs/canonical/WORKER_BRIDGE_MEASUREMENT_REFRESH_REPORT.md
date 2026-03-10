# Worker Bridge Measurement Refresh Report

Date: March 10, 2026

## 1. Goal

Refresh worker-bridge measurement so it reflects a **still-bridged** worker path after:
- analytics direct execution cutover
- alerts direct execution cutover

## 2. Audit Findings (Current Scenario Drift)

Previous `worker-bridge` perf script defaulted to:
- path: `/api/internal/jobs/analytics`
- body: analytics job payload (`type`, `context`)

That became stale for default measurement because analytics is now direct by default in worker runtime.

Affected file:
- `apps/worker/scripts/performance/run-worker-bridge-scenario.ts`

## 3. Candidate Selection Decision

Requested priority was:
1. bulk import first if practical
2. otherwise vin decode

### 3.1 Bulk import practicality result

Bulk import was **not selected** as the default benchmark path because it requires:
- `importId` (real `BulkImportJob` record linkage),
- `requestedByUserId`,
- row payloads that trigger meaningful write-heavy execution.

Using synthetic bulk-import payloads for bridge timing can distort measurement with job-state/business write semantics instead of mostly measuring bridge overhead.

### 3.2 Selected representative path

Selected default benchmark:
- `/api/internal/jobs/vin-decode`

Default payload strategy:
- deterministic VIN
- deterministic non-existent `vehicleId` (`00000000-0000-0000-0000-000000000000`)

Rationale:
- still-bridged worker path
- valid internal schema
- low-risk execution path
- limited business mutation
- stable enough for repeated overhead measurement

## 4. Implementation Changes

Updated:
- `apps/worker/scripts/performance/run-worker-bridge-scenario.ts`

Changes:
- default `path` changed from `/api/internal/jobs/analytics` to `/api/internal/jobs/vin-decode`
- added default `vehicleId` and `vin` args for vin-decode probe payload
- added path-specific request-body builder:
  - crm
  - vin-decode
  - alerts
  - analytics-like fallback
- enriched output params to include `vehicleId` / `vin` for traceability

No worker runtime execution architecture changes were made.

## 5. Re-Measurement

## 5.1 Direct worker-bridge scenario rerun

Command:
- `DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:worker-bridge -- --dealership-id a1000000-0000-0000-0000-000000000001 --iterations 12`

Result:
- path: `/api/internal/jobs/vin-decode`
- latency: `min 132ms`, `avg 170.17ms`, `max 351ms`
- errors: `0`

## 5.2 Full suite rerun (with refreshed worker-bridge default)

Command:
- `DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:all -- --seed none`

Artifact:
- `artifacts/perf/2026-03-10T15-01-44-281Z`

Worker-bridge result in full run:
- path: `/api/internal/jobs/vin-decode`
- latency: `min 136ms`, `avg 153.08ms`, `max 229ms`
- errors: `0`

Platform-bridge in same run:
- avg `127.83ms`

## 6. Comparison With Prior Stale Measurement

Prior run that still measured analytics endpoint:
- `artifacts/perf/2026-03-10T14-57-05-418Z`
- worker-bridge path: `/api/internal/jobs/analytics`
- avg: `388.5ms`

Current refreshed run:
- `artifacts/perf/2026-03-10T15-01-44-281Z`
- worker-bridge path: `/api/internal/jobs/vin-decode`
- avg: `153.08ms`

Interpretation:
- These numbers are **not apples-to-apples by business workload**.
- The refreshed measurement is now truthful for the remaining bridged path chosen as default probe.
- This is a measurement-integrity fix, not proof of architectural speedup by itself.

## 7. Canonical Impact

Worker-bridge default scenario now measures a still-bridged endpoint and is no longer anchored to analytics.

Canonical docs updated to reflect new default probe behavior:
- `docs/canonical/PERFORMANCE_SIMULATION_PLAN.md`

## 8. Constraints Preserved

- BullMQ remains execution engine.
- Postgres remains durable workflow state source of truth.
- No CRM direct-execution migration in this sprint.
- No broad worker rewrite performed.
