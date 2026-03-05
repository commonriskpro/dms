# Inventory Dashboard Layout — Specification

**Status:** Specification only. No code, Prisma, or API routes defined here.

**Context:** The DMS dealer app Inventory page will use a dashboard layout matching an approved mock. Existing pieces: `InventoryPage`, `InventorySummaryCards` (4 cards; progress bars to be replaced by trend chips), `InventoryRightRail` (Quick Actions + Alerts), `InventoryAlertsCard`, and `inventory.service.alerts.getAlertCounts(dealershipId, userId)`. Permissions in use: `inventory.read`, `inventory.write`, `customers.read`, `crm.read`, `deals.read`. There is no `dashboard.read`; the dashboard relies on `customers.read`, `crm.read`, `deals.read`, and `inventory.read`.

---

## 1. LAYOUT GRID (breakpoints)

- **Page:** `PageShell` + `PageHeader`.
  - **Header left:** Page title (e.g. "Inventory").
  - **Header right:** "Last updated" (relative time) + Refresh control (button or link).
- **Row 1 — KPI cards:** Four KPI cards in a grid.
  - Grid: `gap-[var(--space-grid)]`, responsive columns: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (align with existing `summaryGrid` from `@/lib/ui/recipes/layout`).
- **Row 2 — Middle:** Three cards in one row:
  - **Inventory Health** (aging buckets).
  - **Alerts** (existing Alerts card content).
  - **Quick Actions** (existing Quick Actions card).
  - **Constraint:** Only ONE Quick Actions card on the page; remove any duplicate (e.g. do not repeat Quick Actions in a right rail if it already appears in this row).
- **Row 3:** **Deal Pipeline** — full-width horizontal bar.
  - Stages: Leads → Appointments → Working Deals → Pending Funding → Sold Today.
  - Placed directly above the Inventory List.
- **Row 4 (or same row as pipeline, per mock):** **Team Activity Today** card (counts list).
- **Row 5:** **Inventory List** table — unchanged below pipeline (filters, table, pagination as today).

Breakpoints and spacing must follow existing tokens (`--space-grid`, `sectionStack`, etc.) so the layout is consistent with the rest of the dealer app.

---

## 2. KPI DEFINITIONS AND DELTAS (data contract)

KPIs replace the current summary cards. Progress bars tied to unknown maxima are removed; each KPI uses **trend chips** or secondary text as specified.

| KPI | Primary value | Trend / chip | Notes |
|-----|----------------|--------------|--------|
| **Total Units** | Current count | Delta vs last 7 days: "+N this week" or "—" when not available | `delta7d: number \| null`; null → show "—". |
| **In Recon** | Count | Percent of lot (e.g. "X% of lot") | Chip shows percent of lot. |
| **Sale Pending** | Count | Optional $ value pending; if value not available, show count only | `salePendingValueCents?: number \| null`. |
| **Inventory Value** | Total value | Chip: average per vehicle | `avgValueCents` used for chip. |

**TypeScript-friendly shape for `getKpis(dealershipId)` result:**

```ts
interface InventoryKpis {
  totalUnits: number;
  delta7d: number | null;
  inReconUnits: number;
  inReconPercent: number;
  salePendingUnits: number;
  salePendingValueCents?: number | null;
  inventoryValueCents: number;
  avgValueCents: number;
}
```

- All numeric fields are required except `delta7d` and `salePendingValueCents`, which may be `null` or omitted when unavailable.
- Trend chip behavior: Total Units → "+N this week" or "—"; In Recon → percent of lot; Sale Pending → count and optionally formatted $ when `salePendingValueCents` present; Inventory Value → avg per vehicle from `avgValueCents`.

---

## 3. INVENTORY HEALTH (aging buckets)

- **Buckets:** &lt;30 days, 30–60, 60–90, &gt;90 days in stock.
- **Counts:** `lt30`, `d30to60`, `d60to90`, `gt90` (all non-negative integers).
- **UI:** Subtle bars per bucket (no progress bar tied to an unknown max). Highlight when `gt90 > 0` (e.g. visual emphasis for over-90 bucket).
- **Data shape for `getAgingBuckets(dealershipId)`:**

```ts
interface InventoryAgingBuckets {
  lt30: number;
  d30to60: number;
  d60to90: number;
  gt90: number;
}
```

---

## 4. DEAL PIPELINE

- **Stages (in order):** leads, appointments, workingDeals, pendingFunding, soldToday. All numeric; if data is not available, return zeros; typed shape is always present.
- **UI:** Full-width horizontal bar with arrows/chevrons between stages.
- **Data shape for `getDealPipeline(dealershipId)`:**

```ts
interface DealPipelineStages {
  leads: number;
  appointments: number;
  workingDeals: number;
  pendingFunding: number;
  soldToday: number;
}
```

---

## 5. TEAM ACTIVITY TODAY

- **Metrics:** callsLogged, appointmentsSet, notesAdded, callbacksScheduled, dealsStarted. May be zero initially; API shape must be wired for future implementation.
- **Data shape for `getTeamActivityToday(dealershipId)`:**

```ts
interface TeamActivityToday {
  callsLogged: number;
  appointmentsSet: number;
  notesAdded: number;
  callbacksScheduled: number;
  dealsStarted: number;
}
```

---

## 6. DATA LOADING PLAN

- **Server component:** The inventory page (or a parent dashboard wrapper) loads all initial data in parallel (e.g. `Promise.all`) and passes props to the page/client components:
  - `initialKpis`, `initialAging`, `initialAlerts`, `initialPipeline`, `initialTeam`.
- **Client components:** MUST NOT fetch-on-mount when `initialData` or these `initial*` props are provided. Use props as the source of truth for first render; refresh only on explicit user action (e.g. Refresh) or when no initial data was passed.
- **Server-first:** Aligns with DMS rule: no fetch-on-mount for initial page data when the server supplies it.

---

## 7. RBAC

- **inventory.read:** Required for inventory KPIs, list, Inventory Health, and Alerts. If the user lacks `inventory.read`, those sections are omitted or show zeros; the whole page must not return 403 (permission checks are per-section where applicable).
- **Pipeline:** Access requires `crm.read` OR `deals.read` (define which is authoritative, or both with fallback). If the user has neither, the pipeline section is omitted or shows zeros.
- **Team Activity:** Uses `customers.read` (or document that a future `dashboard.read` could be added to gate this section). If the user lacks the required permission, the section is omitted or shows zeros.
- **Principle:** If the user lacks permission for a section, that section is omitted or shows zeros; no 403 for the whole page.

---

## 8. ACCEPTANCE CRITERIA

- Layout matches mock: 4 KPI cards with trend chips (no meaningless progress bars), one Quick Actions card only, pipeline full width above table, Team Activity card present.
- No progress bars tied to unknown maxima (e.g. no arbitrary max for Total Units or Inventory Value).
- Server-first: no fetch-on-mount when initial data is provided via `initialKpis`, `initialAging`, `initialAlerts`, `initialPipeline`, `initialTeam`.
- RBAC: Sections respect `inventory.read`, `crm.read`/`deals.read`, and `customers.read` as above; missing permission results in section omitted or zeros, not whole-page 403.
- Data contracts: KPI, aging, pipeline, and team-activity shapes are as defined in §§2–5 and are TypeScript-friendly for service/API implementation.
