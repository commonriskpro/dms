# SQL EXPLAIN Capture Guide (Canonical)

Date: March 10, 2026  
Scope: Repo-specific EXPLAIN capture and documentation workflow for measured SQL optimization sprints.

Use with:
- `docs/canonical/SQL_OPTIMIZATION_PLAYBOOK.md`
- `docs/canonical/SQL_OPTIMIZATION_CHECKLIST.md`
- `docs/canonical/PERFORMANCE_SIMULATION_PLAN.md`
- domain reports under `docs/canonical/*_REPORT.md`

---

## 1. When EXPLAIN Is Required In This Repo

EXPLAIN is required before behavior-changing SQL work when any of these are true:

1. List-path p95 remains high after obvious select/include cleanup.
2. `findMany` and `count` timings diverge materially.
3. You are proposing index additions/changes.
4. A filter+sort variant appears hot (for example `status + salePrice desc` in inventory).
5. A path is join-heavy or anti-join-heavy (`missingPhotosOnly`-style patterns).
6. You are deciding between query rewrite vs index support vs stop-for-now.

Not required:
- pure doc-only updates,
- non-SQL-only changes where SQL shape is unchanged.

---

## 2. Pair EXPLAIN With Repeated-Run Perf Evidence

Do not publish EXPLAIN findings alone.

Required pairing:
1. repeated-run perf baseline (minimum 5 runs when variance is known high),
2. EXPLAIN capture for dominant variant(s),
3. post-change repeated-run comparison with same args/seed/state,
4. explicit before/after summary (`mean p50/p95/avg`, spread/range).

Interpretation rule:
- plan evidence explains likely causes; repeated-run measurements decide whether change is retained.

---

## 3. Repo-Specific Capture Workflow

## 3.1 Common workflow (all domains)

1. Identify hot path and owning code file.
2. Record exact query context:
   - filters
   - sort/order
   - page/limit/offset
   - tenant scope assumptions (`dealershipId`)
   - soft-delete predicates (`deletedAt`)
3. Run repeated perf scenario first.
4. Capture SQL-equivalent EXPLAIN for dominant variant(s).
5. Apply one narrow change.
6. Re-run same repeated scenario set.
7. Document plan + measurements in canonical docs.

## 3.2 Inventory workflow

Primary files:
- `apps/dealer/modules/inventory/db/vehicle.ts`
- `apps/dealer/modules/inventory/service/inventory-page.ts`
- `apps/dealer/scripts/performance/run-inventory-scenario.ts`

Perf baseline command:
```bash
npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2
```

Optional micro-breakdown command:
```bash
LOG_LEVEL=debug INVENTORY_OVERVIEW_PROFILE=1 npm run perf:inventory -- --dealership-slug demo --iterations 12 --warmup 2
```

EXPLAIN capture style:
- use SQL equivalent of the actual variant (`where`, `order by`, `limit/offset`) against dealer DB.
- capture at least:
  - default list variant
  - hot filtered/sorted variant
  - count variant if count spikes are observed

## 3.3 Reports workflow

Primary files:
- `apps/dealer/modules/reports/db/*.ts`
- `apps/dealer/scripts/performance/run-reports-scenario.ts`

Perf baseline command:
```bash
npm run perf:reports -- --dealership-slug demo --iterations 12 --warmup 2
```

Rules:
- capture EXPLAIN for the slowest report endpoint query shape(s), not every query.
- include date-range and group-by context in report docs.

## 3.4 Dashboard workflow

Primary files:
- `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`
- `apps/dealer/scripts/performance/run-dashboard-scenario.ts`

Perf baseline command:
```bash
npm run perf:dashboard -- --dealership-slug demo --iterations 10 --mutation-bursts 4
```

Rules:
- EXPLAIN trend/grouped queries when dashboard read latency regresses.
- preserve event-driven snapshot architecture while tuning SQL.

## 3.5 CRM / jobs workflow

Primary files:
- `apps/dealer/modules/crm-pipeline-automation/*`
- `apps/dealer/app/api/crm/jobs/run/route.ts`
- async docs under `docs/canonical/ASYNC_CONVERGENCE_*.md`

Rules:
- focus EXPLAIN on workflow-state query hot spots (due-job selection, run history filters, status transitions).
- do not conflate execution-engine latency with SQL plan quality.
- preserve Postgres durable-state semantics.

---

## 4. Required Query Context To Record

Every EXPLAIN note in canonical docs must include:

1. Domain/path and owning file(s).
2. Filter/sort pattern.
3. Pagination parameters (`limit`, `offset`, page size).
4. Expected row-count context:
   - result row count (if known),
   - rough table scale/seed tier.
5. Environment assumptions:
   - seed tier (`small|medium|large`) or existing dataset status,
   - whether data is freshly seeded or long-lived local DB.
6. Before/after intent:
   - what changed,
   - what was expected,
   - whether plan changed materially.

---

## 5. How To Interpret Common Plan Signals (Repo Context)

1. Seq Scan
- can be acceptable on very small tables.
- suspect on large dealer-scoped tables in hot paths (`Vehicle`, `Deal`, `Customer`, etc.).
- in this repo, repeated seq scans on join-heavy filtered variants often map to p95 spikes.

2. Explicit Sort
- expected when no usable ordered index exists for filter+sort combo.
- if seen on hot list variant, index-support change is often the first safe option.

3. Join-heavy path
- validate whether joins are required for the endpoint contract.
- prefer narrowing scope or batching before broad rewrites.

4. Anti-join/filter-heavy count path
- treat count as its own problem.
- do not automatically rewrite main list query just to fix one count variant.

5. Planner not picking new index
- do not overclaim.
- keep/revert based on repeated-run perf evidence + complexity tradeoff.

---

## 6. Writing EXPLAIN Findings In Canonical Docs

Required style:
1. Separate facts from inference.
2. Report exact observed nodes (for example `Index Scan + Sort`, `Seq Scan + Hash Join`).
3. Tie findings to measured runs, not assumptions.
4. Use cautious language under high variance:
   - "directional improvement"
   - "mixed signal"
   - "not conclusive"
5. Explicitly state retain/revert/defer decision.

Avoid:
1. claiming causality from EXPLAIN alone,
2. claiming a win from one run,
3. recommending broad rewrites without dominant-cost evidence.

---

## 7. Lightweight Template For Future Sprints

Copy this section into sprint reports:

```md
## SQL EXPLAIN Capture

### Context
- Path/domain:
- Owning files:
- Scenario command:
- Seed/state assumptions:

### Query variant(s)
1) Variant name:
- Filters:
- Sort/order:
- Pagination:
- Row-count context:

### EXPLAIN findings (before)
- Node summary:
- Index used:
- Sort/join/scan notes:

### Change applied
- Narrow change:
- Files/migration:

### EXPLAIN findings (after)
- Node summary:
- Index used:
- Sort/join/scan notes:

### Perf comparison (repeated runs)
- Run count:
- Before mean p50/p95/avg:
- After mean p50/p95/avg:
- Spread before/after:

### Decision
- Retained/Reverted/Deferred:
- Confidence level:
- Next step:
```

---

## 8. Canonical Output Locations

Place EXPLAIN-heavy sprint artifacts under `docs/canonical/` and link from `docs/canonical/INDEX.md`.

Typical targets:
- `INVENTORY_*_REPORT.md`
- `PERFORMANCE_RUN_REVIEW.md`
- domain-specific optimization report for the sprint.
