# Code Polish & Refactor Spec — Full Sprint

**Sprint:** Full Code Polish + Duplication Audit + Cleanup  
**Date:** 2026-03-07  
**Scope:** apps/dealer (and docs); safe, incremental, behavior-preserving.

---

## 1. REPO INSPECTION SUMMARY

### 1.1 Duplication hotspots

| Area | Finding | Location |
|------|--------|----------|
| **Money formatting** | Local `formatCents` duplicate (different signature: number, no decimals) | `components/dashboard-v3/FloorplanLendingCard.tsx` — should use `@/lib/money` |
| **buildQueryString** | Identical helper in two files | `app/(app)/inventory/dashboard/InventoryDashboardContent.tsx`, `modules/inventory/ui/InventoryPageContentV2.tsx` |
| **Route-level serializers** | Inline `serializeExpense` in 2 files; `serializeTransaction` in 3; `serializeDealTitle` in 3; `serializeDealFunding` in 2; `serializeChecklistItem` in 2 | `app/api/expenses/*`, `app/api/accounting/transactions/*`, `app/api/deals/[id]/title/*`, `app/api/deals/[id]/funding/*`, `app/api/deals/**/dmv-checklist/*` |
| **transportCostCents helper** | Same one-liner in two UI files | `modules/inventory/ui/DetailPage.tsx`, `modules/inventory/ui/VehicleForm.tsx` — can live in `modules/inventory/ui/types.ts` with other getters |
| **Queue pages** | Delivery / Funding / Title share same pattern (state, fetch, table, empty/error, pagination) | `modules/deals/ui/DeliveryQueuePage.tsx`, `FundingQueuePage.tsx`, `TitleQueuePage.tsx` — consolidate only if extracting a hook or shared type; no forced single component |
| **Status badge mappings** | Per-module status→variant (deal, opportunity, finance, submission, vehicle) | Already in types.ts where applicable; CustomerOverviewCard/TagsStatusCard use inline `stageBadgeClass` — consider shared mapping if same semantics |
| **Profit calculations** | Single-deal profit: `accounting-core/service/profit.ts`; report aggregates: `reporting-core` (dealer-profit, inventory-roi, salesperson-performance) | No duplication: different concerns (single deal vs reports). Leave as-is. |
| **Vehicle cost** | `totalCostCents` / `projectedGrossCents` in `inventory/service/vehicle.ts`; used by reporting-core, reports, API cost route | Single source of truth; no duplicate logic. |

### 1.2 Dead / stale code hotspots

| Category | Items | Source |
|----------|--------|--------|
| **Unused customer UI** | `modules/customers/ui/ListPage.tsx`, `modules/customers/ui/CustomersPage.tsx` | DEAD_CODE_AUDIT; app uses CustomersPageClient only |
| **Unused inventory UI** | `modules/inventory/ui/InventoryPage.tsx`, `ListPage.tsx`, `DetailPage.tsx`, `CreateVehiclePage.tsx`, `EditVehiclePage.tsx` | DEAD_CODE_AUDIT; routes use InventoryPageContentV2, VehicleDetailPage, AddVehiclePage, EditVehicleUi |
| **Unused layout shims** | `components/layout/Sidebar.tsx`, `components/layout/Topbar.tsx` | Re-exports never imported |
| **Unused UI primitives** | `app-button.tsx`, `app-card.tsx`, `app-input.tsx`, `modal-error-body.tsx` | DEAD_CODE_AUDIT; app uses shadcn/ui |
| **Unused barrel** | `lib/api/index.ts` | No imports from `@/lib/api` |
| **Tests targeting dead code** | `inventory-permissions.test.tsx` (imports old ListPage/DetailPage/etc.), `customers-ui.test.tsx` (imports CustomersListPage — that file is live; ListPage.tsx is dead) | Update tests to use live pages before removing dead files |

### 1.3 Architecture drift

| Item | Finding |
|------|--------|
| **MODULE_REGISTRY / ARCHITECTURE_MAP** | Do not list `reporting-core`, `accounting-core`, `finance-core`, `integrations`. Reports module is listed; reporting-core is used by API routes (dealer-profit, inventory-roi, salesperson-performance, accounting-export). |
| **Docs** | Many one-off sprint/step reports; some reference old implementations. No bulk doc delete; mark follow-up for stale doc cleanup in Bucket E. |

### 1.4 Exact files likely to change

- **Backend:** `FloorplanLendingCard.tsx` (use lib/money), `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts`, `app/api/accounting/transactions/route.ts`, `app/api/accounting/transactions/[id]/route.ts`, `app/api/accounting/transactions/[id]/post/route.ts`, `app/api/deals/[id]/title/route.ts`, `app/api/deals/[id]/title/status/route.ts`, `app/api/deals/[id]/title/start/route.ts`, `app/api/deals/[id]/funding/route.ts`, `app/api/deals/[id]/funding/status/route.ts`, `app/api/deals/dmv-checklist/route.ts`, `app/api/deals/dmv-checklist/[itemId]/route.ts` — only if serializers are extracted to shared modules.
- **Frontend:** `FloorplanLendingCard.tsx`, `InventoryDashboardContent.tsx`, `InventoryPageContentV2.tsx` (buildQueryString), `modules/inventory/ui/types.ts` (transportCostCents), `DetailPage.tsx`, `VehicleForm.tsx`.
- **Dead removal (after test updates):** `modules/customers/ui/ListPage.tsx`, `CustomersPage.tsx`, `modules/inventory/ui/InventoryPage.tsx`, `ListPage.tsx`, `DetailPage.tsx`, `CreateVehiclePage.tsx`, `EditVehiclePage.tsx`, `components/layout/Sidebar.tsx`, `Topbar.tsx`, `app-button.tsx`, `app-card.tsx`, `app-input.tsx`, `modal-error-body.tsx`, `lib/api/index.ts`, optionally `lib/ui/style-policy.ts` if all app-* consumers removed.

---

## 2. DUPLICATION AUDIT (DETAIL)

### 2.1 Duplicate services

- **Deal profit:** `accounting-core/service/profit.ts` (single deal) vs `reporting-core/service/dealer-profit.ts` (aggregate). Different purposes; no merge.
- **Deal totals:** `deals/service/calculations.ts` + `deal-math.ts` (wrapper); `finance-shell/service/calculations.ts` for finance totals. No duplication.

### 2.2 Duplicate serializers / DTO shaping

- **Expenses:** `serializeExpense` defined in `app/api/expenses/route.ts` and `app/api/expenses/[id]/route.ts` — identical logic; extract to `modules/accounting-core/serialize.ts` or single route helper.
- **Transactions:** `serializeTransaction` in three route files — extract to accounting-core or shared api serialization.
- **Deal title:** `serializeDealTitle` in three deal title routes — extract to `app/api/deals/serialize.ts` or deals serialization module.
- **Deal funding:** `serializeDealFunding` in two routes — same.
- **DMV checklist:** `serializeChecklistItem` in two routes — same.

### 2.3 Duplicate validation schemas

- Pagination: centralized `parsePagination`; used consistently. No duplicate query schemas for pagination.

### 2.4 Duplicate route logic

- getAuthContext → guardPermission → validate → service → jsonResponse pattern is repeated; this is intentional (rules). No consolidation of route structure.

### 2.5 Duplicate UI components

- **Empty/loading/error:** Shared `EmptyState`, `ErrorState`; loading skeletons repeated inline (acceptable).
- **Status badges:** `StatusBadge` + per-entity variant maps in types; some cards use inline `stageBadgeClass` / `STATUS_CHIP` — consolidate only where same status set.
- **Queue pages:** Three very similar queue pages; optional future: shared `useQueuePage` hook + shared table shell; not in scope for this sprint to avoid behavior risk.

### 2.6 Duplicate table/list/filter patterns

- Filter bar + table + pagination repeated; design is consistent. No forced abstraction.

### 2.7 Duplicate status badge logic

- `dealStatusToVariant` in `deals/ui/types.ts`; `opportunityStatusToVariant` in crm types; etc. Already centralized per module. Customer cards use inline mapping — defer to Bucket E.

### 2.8 Duplicate money/date helpers

- One local `formatCents` in FloorplanLendingCard (number, no decimals); everywhere else uses `@/lib/money`. Unify FloorplanLendingCard to lib/money.

### 2.9 Duplicate timeline/message/feed logic

- Not audited in depth; no change in this sprint.

### 2.10 Duplicate queue/list page patterns

- Delivery/Funding/Title queues are similar; document as follow-up (Bucket E); no structural change this sprint.

---

## 3. DEAD / STALE CODE AUDIT

- **Unused files:** See DEAD_CODE_AUDIT.md Section 1 (customer ListPage/CustomersPage; inventory old pages; layout shims; app-button/card/input/modal-error-body; lib/api/index.ts).
- **Obsolete modules:** None; reporting-core and accounting-core are used.
- **Stale tests:** inventory-permissions.test.tsx targets old inventory pages; customers-ui.test.tsx uses CustomersListPage (live file) — only ListPage.tsx and CustomersPage.tsx are dead.
- **Duplicate docs:** Many step/sprint reports; defer cleanup to Bucket E.
- **Old helpers:** style-policy.ts only used by unused app-* components; remove with those.

---

## 4. REFACTOR BUCKETS

### Bucket A — Safe low-risk cleanup

- Replace local `formatCents` in FloorplanLendingCard with `formatCents` from `@/lib/money` (adapt to string if needed).
- Extract `buildQueryString` to a single shared helper (e.g. `lib/url/buildQueryString.ts`) and use in InventoryDashboardContent and InventoryPageContentV2.
- Add `transportCostCents` (and optionally `getReconCostCents`/`getMiscCostCents` if not already) to `modules/inventory/ui/types.ts`; use in DetailPage and VehicleForm.
- Remove unused barrel `lib/api/index.ts` (no consumers).
- Remove unused layout shims: `components/layout/Sidebar.tsx`, `components/layout/Topbar.tsx`.

### Bucket B — Duplicate service consolidation

- No service merges required; profit and calculations are appropriately split.

### Bucket C — Duplicate UI consolidation

- Use shared `buildQueryString` (Bucket A).
- Unify FloorplanLendingCard money display (Bucket A).
- Optionally: extract `serializeExpense` / `serializeTransaction` to `modules/accounting-core/serialize.ts` and reuse in route handlers; extract `serializeDealTitle`, `serializeDealFunding`, `serializeChecklistItem` to `app/api/deals/serialize.ts` or adjacent. **Decision:** Do serializer extraction for accounting (expenses + transactions) and for deals (title, funding, checklist) to reduce copy-paste and keep API response shape consistent.

### Bucket D — Dead code removal

- After updating tests: remove `modules/customers/ui/ListPage.tsx`, `modules/customers/ui/CustomersPage.tsx`.
- After updating inventory-permissions.test.tsx to use live pages: remove `modules/inventory/ui/InventoryPage.tsx`, `ListPage.tsx`, `DetailPage.tsx`, `CreateVehiclePage.tsx`, `EditVehiclePage.tsx`.
- Remove `components/ui/app-button.tsx`, `app-card.tsx`, `app-input.tsx`, `modal-error-body.tsx`.
- Remove `lib/ui/style-policy.ts` if no remaining consumers.
- Do not remove event bus or instrumentation; event usage is a separate wiring task (document in Bucket E).

### Bucket E — Follow-up deferred

- Update ARCHITECTURE_MAP / MODULE_REGISTRY to include reporting-core, accounting-core, finance-core, integrations (or document why excluded).
- Stale doc cleanup (step reports, duplicate specs).
- Queue page abstraction (shared hook or component) if desired.
- Customer status badge mapping to shared token (if same semantics).
- Event bus wiring: ensure emitEvent is used where domain events are intended; document in final report.

---

## 5. EXACT FILE PLAN

| Action | File(s) | Why |
|--------|--------|-----|
| Edit | `components/dashboard-v3/FloorplanLendingCard.tsx` | Use formatCents from @/lib/money |
| Create | `lib/url/buildQueryString.ts` (or under lib) | Shared buildQueryString |
| Edit | `app/(app)/inventory/dashboard/InventoryDashboardContent.tsx` | Use shared buildQueryString |
| Edit | `modules/inventory/ui/InventoryPageContentV2.tsx` | Use shared buildQueryString |
| Edit | `modules/inventory/ui/types.ts` | Add transportCostCents (and ensure getReconCostCents/getMiscCostCents exported if used) |
| Edit | `modules/inventory/ui/DetailPage.tsx`, `VehicleForm.tsx` | Use transportCostCents from types |
| Create / Edit | `modules/accounting-core/serialize.ts` | Add serializeExpense, serializeTransaction; use in expense and transaction routes |
| Edit | `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts` | Use shared serializeExpense |
| Edit | `app/api/accounting/transactions/route.ts`, `[id]/route.ts`, `[id]/post/route.ts` | Use shared serializeTransaction |
| Edit | `app/api/deals/serialize.ts` (or new file under api/deals) | Add serializeDealTitle, serializeDealFunding, serializeChecklistItem |
| Edit | Deal title/funding/dmv-checklist routes | Use shared serializers |
| Delete | `lib/api/index.ts` | Unused barrel |
| Delete | `components/layout/Sidebar.tsx`, `Topbar.tsx` | Unused shims |
| Edit | `modules/inventory/ui/__tests__/inventory-permissions.test.tsx` | Switch to live pages (VehicleDetailPage, InventoryPageContentV2, AddVehiclePage, EditVehicleUi) |
| Delete | `modules/inventory/ui/InventoryPage.tsx`, `ListPage.tsx`, `DetailPage.tsx`, `CreateVehiclePage.tsx`, `EditVehiclePage.tsx` | After test update |
| Delete | `modules/customers/ui/ListPage.tsx`, `CustomersPage.tsx` | Never imported |
| Delete | `components/ui/app-button.tsx`, `app-card.tsx`, `app-input.tsx`, `modal-error-body.tsx` | Unused |
| Delete | `lib/ui/style-policy.ts` | Only used by removed app-* components |

---

## 6. SAFETY PLAN

- **Behavior:** No change to API response shapes; serializers moved, not reimplemented. No change to RBAC, tenant scoping, or audit.
- **Migration risk:** Low; no DB or contract changes.
- **Tests:** Run `npm run test:dealer` (Jest); update inventory-permissions.test.tsx to assert on live components; keep customers-ui.test.tsx (it uses CustomersListPage which is live).
- **Rollback:** All changes are file-level; revert commits if needed. No feature flags.

---

## 7. COMMANDS

- From repo root: `npm run test:dealer`, `npm run lint`, `npm run build` (for apps/dealer or monorepo as configured).
