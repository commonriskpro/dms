# Next Performance Priority Review

Date: March 10, 2026  
Scope: repo-wide next-priority decision after inventory staged optimization, worker-bridge measurement refresh, and SQL optimization playbook rollout.

Primary sources:
- `docs/canonical/PERFORMANCE_RUN_REVIEW.md`
- `docs/canonical/INVENTORY_PERF_STAGED_IMPLEMENTATION_REPORT.md`
- `docs/canonical/INVENTORY_PERF_OPTIMIZATION_REPORT.md`
- `docs/canonical/INVENTORY_QUERY_PLAN_REVIEW.md`
- `docs/canonical/INVENTORY_INDEX_SUPPORT_REPORT.md`
- `artifacts/perf/2026-03-10T15-35-29-821Z/summary.json`
- `artifacts/perf/2026-03-10T15-35-29-821Z/dashboard.json`
- `artifacts/perf/2026-03-10T15-35-29-821Z/worker-bridge.json`
- `artifacts/perf/2026-03-10T15-13-20-806Z/summary.json` (sanity comparison)

---

## 1. Highest Valid Measured Hotspot Now

Using latest full-suite artifact (`2026-03-10T15-35-29-821Z`), the highest clearly measured percentile hotspot is:

- **Dashboard refresh path (`refreshJobs`)**
  - `p95=942.8ms`
  - `max=953ms`
  - `count=3` per run (mutation bursts)

Context:
- dashboard read path itself is healthy (`dashboardReads p95=1ms`)
- reports remain healthy (`salesSummary p95=1ms` in latest run)

---

## 2. Is Inventory Still Worth Another Sprint?

**Not as the immediate next repo-wide sprint.**

Why:
1. Inventory has already seen large cumulative gains in staged work.
2. Latest full-suite inventory metric is materially lower than historic baseline and currently below dashboard refresh p95:
   - latest full-suite inventory `p95=416.95ms`
3. Latest inventory SQL/index sprint showed modest, variance-aware directional improvement and reduced spread, not a large new breakthrough.

Decision:
- keep inventory in a **monitor + targeted follow-up** bucket, not top priority.

---

## 3. Is Dashboard Refresh Path Now the Main Target?

**Yes, for the next optimization sprint.**

Rationale:
1. It is currently the strongest percentile hotspot in latest valid measurements.
2. It affects event-driven user freshness after mutations.
3. Reads are already fast; optimization should focus on refresh execution and invalidation workflow, not dashboard read query path.

Recommended scope:
- measure and optimize refresh job internals (`inventory_dashboard`, `sales_metrics`, `customer_stats`) with segmented timing before deeper changes.

---

## 4. Is Bridge Overhead Worth Further Redesign Now?

**Measure-first, redesign-later.**

Current bridge evidence:
- worker bridge latest run: `avg=261.58ms`, `max=1446ms`, `errorCount=0`
- platform bridge latest run: `avg=140.58ms`, `errorCount=0`

Interpretation:
1. Bridge overhead is real and non-trivial.
2. Current worker-bridge scenario still reports `min/avg/max` only (no p95), so tail behavior is not yet characterized robustly.
3. Without segmented timing (network vs dealer handler vs DB), a broad bridge redesign is premature.

Decision:
- no immediate broad bridge architecture redesign sprint.
- continue phased, measured bridge work after dashboard refresh sprint or in parallel as instrumentation-only.

---

## 5. Recommended Next Optimization Sprint

## Sprint Target: Dashboard Refresh Path Optimization (measurement-first)

Goals:
1. Add segmented timing inside refresh job execution path.
2. Identify dominant SQL/invalidations within refresh jobs.
3. Apply one narrow, high-confidence optimization.
4. Re-run repeated dashboard scenario comparisons (`mutationBursts` retained) and report before/after.

Success criteria:
- meaningful reduction in `refreshJobs` p95 with no regression to read-path correctness.
- no behavior change in business semantics, tenant isolation, or async durability rules.

---

## 6. What Should Explicitly Wait

1. **Another broad inventory query-shape rewrite**
- wait unless new measurement isolates a clear dominant query-side win outside current variance band.

2. **`missingPhotosOnly` anti-join redesign**
- keep as a dedicated future effort; do not bundle with dashboard refresh sprint.

3. **Broad worker/dealer bridge architecture redesign**
- wait for stronger percentile + segmented timing evidence.

4. **Speculative denormalization or async migration of live list reads**
- conflicts with current canonical rules and risk posture.

---

## Conservative Priority Order (Current)

1. Dashboard refresh path optimization (next sprint).
2. Bridge measurement quality improvements (p95/segmented timing) and narrow follow-up.
3. Inventory targeted follow-up only if it retakes top hotspot status in repeated full-suite runs.
