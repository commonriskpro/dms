# Optimization Audit

This document is the code-truth optimization audit for the repository as inspected on March 9, 2026.

Source-of-truth order:
1. current code under `apps/*`, `packages/*`, `scripts/*`, and Prisma schemas
2. current canonical docs under `docs/canonical/*`
3. legacy docs only as reference when consistent with current code

## 1. Executive Summary

The highest-value optimization work is not a broad rewrite.
It is concentrated in a few repeatable patterns:
- repeated auth, tenant, and permission resolution on dealer requests
- heavy report and dashboard aggregation done with multiple Prisma queries plus in-memory joins
- worker and platform internal HTTP bridges that add latency, serialization, and logging overhead
- repeated BullMQ queue construction in producers
- very large client components that pull heavy chart/table libraries into dealer and platform bundles
- test/build friction from repeated Prisma generation and monolithic Jest runs

Most important practical conclusion:
- the repo now has a coherent architecture, but several hot paths still pay avoidable overhead at request time
- the best first optimizations are low-risk request-scope caching, queue reuse, logging reduction, and targeted query reshaping
- several DB/search optimizations should be measured before changing indexes or query strategy, especially anything involving `contains`/ILIKE-style search

## 2. Highest-Value Optimization Opportunities

### 2.1 Dealer session, tenancy, and RBAC resolution

Status:
- `Medium effort / high value`

Evidence:
- `apps/dealer/lib/api/handler.ts`
- `apps/dealer/lib/tenant.ts`
- `apps/dealer/lib/rbac.ts`
- many server pages call `getSessionContextOrNull()` directly, including:
  - `apps/dealer/app/(app)/dashboard/page.tsx`
  - `apps/dealer/app/(app)/customers/page.tsx`
  - `apps/dealer/app/(app)/inventory/page.tsx`
  - `apps/dealer/app/(app)/customers/[id]/page.tsx`

Observed inefficiency:
- `getSessionContextOrNull()` performs multiple sequential lookups:
  - Supabase user lookup
  - dealer profile lookup or creation
  - dealership resolution via cookie / stored active dealership / membership checks
  - permission loading via `loadUserPermissions()`
  - optional pending-approval lookup
- `loadUserPermissions()` builds the effective permission set with three DB queries plus deep includes.
- `getSessionDealershipInfo()` and `getActiveDealershipId()` repeat membership and dealership validation work.

Impact:
- runtime speed
- DB load
- server/API efficiency

Recommendation:
- introduce request-scoped memoization for current-user, dealership, and effective permission resolution
- collapse redundant membership/dealership checks where the same request already resolved them
- consider a cheaper "session summary" query path for page loads that only need `activeDealershipId`, `emailVerified`, and a permission set hash

### 2.2 Worker and platform internal HTTP bridge overhead

Status:
- `Medium effort / high value`

Evidence:
- worker bridge: `apps/worker/src/dealerInternalApi.ts`
- worker consumers: `apps/worker/src/workers/*.worker.ts`
- platform bridge: `apps/platform/lib/call-dealer-internal.ts`

Observed inefficiency:
- every worker job does:
  - JWT signing
  - JSON serialization
  - HTTP round trip back into dealer
  - JSON parsing
- platform control-plane calls to dealer internal endpoints repeat the same bridge pattern for monitoring, invites, provisioning, and maintenance.

Why this matters:
- the bridge is architecturally valid, but it is not free
- it adds latency, allocates extra objects, duplicates error handling, and increases noisy request logs

Impact:
- runtime speed
- worker throughput
- deployment/runtime cost
- reliability

Recommendation:
- keep the bridge as the canonical cross-app boundary, but reduce per-call cost:
  - batch where feasible for monitoring/stat endpoints
  - reuse token/HTTP helpers more aggressively
  - consider direct shared-service execution only inside a single deployment boundary if that boundary is explicitly guaranteed
- measure the worst monitoring endpoints before changing the platform bridge shape

### 2.3 BullMQ producer queue-instance churn

Status:
- `Quick win`

Evidence:
- `apps/dealer/lib/infrastructure/jobs/enqueueAnalytics.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueBulkImport.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts`
- `apps/dealer/lib/infrastructure/jobs/enqueueCrmExecution.ts`

Observed inefficiency:
- each enqueue path dynamically imports BullMQ and constructs a new `Queue` instance on every call
- repeated connection/object setup is avoidable in hot producer paths

Impact:
- runtime speed
- worker throughput
- deployment/runtime cost

Recommendation:
- centralize queue instance creation behind a shared lazy singleton per queue
- keep current retry/backoff semantics unchanged

### 2.4 Dashboard V3 trend aggregation in JavaScript

Status:
- `Quick win to medium effort`

Evidence:
- `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`

Observed inefficiency:
- 7-day trends fetch all matching `createdAt` rows for vehicles, opportunities, deals, and contracted deals
- counts are then aggregated in JS via `buildTrendArray(...)`

Why this matters:
- this is a repeatable dashboard path
- the DB already has indexes on `createdAt` for major models, but the current approach still materializes every row instead of returning grouped counts

Impact:
- runtime speed
- DB load
- server/API efficiency

Recommendation:
- replace row fetching with grouped day counts via `groupBy`, raw SQL date bucketing, or pre-aggregated daily stats
- keep the current cache layer, but reduce cache-miss cost first

### 2.5 Dealer reports fan-out and in-memory joins

Status:
- `Medium effort / high value`

Evidence:
- `apps/dealer/modules/reports/db/sales.ts`
- `apps/dealer/modules/reports/db/finance.ts`
- `apps/dealer/modules/reports/db/inventory.ts`
- `apps/dealer/modules/reports/ui/ReportsPage.tsx`

Observed inefficiency:
- sales reporting loads deals, deal history, customers, vehicles, and profiles separately, then joins in memory
- finance penetration does a deal ID fetch, then a second finance fetch by `dealId IN (...)`
- inventory aging/export loads broad vehicle sets and computes derived metrics in JS
- the reports page fires six API requests in parallel every time the date range changes

Impact:
- runtime speed
- DB load
- serialization/data-shape efficiency
- client rendering efficiency

Recommendation:
- optimize in two layers:
  1. DB/service layer: reduce fan-out and duplicate reads, especially for export and trend endpoints
  2. UI layer: avoid re-fetching every report widget for every small date change if only one widget depends on the changed state

### 2.6 Inventory list enrichment cost on page loads

Status:
- `Needs measurement first`

Evidence:
- `apps/dealer/modules/inventory/service/inventory-page.ts`
- `apps/dealer/modules/inventory/service/inventory-intelligence-dashboard.ts`
- `apps/dealer/modules/inventory/db/vehicle.ts`

Observed inefficiency:
- inventory overview performs a paginated list query, plus KPI queries, plus alert queries, plus pipeline queries, plus separate cost-ledger totals, plus price-to-market enrichment
- some of this work is cached, some is not, and list enrichment remains row-oriented

Why it needs measurement:
- some of this is justified product value
- changing it blindly risks reducing page quality more than it improves latency

Impact:
- runtime speed
- DB load
- server/API efficiency

Recommendation:
- measure the expensive parts independently:
  - list query time
  - cost total lookup time
  - price-to-market enrichment time
  - non-list aggregate time
- optimize only the dominant contributor

### 2.7 Large client bundles in dealer and platform UI

Status:
- `Medium effort / high value`

Evidence:
- large client files:
  - `apps/dealer/modules/reports/ui/ReportsPage.tsx`
  - `apps/dealer/modules/customers/ui/DetailPage.tsx`
  - `apps/dealer/modules/lender-integration/ui/DealLendersTab.tsx`
  - `apps/dealer/modules/finance-shell/ui/DealFinanceTab.tsx`
  - `apps/platform/app/(platform)/platform/dealerships/[id]/page.tsx`
  - `apps/platform/app/(platform)/platform/users/page.tsx`
- heavy client imports:
  - `recharts` in `apps/dealer/modules/reports/ui/ReportsPage.tsx`
  - `@tanstack/react-table` in customer list UI

Observed inefficiency:
- several major pages are monolithic `use client` components with charts, dialogs, forms, tables, and mutation logic in one file
- chart libraries are statically imported rather than clearly isolated behind smaller client islands or dynamic imports

Impact:
- bundle size
- React/Next rendering efficiency
- client CPU/memory

Recommendation:
- split the heaviest pages into server-shell plus client islands
- lazy-load chart-heavy sections and secondary dialogs
- defer non-critical widgets behind tabs or visibility triggers

### 2.8 Logging noise in worker and hot async paths

Status:
- `Quick win`

Evidence:
- `apps/worker/src/index.ts`
- `apps/worker/src/workers/*.worker.ts`
- `apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`
- `apps/platform/lib/call-dealer-internal.ts`

Observed inefficiency:
- each worker job logs start, done, and completion lines
- failures log full error messages per attempt
- platform and dealer also emit request and debug logs around internal bridges

Impact:
- deployment/runtime cost
- observability signal-to-noise
- log ingestion volume

Recommendation:
- keep failures and summary logs
- sample or remove success-path per-job completion logs in hot queues
- standardize on structured logging with level controls rather than raw `console.log`

### 2.9 Build and test friction

Status:
- `Quick win to medium effort`

Evidence:
- `apps/dealer/package.json`
- `apps/platform/package.json`
- `apps/dealer/jest.config.js`
- `apps/platform/jest.config.js`
- `apps/platform/jest.heavy.config.js`

Observed inefficiency:
- dealer `pretest` always runs `prisma generate`
- dealer `test:all` serializes lint, build, unit, and integration work in one command
- platform maintains a split between normal and heavy Jest configs rather than a more deliberate project/test-tag model
- `next/jest` startup cost is paid across very large test surfaces

Impact:
- test/runtime speed
- developer productivity
- CI cost

Recommendation:
- stop regenerating Prisma client on every local test invocation when schema has not changed
- separate truly DB/integration-heavy suites from fast unit suites more aggressively
- introduce CI-oriented sharding or tagged projects instead of a single monolithic Jest invocation

### 2.10 Serialization and contract duplication

Status:
- `Medium effort / medium value`

Evidence:
- dealer serializers:
  - `apps/dealer/app/api/deals/serialize.ts`
  - `apps/dealer/modules/lender-integration/serialize.ts`
- mobile endpoint typing:
  - `apps/mobile/src/api/endpoints.ts`
- shared contracts package:
  - `packages/contracts`

Observed inefficiency:
- multiple large manual serializer layers exist for dealer API responses
- mobile keeps a very large local endpoint type catalog instead of leaning more heavily on shared contracts
- this increases maintenance cost and makes payload minimization harder

Impact:
- developer productivity
- serialization consistency
- payload-shape drift risk

Recommendation:
- do not rewrite all serializers at once
- instead, target the noisiest domains first: deals, lender submissions, and mobile API DTO reuse

## 3. Quick Wins

1. Reuse BullMQ `Queue` instances in dealer enqueue helpers instead of constructing them per call.
2. Add request-scoped caching for dealer session, dealership, and permission resolution.
3. Reduce worker success-path logging volume while preserving failure and summary logs.
4. Remove unconditional `prisma generate` from routine local dealer test runs when schema is unchanged.
5. Lazy-load or split chart-heavy report UI sections so `recharts` does not land in the initial reports bundle by default.

## 4. Runtime Hotspots By App / Domain

### Dealer app

Likely hotspots:
- `apps/dealer/lib/api/handler.ts`
- `apps/dealer/lib/tenant.ts`
- `apps/dealer/lib/rbac.ts`
- `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`
- `apps/dealer/modules/inventory/service/inventory-page.ts`
- `apps/dealer/modules/reports/db/*.ts`

Pattern:
- repeated session/tenant/permission work plus broad aggregate queries

### Platform app

Likely hotspots:
- `apps/platform/lib/platform-auth.ts`
- `apps/platform/lib/call-dealer-internal.ts`
- `apps/platform/app/(platform)/platform/dealerships/[id]/page.tsx`
- monitoring/report routes under `apps/platform/app/api/platform/monitoring/*`

Pattern:
- control-plane pages do real work, but still run as large client pages and pay signed dealer bridge overhead

### Mobile app

Likely hotspots:
- `apps/mobile/src/auth/auth-service.ts`
- `apps/mobile/src/api/endpoints.ts`

Pattern:
- more of a code-health and request-efficiency concern than raw runtime hotspot
- repeated `supabase.auth.getUser(accessToken)` calls can be reduced with in-memory session caching

### Worker

Likely hotspots:
- `apps/worker/src/dealerInternalApi.ts`
- `apps/worker/src/workers/*.worker.ts`

Pattern:
- every queue consumer incurs HTTP hop + JSON overhead back into dealer
- concurrency is modest today, but this pattern becomes more expensive as queue volume grows

## 5. Database / Query Efficiency Findings

### Clearly actionable

- Dashboard V3 trend queries fetch rows and aggregate in JS instead of grouped DB counts.
  - `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`
- Report services use multiple fan-out queries and in-memory joins.
  - `apps/dealer/modules/reports/db/sales.ts`
  - `apps/dealer/modules/reports/db/finance.ts`
  - `apps/dealer/modules/reports/db/inventory.ts`
- Dealer auth/session paths repeat dealership and membership lookups.
  - `apps/dealer/lib/tenant.ts`
  - `apps/dealer/lib/api/handler.ts`
  - `apps/dealer/lib/rbac.ts`

### Needs measurement before touching

- Customer search uses `contains` across `name`, phone values, and email values.
  - `apps/dealer/modules/customers/db/customers.ts`
- Vehicle search uses `contains` on `vin`, `make`, `model`, and `stockNumber`.
  - `apps/dealer/modules/inventory/db/vehicle.ts`

Reason to measure first:
- B-tree indexes already exist for some exact/prefix-style fields, but `contains`/ILIKE behavior may still full-scan depending on data size and query shape
- if search becomes a real hotspot, the right answer is likely trigram/GIN support or a proper search service, not ad hoc SQL tweaks

## 6. Worker / Runtime Inefficiency Findings

- Worker consumers call dealer internal HTTP endpoints for all business work.
  - `apps/worker/src/dealerInternalApi.ts`
- Per-job log volume is high on the success path.
  - `apps/worker/src/workers/*.worker.ts`
- CRM execution still preserves the Postgres claim/retry loop inside dealer.
  - `apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`

Important distinction:
- the CRM preserved loop is not an architectural bug now
- it is a valid candidate for later simplification once rollout and correctness are fully proven

## 7. Build / Test / Developer Efficiency Findings

- Dealer local tests always run `prisma generate` first.
  - `apps/dealer/package.json`
- Dealer `test:all` is a large serialized workflow.
  - `apps/dealer/package.json`
- Platform keeps separate normal and heavy Jest configs.
  - `apps/platform/jest.config.js`
  - `apps/platform/jest.heavy.config.js`
- Repo still contains a large amount of legacy reference docs that increase navigation noise.
  - `apps/dealer/docs/*`
  - `apps/platform/docs/*`
  - top-level legacy docs outside `docs/canonical/`

## 8. Dead / Redundant Code Findings

These are optimization-relevant cleanup candidates, not proven runtime bottlenecks:
- `agent_spec.md` is obsolete as a rule source.
- `dms-package.json` is a stale artifact.
- `scripts/vitest-to-jest.js` appears to be historical tooling.
- large legacy doc trees still exist under:
  - `apps/dealer/docs/*`
  - `apps/platform/docs/*`

Rationale:
- these do not hurt request latency directly
- they do hurt repo navigation, AI-agent accuracy, and maintenance efficiency

## 9. Things That Need Measurement Before Touching

1. Search-query index strategy for customer and vehicle contains-search.
2. Whether inventory-page latency is dominated by base list query, cost totals, or price-to-market enrichment.
3. Whether platform monitoring endpoints are materially slow because of dealer bridge cost or because of underlying dealer query cost.
4. Whether chart-heavy dealer pages are actually among the largest client bundles after current Next.js tree-shaking.
5. Whether mobile auth refresh overhead is meaningful in real usage versus acceptable background cost.

## 10. Things Not Worth Optimizing Yet

1. Worker concurrency settings by themselves.
   Reason: queue volumes are not proven here; correctness and observability matter more right now.
2. Rewriting all manual serializers into a generic framework.
   Reason: too risky and too broad for uncertain payoff.
3. Replacing the dealer/platform signed bridge wholesale.
   Reason: it is an intentional boundary; optimize the expensive calls first.
4. Chasing micro-optimizations in small UI primitives.
   Reason: the bigger cost is large page composition, not tiny leaf components.
5. Deep mobile refactors solely for bundle/runtime speed.
   Reason: mobile’s main gap is feature depth and test breadth, not a demonstrated performance wall.
