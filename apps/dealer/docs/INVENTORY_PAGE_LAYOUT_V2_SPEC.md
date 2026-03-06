# Inventory Page Layout V2 — Spec (Step 1)

**Status**: Spec only (no code). Follow 4-step flow: Spec → Backend → Frontend → Security & QA.

---

## 1. Layout structure (match mock)

### 1.1 Order and regions

1. **Page title**: "Inventory" (top left).
2. **KPI row**: 4 cards in a grid.
   - Card 1: **Total Units** — value + subtext "+N added this week".
   - Card 2: **Inventory Value** — currency value + subtext "Avg $X / vehicle".
   - Card 3: **Inventory Alerts** — list of alert lines: Missing Photos N, Units > 90 Days N, Units Need Recon N (with optional indicators/checkboxes per mock).
   - Card 4: **Inventory Health** — aging buckets: &lt;30 Days N, 30–60 Days N, 60–90 Days N, &gt;90 Days N (with progress bar per bucket).
3. **Deal Pipeline strip**: Single row — "Leads **N** → Appointments **N** → Working Deals **N** → Pending Funding **N** → Sold Today **N**" (numbers bold/linked as in mock).
4. **Filter bar row**:
   - Left: "Advanced Filters" button; two chips: "{N} floor planned", "{N} previously sold".
   - Right: "+ Create Plans" button; "Save Search" (button or dropdown per existing pattern).
5. **Vehicle Inventory table** (title: "Vehicle Inventory"):
   - Columns: **Stock #**, **Vehicle**, **Status**, **Price**, **Cost**, **Floor Plan**, **Days in Inventory**, **Source**, **Actions**.
   - Rows: one per vehicle; Stock # and Vehicle (year/make/model) visible; Status as pill; Price/Cost in currency; Floor Plan = lender name or "—"; Days in Inventory = days since creation; Source = "—" (reserved); Actions = View + Edit.
   - Pagination below table: "Showing X–Y of Z", Previous / Page N of M / Next.

### 1.2 Responsive behavior

- **KPI cards**: 1 column on mobile, 2 columns on `md`, 4 columns on `lg+`.
- Filter bar and pipeline strip: wrap as needed; table: horizontal scroll on small screens.
- No layout shift: use deterministic placeholders or skeletons where needed.

---

## 2. Data contracts

### 2.1 Page context

- **Source of data**: Single server-side call `getInventoryPageOverview(ctx, query)` from the inventory module. No client fetch on mount for initial page data.
- **Context `ctx`**: `{ dealershipId: string, userId: string, permissions: string[] }` (or equivalent session type used in the app).
- **Query (Zod-validated)**:
  - `page`: number, min 1, default 1.
  - `pageSize`: number, min 1, max 100, default 25.
  - Optional filters (for list only): `status`, `search`, `minPrice`, `maxPrice`, `locationId`, `sortBy`, `sortOrder` — same as existing list endpoint where applicable.
- **Response shape** (all fields required; use defaults when permission missing):

```ts
{
  kpis: {
    totalUnits: number;
    addedThisWeek: number;
    inventoryValueCents: number;
    avgValuePerVehicleCents: number;
  };
  alerts: {
    missingPhotos: number;
    over90Days: number;
    needsRecon: number;
  };
  health: {
    lt30: number;
    d30to60: number;
    d60to90: number;
    gt90: number;
  };
  pipeline: {
    leads: number;
    appointments: number;
    workingDeals: number;
    pendingFunding: number;
    soldToday: number;
  };
  list: {
    items: VehicleListItem[];
    page: number;
    pageSize: number;
    total: number;
  };
  filterChips?: {
    floorPlannedCount: number;
    previouslySoldCount: number;
  };
}
```

- **VehicleListItem** (for table): id, stockNumber, year, make, model, status, salePriceCents (number or string for display), costCents (total or auction; number/string), floorPlanLenderName: string | null, createdAt (for days in inventory), source: string | null (reserved; may be "—"). All money in cents for consistency.
- **Cents**: All money fields in the contract are in cents (number or string as per existing codebase). Display formatting (e.g. $X.XX) is UI-only.
- **Filter chip counts**: Floor planned count = number of vehicles with an active floor plan (VehicleFloorplan) for the dealership. Previously sold count = number of vehicles with status SOLD (or equivalent "previously sold" definition). These may be returned as part of `kpis` or a separate `filterChips: { floorPlannedCount, previouslySoldCount }` in the response so the filter bar can show "N floor planned" and "N previously sold".

### 2.2 RBAC and defaults

- **inventory.read**: Required to load KPIs, alerts, health, and list. If missing: return 403 from the page or show "no access" and do not call the service for inventory data; list and counts may be empty/default.
- **Pipeline**: Requires **deals.read** or **crm.read** (or both; one is sufficient). If neither is present, pipeline counts are returned as zeros (no 403 for the whole page).
- **Tenant isolation**: Every query and aggregate is scoped by `dealershipId` from `ctx`. No cross-tenant data. List, counts, and pipeline are all dealership-scoped.

### 2.3 Existing pieces (no regeneration)

- Reuse existing DB/services where they match this contract: vehicle list (with optional include for floor plan lender), vehicle KPIs/aggregates, aging buckets, alert counts, deal pipeline. Extend only as needed (e.g. list with floor plan lender, floor-planned count, previously-sold count).
- Reuse existing UI components where they match the mock (e.g. DealPipelineBar, InventoryFilterBar, InventoryHealthCard, InventoryAlertsCard) or adapt titles/labels to match exactly: "Inventory Alerts", "Inventory Health", "Vehicle Inventory", "Days in Inventory".

---

## 3. RBAC summary

| Data / action              | Permission     | Behavior if missing                    |
|----------------------------|----------------|----------------------------------------|
| KPIs, alerts, health, list | inventory.read | 403 or no-access UI; no inventory data |
| Pipeline counts            | deals.read or crm.read | Pipeline zeros; page still loads  |
| Filter chip counts         | inventory.read | Same as KPIs; chips show counts         |

- Tenant: All data scoped by `ctx.dealershipId`. No cross-tenant access.

---

## 4. Acceptance criteria

- **Server-first**: RSC loads initial data via `getInventoryPageOverview(ctx, query)`; no client fetch on mount for that data.
- **No fetch-on-mount**: Client components receive `initialData` (or equivalent) from the server; table pagination/filters trigger navigation or server refresh (e.g. URL search params), not a client-side fetch of the full page payload unless explicitly a "refresh" action.
- **Token-only styling**: Use only design tokens (e.g. `var(--text)`, `var(--surface)`, `var(--border)`, `var(--accent)`) or shadcn/ui components that use them. No Tailwind palette colors (e.g. no `text-blue-500`).
- **Deterministic UI**: Same query + permissions yield same layout and data; no cross-tenant caching; page uses `noStore()` and route segment `dynamic = "force-dynamic"`.
- **Query validation**: Page (or wrapper) parses search params with Zod; invalid params are coerced or defaulted per schema; list pagination respects `page`/`pageSize` and max limit.
- **Table**: Title "Vehicle Inventory"; column header "Days in Inventory"; columns Stock #, Vehicle, Status, Price, Cost, Floor Plan, Source, Actions as specified.
- **Modals (Option B if used)**: "Advanced Filters", "Create Plans", "Save Search" open modal routes (e.g. intercept routes) where the project uses Option B; otherwise inline modals. No requirement to implement Create Plans / Save Search backend logic in this spec—only open the modal/route.

---

## 5. File / boundary notes

- **Backend**: Single service module `modules/inventory/service/inventory-page.ts` exporting `getInventoryPageOverview(ctx, query)`. It may call existing db/service (vehicle, alerts, dashboard, deal-pipeline) and add minimal new helpers (e.g. count floor-planned, count previously sold) in the inventory module.
- **Frontend**: Page at `apps/dealer/app/(app)/inventory/page.tsx` (RSC); components under `modules/inventory/ui/` (e.g. InventoryKpis, InventoryPipelineStrip, InventoryFilterBar, VehicleInventoryTable) or equivalent. Table may be the existing InventoryTableCard with the correct title and column label and data shape.
- **No new API route**: Data is loaded in the RSC by calling the service directly. Optional: a dedicated GET API route for the overview for future use (e.g. refresh); not required for this spec.

---

## 6. Audit and security notes

- No new audit events required for this layout. Existing audit rules for inventory reads (if any) and deal pipeline reads apply.
- Sensitive reads: Inventory list and KPIs are dealership-scoped; pipeline is dealership-scoped. No PII in logs; no raw card data.
