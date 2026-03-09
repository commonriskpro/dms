# Vehicle Costs Tab — Hybrid UI Spec

**Program:** Vehicle Costs Tab Hybrid UI Implementation  
**Step:** Architect (Step 1)  
**Goal:** Implement a first-class **Costs** tab on the vehicle detail page with the approved hybrid layout: light-mock structural clarity for header and document rail, dark-mock density and polish for summary cards, cost ledger workspace, and action bar.

---

## Current state

- Vehicle detail has **no tab system**. All cards render in a single scrollable column (left card stack) with a 280px right rail.
- `VehicleCostsAndDocumentsCard` is a single monolithic card (700 lines) buried deep in the card stack. It contains acquisition summary, cost totals, cost ledger table, documents list, and both modals (add/edit entry + upload document).
- Vehicle header uses `VehicleHeader` → `EntityHeader` → `PageHeader` with breadcrumbs, title (year/make/model), status badge, meta (Stock #, VIN), and an actions block (Edit, Upload Photos, Create Deal, intelligence badges).
- Right rail has ReconStatusCard, ActivityCard, VehicleDetailQuickActionsCard, and intelligence surfaces.
- Layout: `mainGrid` = `grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]`.

---

## 1. Locked page composition

### 1.1 Vehicle header

Keep the existing `VehicleHeader` → `EntityHeader` → `PageHeader` structure. Refine to match the hybrid direction:

- **Left:** Back arrow (← Back to inventory), vehicle thumbnail (first photo if available; placeholder if not), year/make/model as primary title, VIN below or beside it, status badge chip (e.g. "In Inventory").
- **Right:** Action bar: overflow (···), Print, Edit Vehicle. Signal badges remain if present.
- No redesign of the header component itself. Only adjust content passed to it in `VehicleDetailPage` if needed for thumbnail or VIN prominence.

### 1.2 Tab row

Add a **tab navigation row** below the vehicle header. Tabs:

| Tab | Content | Notes |
|-----|---------|-------|
| Overview | Existing cards: Overview, Pricing, Intelligence, Valuation, Pricing Automation, Marketing/Distribution, Details, Specs/VIN | Default tab; shows the current card stack minus Costs/Recon/Floorplan |
| Media | Placeholder or redirect to upload/gallery (existing "Upload Photos" link) | Minimal — can be a stub pointing to edit page |
| Pricing | Existing VehiclePricingCard, VehicleValuationsCard | |
| Recon | Existing VehicleReconCard | |
| **Costs** | New Costs tab layout (see §1.3) | Active in mock |
| History | Placeholder (ActivityCard content or stub) | |

Implementation: a simple client-side tab state in `VehicleDetailContent`. No URL-based routing for tabs — keep it lightweight. Tab row uses design tokens, no raw colors.

### 1.3 Costs tab layout

When **Costs** tab is active:

```
┌──────────────────────────────────────────────────────────────────┐
│  Top summary row                                                │
│  ┌──────────────────────────┐  ┌───────────────────────────────┐│
│  │  Acquisition Summary     │  │  Cost Totals                  ││
│  │  Purchase Price  Vendor  │  │  Acquisition  Recon  Fees     ││
│  │  Purchase Date  Location │  │        Total Invested         ││
│  └──────────────────────────┘  └───────────────────────────────┘│
├──────────────────────────────────────────────────────────────────┤
│  Main workspace row                                             │
│  ┌─────────────────────────────────┐  ┌────────────────────────┐│
│  │  Cost Ledger                    │  │  Documents             ││
│  │  + Add Cost   Filter  Search    │  │  Upload                ││
│  │  ┌──────────────────────────┐   │  │  ┌──────────────────┐  ││
│  │  │ Date  Category  Vendor  │   │  │  │ Bill of Sale.pdf │  ││
│  │  │ Amount  Memo  Docs  ··· │   │  │  │ Invoice.pdf      │  ││
│  │  │ ─────────────────────── │   │  │  │ Receipt.jpg      │  ││
│  │  │ (rows)                  │   │  │  └──────────────────┘  ││
│  │  └──────────────────────────┘   │  │                        ││
│  └─────────────────────────────────┘  └────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

- **Top summary row:** Two cards side by side. Split roughly 50/50 or flex to content.
- **Main workspace row:** Cost Ledger takes ~70% width; Documents rail takes ~30% (min ~280px). On mobile, stack vertically.
- **Notes block:** Out of scope for this sprint. Too much risk of clutter with no clear data source yet.

### 1.4 Right rail behavior

When the Costs tab is active, the existing 280px right rail from `VehicleDetailContent` is **not** rendered. The Costs tab has its own internal Documents rail (right side of the main workspace row). This gives the cost workspace full page width minus the documents rail.

On other tabs (Overview, Pricing, Recon, History), the existing right rail continues to render.

---

## 2. Layout proportions

### 2.1 Summary row

- Grid: `grid grid-cols-1 gap-3 md:grid-cols-2` — two cards, equal width, tight gap.
- Card padding: `p-4` (16px). No giant padding.
- Values: large and scannable (text-xl or text-2xl for amounts, text-sm for labels).

### 2.2 Main workspace row

- Grid: `grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]` — ledger takes remaining space; documents rail is 320px on lg+.
- On smaller screens, documents rail stacks below the ledger.
- Ledger card: `p-3` internal padding. Table cells tight.
- Documents rail: `p-3` internal padding. List items compact.

### 2.3 Spacing targets

- Section gap between summary row and workspace row: `gap-3` (12px).
- Internal card section spacing: `space-y-2` or `space-y-3`.
- Table row height: default table density (no extra padding).

---

## 3. Visual polish rules

1. **Dark-mock density:** Tight card padding (`p-3` to `p-4`), compact table rows, no extra breathing room between sections. Summary values are prominent but not oversized.
2. **Light-mock structure:** Clear card boundaries, readable section headings, distinct separation between summary row and workspace row.
3. **No airy spacing:** No `gap-6` or `gap-8` between sections within the Costs tab. Max gap between major sections: `gap-3`.
4. **No giant banners:** Acquisition Summary and Cost Totals are compact stat blocks, not hero cards.
5. **Compact but readable:** Table text is `text-sm`; labels are `text-xs` or `text-[11px]` uppercase; amounts are `text-sm font-medium tabular-nums`.
6. **Colors:** CSS vars only: `--surface`, `--surface-2`, `--border`, `--text`, `--muted-text`, `--text-soft`, `--accent`. No raw Tailwind palette.
7. **Card component:** Use `DMSCard`/`DMSCardHeader`/`DMSCardContent` from `@/components/ui/dms-card`.

---

## 4. Component mapping

### 4.1 Reuse as-is

| Component | Purpose |
|-----------|---------|
| `VehicleHeader` | Vehicle identity block (title, status, meta, actions) |
| `EntityHeader` / `PageHeader` | Internal header primitives |
| `DMSCard` / `DMSCardHeader` / etc. | Card primitives for all sections |
| `Table` / `TableHeader` / etc. | Cost ledger table |
| `Dialog` / `DialogContent` / etc. | Add/edit entry modal, upload document modal |
| `Button`, `Input`, `Select` | Form and action controls |
| `Skeleton`, `ErrorState` | Loading/error states |
| All existing cards (Overview, Pricing, Recon, etc.) | Non-Costs tabs |

### 4.2 Split from VehicleCostsAndDocumentsCard

The monolithic `VehicleCostsAndDocumentsCard` (700 lines) will be **decomposed** into:

| New component | Content from current card | Notes |
|---------------|--------------------------|-------|
| `CostsTabContent` | Container for the entire Costs tab; manages data fetching and state | Top-level wrapper; replaces the card when in Costs tab |
| `AcquisitionSummaryCard` | Acquisition summary section (lines ~352–385) | Standalone card for the summary row |
| `CostTotalsCard` | Cost totals section (lines ~387–416) | Standalone card for the summary row |
| `CostLedgerCard` | Cost ledger table + Add Cost action + modals (lines ~418–641) | Main workspace card; includes the add/edit entry dialog |
| `DocumentsRailCard` | Documents list + upload action + upload modal (lines ~508–697) | Right-side rail card; includes upload dialog |

Data fetching (`loadAll`, `fetchCost`, `fetchEntries`, `fetchDocuments`) stays in `CostsTabContent` and is passed down via props to avoid multiple fetch sources.

### 4.3 New components

| Component | Purpose |
|-----------|---------|
| `VehicleDetailTabs` | Tab navigation row below the vehicle header; client-side state; renders active tab content |

### 4.4 Wrap / refine

| Component | Change |
|-----------|--------|
| `VehicleDetailContent` | Add tab support; conditionally render card stack vs. Costs tab; hide right rail when Costs tab is active |
| `VehicleDetailPage` | Pass tab props to content; no other changes |

---

## 5. Files to touch

| File | Change |
|------|--------|
| `modules/inventory/ui/VehicleDetailContent.tsx` | Add tab state and `VehicleDetailTabs`; conditionally render Costs tab vs. card stack; hide right rail on Costs tab |
| `modules/inventory/ui/components/VehicleCostsAndDocumentsCard.tsx` | Keep as-is for now (still rendered when Costs tab is NOT active — actually remove from card stack; only used via Costs tab) |
| `modules/inventory/ui/components/CostsTabContent.tsx` | **New.** Costs tab wrapper: data fetching, state, renders AcquisitionSummaryCard + CostTotalsCard + CostLedgerCard + DocumentsRailCard |
| `modules/inventory/ui/components/AcquisitionSummaryCard.tsx` | **New.** Acquisition summary as a standalone card |
| `modules/inventory/ui/components/CostTotalsCard.tsx` | **New.** Cost totals as a standalone card |
| `modules/inventory/ui/components/CostLedgerCard.tsx` | **New.** Cost ledger table + actions + add/edit modal as a standalone card |
| `modules/inventory/ui/components/DocumentsRailCard.tsx` | **New.** Documents list + upload action + upload modal as a standalone card |
| `modules/inventory/ui/components/VehicleDetailTabs.tsx` | **New.** Tab navigation row component |
| `modules/inventory/ui/types.ts` | No changes expected |
| `lib/ui/recipes/layout.ts` | Add `costsTabSummaryGrid` and `costsTabWorkspaceGrid` layout recipes |

---

## 6. Slice plan with acceptance criteria

### SLICE A — Hybrid costs-tab UI spec

- **Deliverable:** This spec approved.
- **Acceptance:** Spec defines tab system, Costs tab layout, component decomposition, file plan, and visual polish rules.

### SLICE B — Vehicle header + tabs alignment

- **Scope:** Add `VehicleDetailTabs` component; add tab state to `VehicleDetailContent`; render tab row below the header; conditionally show card stack (Overview tab) vs. Costs tab content; hide right rail on Costs tab.
- **Acceptance:** Tab row renders with Overview, Media, Pricing, Recon, Costs, History. Clicking a tab shows the correct content. Vehicle header unchanged except for any minor refinements for hybrid consistency. No regression on existing card stack behavior when Overview is active. Costs tab shows placeholder (to be replaced by SLICE C–E).
- **Files:** `VehicleDetailContent.tsx`, `VehicleDetailTabs.tsx` (new), `layout.ts`.

### SLICE C — Summary row refinement

- **Scope:** Create `AcquisitionSummaryCard` and `CostTotalsCard`; render them in the Costs tab top summary row. Tight density, dark-mock polish. Values scannable, labels compact.
- **Acceptance:** Summary row shows Acquisition Summary (vendor, purchase price, purchase date, total invested) and Cost Totals (acquisition, recon, fees, total invested) side by side. No airy spacing. Compact card padding. Works on mobile (stacked).
- **Files:** `AcquisitionSummaryCard.tsx` (new), `CostTotalsCard.tsx` (new), `CostsTabContent.tsx` (new, partial — fetching + summary row).

### SLICE D — Cost ledger workspace refinement

- **Scope:** Create `CostLedgerCard` with the cost entries table, Add Cost button, and add/edit entry dialog. Tighten spacing and density. Match dark-mock table feel.
- **Acceptance:** Ledger table renders with date, category, vendor, amount, memo, docs, actions. Add/Edit/Remove entries work. Table is compact with tight padding. Action bar (Add Cost) is clear but not oversized.
- **Files:** `CostLedgerCard.tsx` (new), `CostsTabContent.tsx` (extended — workspace row + ledger).

### SLICE E — Documents rail refinement

- **Scope:** Create `DocumentsRailCard` with documents list, upload button, and upload dialog. Right-side rail, compact, readable.
- **Acceptance:** Documents rail renders in the right side of the workspace row. Upload button is prominent but not oversized. Document items show filename, kind, linked entry, date, View/Remove. Upload dialog works. Rail is 320px on lg+, full width on small screens.
- **Files:** `DocumentsRailCard.tsx` (new), `CostsTabContent.tsx` (complete — adds documents rail to workspace row).

### SLICE F — Tests, docs, hardening

- **Scope:** Focused tests for the new tab navigation and Costs tab components. Responsive sanity. Dark/light sanity. Final report.
- **Acceptance:** Tests pass; docs and reports complete; no regressions on existing vehicle detail behavior.
- **Files:** Tests for new components; `VEHICLE_COSTS_TAB_HYBRID_UI_REPORT.md`, security/perf/final reports.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Accidental redesign of full vehicle page | Tab system is additive; existing cards remain; tab defaults to Overview which shows the current card stack |
| Too much whitespace | Spacing targets locked: max gap-3 between sections; p-3 to p-4 card padding; no gap-6 anywhere in Costs tab |
| Documents rail too weak or too dominant | Fixed at 320px on lg+; own card with clear header and upload action; not wider than cost ledger |
| Ledger workspace losing density | Table uses default shadcn/ui table density; no extra padding on cells; text-sm throughout |
| Notes clutter | Notes block explicitly out of scope; can be added later without disrupting the layout |
| Table density drift | Lock table to current `Table` component density; no custom row heights or extra padding |
| Tab system adding page-load weight | Tabs are client-side state only; no new data fetching; lazy content rendering per tab |

---

## Design lock

- **Light mock structure:** Vehicle header identity block, clear card boundaries, distinct section separation.
- **Dark mock density:** Tight padding, compact tables, prominent but not oversized values, dark-surface card feel.
- Tab system is a lightweight client-side addition. No URL routing for tabs.
- Costs tab owns its own layout (summary row + workspace row with documents rail). No right rail from the main page when Costs tab is active.

No app code in Step 1.
