# Lint Debt Cleanup + Release Candidate — Spec

**Sprint:** Lint Debt Cleanup + Release Candidate  
**Date:** 2026-03-07  
**Scope:** Fix remaining lint errors, reduce warnings where low-risk, preserve behavior, document deferred items. No features.

---

## 1. Repo inspection summary

- **Build:** PASS  
- **Tests (unit):** PASS with `SKIP_INTEGRATION_TESTS=1`  
- **Lint:** Runs correctly; **7 errors, 19 warnings** (26 problems)

---

## 2. Exact remaining lint errors and warnings

### 2.1 Errors (7)

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 1 | `app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx` | 18 | no-restricted-imports | 'lucide-react' import restricted; use @/lib/ui/icons |
| 2 | `app/(app)/inventory/dashboard/page.tsx` | 89 | react-hooks/purity | Date.now() impure during render |
| 3 | `components/journey-bar/SegmentedJourneyBar.tsx` | 65 | react-hooks/purity | Date.now() impure during render |
| 4 | `modules/customers/ui/components/CustomersFilterSearchBar.tsx` | 85 | react-hooks/refs | Cannot update ref during render (onSearchChangeRef.current = …) |
| 5 | `modules/finance-core/ui/DealComplianceTab.tsx` | 189 | react/no-unescaped-entities | `'` must be escaped |
| 6 | `modules/finance-core/ui/DealComplianceTab.tsx` | 250 | react/no-unescaped-entities | `'` must be escaped |
| 7 | `modules/inventory/ui/components/VehiclePhotosManager.tsx` | 4 | no-restricted-imports | 'lucide-react' import restricted; use @/lib/ui/icons |

### 2.2 Warnings (19)

| # | File | Line | Rule | Message |
|---|------|------|------|---------|
| 1 | `app/(app)/inventory/dashboard/InventoryDashboardContent.tsx` | 183 | @next/next/no-html-link-for-pages | Use `<Link />` for /inventory/ |
| 2 | `app/(app)/inventory/dashboard/page.tsx` | 18 | @next/next/no-html-link-for-pages | Use `<Link />` for /inventory/dashboard/ |
| 3 | `app/(app)/inventory/new/components/PhotosStatusCard.tsx` | 206, 261 | @next/next/no-img-element | Use next/image |
| 4 | `app/platform/dealerships/[id]/page.tsx` | 105 | react-hooks/exhaustive-deps | useCallback missing addRoleId |
| 5 | `components/journey-bar/SegmentedJourneyBar.tsx` | 227 | jsx-a11y/role-has-required-aria-props | option needs aria-selected |
| 6 | `contexts/dealer-lifecycle-context.tsx` | 44 | react-hooks/exhaustive-deps | useMemo unnecessary dependency state |
| 7 | `modules/customers/ui/CustomersListPage.tsx` | 258, 261 | react-hooks/exhaustive-deps, react-hooks/incompatible-library | useMemo deps; TanStack Table incompatible |
| 8 | `modules/deals/ui/desk/DealDeskWorkspace.tsx` | 108 | react-hooks/exhaustive-deps | useEffect missing desk.deal |
| 9 | `modules/finance-shell/ui/DealFinanceTab.tsx` | 187, 203, 209 | react-hooks/exhaustive-deps | useCallback/useEffect missing finance |
| 10 | `modules/inventory/ui/InventoryPageContentV2.tsx` | 214 | @next/next/no-html-link-for-pages | Use `<Link />` for /inventory/aging/ |
| 11 | `modules/inventory/ui/components/VehicleOverviewCard.tsx` | 50 | @next/next/no-img-element | Use next/image |
| 12 | `modules/inventory/ui/components/VehiclePhotosManager.tsx` | 351 | @next/next/no-img-element | Use next/image |
| 13 | `modules/lender-integration/ui/DealLendersTab.tsx` | 908 | react-hooks/exhaustive-deps | useEffect missing submission |
| 14 | `modules/search/ui/GlobalSearch.tsx` | 193 | jsx-a11y/role-supports-aria-props | aria-expanded on input/textbox |
| 15 | `scripts/cleanup-legacy-vehicle-fileobjects.ts` | 66 | (directive) | Unused eslint-disable for no-constant-condition |

---

## 3. Grouping by root-cause type

| Type | Count | Files | Safe-fix approach |
|------|--------|--------|-------------------|
| **no-restricted-imports** (lucide-react) | 2 errors | EditVehicleUi, VehiclePhotosManager | Add missing icons to @/lib/ui/icons; import from @/lib/ui/icons |
| **react-hooks/purity** (Date.now in render) | 2 errors | inventory/dashboard/page, SegmentedJourneyBar | Compute timestamp in useMemo with stable deps or move to effect/state |
| **react-hooks/refs** (ref in render) | 1 error | CustomersFilterSearchBar | Move ref.current assignment into useEffect |
| **react/no-unescaped-entities** | 2 errors | DealComplianceTab | Escape apostrophe: &apos; or {"'"} |
| **@next/next/no-html-link-for-pages** | 3 warnings | 3 files | Replace <a href="..."> with <Link> (internal routes) |
| **@next/next/no-img-element** | 4 warnings | 3 files | Defer (can require layout/sizing changes) or fix if trivial |
| **react-hooks/exhaustive-deps** | 7 warnings | 5 files | Defer unless obviously safe (risk of loops/behavior change) |
| **react-hooks/incompatible-library** | 1 warning | CustomersListPage | Defer (TanStack Table API) |
| **jsx-a11y** | 2 warnings | SegmentedJourneyBar, GlobalSearch | Fix aria-selected / aria-expanded if trivial; else defer |
| **Unused eslint-disable** | 1 warning | cleanup-legacy-vehicle-fileobjects.ts | Remove directive |

---

## 4. Exact files involved

**Errors (must fix):**  
EditVehicleUi.tsx, page.tsx (inventory/dashboard), SegmentedJourneyBar.tsx, CustomersFilterSearchBar.tsx, DealComplianceTab.tsx, VehiclePhotosManager.tsx, lib/ui/icons.ts (add exports).

**Warnings (safe to fix in this sprint):**  
InventoryDashboardContent.tsx, page.tsx (inventory/dashboard), InventoryPageContentV2.tsx (replace <a> with <Link>); scripts/cleanup-legacy-vehicle-fileobjects.ts (remove unused directive).

**Warnings (defer):**  
exhaustive-deps, incompatible-library, no-img-element, jsx-a11y where fix is non-trivial.

---

## 5. Safe-fix plan

1. **lib/ui/icons.ts:** Export `Check`, `Plus`, `Trash2` from lucide-react (used by EditVehicleUi and VehiclePhotosManager).  
2. **EditVehicleUi.tsx:** Replace `import { … } from "lucide-react"` with `import { Check, ChevronRight, FileText, Printer } from "@/lib/ui/icons"`.  
3. **VehiclePhotosManager.tsx:** Replace `import { … } from "lucide-react"` with `import { MoreHorizontal, Plus, Star, Trash2 } from "@/lib/ui/icons"`.  
4. **inventory/dashboard/page.tsx:** Replace `const lastUpdatedMs = Date.now()` with a value from `useMemo(() => Date.now(), [])` so it is stable per mount.  
5. **SegmentedJourneyBar.tsx:** Compute `daysSince` using a timestamp from `useMemo(() => Date.now(), [])` (or equivalent) so render is pure.  
6. **CustomersFilterSearchBar.tsx:** Move `onSearchChangeRef.current = onSearchChange` from render into the existing useEffect so ref is not written during render.  
7. **DealComplianceTab.tsx:** Replace raw `'` in JSX with `{"'"}` or `&apos;` at lines 189 and 250.  
8. **no-html-link-for-pages:** In InventoryDashboardContent, inventory/dashboard/page, InventoryPageContentV2, replace internal `<a href="...">` with `<Link href="...">` from next/link.  
9. **scripts/cleanup-legacy-vehicle-fileobjects.ts:** Remove the unused eslint-disable comment for no-constant-condition.

---

## 6. Deferred items

- **react-hooks/exhaustive-deps** (multiple files): Adding deps can change behavior or cause loops; fix only when clearly safe.  
- **react-hooks/incompatible-library** (CustomersListPage): TanStack Table API; no minimal change.  
- **@next/next/no-img-element**: May require layout/sizing; defer unless trivial.  
- **jsx-a11y** (aria-selected, aria-expanded): Defer if fixing requires behavior or role changes.

---

## 7. Release-candidate acceptance criteria

1. All **7 lint errors** resolved.  
2. **Warnings** reduced where low-risk (Link, unused directive); remaining warnings documented as deferred.  
3. **Build:** PASS.  
4. **Tests (unit):** PASS with SKIP_INTEGRATION_TESTS=1.  
5. No product behavior change; no tenant/RBAC/audit/API regressions.  
6. Final report lists fixes and deferred items.
