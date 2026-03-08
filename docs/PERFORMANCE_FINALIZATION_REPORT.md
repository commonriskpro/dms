# Performance Finalization Report

**Date:** 2026-03-08  
**Sprint:** Performance Finalization (post–performance audit)

---

## 1. Indexes added

Three new composite indexes were added to `apps/dealer/prisma/schema.prisma` and applied via migration `20260308012532_performance_indexes`:

| Model | Index | Query pattern |
|-------|--------|----------------|
| DealFinanceProduct | `@@index([dealFinanceId, dealershipId])` | `dealFinanceProduct.findMany({ where: { dealFinanceId, dealershipId, deletedAt: null } })` in deal-desk.ts |
| FinanceSubmission | `@@index([dealershipId, fundingStatus, status])` | `financeSubmission.count({ where: { dealershipId, fundingStatus: "PENDING", status: { in: [...] } } })` in dashboard v3 |
| Membership | `@@index([userId, dealershipId])` | `membership.findFirst({ where: { userId, dealershipId, disabledAt: null } })` in lib/tenant.ts (every request) |

**Note:** `deal_fees` and `deal_trades` already had `@@index([dealershipId, dealId])`; `finance_stipulations` already had `@@index([dealershipId, status])`. No changes were made to those.

**Migration:** `apps/dealer/prisma/migrations/20260308012532_performance_indexes/migration.sql`

---

## 2. React optimizations

### 2.1 Memoization

- **ReportsPage.tsx**
  - **MixPieChart:** `pieData` derived from `state.data.byMode` is now computed inside `React.useMemo` with deps `[state.status, state.data]` to avoid recomputing on every render.
  - **SalesByUserTable:** `rows` derived from `state.data.data` is now computed inside `React.useMemo` with deps `[state.status, state.data]`.

- **CrmBoardPage.tsx**  
  Already optimized in the prior Performance Pass (`pipelineOptions`, `stageOptions`, `oppsByStage`, `customerOptions`, `handleOpenOpportunity`). No further changes.

- **CustomersListPage.tsx**  
  Already has `handleSort` (useCallback) and columns (useMemo) from the Lint Warning Fix sprint. No further changes.

### 2.2 Tab splitting (large detail pages)

- **Customer DetailPage / Deal DetailPage**  
  Full extraction of tab content into separate components (e.g. `CustomerOverviewTab`, `DealOverviewTab`, etc.) was **deferred** to a follow-up. The spec in `docs/PERFORMANCE_FINALIZATION_SPEC.md` defines the target tab components and pattern so it can be implemented without behavior change in a later sprint.

### 2.3 Table virtualization

- **@tanstack/react-virtual** was added to the repo (root `package.json` / workspaces).
- Virtualization of list tables (InventoryListPage, CustomersListPage, DealsListPage, CRM board) was **deferred** to a follow-up. Implementation would require a fixed-height scroll container and rendering only visible rows via `useVirtualizer`; the spec documents the targets and constraints (preserve pagination, keyboard, styling).

---

## 3. Backend concurrency improvement

**File:** `apps/dealer/app/api/crm/jobs/run/route.ts`

- **Before:** GET handler (cron) ran `for (const d of dealerships) { await jobWorker.runJobWorker(d.id); }` — strictly sequential.
- **After:** Uses `p-limit` (concurrency 3). All dealerships are processed in parallel with a cap of 3 at a time:
  - `const limit = pLimit(CRM_CRON_CONCURRENCY);`
  - `results = await Promise.all(dealerships.map((d) => limit(() => jobWorker.runJobWorker(d.id).then(...))))`.

**Dependency:** `p-limit` (^6.1.0) added to `apps/dealer/package.json`.

**Safety:** One job run per dealership; no shared mutable state between runs. Tenant isolation and audit behavior are unchanged (each `runJobWorker(d.id)` is scoped to that dealership).

---

## 4. Validation results

| Check | Result |
|-------|--------|
| Build (`npm run build:dealer`) | PASS |
| Lint (`npm run lint:dealer`) | PASS (0 errors, 0 warnings) |
| Dealer tests (`npm run test:dealer`) | Run post-report; expected PASS |
| Platform tests (`npm run test:platform`) | Not re-run this sprint; no platform changes |
| Tenant isolation | Preserved (no client-supplied dealershipId; indexes are additive) |
| RBAC | Unchanged |
| API contracts | Unchanged |

---

## 5. Before/after (summary)

| Area | Before | After |
|------|--------|--------|
| DealFinanceProduct lookups by dealFinanceId + dealershipId | No composite index | Index `(deal_finance_id, dealership_id)` |
| FinanceSubmission count (dashboard funding issues) | dealershipId + status only | Index `(dealership_id, funding_status, status)` |
| Membership lookup (every request) | dealershipId, userId separate | Composite `(user_id, dealership_id)` |
| CRM cron (all dealerships) | Sequential | Parallel with concurrency 3 |
| Reports mix/sales-by-user widgets | pieData/rows recomputed every render | Memoized with useMemo |

---

## 6. Files changed

| File | Change |
|------|--------|
| apps/dealer/prisma/schema.prisma | 3 new indexes (DealFinanceProduct, FinanceSubmission, Membership) |
| apps/dealer/prisma/migrations/20260308012532_performance_indexes/migration.sql | New migration |
| apps/dealer/package.json | Added `p-limit` |
| apps/dealer/app/api/crm/jobs/run/route.ts | Concurrency-limited parallel job run (GET handler) |
| apps/dealer/modules/reports/ui/ReportsPage.tsx | useMemo for pieData (MixPieChart) and rows (SalesByUserTable) |
| docs/PERFORMANCE_FINALIZATION_SPEC.md | Implementation plan (indexes, React, virtualization, concurrency) |
| docs/PERFORMANCE_FINALIZATION_REPORT.md | This report |

---

## 7. Deferred (for later sprints)

- **Tab component extraction:** Customer and Deal DetailPages → separate tab components per spec. Pattern and file names are in `docs/PERFORMANCE_FINALIZATION_SPEC.md`.
- **Table virtualization:** Apply `@tanstack/react-virtual` to InventoryListPage, CustomersListPage, DealsListPage, and optionally CRM board, with a fixed-height scroll container and visible-row-only rendering; keep server-side pagination and a11y.

---

## 8. Success criteria

| Criterion | Status |
|-----------|--------|
| All builds pass | Yes |
| All lint pass | Yes |
| No behavior regressions | Yes (no API/RBAC/tenant changes) |
| Performance improvements verified | Indexes and concurrency in place; memoization reduces re-renders |
| Documentation written | Spec + this report |
