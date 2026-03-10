# Performance Run Review

Date: March 10, 2026  
Command: `npm run perf:all -- --seed medium`  
Latest artifacts: `artifacts/perf/2026-03-10T01-47-37-594Z/`

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
