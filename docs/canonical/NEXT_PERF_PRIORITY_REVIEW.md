# Next Performance Priority Review

Date: March 10, 2026  
Scope: repo-wide priority reassessment after the completed dashboard refresh micro-tuning sequence.

Primary sources used:
- `docs/canonical/PERFORMANCE_RUN_REVIEW.md`
- `docs/canonical/DASHBOARD_REFRESH_OPTIMIZATION_REPORT.md`
- `docs/canonical/INVENTORY_PERF_OPTIMIZATION_REPORT.md`
- `docs/canonical/BRIDGE_MEASUREMENT_QUALITY_REPORT.md`
- `docs/canonical/OPTIMIZATION_AUDIT.md`
- `docs/canonical/OPTIMIZATION_PLAN.md`

---

## 1) Highest Valid Measured Hotspot Now

Highest currently measured hotspot class remains:
- **Dashboard refresh execution** (`refreshJobs`), not dashboard reads.

Most recent repeated-run post-tuning means (final dashboard micro-sprint):
- `refreshJobs avg=307.52ms`
- `refreshJobs p95=563.87ms`

Comparison anchor from latest full-suite reference in canonical docs:
- inventory read path `p95=416.95ms`
- dashboard reads `p95=1ms`
- reports reads healthy (low p95)

Conservative conclusion:
- dashboard refresh remains the top measured percentile hotspot class.

---

## 2) Should Dashboard Refresh Stay In Monitor Mode?

**Yes.**

Reasoning:
- planned micro-tuning sequence has been completed (operations, acquisition, deals, inventory, query-side follow-ups).
- final narrow acquisition query index sprint delivered directional gains, but run-to-run variance remains high.
- marginal returns are now lower and noisier than earlier wins.

Decision:
- treat dashboard micro-tuning as complete for now.
- reopen only with new stronger evidence (staging/prod-like traces or materially different workload behavior).

---

## 3) Should Inventory Stay In Monitor Mode?

**Yes.**

Reasoning:
- inventory has already received substantial staged optimization and major p95 reduction across prior sprints.
- latest canonical full-suite comparison still places inventory below refresh hotspot percentile.
- current inventory findings indicate incremental/variance-sensitive gains rather than clear next large win.

Decision:
- keep inventory in monitor mode with periodic re-measurement.

---

## 4) Should Bridge Work Move Up In Priority?

**Yes, selectively (not broad redesign).**

Evidence:
- bridge measurement quality is now improved (p50/p95/p99 + segmented timing).
- worker bridge still shows meaningful latency/tail behavior in canonical evidence.
- network/request segment is dominant in observed bridge runs.
- analytics/alerts/vinDecode direct-execution progress is complete, leaving still-bridged families as next candidates.

Decision:
- move **narrow bridge optimization/planning** up as the next runtime focus.
- keep broad bridge architecture redesign deferred.

---

## 5) Should Build/Test/Dev Speed Become The Next Target?

**Not as the immediate next sprint.**

Reasoning:
- runtime hotspots with measurable user/ops latency impact still exist (bridge overhead path).
- build/test/dev speed remains important but better positioned as a parallel/secondary lane.

Decision:
- keep build/test/dev efficiency in secondary queue unless runtime priorities stall.

---

## 6) Recommended Next Optimization Sprint

Recommended next sprint:
- **Narrow bridge optimization on still-bridged paths**, measurement-first.

Scope guidance:
- focus on one still-bridged high-value path family at a time (`bulkImport` first candidate, or `crmExecution` measurement-first if safer to inspect before touching).
- prioritize reducing request-path overhead and tail variance without broad architectural rewrite.
- preserve BullMQ execution + Postgres durable state.

Success criteria:
- repeated-run directional improvement in bridge latency/tail metrics,
- no semantics regressions,
- no scope creep into broad platform/worker redesign.

---

## 7) What Should Explicitly Wait

1. Additional dashboard micro-tuning loops without stronger new evidence.
2. Broad inventory list-path rewrites while inventory is in monitor mode.
3. Broad worker/dealer bridge redesign (all-at-once cutover).
4. Speculative denormalization or async changes to canonical live read paths.
5. Large multi-domain refactors bundled into one performance sprint.

---

## Priority Order (Conservative)

1. Narrow bridge optimization on still-bridged paths (measurement-first).
2. Repo-wide runtime reassessment after that bridge sprint.
3. Build/test/dev efficiency sprint (parallel or next, depending on runtime results).
4. Dashboard/inventory reopen only if new evidence materially changes ranking.

---

## Update After Selective bulkImport Bridge Sprint

Reference:
- `docs/canonical/BRIDGE_OPTIMIZATION_SPRINT_REPORT.md`
- `docs/canonical/PERFORMANCE_RUN_REVIEW.md`

Outcome:
- bulkImport direct execution cutover completed (default direct, bridge rollback flag preserved).
- repeated bridge measurements still show worker bridge tail materially above platform bridge.

Priority impact:
- dashboard remains monitor mode.
- inventory remains monitor mode.
- bridge optimization remains the active runtime priority lane.

Recommended next sprint:
1. continue selective bridge optimization on one candidate only, with CRM still treated as high-risk for direct cutover;
2. prioritize narrow, measurement-first improvements on still-bridged paths and/or bridge overhead segmentation quality before any broad redesign.
