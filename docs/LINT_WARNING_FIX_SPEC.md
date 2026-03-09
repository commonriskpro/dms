# Lint Warning Fix Spec

**Date:** 2026-03-07  
**Scope:** 15 warnings across 11 files

---

## 1. @next/next/no-img-element (4 warnings, 3 files)

| File | Line(s) | Root cause | Chosen fix |
|------|---------|------------|------------|
| PhotosStatusCard.tsx | 206, 261 | Primary and thumbnail URLs are from `createObjectURL(blob)` or parent-passed array; next/image does not support blob URLs | Keep `<img>`; add narrow `eslint-disable-next-line` with reason "blob/object URLs for upload preview; next/image unsupported" |
| VehicleOverviewCard.tsx | 50 | `photoUrls` are signed or CDN URLs from API; next/image would require remotePatterns and can break signed URLs | Keep `<img>`; add narrow `eslint-disable-next-line` with reason "signed/remote vehicle photo URLs; next/image not used to avoid loader/config" |
| VehiclePhotosManager.tsx | 351 | Same as above — signed URLs from `/api/inventory/:id/photos` | Keep `<img>`; add narrow `eslint-disable-next-line` with same reason |

---

## 2. react-hooks/exhaustive-deps (7 warnings, 5 files)

| File | Line | Root cause | Chosen fix |
|------|------|------------|------------|
| app/platform/dealerships/[id]/page.tsx | 105 | `fetchRoles` reads `addRoleId` to decide whether to set initial role from first fetch | Use a ref to track "has set initial addRoleId"; callback no longer reads `addRoleId`, so no dependency needed |
| contexts/dealer-lifecycle-context.tsx | 44 | useMemo deps include `state` but return value only uses `activeDealership`, `lifecycleStatus`, `lastStatusReason`, `closedDealership` | Remove `state` from dependency array (unnecessary) |
| CustomersListPage.tsx | 258 | `columns` useMemo uses `handleSort` in column defs but deps are `[sortBy, sortOrder]` | Wrap `handleSort` in `useCallback([sortBy, sortOrder])` and add `handleSort` to columns useMemo deps |
| DealDeskWorkspace.tsx | 108 | Effect syncs from `desk.deal` but deps are `[desk.deal.id, desk.deal.updatedAt]` | Use single dep `desk.deal` so any deal change resyncs drafts |
| DealFinanceTab.tsx | 187, 203, 209 | fetchProducts uses `finance`; one useEffect flagged; refetchAll uses `finance` | Add `finance` to fetchProducts and refetchAll deps; for useEffect at 197 that only calls fetchFinance(), add narrow eslint-disable (effect intentionally runs only when fetchFinance identity changes) |
| DealLendersTab.tsx | 908 | Effect syncs form state from `submission`; deps list individual fields | Add `submission` to dependency array (effect reads full submission) |

---

## 3. jsx-a11y (2 warnings, 2 files)

| File | Line | Root cause | Chosen fix |
|------|------|------------|------------|
| SegmentedJourneyBar.tsx | 234 | `<li role="option">` must have `aria-selected` per ARIA | Add `aria-selected={s.id === currentStageId}` to the `<li>` (Button already has it; role="option" is on the li) |
| GlobalSearch.tsx | 193 | `aria-expanded` is not supported by implicit role `textbox` | Set `role="combobox"` on the input so aria-expanded/aria-controls/aria-activedescendant are valid |

---

## 4. react-hooks/incompatible-library (1 warning)

| File | Line | Root cause | Chosen fix |
|------|------|------------|------------|
| CustomersListPage.tsx | 261 | TanStack Table's `useReactTable()` returns non-memoizable functions; React Compiler skips memoizing | Single-line eslint-disable-next-line with comment: "TanStack Table API returns unstable refs; skip compiler memoization" |

---

## File plan

1. PhotosStatusCard.tsx — 2× eslint-disable-next-line (img)
2. VehicleOverviewCard.tsx — 1× eslint-disable-next-line (img)
3. VehiclePhotosManager.tsx — 1× eslint-disable-next-line (img)
4. SegmentedJourneyBar.tsx — add aria-selected on `<li role="option">`
5. GlobalSearch.tsx — add role="combobox" on input
6. app/platform/dealerships/[id]/page.tsx — ref for initial addRoleId, remove addRoleId from callback body
7. contexts/dealer-lifecycle-context.tsx — remove `state` from useMemo deps
8. CustomersListPage.tsx — useCallback(handleSort), add handleSort to columns deps; eslint-disable-next-line for useReactTable
9. DealDeskWorkspace.tsx — effect deps `[desk.deal]`
10. DealFinanceTab.tsx — add finance to fetchProducts and refetchAll; eslint-disable-next-line for useEffect(fetchFinance)
11. DealLendersTab.tsx — add `submission` to effect deps
