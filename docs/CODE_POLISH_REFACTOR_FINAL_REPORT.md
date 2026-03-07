# Code Polish Refactor — Final Report

**Sprint:** Full Code Polish + Duplication Audit + Cleanup  
**Date:** 2026-03-07  
**Spec:** `docs/CODE_POLISH_REFACTOR_SPEC.md`

---

## 1. What was deduplicated

### Backend

- **Expense serialization:** `serializeExpense` moved to `modules/accounting-core/serialize.ts` and used from `app/api/expenses/route.ts` and `app/api/expenses/[id]/route.ts`.
- **Transaction serialization:** `serializeTransaction` moved to `modules/accounting-core/serialize.ts` and used from `app/api/accounting/transactions/route.ts`, `[id]/route.ts`, and `[id]/post/route.ts`.
- **Deal title serialization:** `serializeDealTitle` added to `app/api/deals/serialize.ts` and used from `app/api/deals/[id]/title/route.ts`, `[id]/title/status/route.ts`, and `[id]/title/start/route.ts`.
- **Deal funding serialization:** `serializeDealFunding` added to `app/api/deals/serialize.ts` and used from `app/api/deals/[id]/funding/route.ts` and `[id]/funding/status/route.ts`.
- **DMV checklist serialization:** `serializeChecklistItem` added to `app/api/deals/serialize.ts` and used from `app/api/deals/[id]/dmv-checklist/route.ts` and `app/api/deals/dmv-checklist/[itemId]/route.ts`.
- **Money formatting:** Replaced local `formatCents` in `components/dashboard-v3/FloorplanLendingCard.tsx` with `formatCents` from `@/lib/money`.
- **URL query building:** Added `lib/url/buildQueryString.ts` and switched `app/(app)/inventory/dashboard/InventoryDashboardContent.tsx` and `modules/inventory/ui/InventoryPageContentV2.tsx` to use it.
- **Vehicle transport cost getter:** Added `transportCostCents` to `modules/inventory/ui/types.ts` and used it from `modules/inventory/ui/DetailPage.tsx` and `modules/inventory/ui/VehicleForm.tsx` (then `DetailPage.tsx` was removed as dead; `VehicleForm.tsx` still uses it).

### Frontend

- **buildQueryString:** Single shared implementation used by inventory dashboard and inventory list content.
- **transportCostCents:** Single getter in types used by VehicleForm (and was used by removed DetailPage).
- **Empty/loading/error:** No new shared components; existing `EmptyState` / `ErrorState` already used.

---

## 2. What was removed (dead code)

- **Barrel:** `apps/dealer/lib/api/index.ts` (unused).
- **Layout shims:** `apps/dealer/components/layout/Sidebar.tsx`, `components/layout/Topbar.tsx` (re-exports never imported).
- **Unused UI primitives:** `components/ui/app-button.tsx`, `app-card.tsx`, `app-input.tsx`, `modal-error-body.tsx`.
- **Style policy:** `lib/ui/style-policy.ts` (only referenced by removed app-* components).
- **Customer UI (dead):** `modules/customers/ui/ListPage.tsx`, `modules/customers/ui/CustomersPage.tsx`.
- **Inventory UI (superseded):** `modules/inventory/ui/InventoryPage.tsx`, `ListPage.tsx`, `DetailPage.tsx`, `CreateVehiclePage.tsx`, `EditVehiclePage.tsx`.

---

## 3. What was intentionally deferred (Bucket E)

- Updating ARCHITECTURE_MAP / MODULE_REGISTRY for reporting-core, accounting-core, finance-core, integrations.
- Stale doc cleanup (step reports, duplicate specs).
- Queue page abstraction (shared hook/component for delivery/funding/title).
- Customer status badge mapping to a shared token.
- Event bus wiring (ensure `emitEvent` is used where domain events are intended).

---

## 4. Files changed (summary)

| Action | Path |
|--------|------|
| Created | `docs/CODE_POLISH_REFACTOR_SPEC.md` |
| Created | `docs/CODE_POLISH_REFACTOR_FINAL_REPORT.md` |
| Created | `modules/accounting-core/serialize.ts` |
| Created | `lib/url/buildQueryString.ts` |
| Edited | `app/api/deals/serialize.ts` (added serializeDealTitle, serializeDealFunding, serializeChecklistItem) |
| Edited | `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts` (use accounting-core serialize) |
| Edited | `app/api/accounting/transactions/route.ts`, `[id]/route.ts`, `[id]/post/route.ts` (use accounting-core serialize) |
| Edited | `app/api/deals/[id]/title/route.ts`, `[id]/title/status/route.ts`, `[id]/title/start/route.ts` (use serialize from deals) |
| Edited | `app/api/deals/[id]/funding/route.ts`, `[id]/funding/status/route.ts` (use serialize from deals) |
| Edited | `app/api/deals/[id]/dmv-checklist/route.ts`, `app/api/deals/dmv-checklist/[itemId]/route.ts` (use serialize from deals) |
| Edited | `app/api/deals/title/route.ts` (type fix for dealTitle; no serializer change) |
| Edited | `components/dashboard-v3/FloorplanLendingCard.tsx` (use formatCents from lib/money) |
| Edited | `app/(app)/inventory/dashboard/InventoryDashboardContent.tsx` (use buildQueryString from lib) |
| Edited | `modules/inventory/ui/InventoryPageContentV2.tsx` (use buildQueryString from lib) |
| Edited | `modules/inventory/ui/types.ts` (added transportCostCents) |
| Edited | `modules/inventory/ui/VehicleForm.tsx` (use transportCostCents from types) |
| Edited | `modules/inventory/ui/__tests__/inventory-permissions.test.tsx` (use live components + minimal data) |
| Deleted | `lib/api/index.ts`, `components/layout/Sidebar.tsx`, `Topbar.tsx`, `components/ui/app-button.tsx`, `app-card.tsx`, `app-input.tsx`, `modal-error-body.tsx`, `lib/ui/style-policy.ts` |
| Deleted | `modules/customers/ui/ListPage.tsx`, `CustomersPage.tsx` |
| Deleted | `modules/inventory/ui/InventoryPage.tsx`, `ListPage.tsx`, `DetailPage.tsx`, `CreateVehiclePage.tsx`, `EditVehiclePage.tsx` |

---

## 5. Commands run

- `npm run test:dealer` (Jest): finance-core serialize and lib/money tests passed. inventory-permissions failed (missing `@testing-library/dom` in env). accounting-core profit-calc and deals tenant-isolation failed (Prisma schema vs DB: `Deal.delivery_status` missing).
- `npm run build`: Build failed after our changes due to (1) `app/api/deals/title/route.ts` type error — fixed with cast for `dealTitle` and `serializeDeal`; (2) `app/api/inventory/acquisition/[id]/route.ts` type error — pre-existing, not changed in this sprint.
- Lint: No `lint` script at repo root; no linter errors reported for edited files.

---

## 6. Behavior and safety

- **API:** Response shapes unchanged; serializers only moved or centralized. Tenant scoping, RBAC, and audit paths unchanged.
- **UI:** Same UX; one local formatCents and one buildQueryString replaced by shared implementations. Removed pages were unused; live routes use VehicleDetailPage, InventoryPageContentV2, AddVehiclePage, EditVehicleUi.

---

## 7. Known risks and follow-up

- **Tests:** inventory-permissions test expects `@testing-library/dom`; profit-calc and tenant-isolation expect DB schema with `delivery_status`. Fix test env and/or DB/schema for green CI.
- **Build:** `app/api/inventory/acquisition/[id]/route.ts` has a type error (toLeadResponse vs. updated shape); fix separately.
- **Rollback:** Revert the commit(s) that applied this refactor; no DB or contract changes.

---

## 8. Performance pass

No new N+1 patterns, duplicate fetches, or repeated heavy transformations were identified during the duplication audit. Profit and vehicle-cost logic already use single sources of truth (accounting-core profit, reporting-core aggregates, inventory/service/vehicle totalCostCents). No performance changes were made.

---

## 9. Follow-up cleanup candidates

- Add reporting-core / accounting-core / finance-core / integrations to MODULE_REGISTRY and ARCHITECTURE_MAP.
- Resolve event bus usage (emitEvent vs. legacy events) and document.
- Optionally extract a shared queue page hook/component for delivery, funding, and title queues.
- Consolidate customer status badge mapping to a shared token if semantics align.
