# Performance Run Review

Date: March 10, 2026  
Command: `npm run perf:all -- --seed medium`  
Latest artifacts: `artifacts/perf/2026-03-10T01-47-37-594Z/`

## Latest Inventory Measured Sprint Update (March 10, 2026)

This review is superseded for current inventory hotspot numbers by:
- `docs/canonical/INVENTORY_PERF_SPRINT_NEXT_REPORT.md`
- latest full-suite artifact: `artifacts/perf/2026-03-10T15-01-44-281Z/summary.md`

Current inventory-focused measured comparison (same profiled scenario):
- before: `p50=262ms`, `p95=311.6ms`, `max=327ms`
- after slim-select optimization: `p50=258ms`, `p95=310.55ms`, `max=343ms`
- delta: `p95 -1.05ms` (`~0.34%`)

Current interpretation:
- inventory remains one of the highest valid measured read-path hotspots.
- dominant remaining cost is still `coreBreakdown.vehicleList` (`coreQueriesMs` dominant).

VehicleList micro-profiling refresh:
- `vehicleList` now logs sub-breakdown:
  - `findManyMs`
  - `countMs`
- latest profiled inventory runs show `findMany` as the typical dominant half, with occasional `count` spikes.
- low-risk follow-up index attempt (`VehiclePhoto(dealership_id, vehicle_id, sort_order)`) did not produce a clear p95 gain in local measurements.
- direct findMany query-shape optimization attempt (batched photo lookup replacing relation include) regressed p95 and was reverted.

Latest full-suite check after this sprint:
- command: `DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:all -- --seed none`
- artifact: `artifacts/perf/2026-03-10T15-35-29-821Z/summary.md`
- highlights:
  - inventory `p95=416.95ms`
  - reports `p95<=1ms`
  - dashboard reads `p95=1ms`
  - worker-bridge (vin-decode probe) `avg=261.58ms`
  - platform-bridge `avg=140.58ms`

## Measurement Integrity Remediation Outcome

This sprint targeted two blockers and both were remediated for measurement integrity:

1. Dashboard SQL/schema drift:
- Fixed dashboard trend raw SQL to use mapped DB column names (`created_at`, `dealership_id`, `deleted_at`) instead of camel-case names.
- Result: dashboard scenario now returns valid metrics (`errorCount=0`) instead of failing on `createdAt` column errors.

2. Worker/platform bridge runtime/config instability:
- Added safe local fallback behavior in bridge scenario scripts:
  - fallback `DEALER_INTERNAL_API_URL` to `http://localhost:3000` when missing
  - preflight reachability check with explicit `skipped` status when unreachable
- Orchestrator now records bridge scenarios as `skipped` with reason, instead of noisy repeated failures.

## Latest Run Summary
- Overall run status: `passed`
- Duration: `48163ms`
- Seed: `passed` (medium)
- Scenario warnings: none

Per-scenario highlights:
- Reports: `salesSummary p95=55.45ms`
- Inventory: `p95=1070.65ms`
- Dashboard: `p95=56ms`, `errors=0` (now healthy)
- Worker-burst: `crmFailedEnqueueCount=0`
- Worker-bridge: `skipped` (dealer internal URL unreachable locally)
- Platform-bridge: `skipped` (dealer internal URL unreachable locally)

## Comparison vs Prior Run
Compared against: `artifacts/perf/2026-03-10T01-42-23-730Z/`

Key deltas:
- Dashboard moved from invalid (`errorCount=1`, unusable read metrics) to valid (`errorCount=0`, p95 captured).
- Bridge scenarios moved from hard runtime errors to explicit local skips with clear reason.
- Inventory remains high-latency and still the top valid hotspot.

## Top Valid Hotspots (Current)
1. Inventory scenario (`p95=1070.65ms`) — highest measured valid latency.
2. Worker-burst enqueue path shows higher wall time than bridge checks but no functional failure.
3. Reports/dashboard are now measurable and materially lower than inventory in this run.

## Is Inventory Still the Top Valid Hotspot?
Yes.

With dashboard now corrected and bridge scenarios safely classified as skipped when unreachable, inventory remains the most credible and highest-latency measured target for optimization.

## Inventory Optimization Follow-up (Targeted)
Follow-up optimization sprint applied a low-risk core-path change:
- Removed unnecessary `location` relation fetch for list-heavy inventory overview/intelligence paths while preserving API default behavior.
- Detailed report: `docs/canonical/INVENTORY_PERF_OPTIMIZATION_REPORT.md`

Latest targeted inventory scenario re-run:
- Command: `npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`
- Result: `p95=1012.55ms` (down from `1070.65ms`, ~`5.4%` improvement)

Interpretation:
- Inventory is still a hotspot, but this confirms measurable progress from focused core-query overfetch reduction.

## Inventory Optimization Follow-up (Second Measured Sprint)
Second measured sprint targeted the next dominant core contributor after re-profiling:
- Added core breakdown profiling inside `coreQueriesMs`.
- Optimized inventory alert counts to use count queries (with dismissal exclusions) instead of list materialization.
- Removed repeated tenant-read checks within the same already-validated inventory overview request path.

Latest targeted inventory scenario re-run:
- Command: `npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`
- Result: `p95=917.55ms` (down from `1012.55ms` after sprint 1)

Cumulative inventory delta from canonical baseline:
- `1070.65ms -> 917.55ms` (`-153.10ms`, `~14.3%` improvement)

## Inventory Staged Implementation Update (Stages 1-4)
Latest staged implementation results:
- Detailed stage log: `docs/canonical/INVENTORY_PERF_STAGED_IMPLEMENTATION_REPORT.md`
- Priority stages completed in order with per-stage measurement.

Current retained inventory result after staged updates:
- Command: `npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2`
- Metrics: `p50=257.5ms`, `p95=306.05ms`, `max=344ms` (latest Stage 6 retry measurement)

Cumulative change from staged baseline (`p95=799.5ms`):
- `799.5ms -> 306.05ms` (`-493.45ms`, `~61.7%`)

Hotspot note:
- Inventory remains the highest measured path among currently validated local scenarios, but the gap is materially reduced.

## Stage 6 Retry Update (Default First-Page Warm Cache)
Stage 6 was retried with a serialization-safe DTO projection and retained:
- Cache scope is intentionally narrow: only canonical default first-page inventory view.
- Live list path remains canonical and is always used for non-default query shapes.
- Cache miss/malformed payload/error all fail open to the live query path.

Measured retry delta:
- Before retry: `p95=313.25ms`
- After retry: `p95=306.05ms`
- Delta: `-7.20ms` (`~2.3%`)

Note:
- The standard perf inventory scenario defaults to `pageSize=50`, so Stage 6 impact is modest in this run.
- Profiled default-page runs confirm warm-cache hits without BigInt serialization failures.

## Recommended Next Step
Run the same command with a reachable local dealer internal endpoint for bridge scenarios (or a staging-equivalent target) to capture real bridge latency instead of skip status, then continue focusing optimization work on inventory query/enrichment cost.

## Inventory Measurement-Stability Refresh (March 10, 2026)

Reference:
- `docs/canonical/INVENTORY_QUERY_PLAN_REVIEW.md`

Latest inventory-only repeated sample (`12 iterations`, `2 warmup`, run 5x):
- p95 range: `392.95ms` to `507.3ms`
- confirms meaningful run-to-run variance in current environment.

Profiled micro-breakdown refresh:
- `findMany` dominant in `11/12` profiled iterations (excluding warmup).
- `count` secondary with occasional spikes, especially on filtered variants.

Current evidence-based recommendation:
- next inventory optimization should be a narrow query-plan/index-support change, not a broad query rewrite.

## Inventory Index-Support Follow-Up (March 10, 2026)

Reference:
- `docs/canonical/INVENTORY_INDEX_SUPPORT_REPORT.md`

Applied:
- narrow composite index for `status=AVAILABLE + salePriceCents desc` path.

Repeated-run comparison (`5x` before and `5x` after):
- mean p95: `440.66ms -> 424.3ms` (`-3.71%`)
- mean avg: `312.23ms -> 304.37ms`
- mean p50: `321.9ms -> 331.1ms` (mixed signal)
- p95 spread: `138.75ms -> 79.05ms`

Interpretation:
- keep index change (low risk; modest directional gain), but continue using multi-run comparisons due remaining variance.
