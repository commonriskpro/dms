# Performance Finalization Spec

**Date:** 2026-03-08  
**Context:** Post–performance audit; build, lint, tests pass. No API/RBAC/tenant changes.

---

## 1. Database indexes to add

Query patterns and indexes below. Only indexes not already present in the schema are added.

| Table | Index | Query pattern | Status in schema |
|-------|--------|----------------|------------------|
| deal_fees | `(dealership_id, deal_id)` | `dealFee.findMany({ where: { dealershipId, dealId } })` in deal-desk.ts | **Already exists** |
| deal_trades | `(dealership_id, deal_id)` | `dealTrade.findFirst({ where: { dealershipId, dealId } })` in deal-desk.ts | **Already exists** |
| deal_finance_products | `(deal_finance_id, dealership_id)` | `dealFinanceProduct.findMany({ where: { dealFinanceId, dealershipId, deletedAt: null } })` in deal-desk.ts | Add `@@index([dealFinanceId, dealershipId])` (schema has `[dealershipId, dealFinanceId]` only) |
| finance_submissions | `(dealership_id, funding_status, status)` | `financeSubmission.count({ where: { dealershipId, fundingStatus: "PENDING", status: { in: [...] } } })` in dashboard v3 | Add `@@index([dealershipId, fundingStatus, status])` |
| finance_stipulations | `(dealership_id, status)` | `financeStipulation.count({ where: { dealershipId, status: "REQUESTED" } })` | **Already exists** |
| memberships | `(user_id, dealership_id)` | `membership.findFirst({ where: { userId, dealershipId, disabledAt: null } })` in lib/tenant.ts (every request) | Add `@@index([userId, dealershipId])` |

**Implementation:** Update `apps/dealer/prisma/schema.prisma` with the three new indexes (DealFinanceProduct, FinanceSubmission, Membership). DealFee, DealTrade, and FinanceStipulation already have the recommended indexes. Run `npx prisma migrate dev --name performance_indexes`.

---

## 2. React performance improvements

### 2.1 Memoization targets

- **CrmBoardPage** — Already memoized in prior pass: `pipelineOptions`, `stageOptions`, `oppsByStage`, `customerOptions`, `handleOpenOpportunity`. No change.
- **ReportsPage** — Memoize derived data in widget components:
  - Mix card: `pieData` from `state.data.byMode` → `useMemo(() => byMode.map(...), [byMode])`.
  - Sales-by-user table: `rows` from `state.data` → `useMemo(() => data.map(...), [data, meta])`.
- **CustomersListPage** — Already has `handleSort` (useCallback) and columns (useMemo with handleSort). No change.

### 2.2 Large components — split into tab components

- **Customer DetailPage** (`modules/customers/ui/DetailPage.tsx`, ~1486 lines)  
  Extract tab content into:
  - `CustomerOverviewTab.tsx`
  - `CustomerActivityTab.tsx`
  - `CustomerDealsTab.tsx`
  - `CustomerVehiclesTab.tsx`
  - `CustomerNotesTab.tsx`
  - `CustomerFilesTab.tsx`  
  DetailPage keeps state and tab routing; each tab receives props and renders existing UI.

- **Deal DetailPage** (`modules/deals/ui/DetailPage.tsx`, ~1114 lines)  
  Extract tab content into:
  - `DealOverviewTab.tsx`
  - `DealFinanceTab.tsx` (deal-level finance tab; distinct from finance-shell’s DealFinanceTab)
  - `DealProductsTab.tsx`
  - `DealDeliveryTab.tsx`
  - `DealTitleTab.tsx`  
  Same pattern: DetailPage keeps state/routing; tabs receive props and preserve behavior.

---

## 3. Table virtualization targets

Use `@tanstack/react-virtual` for:

- **Inventory list** — e.g. `VehicleInventoryTable` / list in `InventoryPageContentV2` (or equivalent list page).
- **Customers list** — `CustomersListPage` table body (rows from `table.getRowModel().rows`).
- **Deals list** — `DealsTableCard` / deals list table body.
- **CRM board** — `StageColumn` opportunity list (optional; often smaller).

**Pattern:** Wrap the scroll container; use `useVirtualizer({ count: rows.length, getScrollElement, estimateSize })`; render only visible rows. Preserve server-side pagination (virtualize current page only), keyboard navigation, and existing styling.

---

## 4. Backend concurrency improvement

**File:** `apps/dealer/app/api/crm/jobs/run/route.ts`  
**Current:** GET handler runs `for (const d of dealerships) { await jobWorker.runJobWorker(d.id); }`.  
**Target:** Controlled parallel execution with concurrency limit (e.g. 3) via `p-limit`.

**Requirements:**

- One job run per dealership; no cross-dealership data.
- Preserve audit/logging behavior.
- Add dependency: `p-limit` (e.g. `npm install p-limit` in apps/dealer or monorepo root).

**Example:**

```ts
const limit = pLimit(3);
const results = await Promise.all(
  dealerships.map((d) => limit(() => jobWorker.runJobWorker(d.id).then((r) => ({ dealershipId: d.id, ...r }))))
);
```

---

## 5. Validation (Security & QA)

- Tenant isolation: no dealershipId from client; all queries scoped by auth.
- RBAC: guardPermission / requirePlatformAdmin unchanged.
- API response shapes unchanged.
- Commands: `npm run build:dealer`, `npm run lint:dealer`, `npm run test:dealer`, `npm run test:platform` — all must pass.

---

## 6. Success criteria

- All builds and tests pass; lint clean.
- No behavior regressions; no API contract changes.
- Indexes added and migration applied.
- CRM cron GET uses concurrency-limited parallel run.
- ReportsPage memoization applied; large detail pages split into tab components; virtualization applied to list tables where specified.
- Final report: `docs/PERFORMANCE_FINALIZATION_REPORT.md` with indexes, React changes, virtualization, concurrency, and validation results.
