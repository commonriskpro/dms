# Optimization Phase 2 Report

This report captures the Phase 2 optimization measurement + targeted implementation sprint completed on March 10, 2026.

Inputs:
- `docs/canonical/OPTIMIZATION_AUDIT.md`
- `docs/canonical/OPTIMIZATION_PLAN.md`
- `docs/canonical/OPTIMIZATION_MATRIX.md`
- `docs/canonical/OPTIMIZATION_QUICK_WINS.md`
- `docs/canonical/OPTIMIZATION_PHASE1_REPORT.md`

## 1. Scope Executed

Phase 2 focus requested:
1. measure + optimize report fan-out / in-memory joins where evidence is strongest
2. measure inventory list/enrichment cost before architecture changes
3. implement safe chart-heavy lazy-loading
4. measure worker/platform internal HTTP bridge overhead before redesign

## 2. Before/After Findings

## 2.1 Reports fan-out optimization (implemented)

### A) Finance penetration DB fan-out

Before:
- `listFinanceForContractedDealsInRange(...)` in `apps/dealer/modules/reports/db/finance.ts` executed:
  - query 1: `Deal.findMany` (IDs for contracted deals in range)
  - query 2: `DealFinance.findMany` with `dealId IN (...)`

After:
- same function now executes a single `DealFinance.findMany` with nested `deal` relation filters:
  - `deal.status = CONTRACTED`
  - `deal.deletedAt = null`
  - `deal.createdAt` in range
  - dealership scoping preserved

Net:
- query count reduced from 2 to 1 for this path
- removed intermediate in-memory `dealIds` array construction

### B) Sales trend first-contracted dedupe

Before:
- `contractedCountByPeriod(...)` in `apps/dealer/modules/reports/db/sales.ts` fetched all matching `DealHistory` rows, then deduped first-per-deal in memory.

After:
- same function now queries with `distinct: ["dealId"]` + `orderBy createdAt asc`, then aggregates periods from already deduped rows.

Net:
- reduced row materialization and in-memory dedupe work in high-history ranges
- behavior intent preserved (first CONTRACTED transition per deal)

## 2.2 Inventory overview measurement (implemented, no risky refactor)

Before:
- no built-in stage timing for inventory page overview loading.

After:
- `apps/dealer/modules/inventory/service/inventory-page.ts` emits optional profiling logs when:
  - `INVENTORY_OVERVIEW_PROFILE=1`
- logged segments:
  - `coreQueriesMs`
  - `enrichmentMs`
  - `totalMs`
  - list row counts and page sizing context

Net:
- can now gather evidence on where inventory overview time is spent before changing architecture.

## 2.3 Chart-heavy UI lazy-loading (implemented)

Before:
- `apps/dealer/modules/reports/ui/ReportsPage.tsx` statically imported `recharts` and rendered chart components inline.

After:
- chart row moved to `apps/dealer/modules/reports/ui/components/ReportsChartsRow.tsx`.
- `ReportsPage.tsx` now loads chart row via `next/dynamic` (`ssr: false`) with skeleton fallback.
- `recharts` import removed from top-level reports page module.

Net:
- reduced immediate chart-library pressure in initial reports page module path
- loading UX preserved via skeleton fallback

## 2.4 Worker/platform bridge measurement hooks (implemented, no redesign)

### Worker -> dealer internal bridge

File:
- `apps/worker/src/dealerInternalApi.ts`

Added:
- optional profiling via `WORKER_INTERNAL_API_PROFILE=1`
- per-call logs include:
  - path
  - status
  - durationMs
  - requestBytes

### Platform -> dealer internal bridge

File:
- `apps/platform/lib/call-dealer-internal.ts`

Added:
- shared `fetchDealerInternal(...)` wrapper
- optional profiling via `PLATFORM_DEALER_BRIDGE_PROFILE=1`
- per-call logs include:
  - method
  - path
  - status
  - durationMs
  - requestBytes
  - requestId (when present)

Net:
- bridge overhead is now measurable in live/staging traffic without changing bridge architecture.

## 3. Files Changed

Report/query optimization:
- `apps/dealer/modules/reports/db/finance.ts`
- `apps/dealer/modules/reports/db/sales.ts`
- `apps/dealer/modules/reports/service/finance-penetration.ts`
- `apps/dealer/modules/reports/service/sales-summary.ts`
- `apps/dealer/modules/reports/service/sales-by-user.ts`
- `apps/dealer/modules/reports/db/finance.test.ts` (new)

Inventory measurement:
- `apps/dealer/modules/inventory/service/inventory-page.ts`

Chart lazy-loading:
- `apps/dealer/modules/reports/ui/ReportsPage.tsx`
- `apps/dealer/modules/reports/ui/components/ReportsChartsRow.tsx` (new)

Bridge measurement:
- `apps/worker/src/dealerInternalApi.ts`
- `apps/platform/lib/call-dealer-internal.ts`

Docs:
- `docs/canonical/OPTIMIZATION_PHASE2_REPORT.md` (new)

## 4. Validation Performed

Dealer tests:
- `npm -w dealer run test -- --runTestsByPath modules/reports/db/finance.test.ts modules/reports/tests/unit/reports-page-permission.test.ts modules/reports/tests/integration/reports.test.ts`
- `npm -w dealer run test -- --runTestsByPath modules/inventory/tests/inventory-page.test.ts`

Worker tests:
- `npm -w @dms/worker run test -- --runTestsByPath src/workers/worker-handlers.test.ts`

Builds:
- `npm run build:dealer` (pass; existing Supabase realtime webpack warnings still present)
- `npm run build:platform` (pass)

## 5. Deferred Intentionally

Not done in this sprint:
- broad report service redesign beyond the highest-confidence query fan-out reductions
- inventory architecture changes before collecting profiling data
- worker/platform bridge redesign (kept as measurement-only)
- deeper DB/index tuning without measured hot-path evidence

## 6. Recommended Next Step

Collect staging or production-like profiling samples with:
- `REPORTS_PERF_PROFILE=1`
- `INVENTORY_OVERVIEW_PROFILE=1`
- `WORKER_INTERNAL_API_PROFILE=1`
- `PLATFORM_DEALER_BRIDGE_PROFILE=1`

Then prioritize Phase 3/4 changes by observed latency concentration rather than static code shape alone.
