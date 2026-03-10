# Optimization Plan

This plan turns the current code-truth audit into a phased optimization backlog.

Use with:
- [OPTIMIZATION_AUDIT.md](./OPTIMIZATION_AUDIT.md)
- [OPTIMIZATION_MATRIX.md](./OPTIMIZATION_MATRIX.md)
- [OPTIMIZATION_QUICK_WINS.md](./OPTIMIZATION_QUICK_WINS.md)

## Phase 0: Confirm / Measure

Targets:
- dealer session/tenant/permission request cost
- dashboard v3 cache-miss latency
- report endpoint latency and query count
- inventory page list/enrichment breakdown
- platform monitoring/dealer-bridge latency
- client bundle size for the largest dealer and platform pages

Risk:
- Low

Expected benefit:
- prevents mis-targeted refactors
- identifies the true dominant costs before deeper work

Validation approach:
- add timing/log sampling around:
  - `apps/dealer/lib/api/handler.ts`
  - `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`
  - `apps/dealer/modules/inventory/service/inventory-page.ts`
  - `apps/dealer/modules/reports/service/*`
  - `apps/platform/lib/call-dealer-internal.ts`
- capture representative local/staging numbers for:
  - cold cache
  - warm cache
  - list page with filters
  - report page with normal date range

Success criteria:
- a short measurement note exists for each target area
- the next phase is ordered by observed cost, not instinct

## Phase 1: Quick Wins

Targets:
- queue singleton reuse in dealer enqueue helpers
- request-scoped caching for dealer auth/tenant/permission resolution
- worker success-log reduction
- reduce redundant local Prisma generation on test runs
- split or lazy-load chart-heavy report UI

Risk:
- Low

Expected benefit:
- immediate latency and developer-speed gains with minimal behavior change

Validation approach:
- focused unit/integration tests for auth/session behavior and enqueue semantics
- rebuild dealer/platform/worker
- compare log volume and local test runtime before/after

Success criteria:
- no behavior change in auth, queue retry, or API responses
- measurable reduction in repeated DB queries, log lines, or local command time

## Phase 2: DB / Query Optimization

Targets:
- dashboard trend aggregation
- report query fan-out reduction
- high-value inventory enrichment queries
- only measured search/index work

Risk:
- Medium

Expected benefit:
- lower DB load
- faster dashboard/report endpoints
- better scalability under real tenant data

Validation approach:
- compare query counts and endpoint latency before/after
- keep response shape identical
- add targeted tests for date grouping, report totals, and pagination correctness

Success criteria:
- dashboard/report endpoints return the same business results with fewer queries or less row materialization
- no cross-tenant leakage or date-bucketing regressions

## Phase 3: Rendering / API Optimization

Targets:
- split large client pages into smaller client islands
- reduce unnecessary parallel widget fetches on dealer reports page
- review platform detail pages for server-shell/client-island conversion
- reduce redundant API hops where a page can load server-side data directly

Risk:
- Medium

Expected benefit:
- smaller initial bundles
- better TTI and less client memory use
- fewer client-side waterfalls

Validation approach:
- build-time bundle comparison
- route-level smoke tests for the touched pages
- confirm permissions and session-driven behavior still match current UX

Success criteria:
- largest client pages materially shrink or defer expensive sections
- no regression in interactivity or RBAC-driven rendering

## Phase 4: Worker / Job Optimization

Targets:
- reduce worker internal HTTP overhead where batching is safe
- simplify noisy per-job logging
- review internal endpoint payload sizes and remove unnecessary fields
- evaluate later simplification of preserved CRM job-worker internals after rollout proof

Risk:
- Medium to High

Expected benefit:
- higher throughput
- lower latency per job
- lower log ingestion cost

Validation approach:
- worker tests plus focused async integration tests
- compare per-job latency and log volume
- preserve Postgres durable-state semantics and BullMQ retry behavior

Success criteria:
- worker execution remains correct and tenant-safe
- per-job overhead is reduced without weakening auditability or error visibility

## Phase 5: Build / Test / Tooling Optimization

Targets:
- faster dealer local test loop
- better separation of unit vs integration vs heavy platform RBAC suites
- lighter CI-oriented command graph
- cleanup of stale docs/tooling artifacts that increase repo noise

Risk:
- Low to Medium

Expected benefit:
- better developer productivity
- cheaper CI once introduced or expanded
- easier agent and human navigation

Validation approach:
- compare local command timings
- confirm test selection still covers intended suites
- confirm no canonical docs or active scripts still depend on removed artifacts

Success criteria:
- faster default developer test loop
- clearer testing entrypoints
- reduced non-canonical repo noise

## Recommended Order

1. Phase 0
2. Phase 1
3. Phase 2 for dashboard/reports first
4. Phase 3 for large bundle pages after measurement
5. Phase 4 once async rollout remains stable
6. Phase 5 in parallel where safe

## First Implementation Slice

Best first slice:
1. request-scoped auth/tenant/permission caching
2. queue singleton reuse
3. worker log reduction
4. dealer test-loop cleanup
5. dashboard trend aggregation rewrite

Why this first:
- it matches the current architecture
- it is mostly low-risk
- it improves runtime and developer efficiency together
- it does not require product redesign
