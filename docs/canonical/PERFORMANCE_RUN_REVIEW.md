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

## Dashboard Refresh Optimization Sprint (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Measurement command used:
- `npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9`

New refresh profiling now captures:
- `refreshJobsByType`
- `refreshStepBreakdown` (`tenantCheck`, `invalidate`, `signals`, `total`)
- `refreshSignalBreakdown` (domain-level signal timings)

Dominant refresh bottleneck confirmed:
- `signals` stage dominates refresh cost.
- `inventory_dashboard` and `sales_metrics` are the expensive refresh types.

Baseline (instrumented):
- `refreshJobs avg=531.56ms`, `p95=818.6ms`

After narrow optimization (parallel per-domain reconcile writes):
- run A: `refreshJobs avg=546.56ms`, `p95=815.6ms`
- run B (variance check): `refreshJobs avg=676.56ms`, `p95=1411ms`

Interpretation:
- bottleneck attribution improved materially;
- end-to-end latency improvement is not yet conclusive in current local variance;
- keep optimization scope narrow and continue measurement-first iteration on signal recomputation path.

## Dashboard Signal-Domain Micro-Optimization Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Repeated-run baseline (`3x`, mutation bursts 9):
- mean `refreshJobs p95=953.2ms`
- mean `refreshJobs avg=556.63ms`

After micro-optimization (`3x`, same args):
- mean `refreshJobs p95=863.27ms`
- mean `refreshJobs avg=471.11ms`

Measured deltas:
- `refreshJobs p95: -89.93ms`
- `refreshJobs avg: -85.52ms`

Dominant sub-step status:
- signal recomputation remains dominant.
- query-count costs dropped materially for inventory/operations domains.
- next likely micro-target inside refresh path is `operations.reconcile` write/reconcile cost.

## Dashboard Operations-Reconcile Micro-Optimization Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Scenario command (same before/after):
- `npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9`

Repeated-run comparison (`3x` baseline vs `3x` after):
- `refreshJobs avg: 457.11ms -> 398.85ms` (`-58.26ms`)
- `refreshJobs p95: 825.33ms -> 775.13ms` (`-50.2ms`)
- `operations.reconcile avg: 237.44ms -> 52.89ms` (`-184.55ms`)
- `operations.reconcile p95: 271.5ms -> 75.7ms` (`-195.8ms`)

What changed:
- operation-domain reconcile now prefetches active operation signals once and applies conditional create/update/resolve from that state, instead of per-signal lookup/reconcile calls.
- added active signal lookup index: `isig_active_lookup_idx`.

Current interpretation:
- targeted `operations.reconcile` cost is materially reduced and no longer the dominant refresh sub-step.
- dashboard refresh remains a valid optimization area, but the next micro-target should move to remaining higher-cost signal domains (`acquisition` first based on current repeated-run means).

## Dashboard Acquisition Micro-Optimization Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Scenario command:
- `npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9`

Repeated-run comparison (`3x` before vs `3x` after):
- `refreshJobs avg: 420.63ms -> 338.22ms` (`-82.41ms`)
- `refreshJobs p95: 820.73ms -> 651.27ms` (`-169.46ms`)
- `acquisition domain avg: 359.11ms -> 153.22ms` (`-205.89ms`)

Acquisition sub-breakdown after change:
- `acquisition.queryCounts avg=100ms`
- `acquisition.reconcile avg=53.22ms`
- `acquisition.reconcile p95=76.33ms`

Interpretation:
- acquisition is no longer the dominant refresh-domain cost.
- next dashboard refresh micro-target should move to `deals`/`inventory` signal phases (now highest remaining domain means).

## Dashboard Deals Micro-Optimization Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Scenario command:
- `npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9`

Repeated-run comparison (`3x` before vs `3x` after):
- `refreshJobs avg: 340.3ms -> 302.78ms` (`-37.52ms`)
- `refreshJobs p95: 648.53ms -> 568.6ms` (`-79.93ms`)
- `deals domain avg: 177.55ms -> 148.78ms` (`-28.77ms`)
- `deals.reconcile avg: 83.78ms -> 32.56ms` (`-51.22ms`)

Interpretation:
- deals reconcile write-path cost dropped materially.
- next dominant refresh-domain cost is now inventory signal phase (`inventory avg=167.22ms` in this sample).

## Dashboard Inventory Micro-Optimization Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Scenario command:
- `npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9`

Repeated-run comparison (`3x` before vs `3x` after):
- `refreshJobs avg: 335.41ms -> 296.04ms` (`-39.37ms`)
- `refreshJobs p95: 662.2ms -> 537ms` (`-125.2ms`)
- `inventory domain avg: 179.44ms -> 103.34ms` (`-76.1ms`)
- `inventory.reconcile avg: 119.78ms -> 44.67ms` (`-75.11ms`)

Interpretation:
- targeted inventory reconcile optimization produced a clear repeated-run gain.
- inventory is no longer dominant; deals is now the slightly higher remaining refresh domain in this sample.

## Dashboard Deals Query-Side Micro-Optimization Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Scenario command:
- `npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9`

Repeated-run comparison (`3x` before vs `3x` after):
- `refreshJobs avg: 307.15ms -> 306.7ms` (`-0.45ms`, effectively flat)
- `refreshJobs p95: 541.73ms -> 563.53ms` (`+21.8ms`, worse in this sample)
- `deals domain avg: 154.33ms -> 151ms` (`-3.33ms`, small)
- `deals.queryCounts: 108.78ms -> 116.22ms` (`+7.44ms`, no clear gain)
- `deals.query.funding_pending_count: 101.78ms -> 78ms` (`-23.78ms`, directional gain)

Interpretation:
- deals funding query improved directionally with index support, but end-to-end refresh gain was inconclusive under local variance.
- dashboard refresh remains an active hotspot, but this specific query-side step did not produce a clear overall win.

## Repo-Wide Priority Reconciliation (March 10, 2026)

Cross-area status using latest valid evidence:

1. Dashboard refresh:
- still the top measured percentile hotspot after domain micro-optimizations.
- latest repeated sample: `refreshJobs p95=537ms`.

2. Inventory read path:
- materially improved from earlier baseline phases and currently below latest refresh p95 in available evidence.
- keep in monitor mode unless it retakes top percentile hotspot in refreshed full-suite evidence.

3. Worker/platform bridge:
- overhead remains measurable in last full-suite artifact:
  - worker bridge `avg=261.58ms`
  - platform bridge `avg=140.58ms`
- redesign remains deferred pending stronger segmented/tail measurement evidence.

4. Reports/dashboard reads:
- healthy in current evidence; not current bottlenecks.

5. Build/test/dev speed:
- no new repo-wide measurement evidence in this pass that justifies reprioritizing away from runtime hotspots.

Conservative next target:
- continue with one more narrow dashboard refresh micro-sprint focused on remaining query-side domain cost (`deals` first).

## Bridge Measurement-Quality Sprint Update (March 10, 2026)

Reference:
- `docs/canonical/BRIDGE_MEASUREMENT_QUALITY_REPORT.md`

What changed:
- worker and platform bridge perf scenarios now output:
  - latency `p50/p95/p99`
  - segmented timing:
    - setup
    - signing
    - network request
    - response parse
    - handler/service/db (when exposed by target headers)

Repeated bridge runs (`3x`, 12 iterations each, deployed target):

Worker bridge means:
- `avg=228.42ms`, `p50=160ms`, `p95=845.67ms`, `p99=845.67ms`
- segments: setup/sign/parse small, network dominant.

Platform bridge means:
- `avg=145.44ms`, `p50=122.67ms`, `p95=301.67ms`, `p99=301.67ms`
- segments: setup/sign/parse small, network dominant.

Observability caveat:
- handler/service/db segments are now supported by repo code via response headers, but were not observable in these remote-target runs (reported as 0).

Interpretation:
- bridge measurement quality is now substantially better for decision-making.
- worker bridge tail behavior is now visible and should inform next cross-cutting optimization planning.

## Worker vinDecode Direct-Execution Cutover (March 10, 2026)

References:
- `docs/canonical/WORKER_BRIDGE_VINDECODE_REVIEW.md`
- `docs/canonical/WORKER_BRIDGE_VINDECODE_CUTOVER_REPORT.md`

What changed:
- vinDecode worker default mode is now direct shared-service execution.
- rollback remains available via `WORKER_VINDECODE_EXECUTION_MODE=bridge`.
- dealer internal vin-decode endpoint remains available for rollback and measurement.

Validation:
- `npm -w apps/worker run test -- src/workers/worker-handlers.test.ts` passed with new vinDecode direct/bridge assertions.

Bridge probe after cutover (endpoint path still measured directly, `3x` repeated):
- command:
  - `DEALER_INTERNAL_API_URL=https://dms-gold.vercel.app npm run perf:worker-bridge -- --dealership-id a1000000-0000-0000-0000-000000000001 --iterations 12`
- run set:
  - run 1: `avg=271.42ms`, `p50=144ms`, `p95=1577ms`
  - run 2: `avg=170.75ms`, `p50=145ms`, `p95=381ms`
  - run 3: `avg=157.67ms`, `p50=143ms`, `p95=216ms`
- 3-run means:
  - `avg=199.95ms`
  - `p50=144ms`
  - `p95=724.67ms`
  - network/request remains dominant.

Interpretation:
- this confirms bridge overhead is still meaningful when the endpoint path is used,
- but vinDecode no longer pays this hop in the default worker runtime path.

## Dashboard Refresh Parallel-Signal Sprint Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

Change implemented:
- `inventory_dashboard` now runs inventory + acquisition signal generators in parallel.
- `timingsMs.signals` now reflects wall-clock parallel block duration for that path.

Repeated-run comparison (`3x`, same scenario args):
- baseline means:
  - `refreshJobs avg=306.59ms`
  - `refreshJobs p95=593.13ms`
- after means:
  - `refreshJobs avg=293.82ms`
  - `refreshJobs p95=536.47ms`
- delta:
  - `avg: -12.77ms`
  - `p95: -56.66ms`

Interpretation:
- this is a retained, directionally positive win.
- dashboard refresh remains the top hotspot class, but marginal returns are now lower/noisier than earlier reconcile-focused sprints.

## Dashboard Acquisition Query-Index Sprint Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

What changed:
- added deeper acquisition query split profiling:
  - `acquisition.query.appraisal_draft_count`
  - `acquisition.query.source_lead_new_count`
- added one narrow partial index for the dominant acquisition query predicate:
  - `inv_src_lead_new_did_idx` on `InventorySourceLead(dealership_id)` where `status='NEW'`.

Repeated-run comparison (`3x`, same scenario args):
- baseline means:
  - `refreshJobs avg=315.37ms`
  - `refreshJobs p95=567.53ms`
  - `acquisition.queryCounts avg=181.22ms`
- after means:
  - `refreshJobs avg=291.81ms`
  - `refreshJobs p95=516.27ms`
  - `acquisition.queryCounts avg=157.44ms`

Interpretation:
- repeated directional improvement is present and retained.
- dashboard refresh remains a top hotspot class, with remaining variability still visible in local runs.

## Final Dashboard Acquisition Appraisal-Draft Sprint Update (March 10, 2026)

Reference:
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`

What changed:
- final narrow partial index added for appraisal-draft acquisition count:
  - `veh_appr_draft_did_idx` on `VehicleAppraisal(dealership_id)` where `status='DRAFT'`.

Repeated-run comparison (`3x`, same scenario args):
- baseline means:
  - `refreshJobs avg=341.04ms`
  - `refreshJobs p95=637.07ms`
  - `acquisition.queryCounts avg=209.67ms`
  - `acquisition.query.appraisal_draft_count avg=166.11ms`
- after means:
  - `refreshJobs avg=307.52ms`
  - `refreshJobs p95=563.87ms`
  - `acquisition.queryCounts avg=167ms`
  - `acquisition.query.appraisal_draft_count avg=131.67ms`

Interpretation:
- retained directional win with meaningful mean deltas.
- variance remains high enough that further dashboard micro-tuning should pause and repo-wide priorities should be reassessed.

## Selective Bridge Optimization Sprint Update (March 10, 2026)

Reference:
- `docs/canonical/BRIDGE_OPTIMIZATION_SPRINT_REPORT.md`

Implemented:
- bulkImport worker moved to direct execution by default with rollback flag:
  - `WORKER_BULKIMPORT_EXECUTION_MODE=bridge`

Bridge-related repeated measurements (deployed target, `3x`):
- worker bridge means:
  - `avg=235.78ms`
  - `p50=167ms`
  - `p95=843.33ms`
  - `p99=843.33ms`
- platform bridge means:
  - `avg=153.86ms`
  - `p50=137.33ms`
  - `p95=253.33ms`
  - `p99=253.33ms`

Interpretation:
- worker bridge tail remains significant and above platform bridge levels.
- selective bridge optimization remains a valid next-priority runtime lane.
