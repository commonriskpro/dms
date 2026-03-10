# SQL Optimization Playbook (Canonical)

Date: March 10, 2026  
Scope: Repo-specific SQL optimization rules for DMS (`apps/dealer`, `apps/platform`, `apps/worker` interactions with dealer/platform Postgres).

Use with:
- `docs/canonical/OPTIMIZATION_AUDIT.md`
- `docs/canonical/OPTIMIZATION_PLAN.md`
- `docs/canonical/PERFORMANCE_RUN_REVIEW.md`
- `docs/canonical/INVENTORY_PERF_STAGED_IMPLEMENTATION_REPORT.md`
- `docs/canonical/INVENTORY_QUERY_PLAN_REVIEW.md`
- `docs/canonical/INVENTORY_INDEX_SUPPORT_REPORT.md`
- `docs/canonical/ASYNC_CONVERGENCE_PLAN.md`

---

## 1. Core Principles

1. Code + canonical docs are source of truth.
2. Measure before optimizing.
3. Use repeated-run comparisons, not single-run claims.
4. Preserve behavior first:
   - API shape
   - business semantics
   - RBAC outcomes
   - tenant isolation (`dealershipId` scoping)
5. Keep architecture boundaries:
   - BullMQ executes background work.
   - Postgres remains durable workflow/business state.
   - Do not move canonical live list reads into async execution.

---

## 2. Read-Path Classification

Classify every slow path before changing SQL:

1. Live canonical row read
- Example: inventory/customer/deal list rows.
- Primary goal: fast row retrieval with strict correctness.

2. Aggregate/summary read
- Example: dashboard/report counters, trends, KPI totals.
- Primary goal: grouped/counted SQL or snapshot-backed reads.

3. Derived row metadata read
- Example: badges/health flags/market deltas.
- Primary goal: precompute where stable; avoid expensive per-row recompute in hot requests.

4. Workflow/history/audit read
- Example: job runs, automation history, audit logs.
- Primary goal: correctness and traceability first; optimize filters/indexing without sacrificing audit semantics.

Do not optimize these categories with one generic tactic.

---

## 3. List-Page Rules (Inventory/Customers/Deals/Opportunities)

1. Keep list query shape narrow:
- select only row fields rendered on the list.
- avoid detail-only relations in list reads.

2. Keep list canonical:
- live row correctness cannot depend on queue completion.
- cache/snapshot can assist but must fail open to live query.

3. Separate list rows from aggregates:
- list path should not pay for full dashboard/summary calculations.
- load summaries separately via grouped/snapshot reads.

4. Keep tenant filters first-class:
- include `dealershipId` and `deletedAt` predicates in hot list patterns.

5. Prefer measured, reversible changes:
- narrow one relation/include at a time.
- validate both correctness and perf before stacking more changes.

---

## 4. Aggregation Rules

Use DB-side aggregation when:
1. endpoint returns counts/sums/trends only,
2. request currently materializes many rows then aggregates in JS,
3. aggregation keys are stable (status/day/user/lifecycle bucket).

Preferred patterns:
1. `COUNT`, `SUM`, `GROUP BY` over row fetching + in-memory loops.
2. grouped day buckets for trend lines instead of fetching all timestamps.
3. SQL-side de-dupe/first-per-entity logic where it replaces repeated app-layer passes.

Avoid:
1. broad row fan-out with in-memory joins for simple counters.
2. recomputing the same aggregate in multiple services per request.

---

## 5. Snapshot / Precompute Rules

Use durable Postgres snapshots when:
1. data is summary-like and reused frequently,
2. eventual consistency is acceptable within a bounded TTL/revalidation model,
3. stale fallback behavior is explicitly defined.

Implementation rules:
1. Store snapshot in Postgres (durable source).
2. Trigger refresh via BullMQ where possible.
3. Keep live rows canonical and synchronous.
4. Use stale-while-revalidate carefully:
   - stale snapshot can serve summary fast,
   - refresh runs async,
   - live-row operations remain independent.

Do not:
1. gate canonical list correctness on snapshot freshness,
2. push full list execution into worker queues.

---

## 6. N+1 and Batching Rules

Detect N+1 by:
1. profiling logs (request breakdown + repeated subcalls),
2. Prisma query logs/EXPLAIN inspection for repeated per-row lookups,
3. code review of loops that call DB/service repeatedly.

Fix using:
1. one batched query by ID set (`IN (...)`) per request section,
2. preloaded maps keyed by entity ID,
3. shared helper for list + intelligence surfaces to avoid duplicated batch work.

Rule:
- batch first; only denormalize/precompute after batching fails to achieve target latency.

---

## 7. Indexing Rules (Repo-Specific)

1. Index real hot filter+sort combos only.
2. Include tenant scope (`dealershipId`) early in index keys for dealer-side tables.
3. Include soft-delete predicate shape (`deletedAt`) where list paths use it.
4. Prefer one targeted composite index over many speculative indexes.
5. Validate with EXPLAIN + repeated-run measurement.
6. Avoid index spam:
   - each new index must map to a measured query pattern.

Inventory-specific learned rule:
- default list path already had useful index support; targeted variant support (`status + salePrice desc`) was justified only after plan review and variance-aware measurement.

---

## 8. Query-Plan / EXPLAIN Rules

Run plan review before deeper SQL refactors when:
1. p95 remains high after obvious select/include cleanup,
2. count and findMany behavior diverge,
3. adding index candidates.

Minimum plan workflow:
1. capture exact SQL-equivalent query shape for the hot path,
2. run `EXPLAIN (FORMAT JSON)` (and analyze when safe),
3. note index used, sort nodes, seq scans, hash joins,
4. compare plan intent to index design.

Interpretation rule:
- planner not choosing a new index does not automatically invalidate the change, but it lowers confidence; require repeated-run evidence.

---

## 9. Count-Specific Rules

Treat `count(*)` as a separate optimization target.

1. Profile `findMany` and `count` separately on list paths.
2. If `count` spikes only on specific filters, optimize that filter family first (not entire list query).
3. Avoid coupling count fixes to broad row query rewrites unless required.
4. For expensive anti-join counts (e.g., missing-photo style filters), consider dedicated strategy and keep scope isolated.

---

## 10. Variance-Aware Measurement Rules

Required comparison protocol for SQL tuning:
1. Same dataset/seed tier.
2. Same command args and iteration/warmup.
3. Repeat runs (minimum 5x when variance is known high).
4. Record:
   - p50
   - p95
   - avg
   - max
   - spread/range
5. Compare means and spread, not only best run.

Interpretation:
1. Tiny deltas inside spread/noise are not wins.
2. Mixed signals (e.g., p95 down, p50 up) require cautious retention decisions.
3. Keep low-risk changes with modest directional gains if no regressions in behavior/tests.

---

## 11. Domain Guidance (Current Repo)

### Inventory

Current state:
- heavily optimized versus early baseline, but still a top measured read hotspot.
- dominant remaining cost is often `vehicleList.findMany`.

Rules:
1. keep list live and canonical,
2. optimize query-plan/index support incrementally,
3. keep summary/snapshot logic off critical row path.

### Reports

Current state:
- major improvements already landed; avoid broad rewrites without new evidence.

Rules:
1. avoid report fan-out + in-memory joins where grouped SQL can replace them,
2. keep chart-heavy UI fetches scoped to necessary widgets.

### Dashboard

Current state:
- reads are healthy after grouped/snapshot/event-driven work.

Rules:
1. preserve grouped-count/trend aggregation pattern,
2. avoid reintroducing full-row trend materialization.

### CRM / Jobs

Current state:
- BullMQ execution + Postgres durable state is canonical direction.

Rules:
1. optimize workflow-state queries with indexing/filtering discipline,
2. do not trade away auditability/traceability for query micro-gains,
3. keep execution concerns and durable state concerns separated.

---

## 12. Anti-Patterns to Avoid

1. Broad query rewrites without measurement.
2. Random index additions without plan evidence.
3. Moving live list reads into BullMQ.
4. Recomputing summaries in hot request paths when snapshots/grouped reads exist.
5. Speculative denormalization without refresh semantics and fallback plan.
6. Using single-run p95 as proof.
7. Blending unrelated optimization domains into one sprint (hard to validate, hard to rollback).

---

## 13. Practical Decision Matrix

For any hot SQL path, choose next action in this order:

1. **Query-plan review first**  
Use when index/sort/join behavior is unclear.

2. **Narrow select/include**  
Use when list payload is over-wide or detail relations leak into list reads.

3. **Remove summary leakage from live path**  
Use when list request is paying for aggregate work.

4. **Add/adjust index**  
Use when hot filter+sort is clear and plan indicates avoidable sort/scan.

5. **Push aggregation into SQL**  
Use for counter/trend-heavy endpoints currently aggregating in JS.

6. **Batch related reads**  
Use for N+1 or per-row enrichment lookups.

7. **Snapshot/precompute**  
Use for repeated summary/derived metadata where eventual consistency is acceptable.

8. **Stop optimizing for now**  
If gains stay within variance, or risk exceeds expected value.

---

## 14. Current SQL-Focused Targets Worth Attention

Grounded in current canonical perf/optimization docs:

1. Inventory list variant optimization beyond current staged work:
- continue targeted plan/index work for dominant `findMany` variants.

2. Inventory filter families with join-heavy plans:
- keep isolated from broad list rewrites; handle as dedicated filter-specific effort.

3. Report fan-out edge paths:
- verify if any remaining high-volume date-range paths still materialize too much data.

4. Count-heavy filtered views:
- evaluate as separate from row retrieval.

5. Measurement stability improvements:
- keep repeated-run baselines current for SQL hotspots before each sprint.

---

## Facts vs Recommendations

Facts in this playbook come from current code and canonical measured reports as of March 10, 2026.  
Recommendations are decision rules for future sprints and must still be validated against fresh measurements before behavior-changing SQL work.
