# Performance Simulation Plan (Canonical)

Last updated: March 10, 2026

## Objective
Implement realistic, repeatable performance simulations for major hotspots without risky architecture rewrites.

This toolkit now supports:
- Reports service timing under realistic date-range/query fan-out.
- Inventory overview/list+enrichment timing.
- Dashboard read + event-driven refresh timing.
- Bursty async enqueue behavior.
- Worker -> dealer internal bridge latency.
- Platform -> dealer bridge latency.

## Implemented Toolkit

### Dealer scripts
- `apps/dealer/scripts/performance/seed-performance-data.ts`
- `apps/dealer/scripts/performance/run-reports-scenario.ts`
- `apps/dealer/scripts/performance/run-inventory-scenario.ts`
- `apps/dealer/scripts/performance/run-dashboard-scenario.ts`
- `apps/dealer/scripts/performance/run-worker-burst-scenario.ts`
- `apps/dealer/scripts/performance/_utils.ts`

### Worker script
- `apps/worker/scripts/performance/run-worker-bridge-scenario.ts`

### Platform script
- `apps/platform/scripts/performance/run-platform-bridge-scenario.ts`

### Package commands
- Root:
  - `npm run perf:seed -- --tier small|medium|large [--dealership-slug demo] [--fresh true] [--multiplier N]`
  - `npm run perf:reports -- --dealership-slug demo [--iterations 10] [--range-days 90]`
  - `npm run perf:inventory -- --dealership-slug demo [--iterations 12] [--page-size 50]`
  - `npm run perf:dashboard -- --dealership-slug demo [--iterations 8] [--mutation-bursts 3]`
  - `npm run perf:worker-burst -- --dealership-slug demo [--burst-size 50] [--bursts 3]`
  - `npm run perf:worker-bridge -- --dealership-id <uuid> [--iterations 20] [--path /api/internal/jobs/vin-decode]`
  - `npm run perf:platform-bridge -- [--mode rate-limits|job-runs] [--dealership-id <uuid>] [--iterations 20]`
- App-local:
  - Dealer: `npm --prefix apps/dealer run perf:*`
  - Worker: `npm --prefix apps/worker run perf:bridge -- ...`
  - Platform: `npm --prefix apps/platform run perf:bridge -- ...`

## Prerequisites
- Valid local env files (`.env.local`, `.env.platform-admin`) with database URLs and internal bridge secrets.
- Prisma clients generated and migrations applied for dealer/platform schemas.
- Dealer DB seeded at least once (`npm run db:seed`) before running perf seed/scenarios.
- Redis running when queue execution scenarios are intended to be fully exercised.

If dashboard scenario fails with SQL column errors (example: `column "createdAt" does not exist`), treat it as schema/code drift in that environment and resolve migrations before interpreting timing numbers.

## Dataset Model and Scale Tiers

Seeder is additive by default and creates realistic cross-domain records:
- `Vehicle`, `Customer`, `Deal`, `DealHistory`, `DealFinance`, `FinanceApplication`, `FinanceSubmission`, `Opportunity`, `CustomerTask`, `IntelligenceSignal`.
- Uses relationship-valid IDs and dealership scoping.
- Uses synthetic tags/prefixes (`PERF_SIM-*`) for traceability.

Tier profiles:
- `small`: local sanity and smoke profiling.
- `medium`: meaningful local profiling baseline.
- `large`: stress-local profile to expose scaling bottlenecks.

Safety:
- No destructive wipe by default.
- `--fresh true` only clears tagged simulation records before reseeding.

## Scenario Definitions

### 1) Reports
Script: `run-reports-scenario.ts`

Runs:
- Sales summary (`getSalesSummary`)
- Finance penetration (`getFinancePenetration`)
- Sales by user (`getSalesByUser`)

Captured:
- Per-report duration stats (`min/avg/p50/p95/max`).
- Iteration + warmup controls.
- Date-range controls.

Optional profiling alignment:
- Set `REPORTS_PERF_PROFILE=1` to include in-service profiling logs.

### 2) Inventory
Script: `run-inventory-scenario.ts`

Runs:
- Repeated `getInventoryPageOverview` calls across query variants (status/filter/search/sort).

Captured:
- End-to-end service duration stats.
- Result row count stats by run.

Optional profiling alignment:
- Set `INVENTORY_OVERVIEW_PROFILE=1` to include in-service `coreQueriesMs/enrichmentMs/totalMs` logs.

### 3) Dashboard KPI/Event Flow
Script: `run-dashboard-scenario.ts`

Runs:
- Baseline repeated dashboard reads (`getDashboardV3Data`).
- Event refresh bursts via `runAnalyticsJob` (`inventory_dashboard`, `sales_metrics`, `customer_stats`).
- Post-refresh read timing.

Captured:
- Dashboard read duration stats.
- Refresh job duration stats.
- Invalidated prefix counts and skipped flags.

### 4) Worker/Async Burst
Script: `run-worker-burst-scenario.ts`

Runs:
- Bursty enqueues for analytics, alerts, CRM execution.

Captured:
- Enqueue latency stats per queue family.
- CRM enqueue failures (e.g., queue unavailable).
- Optional `DealerJobRun` delta after wait window.

### 5) Worker Internal Bridge
Script: `apps/worker/.../run-worker-bridge-scenario.ts`

Runs:
- Repeated worker-side internal API calls via `postDealerInternalJob`.
- Default probe path now targets still-bridged VIN follow-up:
  - `/api/internal/jobs/vin-decode` with a deterministic non-existent `vehicleId` for low-risk, stable overhead measurement.
- Override path remains available via `--path` for targeted checks.

Captured:
- Per-call latency summary.
- Error count and sample errors.

Optional profiling alignment:
- Set `WORKER_INTERNAL_API_PROFILE=1`.

### 6) Platform/Dealer Bridge
Script: `apps/platform/.../run-platform-bridge-scenario.ts`

Runs:
- Repeated platform bridge calls:
  - `rate-limits` mode (`callDealerRateLimits`)
  - `job-runs` mode (`callDealerJobRuns`, needs `--dealership-id`)

Captured:
- Per-call latency summary.
- Error count and sample errors.

Optional profiling alignment:
- Set `PLATFORM_DEALER_BRIDGE_PROFILE=1`.

## Recommended Baseline Flow

1. Seed medium baseline:
   - `npm run perf:seed -- --tier medium --dealership-slug demo`
2. Run reports:
   - `REPORTS_PERF_PROFILE=1 npm run perf:reports -- --dealership-slug demo --iterations 12 --warmup 2`
3. Run inventory:
   - `INVENTORY_OVERVIEW_PROFILE=1 npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`
4. Run dashboard:
   - `npm run perf:dashboard -- --dealership-slug demo --iterations 10 --mutation-bursts 4`
5. Run burst enqueue:
   - `npm run perf:worker-burst -- --dealership-slug demo --burst-size 60 --bursts 3 --wait-after-ms 5000`
6. Run worker bridge:
   - `WORKER_INTERNAL_API_PROFILE=1 npm run perf:worker-bridge -- --dealership-id <uuid> --iterations 30`
7. Run platform bridge:
   - `PLATFORM_DEALER_BRIDGE_PROFILE=1 npm run perf:platform-bridge -- --mode rate-limits --iterations 30`

## What This Does Not Fully Simulate
- Frontend browser rendering/paint costs under true user hardware variability.
- Full production network latency and multi-node concurrency behavior.
- External dependency variability (Twilio/SendGrid/third-party market systems).
- True production Redis/Postgres contention patterns without staging/prod-like infra.

## Trigger Criteria for Further Optimization Work
- p95 materially regresses versus previous baseline on same tier and scenario.
- Inventory/report scenarios show rising latency not explained by data scale increase.
- Bridge scenario error rates rise above local/staging expected baseline.
- Burst enqueue shows high failure rates or clear queue availability issues.
