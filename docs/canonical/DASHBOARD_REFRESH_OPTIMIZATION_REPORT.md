# Dashboard Refresh Optimization Report

Date: March 10, 2026  
Scope: measurement-first, narrow optimization on dashboard refresh/recompute path only.

## Goal

Optimize the highest measured dashboard hotspot:
- `refreshJobs` path (not dashboard reads).

Constraints followed:
- dashboard read path unchanged,
- no inventory optimization work,
- no bridge redesign work,
- tenant isolation and BullMQ/Postgres architecture preserved.

## Measurement Setup

Command used:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Rationale:
- more refresh bursts than default to improve type-level visibility (`inventory_dashboard`, `sales_metrics`, `customer_stats`).

## Step 1: Re-profile Refresh Path

Instrumentation added:
- `runAnalyticsJob` now returns `timingsMs`:
  - `tenantCheck`
  - `invalidate`
  - `signals`
  - `total`
  - `signalByKey` (domain-level timings)
- dashboard perf scenario now reports:
  - `refreshJobsByType`
  - `refreshStepBreakdown`
  - `refreshSignalBreakdown`

Dominant measured sub-step (baseline with instrumentation):
- `signals` stage dominates refresh cost.
- `invalidate` is negligible.
- highest-cost types:
  - `inventory_dashboard`
  - `sales_metrics`

Baseline snapshot:
- `refreshJobs avg=531.56ms`, `p95=818.6ms`, `max=885ms`
- `refreshStepBreakdown.signals avg=482.44ms`, `p95=763.8ms`
- `refreshJobsByType` averages:
  - `inventory_dashboard=683ms`
  - `sales_metrics=616.33ms`
  - `customer_stats=295.33ms`

## Step 2: Narrow Optimization Implemented

Optimization:
- parallelized independent per-domain signal reconciliation writes inside each domain generator:
  - `generateInventorySignals`
  - `generateCrmSignals`
  - `generateDealSignals`
  - `generateOperationSignals`
  - `generateAcquisitionSignals`
- this targets serial DB write overhead in the dominant signal recomputation phase.

Safety:
- no domain semantics changed,
- same signal codes and reconciliation logic,
- only execution ordering of independent reconcile calls changed.

## Step 3: After-Change Measurements

Post-change run A:
- `refreshJobs avg=546.56ms`, `p95=815.6ms`, `max=818ms`
- `refreshStepBreakdown.signals avg=506.56ms`, `p95=765.2ms`
- `refreshJobsByType` averages:
  - `inventory_dashboard=692.33ms`
  - `sales_metrics=693ms`
  - `customer_stats=254.33ms`

Post-change run B (variance check):
- `refreshJobs avg=676.56ms`, `p95=1411ms`, `max=1753ms`
- outlier-heavy run (tenant/signal spikes), confirms environment noise remains significant.

## Before/After Interpretation (Conservative)

What is clear:
- dominant bottleneck is confirmed: **signal recomputation** in refresh jobs.
- `invalidate` remains very small and not the primary target.
- `inventory_dashboard` and `sales_metrics` remain the expensive refresh types.

What is not clear:
- this narrow parallel-reconcile optimization did **not** produce a stable, repeatable end-to-end win in current local runs.
- results are mixed under high variance.

Decision:
- retain instrumentation improvements (high value, low risk).
- retain code change as low-risk internal execution improvement, but treat performance impact as **inconclusive** pending staged/prod-like repeated measurements.

## Tests Run

Command:

```bash
npm -w dealer run test -- modules/intelligence/service/async-jobs.test.ts modules/dashboard/tests/getDashboardV3Data.test.ts
```

Result:
- pass (`16/16`)

## Next Bottleneck After This Sprint

Still the dashboard refresh signal phase:
- particularly `inventory_dashboard` and `sales_metrics` signal generation/reconciliation path.

Recommended next narrow focus:
1. measure and optimize signal-engine queries/writes by domain with repeated-run evidence in a less noisy mode (staging/prod build runtime),
2. evaluate safe coalescing policy only if repeated identical refresh events are confirmed in production traces.

---

## Dashboard Signal-Domain Micro-Optimization Sprint (March 10, 2026)

Scope:
- only dominant refresh signal domains:
  - `inventory_dashboard`
  - `sales_metrics`

### Measurement-first profiling added

Deeper profiling surfaced in dashboard scenario output:
- `inventory.queryCounts`, `inventory.reconcile`
- `deals.queryCounts`, `deals.reconcile`
- `operations.queryCounts`, `operations.reconcile`

### Dominant sub-step findings (before micro-optimization)

Repeated baseline (`3x`, same scenario args):
- mean `refreshJobs p95=953.2ms`
- mean `refreshJobs avg=556.63ms`

Signal-domain findings:
- `inventory.queryCounts` and `operations.queryCounts` were significant repeated SQL cost.
- reconcile remained substantial, especially `operations.reconcile`.

### Narrow optimizations implemented

1. Collapsed inventory count pair into one SQL query using `COUNT(*) FILTER (...)`:
- file: `apps/dealer/modules/intelligence/service/signal-engine.ts`
- removed two separate `Vehicle.count(...)` calls in `generateInventorySignals`.

2. Collapsed operations title-status counts into one grouped query:
- file: `apps/dealer/modules/intelligence/service/signal-engine.ts`
- replaced two `DealTitle.count(...)` calls with one `groupBy(titleStatus)` in `generateOperationSignals`.

3. Reduced unnecessary signal-update churn:
- file: `apps/dealer/modules/intelligence/db/signals.ts`
- `upsertActiveSignal` no longer treats `happenedAt` drift alone as a change.
- unchanged signal metadata/title/severity/action now avoids write update churn during refresh loops.

### Repeated-run comparison

Scenario command (all series):

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline mean (3 runs):
- `refreshJobs p95=953.2ms`
- `refreshJobs avg=556.63ms`
- `inventory_dashboard avg=772.89ms`
- `sales_metrics avg=609ms`

After final micro-optimization mean (3 runs):
- `refreshJobs p95=863.27ms`
- `refreshJobs avg=471.11ms`
- `inventory_dashboard avg=679.22ms`
- `sales_metrics avg=507.89ms`

Mean deltas (baseline -> final):
- `refreshJobs p95: -89.93ms`
- `refreshJobs avg: -85.52ms`
- `inventory_dashboard avg: -93.67ms`
- `sales_metrics avg: -101.11ms`

Sub-breakdown movement:
- `operations.queryCounts: 127.55ms -> 46.11ms` (mean)
- `inventory.queryCounts: 117.11ms -> 81.67ms` (mean)
- `inventory.reconcile: 164.22ms -> 102.22ms` (mean)
- `operations.reconcile` remains comparatively high (`214.56ms -> 231.33ms`, mean, noisy)

### Tests

Command:

```bash
npm -w dealer run test -- modules/intelligence/service/async-jobs.test.ts modules/dashboard/tests/getDashboardV3Data.test.ts modules/intelligence/service/signal-engine.test.ts
```

Result:
- Passed suites:
  - `modules/intelligence/service/async-jobs.test.ts`
  - `modules/dashboard/tests/getDashboardV3Data.test.ts`
- `modules/intelligence/service/signal-engine.test.ts` is not present in current repo.

### Current next bottleneck after micro-sprint

- Dashboard refresh remains the top hotspot class, but improved.
- Inside refresh signal work, `operations.reconcile` is now the most likely next micro-target.

---

## Operations Reconcile Micro-Optimization Sprint (March 10, 2026)

Scope:
- narrow optimization only for `operations.reconcile` in dashboard refresh.
- preserved dashboard reads, BullMQ execution, and Postgres durable state model.

### Measurement-first baseline (3 repeated runs)

Command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means (before this sprint):
- `refreshJobs avg=457.11ms`
- `refreshJobs p95=825.33ms`
- `operations.reconcile avg=237.44ms`
- `operations.reconcile p95=271.5ms`

### Profiling + bottleneck findings

Findings:
- `operations.reconcile` remained mostly write-path reconcile overhead, not tenant check or cache invalidation.
- previous path performed per-signal active lookup + reconcile calls.
- with two operation signals, repeated lookup/upsert/resolve behavior was still expensive under repeated refresh bursts.

### Narrow optimization implemented

1. Added deeper `operations.reconcile` profiling output:
- `operations.reconcile.title_issue_hold`
- `operations.reconcile.title_pending`

2. Replaced operation-domain reconcile from per-signal generic path to one operation-specific reconcile pass:
- prefetch active operation signals once (`findMany`),
- apply conditional create/update/resolve using prefetched state,
- preserve same signal codes and semantics.

3. Added active-signal lookup index to support reconcile lookup patterns:
- Prisma schema index:
  - `@@index([dealershipId, domain, code, resolvedAt, deletedAt, entityType, entityId], map: "isig_active_lookup_idx")`
- migration:
  - `apps/dealer/prisma/migrations/20260310173000_intelligence_signal_active_lookup_index/migration.sql`

### Post-change repeated measurements (3 runs)

Means after this sprint:
- `refreshJobs avg=398.85ms`
- `refreshJobs p95=775.13ms`
- `operations.reconcile avg=52.89ms`
- `operations.reconcile p95=75.7ms`

Delta vs baseline:
- `refreshJobs avg: -58.26ms`
- `refreshJobs p95: -50.2ms`
- `operations.reconcile avg: -184.55ms`
- `operations.reconcile p95: -195.8ms`

Interpretation:
- this sprint produced a real, repeatable directional improvement in the targeted operation reconcile path.
- `operations.reconcile` is no longer the dominant refresh sub-step.
- next refresh micro-target should move to remaining high-cost domains (`acquisition`, then `deals`/`inventory` signal phases).

### Tests

Command:

```bash
npm -w dealer run test -- modules/intelligence/service/async-jobs.test.ts modules/dashboard/tests/getDashboardV3Data.test.ts modules/intelligence/tests/signal-engine.test.ts
```

Result:
- pass (`18/18`)

---

## Acquisition Refresh Micro-Optimization Sprint (March 10, 2026)

Scope:
- narrow, measurement-first optimization on the next dominant refresh-domain cost (`acquisition`).
- no dashboard read-path changes, no bridge redesign, no inventory-list scope changes.

### Re-profile after operations optimization (3 repeated runs)

Command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means for this sprint:
- `refreshJobs avg=420.63ms`
- `refreshJobs p95=820.73ms`
- domain means:
  - `acquisition=359.11ms` (dominant)
  - `deals=237.89ms`
  - `inventory=187.89ms`
  - `operations=105.11ms`
  - `crm=164.33ms`

### Dominant sub-step inside acquisition

Added deeper acquisition profiling:
- `acquisition.queryCounts`
- `acquisition.reconcile`
- `acquisition.reconcile.appraisal_draft`
- `acquisition.reconcile.source_lead_new`

Evidence:
- acquisition cost was primarily reconcile/write-path work, not just count queries.

### Narrow optimization implemented

1. Added acquisition timing breakdowns in signal generation output.
2. Replaced acquisition reconcile from generic per-signal path to one acquisition-scoped pass:
   - prefetch active acquisition signals once,
   - apply conditional create/update for active counts,
   - skip resolve write when count is zero and no active signal exists.
3. Preserved tenant scoping and existing signal codes/semantics.

### Repeated-run after results (3 runs, same args)

After means:
- `refreshJobs avg=338.22ms`
- `refreshJobs p95=651.27ms`
- domain means:
  - `acquisition=153.22ms`
  - `deals=187.33ms`
  - `inventory=187.22ms`
  - `operations=104ms`
  - `crm=175.33ms`

Delta vs sprint baseline:
- `refreshJobs avg: -82.41ms`
- `refreshJobs p95: -169.46ms`
- `acquisition: -205.89ms`

Acquisition sub-breakdown (after):
- `acquisition.queryCounts avg=100ms`
- `acquisition.reconcile avg=53.22ms`
- `acquisition.reconcile p95=76.33ms`

### Interpretation

- acquisition is no longer the dominant refresh-domain hotspot.
- next likely refresh micro-target shifts to `deals` and `inventory` signal phases.

---

## Deals Refresh Micro-Optimization Sprint (March 10, 2026)

Scope:
- measurement-first optimization on the next dominant refresh-domain cost after acquisition.
- no dashboard read-path changes, no inventory list-path work, no bridge changes.

### Re-profile after acquisition optimization (3 repeated runs)

Command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means for this sprint:
- `refreshJobs avg=340.3ms`
- `refreshJobs p95=648.53ms`
- `deals=177.55ms` (dominant)
- `inventory=152.89ms` (close behind)
- `deals.queryCounts=93.78ms`
- `deals.reconcile=83.78ms`

### Dominant sub-step inside deals

`deals` remained split across query and reconcile cost, with reconcile still a meaningful micro-target and lower risk than query-shape changes.

### Narrow optimization implemented

1. Added deeper deals reconcile profiling:
- `deals.reconcile.contracts_to_review`
- `deals.reconcile.funding_pending`

2. Replaced deals-domain reconcile with a domain-specific reconcile pass:
- prefetch active deals signals once,
- conditional create/update by preloaded state,
- skip resolve writes when no active signal exists.

Safety:
- same signal codes and semantics retained (`deals.contracts_to_review`, `deals.funding_pending`),
- tenant scoping preserved,
- BullMQ execution + Postgres durable state unchanged.

### Repeated-run after results (3 runs, same args)

After means:
- `refreshJobs avg=302.78ms`
- `refreshJobs p95=568.6ms`
- `deals=148.78ms`
- `inventory=167.22ms`
- `deals.queryCounts=116.22ms`
- `deals.reconcile=32.56ms`

Delta vs sprint baseline:
- `refreshJobs avg: -37.52ms`
- `refreshJobs p95: -79.93ms`
- `deals: -28.77ms`
- `deals.reconcile: -51.22ms`
- `deals.reconcile p95: -74.23ms`

Interpretation:
- the targeted deals reconcile write-path improved materially.
- overall dashboard refresh improved with repeated runs.
- next dominant refresh-domain cost is now `inventory` signal phase (slightly above `deals`).

---

## Inventory Refresh Micro-Optimization Sprint (March 10, 2026)

Scope:
- narrow, measurement-first optimization focused only on inventory signal refresh domain.
- no inventory list-path changes; no dashboard read-path changes; no bridge changes.

### Re-profile after deals optimization (3 repeated runs)

Command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means for this sprint:
- `refreshJobs avg=335.41ms`
- `refreshJobs p95=662.2ms`
- `inventory=179.44ms` (dominant)
- `deals=159.33ms`
- `inventory.queryCounts=59.67ms`
- `inventory.reconcile=119.78ms` (dominant sub-step in inventory)

### Deeper inventory-domain profiling added

Added:
- `inventory.reconcile.recon_queue`
- `inventory.reconcile.aged_90d`

### Narrow optimization implemented

1. Replaced inventory-domain reconcile with a domain-specific reconcile pass:
- prefetch active inventory signals once,
- conditional create/update by preloaded state,
- skip resolve writes when no active signal exists.

2. Preserved signal semantics:
- `inventory.recon_queue`
- `inventory.aged_90d`

### Repeated-run after results (3 runs, same args)

After means:
- `refreshJobs avg=296.04ms`
- `refreshJobs p95=537ms`
- `inventory=103.34ms`
- `deals=139.55ms`
- `inventory.queryCounts=58.56ms`
- `inventory.reconcile=44.67ms`

Delta vs sprint baseline:
- `refreshJobs avg: -39.37ms`
- `refreshJobs p95: -125.2ms`
- `inventory: -76.1ms`
- `inventory.reconcile: -75.11ms`
- `inventory.reconcile p95: -118.33ms`

Interpretation:
- inventory reconcile write-path was the correct micro-target and improved materially.
- inventory is no longer the dominant dashboard refresh-domain cost.
- next likely dashboard refresh micro-target shifts back to `deals` domain query-side cost.

---

## Deals Query-Side Micro-Optimization Sprint (March 10, 2026)

Scope:
- narrow, measurement-first optimization focused only on remaining `deals` query-side refresh cost.
- no dashboard read-path changes, no inventory list-path work, no bridge changes.

### Re-profile after inventory refresh optimization (3 repeated runs)

Command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means for this sprint:
- `refreshJobs avg=307.15ms`
- `refreshJobs p95=541.73ms`
- `deals=154.33ms` (dominant)
- `deals.queryCounts=108.78ms` (dominant deals sub-step)
- `deals.reconcile=45.11ms`

### Deeper deals query profiling added

Added:
- `deals.query.contracts_to_review_count`
- `deals.query.funding_pending_count`

### Dominant query-side finding

In this dataset/run pattern, the funding-pending submission count stayed the more expensive query-side sub-step.

### Narrow optimization implemented

1. Added query-side split profiling for deals query counts.
2. Added index-support changes for funding-pending submission query pattern:
   - composite index:
     - `fin_sub_did_status_fund_idx` on `("dealership_id", "status", "funding_status")`
   - partial index:
     - `fin_sub_pending_sub_dec_did_idx` on `("dealership_id")` where
       `funding_status='PENDING'` and `status IN ('SUBMITTED','DECISIONED')`

### Repeated-run after results (3 runs, same args)

After means:
- `refreshJobs avg=306.7ms`
- `refreshJobs p95=563.53ms`
- `deals=151ms`
- `deals.queryCounts=116.22ms`
- `deals.reconcile=34.66ms`
- `deals.query.funding_pending_count=78ms`

Delta vs sprint baseline:
- `refreshJobs avg: -0.45ms` (flat)
- `refreshJobs p95: +21.8ms` (worse, variance-sensitive)
- `deals: -3.33ms` (small)
- `deals.queryCounts: +7.44ms` (no clear gain)
- `deals.query.funding_pending_count: -23.78ms` (directional gain)

Interpretation (conservative):
- funding query-side sub-step improved directionally.
- end-to-end deals query block and refresh p95 did not improve conclusively in this local repeated sample.
- keep deeper profiling and index support, but treat this sprint as **mixed/inconclusive** for end-to-end refresh gains.

---

## Inventory-Dashboard Parallel Signal Execution Sprint (March 10, 2026)

Scope:
- one narrow, measurement-first change only.
- no dashboard read-path changes, no inventory list-path work, no bridge redesign.

### Re-profile baseline (3 repeated runs)

Command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means for this sprint:
- `refreshJobs avg=306.59ms`
- `refreshJobs p95=593.13ms`
- `refreshJobsByType.inventory_dashboard avg=414.44ms` (dominant refresh type)
- `refreshStepBreakdown.signals avg=233.85ms`

Dominant remaining sub-step/domain finding:
- `inventory_dashboard` remained the dominant type.
- inside its signal work, `acquisition.queryCounts` stayed one of the heaviest measured query-side contributors.

### Narrow optimization implemented

File changed:
- `apps/dealer/modules/intelligence/service/async-jobs.ts`

Change:
- for `inventory_dashboard` / `vin_stats`, run:
  - `generateInventorySignals(dealershipId)`
  - `generateAcquisitionSignals(dealershipId)`
  in parallel via `Promise.all`.
- set `timingsMs.signals` to true wall-clock parallel block duration (instead of summing both branch durations).

Why this is safe:
- no signal code semantics changed,
- no reconcile behavior changed,
- tenant isolation and BullMQ+Postgres architecture unchanged.

### Validation

Focused test:

```bash
npm -w dealer run test -- modules/intelligence/service/async-jobs.test.ts
```

Result:
- pass (`3/3`).

### Repeated-run after results (3 runs, same args)

After means:
- `refreshJobs avg=293.82ms`
- `refreshJobs p95=536.47ms`
- `refreshJobsByType.inventory_dashboard avg=381.56ms`
- `refreshStepBreakdown.signals avg=224.22ms`

Delta vs sprint baseline:
- `refreshJobs avg: -12.77ms` (`~4.2%`)
- `refreshJobs p95: -56.66ms` (`~9.6%`)
- `inventory_dashboard avg: -32.88ms`
- `signals avg: -9.63ms`

Important nuance:
- this optimization improved wall-time by overlap; it did **not** directly reduce acquisition query cost itself.
- `acquisition.queryCounts` remains a high absolute contributor and still shows run-to-run variance.

### Retention Decision

- **Retained**.
- Improvement is repeated and directionally meaningful at end-to-end refresh metrics.
- but returns are now smaller and noisier than earlier domain reconcile wins.

### Next Remaining Bottleneck (Post-sprint)

- `inventory_dashboard` remains the highest-cost refresh type in current repeated runs.
- inside it, `acquisition.queryCounts` and inventory/acquisition reconcile variability remain the primary measured contributors.

### Is another dashboard micro-sprint justified?

Conservative answer:
- **conditionally yes**, but only for one tightly scoped acquisition query-shape/index-plan sprint with repeated-run + query-plan evidence.
- if that sprint is mixed/noisy again, stop dashboard micro-tuning and reassess repo-wide priorities.

---

## Acquisition Query-Plan / Index-Support Sprint (March 10, 2026)

Scope:
- one tightly scoped acquisition query-side sprint only.
- no dashboard read-path changes, no inventory list-path work, no bridge redesign.

### Re-profile acquisition in inventory_dashboard refresh (3 repeated runs)

Command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means:
- `refreshJobs avg=315.37ms`
- `refreshJobs p95=567.53ms`
- `refreshJobsByType.inventory_dashboard avg=389.11ms`
- `acquisition.queryCounts avg=181.22ms`
- split query profiling:
  - `acquisition.query.appraisal_draft_count avg=142.22ms`
  - `acquisition.query.source_lead_new_count avg=155.56ms`

Dominant acquisition query-side sub-step:
- `source_lead_new_count` was the slightly dominant and more volatile acquisition count query in this run set.

### Narrowest justified optimization applied

Added one partial index targeted to the dominant predicate:
- migration:
  - `apps/dealer/prisma/migrations/20260310200500_acq_source_lead_new_partial_idx/migration.sql`
- SQL:
  - `CREATE INDEX "inv_src_lead_new_did_idx" ON "InventorySourceLead" ("dealership_id") WHERE "status" = 'NEW';`

Applied migration:

```bash
npm run db:migrate
```

### Repeated-run after results (3 runs, same args)

After means:
- `refreshJobs avg=291.81ms`
- `refreshJobs p95=516.27ms`
- `refreshJobsByType.inventory_dashboard avg=358.33ms`
- `acquisition.queryCounts avg=157.44ms`
- split query profiling:
  - `acquisition.query.appraisal_draft_count avg=139.22ms`
  - `acquisition.query.source_lead_new_count avg=131.89ms`

Delta vs baseline:
- `refreshJobs avg: -23.56ms`
- `refreshJobs p95: -51.26ms`
- `inventory_dashboard avg: -30.78ms`
- `acquisition.queryCounts: -23.78ms`
- `acquisition.query.source_lead_new_count: -23.67ms`

Interpretation (conservative):
- this is a repeated directional win and is retained.
- acquisition query-side cost improved, especially `source_lead_new_count`.
- variance remains meaningful; this is not a “final” dashboard optimization.

### Retention and next decision

- **Retained**: profiling split + targeted partial index.
- next remaining acquisition query-side cost is now typically `appraisal_draft_count`.
- another dashboard micro-sprint is still conditionally justifiable, but if the next sprint is mixed/noisy, stop dashboard micro-tuning and reassess repo-wide priorities.

---

## Final Acquisition Appraisal-Draft Query Sprint (March 10, 2026)

Scope:
- one final tightly scoped micro-optimization targeting `acquisition.query.appraisal_draft_count`.
- no dashboard architecture rewrite, no inventory list-path work, no bridge redesign.

### Re-profile before change (3 repeated runs)

Scenario command:

```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 12 --warmup 2 --mutation-bursts 9
```

Baseline means:
- `refreshJobs avg=341.04ms`
- `refreshJobs p95=637.07ms`
- `refreshJobsByType.inventory_dashboard avg=447.11ms`
- `acquisition.queryCounts avg=209.67ms`
- `acquisition.query.appraisal_draft_count avg=166.11ms`
- `acquisition.query.source_lead_new_count avg=176.89ms`

Dominance check:
- in this baseline set, `source_lead_new_count` remained slightly higher on average.
- `appraisal_draft_count` remained a major query-side contributor and still justified a final narrow index-support attempt.

### Narrow optimization applied

Added one partial index for appraisal-draft count predicate:
- migration:
  - `apps/dealer/prisma/migrations/20260310204000_acq_appraisal_draft_partial_idx/migration.sql`
- SQL:
  - `CREATE INDEX "veh_appr_draft_did_idx" ON "VehicleAppraisal" ("dealership_id") WHERE "status" = 'DRAFT';`

Applied:

```bash
npm run db:migrate
```

### Validation

Focused tests:

```bash
npm -w dealer run test -- modules/intelligence/service/async-jobs.test.ts modules/intelligence/tests/signal-engine.test.ts
```

Result:
- pass (`5/5`).

### Re-profile after change (3 repeated runs)

Same scenario command and args.

After means:
- `refreshJobs avg=307.52ms`
- `refreshJobs p95=563.87ms`
- `refreshJobsByType.inventory_dashboard avg=403.89ms`
- `acquisition.queryCounts avg=167ms`
- `acquisition.query.appraisal_draft_count avg=131.67ms`
- `acquisition.query.source_lead_new_count avg=139.44ms`

Delta vs baseline means:
- `refreshJobs avg: -33.52ms`
- `refreshJobs p95: -73.2ms`
- `inventory_dashboard avg: -43.22ms`
- `acquisition.queryCounts: -42.67ms`
- `acquisition.query.appraisal_draft_count: -34.44ms`

### Interpretation and stop gate

- this sprint produced a repeated directional win and is **retained**.
- however, run-to-run spread remains significant (one run regressed vs best-case), indicating persistent local variance.
- per the stop rule, this marks a good point to **stop additional dashboard micro-tuning** and reassess repo-wide priorities before another dashboard sprint.
