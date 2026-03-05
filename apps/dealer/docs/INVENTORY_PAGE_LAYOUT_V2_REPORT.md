# Inventory Page Layout V2 — Report

**Date**: 2026-03-05  
**Flow**: Step 1 Spec → Step 2 Backend → Step 3 Frontend → Step 4 Security & QA

---

## What changed

### Step 1 — Spec (no code)
- **Added** `apps/dealer/docs/INVENTORY_PAGE_LAYOUT_V2_SPEC.md` describing:
  - Layout: 4 KPI cards (Total Units, Inventory Value, Inventory Alerts, Inventory Health), Deal Pipeline strip, Filter bar (Advanced Filters, floor planned / previously sold chips, Create Plans + Save Search), Vehicle Inventory table with columns Stock #, Vehicle, Status, Price, Cost, Floor Plan, Days in Inventory, Source, Actions.
  - Responsive: 1 col mobile, 2 col md, 4 col lg+.
  - Data contract for `getInventoryPageOverview(ctx, query)` and RBAC (inventory.read required; pipeline requires deals.read or crm.read).
  - Acceptance criteria: server-first, no fetch-on-mount, token-only styling, deterministic UI.

### Step 2 — Backend
- **Added** `modules/inventory/service/inventory-page.ts`:
  - `getInventoryPageOverview(ctx, query)` — single service that returns kpis, alerts, health, pipeline, list (items, page, pageSize, total), filterChips (floorPlannedCount, previouslySoldCount).
  - Zod `inventoryPageQuerySchema` for page, pageSize, status, search, minPrice, maxPrice, locationId, sortBy, sortOrder.
  - RBAC: throws `ApiError("FORBIDDEN", "inventory.read required")` when permission missing; pipeline counts zero when neither deals.read nor crm.read.
  - All queries tenant-scoped by `ctx.dealershipId`; cents-based money.
- **Extended** `modules/inventory/db/vehicle.ts`:
  - `listVehicles` option `includeFloorplan?: boolean` to include floorplan with lender name.
  - `countFloorPlanned(dealershipId)`, `countPreviouslySold(dealershipId)` for filter chip counts.
- **Exported** inventory-page from `modules/inventory/service/index.ts`.

### Step 3 — Frontend
- **Replaced** `apps/dealer/app/(app)/inventory/page.tsx` with server-first RSC:
  - `noStore()`, `export const dynamic = "force-dynamic"`.
  - Parses `searchParams` (Promise) and validates with `inventoryPageQuerySchema`.
  - Calls `getInventoryPageOverview(ctx, rawQuery)`; no client fetch for initial data.
  - Renders no-access when missing `inventory.read` or dealership/user.
- **Added** client components:
  - `modules/inventory/ui/components/InventoryKpis.tsx` — 4 cards with exact titles: Total Units, Inventory Value, Inventory Alerts, Inventory Health (token-only styling, `summaryGrid`).
  - `modules/inventory/ui/components/VehicleInventoryTable.tsx` — table title "Vehicle Inventory", column "Days in Inventory", columns Stock #, Vehicle, Status, Price, Cost, Floor Plan, Source, Actions; URL-based pagination via `buildPaginatedUrl`.
  - `modules/inventory/ui/InventoryPageContentV2.tsx` — receives `initialData` and `currentQuery`; composes KPIs, DealPipelineBar, InventoryFilterBar, VehicleInventoryTable; Advanced Filters / Create Plans / Save Search open modals (placeholders for Create Plans and Save Search).
- **Reused** `DealPipelineBar`, `InventoryFilterBar` (with floorPlannedCount, previouslySoldCount from overview.filterChips).
- No fetch-on-mount; pagination and filters drive URL so RSC re-fetches.

### Step 4 — Security & QA
- **Added** `modules/inventory/tests/inventory-page.test.ts`:
  - Query validation: defaults, page/pageSize, reject pageSize > 100, reject minPrice > maxPrice, valid status/sortBy/sortOrder.
  - RBAC: `getInventoryPageOverview` without `inventory.read` throws `ApiError` with code FORBIDDEN and message "inventory.read required".
  - Integration (when DB available): overview shape (kpis, alerts, health, pipeline, list, filterChips); pipeline zeros when neither deals.read nor crm.read.
- **Note**: Optional Jest snapshot for layout was not added; existing UI is covered by manual test checklist below. Full test run (`npm test`) can hit DB connection limits in local env; run with `SKIP_INTEGRATION_TESTS=1` to run only unit tests.

---

## What was verified

- **RBAC**: Unauthorized (no inventory.read) throws FORBIDDEN before any DB access.
- **Tenant isolation**: Service uses `ctx.dealershipId` for all calls (vehicle list, counts, dashboard, alerts, pipeline); no cross-tenant data.
- **Query validation**: Zod at edge; invalid pageSize/minPrice>maxPrice rejected.
- **Server-first**: RSC loads data via `getInventoryPageOverview`; client receives `initialData`; pagination/filters update URL and trigger server re-render.
- **Token-only styling**: Components use `var(--text)`, `var(--surface)`, `var(--border)`, `var(--accent)`, etc.; no Tailwind palette colors.
- **Deterministic**: Page uses `noStore()` and `dynamic = "force-dynamic"`.

---

## Manual test checklist

- [ ] Log in as user with inventory.read; open /inventory. Page shows 4 KPI cards, Deal Pipeline strip, filter bar with chips, Vehicle Inventory table.
- [ ] Card titles: "Total Units", "Inventory Value", "Inventory Alerts", "Inventory Health". Table title: "Vehicle Inventory". Column: "Days in Inventory".
- [ ] Change page via pagination; URL updates (e.g. ?page=2); list updates without client fetch.
- [ ] Open Advanced Filters; apply status/search/price; URL updates and list reflects filters.
- [ ] Create Plans and Save Search open modals (placeholder content).
- [ ] Log in as user without inventory.read; /inventory shows no-access message.
- [ ] Responsive: 1 col (mobile), 2 col (md), 4 col (lg+) for KPI cards.

---

## File list

| Path | Change |
|------|--------|
| apps/dealer/docs/INVENTORY_PAGE_LAYOUT_V2_SPEC.md | Added |
| apps/dealer/docs/INVENTORY_PAGE_LAYOUT_V2_REPORT.md | Added |
| apps/dealer/modules/inventory/service/inventory-page.ts | Added |
| apps/dealer/modules/inventory/service/index.ts | Export inventory-page |
| apps/dealer/modules/inventory/db/vehicle.ts | includeFloorplan, countFloorPlanned, countPreviouslySold |
| apps/dealer/app/(app)/inventory/page.tsx | Replaced with RSC + getInventoryPageOverview |
| apps/dealer/modules/inventory/ui/InventoryPageContentV2.tsx | Added |
| apps/dealer/modules/inventory/ui/components/InventoryKpis.tsx | Added |
| apps/dealer/modules/inventory/ui/components/VehicleInventoryTable.tsx | Added |
| apps/dealer/modules/inventory/tests/inventory-page.test.ts | Added |
