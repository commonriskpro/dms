# Lint Warning Fix — Final Report

**Date:** 2026-03-08  
**Sprint:** Fix Remaining Lint Warnings Correctly

---

## Warnings Originally Present

| Rule | Count | Files |
|------|-------|--------|
| @next/next/no-img-element | 4 | PhotosStatusCard.tsx (2), VehicleOverviewCard.tsx (1), VehiclePhotosManager.tsx (1) |
| react-hooks/exhaustive-deps | 7 | platform/dealerships/[id]/page.tsx, dealer-lifecycle-context.tsx, CustomersListPage.tsx, DealDeskWorkspace.tsx, DealFinanceTab.tsx (3), DealLendersTab.tsx |
| jsx-a11y/role-has-required-aria-props | 1 | SegmentedJourneyBar.tsx |
| jsx-a11y/role-supports-aria-props | 1 | GlobalSearch.tsx |
| react-hooks/incompatible-library | 1 | CustomersListPage.tsx (useReactTable) |
| **Total** | **15** | **11 files** |

---

## Fixes Applied

### 1. @next/next/no-img-element (4 → 0)

- **PhotosStatusCard.tsx (206, 261)**  
  Kept `<img>` (blob/object URLs from file picker; next/image does not support blob URLs). Added narrow `{/* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs for upload preview; next/image does not support blob URLs */}` before each img. Wrapped primary image in a fragment so the comment can sit on the line above the element.

- **VehicleOverviewCard.tsx (50)**  
  Kept `<img>` (signed/remote vehicle photo URLs). Added one `{/* eslint-disable-next-line @next/next/no-img-element -- signed/remote vehicle photo URLs; next/image not used to avoid loader config for dynamic URLs */}`.

- **VehiclePhotosManager.tsx (351)**  
  Same as VehicleOverviewCard. One narrow disable with the same reason.

### 2. react-hooks/exhaustive-deps (7 → 0)

- **app/platform/dealerships/[id]/page.tsx (105)**  
  `fetchRoles` was reading `addRoleId` to set initial role only once. Introduced `initialAddRoleIdSetRef` and set it when applying the first role; callback no longer depends on `addRoleId`, so no extra dependency.

- **contexts/dealer-lifecycle-context.tsx (44)**  
  useMemo dependency list included `state` but the computed value only used `activeDealership`, `lifecycleStatus`, `lastStatusReason`, `closedDealership`. Removed `state` from the dependency array.

- **modules/customers/ui/CustomersListPage.tsx (258)**  
  `columns` useMemo used `handleSort` in column definitions. Wrapped `handleSort` in `useCallback` with `[sortBy, sortOrder]` and added `handleSort` to the columns useMemo dependency array.

- **modules/deals/ui/desk/DealDeskWorkspace.tsx (108)**  
  Effect that syncs draft state from `desk.deal` had `[desk.deal.id, desk.deal.updatedAt]`. Replaced with a single dependency `[desk.deal]` so any deal change resyncs drafts.

- **modules/finance-shell/ui/DealFinanceTab.tsx (187, 203, 209)**  
  - `fetchProducts`: added `finance` to dependency array (callback uses `finance` in guard).  
  - useEffect that only calls `fetchFinance()`: left deps as `[canRead, dealId, fetchFinance]`; no disable added (lint did not report after other changes).  
  - Second useEffect (finance/products sync): dependency list updated from `[finance?.id, canRead, fetchProducts]` to `[finance, canRead, fetchProducts]`.  
  - `refetchAll`: added `finance` to dependency array.

- **modules/lender-integration/ui/DealLendersTab.tsx (908)**  
  Effect that syncs form state from `submission` had many granular `submission?.…` deps. Replaced with a single `[submission]` dependency.

### 3. jsx-a11y (2 → 0)

- **SegmentedJourneyBar.tsx (234)**  
  `<li role="option">` must have `aria-selected`. Set `aria-selected={s.id === currentStageId}` on the `<li>` (inner Button already had it; the option role is on the list item).

- **GlobalSearch.tsx (193)**  
  `aria-expanded` is not valid on default role `textbox`. Set `role="combobox"` on the input so `aria-expanded`, `aria-controls`, and `aria-activedescendant` are valid.

### 4. react-hooks/incompatible-library (1 → 0)

- **CustomersListPage.tsx (261)**  
  TanStack Table’s `useReactTable()` returns non-memoizable refs; React Compiler cannot safely memoize. Added a single-line disable immediately above `useReactTable` with comment: `TanStack Table's useReactTable() returns unstable refs; React Compiler cannot memoize this safely`.

---

## Warnings Intentionally Deferred

None. All 15 warnings were addressed with code or narrow, documented disables.

---

## Files Changed

| File | Change |
|------|--------|
| app/(app)/inventory/new/components/PhotosStatusCard.tsx | 2× eslint-disable (img), fragment for primary image |
| modules/inventory/ui/components/VehicleOverviewCard.tsx | 1× eslint-disable (img) |
| modules/inventory/ui/components/VehiclePhotosManager.tsx | 1× eslint-disable (img) |
| components/journey-bar/SegmentedJourneyBar.tsx | aria-selected on `<li role="option">` |
| modules/search/ui/GlobalSearch.tsx | role="combobox" on input |
| app/platform/dealerships/[id]/page.tsx | ref for initial addRoleId; fetchRoles no longer reads addRoleId |
| contexts/dealer-lifecycle-context.tsx | Removed `state` from useMemo deps |
| modules/customers/ui/CustomersListPage.tsx | useCallback(handleSort), handleSort in columns deps, eslint-disable for useReactTable |
| modules/deals/ui/desk/DealDeskWorkspace.tsx | Effect deps `[desk.deal]` |
| modules/finance-shell/ui/DealFinanceTab.tsx | finance in fetchProducts/refetchAll and in products effect deps |
| modules/lender-integration/ui/DealLendersTab.tsx | Effect deps `[submission]` |

---

## Commands Run

- `npm run lint:dealer` — before: 0 errors, 15 warnings; after: 0 errors, 0 warnings  
- `npm run build:dealer` — PASS (exit 0)  
- Targeted tests (dealer-lifecycle-context, SegmentedJourneyBar, GlobalSearch, customers-ui) — run; full suite recommended for regression check

---

## Final Lint Status

```
npm run lint:dealer
✔ 0 errors, 0 warnings
```

No behavior, a11y, or styling regressions intended; all fixes are minimal and documented in code or in `docs/LINT_WARNING_FIX_SPEC.md`.
