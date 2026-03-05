# Inventory Intelligence Dashboard — Spec (Step 1)

## Overview

New **Inventory Dashboard** view at `/inventory/dashboard` that combines KPIs, Inventory Intelligence (Price to Market, Days to Turn, Turn Performance, Alert Center), and the existing Vehicle Inventory table with URL-driven filters. Design-system locked: reuse existing Card/Metric patterns, token-safe styling only, icons from `@/lib/ui/icons`.

---

## 1. Layout Grid and Responsive Behavior

- **KPI row (4 cards):** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4` with `gap-[var(--space-grid)]` (same as existing summary rows).
- **Intelligence section:** Below KPI row. On `lg`: 2-column grid for left block (Price to Market + Days to Turn + Turn Performance) and right block (Alert Center). On smaller breakpoints: single column, cards stack vertically.
  - Left: Price to Market (compact card), Days to Turn (target + indicator), Turn Performance (avg days + aging breakdown).
  - Right: Alert Center (actionable alerts with recommendation text).
- **Vehicle Inventory table:** Full width below intelligence panel; same filters bar (Advanced Filters chip, etc.) and existing table component. No new spacing/typography systems.

**Responsive:**
- Mobile: KPI row stacks (1 col); intelligence cards stack; table full width.
- `md`: KPI 2 cols; intelligence can stay 1 col or start 2 col.
- `lg`: KPI 4 cols; intelligence 2 cols (metrics left, Alert Center right); table full width.

---

## 2. Card Titles and Labels (Match Mock)

**KPI row (4 cards):**
- Total Units
- Inventory Value
- Days to Turn
- Demand Score

**Intelligence panel:**
- Section title: **Inventory Intelligence**
- **Price to Market** — gauge/meter or numeric + label (e.g. “-3.3% Below Market”).
- **Days to Turn** — target + current indicator (value or N/A).
- **Turn Performance** — Avg Days to Sell + Aging Breakdown (same bucket labels: &lt;30, 30–60, 60–90, &gt;90).
- **Alert Center** — actionable alerts with title, count, recommendation, severity.

---

## 3. Data Contract (TypeScript)

Server loader / service returns a single payload. All money in **cents**. List reuses existing list item shape (`VehicleListItem` from `inventory-page`).

```ts
// Query (Zod-validated)
{
  page?: number;      // default 1
  pageSize?: number;  // default 25, max 100
  status?: VehicleStatus;
  search?: string;
  minPrice?: number;  // cents
  maxPrice?: number;
  locationId?: string;
  sortBy?: "createdAt" | "salePriceCents" | "mileage" | "stockNumber" | "updatedAt";
  sortOrder?: "asc" | "desc";
  alertType?: "MISSING_PHOTOS" | "STALE" | "RECON_OVERDUE" | "PRICE_OVER_MARKET" | "AGED_VEHICLE" | "RECON_NEEDED" | "FLOORPLAN_OVERDUE"; // optional filter from alert click
}

// Response
{
  kpis: {
    totalUnits: number;
    inventoryValueCents: number;
    avgValuePerVehicleCents: number;
    daysToTurn: {
      valueDays: number | null;
      targetDays: number;
      status: "good" | "warn" | "bad" | "na";
    };
    demandScore: {
      score: number | null;
      label: "High" | "Medium" | "Low" | "NA";
      supplyLabel?: string;
    };
  };
  intelligence: {
    priceToMarket: {
      vehiclePriceCents: number | null;
      marketAvgCents: number | null;
      deltaPct: number | null;
      label: "Below Market" | "At Market" | "Above Market" | "NA";
    };
    turnPerformance: {
      avgDaysToSell: number | null;
      agingBucketsPct: { lt30: number; d30to60: number; d60to90: number; gt90: number };
    };
    alertCenter: Array<{
      key: "price_over_market" | "aged_vehicle" | "missing_photos" | "recon_needed" | "floorplan_overdue";
      title: string;
      recommendation?: string;
      count: number;
      severity: "low" | "medium" | "high";
      hrefQuery: Record<string, string>;
    }>;
  };
  list: {
    items: VehicleListItem[];  // id, stockNumber, year, make, model, status, salePriceCents, costCents, floorPlanLenderName, createdAt, source
    page: number;
    pageSize: number;
    total: number;
  };
}
```

---

## 4. Definitions and Heuristics (Deterministic, No External Calls)

- **Inventory Value:** Prefer sum of **book value** (e.g. retail/trade from VehicleBookValue) where available; fallback: sum of vehicle **cost** (auction + transport + recon + misc). Exclude SOLD. Tenant-scoped.
- **Price to Market:**
  - **Market baseline:** Prefer book value (e.g. retail) per vehicle or fleet avg; fallback: avg cost across current inventory.
  - **Vehicle price:** Sale price (or list price) of vehicle/fleet.
  - **deltaPct:** `(vehiclePrice - marketAvg) / marketAvg`; handle divide-by-zero (marketAvg 0 → NA). Label: &lt;−2% “Below Market”, −2% to +2% “At Market”, &gt;+2% “Above Market”, else “NA”.
- **Days to Turn:** Predicted days to sell. **Start heuristic:** If we have sold-vehicle history (e.g. vehicles with status SOLD and sold date), compute average days from acquisition to sold; else `valueDays: null`, `status: "na"`. Target days (e.g. 45) configurable constant. Status: good (&lt;= target), warn (between target and 1.5×), bad (&gt; 1.5× or &gt;90), na.
- **Demand Score:** 0–10 score. **Start heuristic:** If insufficient data (e.g. no sales velocity), `score: null`, `label: "NA"`. Optional: derive from aging mix (e.g. more &lt;30 = higher demand). No external market data.
- **Turn Performance:**
  - **avgDaysToSell:** From historical sold units if available; else `null`.
  - **agingBucketsPct:** Percent of **current** inventory in each bucket (&lt;30, 30–60, 60–90, &gt;90 days). Sum to 100 (or 0 if no units).
- **Alert Center:** Actionable items. Reuse existing alerts (missing photos, aged &gt;90d, recon overdue). Add intelligence alerts when computable:
  - **price_over_market:** e.g. vehicles with sale price &gt; X% above market baseline (e.g. &gt;5%); count + hrefQuery to filter table.
  - **aged_vehicle:** units &gt;90 days (map to existing STALE); hrefQuery `alertType=STALE` or aging filter.
  - **missing_photos:** existing; hrefQuery `alertType=MISSING_PHOTOS`.
  - **recon_needed:** recon overdue; hrefQuery `alertType=RECON_OVERDUE`.
  - **floorplan_overdue:** vehicles with active floor plan and `curtailmentDate < today`; hrefQuery e.g. `floorplanOverdue=1`.
  Each alert: `key`, `title`, `recommendation`, `count`, `severity`, `hrefQuery` (applied to dashboard URL so table receives same params).

---

## 5. RBAC and Permissions

- **inventory.read** — Required for the dashboard page and all data. No data returned without it.
- **deals.read / crm.read** — Not required for this dashboard. Only inventory metrics and list; no pipeline or CRM widgets. Add only if future iterations use deal/CRM data for intelligence.

---

## 6. Acceptance Criteria

- [ ] Server-first: page uses `noStore()` and route segment `export const dynamic = "force-dynamic"`.
- [ ] Initial data loaded in RSC; no client fetch-on-mount for dashboard payload.
- [ ] Token-safe styles only (CSS variables / semantic classes from globals.css); no Tailwind palette colors (e.g. no `text-green-500`, `bg-blue-500`).
- [ ] Icons imported only from `@/lib/ui/icons`; use `ICON_SIZES` (sidebar 18, button 16, table 16, card 20) where applicable.
- [ ] No new design primitives: reuse Card/Metric card layout (e.g. `CardHeader pb-2`, `CardTitle text-sm font-medium` or existing `DMSCard*` and `summaryGrid`).
- [ ] N/A or unknown metrics shown as “—” or “N/A” in a consistent, clean way.
- [ ] Clicking an alert applies filters to the Vehicle Inventory table via URL query params (client navigation); table and filters bar reflect URL state.
- [ ] Vehicle Inventory table reuses existing table component and filters bar (Advanced Filters).
- [ ] All API/loader inputs validated with Zod; invalid query → 400.
- [ ] Tenant isolation: metrics and list scoped by `dealership_id`; RBAC enforced in service layer.

---

## 7. Future Integration Notes (Out of Scope This Pass)

- External market data (e.g. vAuto, KAR) for Price to Market and Demand Score.
- Sold-vehicle history (sold date) for accurate Days to Turn and Turn Performance.
- Configurable targets (e.g. days-to-turn target per store).
