# Dashboard VFinal Implementation Spec

## 0) Scope and constraints

This Step 1 spec defines the final dashboard layout pass only (no backend redesign) and locks composition to the approved Dealer OS mock hierarchy.

Non-negotiables for implementation:

- preserve existing routes, APIs, RBAC, tenancy, and modal behavior
- reuse existing `ui-system` primitives (`PageShell`, `PageHeader`, `Widget`, `MetricCard`, `AlertCard`, `InsightCard`, `TableLayout`, `StatusBadge`, signals/timeline primitives)
- adapter-first data shaping only
- dark theme visual lock first; light theme parity second
- no alternate layout compositions

Desktop composition lock (fixed, non-negotiable):

- **Row 1:** 5 KPI cards, equal visual height
- **Row 2:** left `8/12` = Quick Actions + inventory intelligence table block; right `4/12` = Deal Pipeline
- **Row 3:** left `5/12` = inventory summary cards; center `4/12` = Messaging above Acquisition; right `3/12` = Activity above Tasks

Mock image reference (visual target for hierarchy/spacing/density):

- `assets/ChatGPT_Image_Mar_7__2026__10_46_49_PM-e4adc014-fa6b-4b5a-a520-5ee25958d7fc.png`

Reference note:

- `apps/dealer/docs/DASHBOARD_SIGNAL_MAP.md` was not found in repository; current implemented dashboard + signal engine specs are used as source of truth for signal mapping.

---

## 1) Exact final dashboard structure

Top-to-bottom structure must be:

1. **Top command/header zone**
   - existing app shell top command bar (already global)
   - dashboard page header (`PageHeader`) with title + customize action
2. **KPI row**
   - 5 cards target on desktop
   - equal visual height across all five KPI cards
   - metric hierarchy consistent with mock
   - KPI 5 is fixed as **Health / Operations Score**
   - KPI 5 source: derived summary of unresolved operations + intelligence signals
   - KPI 5 visual role: rightmost hero KPI card
3. **Main split (hero row)**
   - left: Quick Actions + inventory intelligence/table-style workbench block (dominant)
   - right: deal pipeline block
4. **Lower content row**
   - lower-left: inventory intelligence summary
   - center stack: messaging + acquisition
   - right stack: activity + tasks
5. **Optional right-context behavior**
   - preserve context behavior as stack/rail semantics at xl+ only if needed; no alternate composition

---

## 2) Exact 12-column hierarchy (desktop/tablet/mobile)

## Desktop (xl and above, 12 columns)

- **Row 1 (KPI)**  
  fixed five-track row with equal-height KPI cards (no alternate composition).  
  - Practical implementation: dedicated 5-column desktop KPI wrapper to force strict 5-across rhythm.
  - KPI 5 remains the rightmost Health / Operations Score card.

- **Row 2 (Main split)**  
  - left Quick Actions + inventory intelligence table workbench: `col-span-8`
  - right pipeline hero: `col-span-4`

- **Row 3 (Lower composition)**  
  - lower-left inventory summary: `col-span-5`
  - center stack (messaging + acquisition): `col-span-4`
  - right stack (activity + tasks): `col-span-3`

## Tablet (md/lg)

- KPI row collapses to `2 x 2 + 1` or `3 + 2` depending viewport width; preserve ordering.
- Main split collapses to `col-span-12` stacked (left first, right second).
- Lower row collapses to two columns:
  - inventory summary full-width first
  - center + right stacks as balanced second row

## Mobile (sm and below)

- strict single column stack
- order locked:
  1) KPI cards
  2) main-left intelligence
  3) main-right pipeline
  4) lower-left inventory summary
  5) center messaging
  6) center acquisition
  7) right activity
  8) right tasks

No content reordering by theme; layout order remains identical in dark and light.

---

## 3) Visual lock rules (pixel-intent)

Dashboard VFinal must lock to these visual targets:

- **proportions:** row-2 left block visibly dominant over pipeline block
- **row-2 identity:** left block is a table-like operational workbench, not a generic widget stack
- **spacing rhythm:** page padding and inter-card gaps follow token rhythm (`--space-page-*`, `--space-grid`, widget paddings)
- **interior padding:** widget internals remain tokenized (`Widget` contract); no ad hoc card padding variants
- **border/shadow density:** tokenized border + `--shadow-card` only; avoid extra glow layers
- **title hierarchy:** page title > section title > widget title > row text
- **button sizing:** consistent with current tokenized button heights and radii
- **status/severity language:** shared `StatusBadge`/signal severity tokens only
- **dark mode lock:** primary reference for contrast and depth
- **light parity:** same structure/proportions/order; palette only shifts via theme tokens

---

## 4) Widget mapping to final layout

## KPI row (5 surfaces)

1. Inventory KPI -> `MetricCard` (`metrics-inventory`)
2. Active Deals KPI -> `MetricCard` (`metrics-deals`)
3. Leads KPI -> `MetricCard` (`metrics-leads`)
4. Gross/BHPH KPI surface -> existing `metrics-bhph` now visualized as lender/finance health KPI (label refinement in UI only)
5. Health / Operations Score card -> composed from unresolved operations + intelligence signals summary using `MetricCard`/`InsightCard` wrapper, no backend contract change

## Main split left (inventory intelligence/table block)

- required section title: **Quick Actions**
- required structure:
  - toolbar/search/filter row
  - table-like operational inventory list
  - row density + badge treatment aligned to mock
- primary component source: existing dashboard surfaces wrapped/adapted in `Widget`/table primitives
- this is the dominant dashboard workbench and must not collapse into a generic widget list

## Main split right (deal pipeline block)

- primary source: `DealPipelineCard` + signal list
- preserve real deal signal data
- apply compact stage-card visual density (presentation-only refinements)

## Lower-left block

- inventory summary/intelligence continuation
- must read as a **single visual zone** containing a **2x2-feel cluster** of summary cards
- source: inventory signal-derived summaries from existing intelligence adapter path

## Center stack

- exactly two stacked panels:
  1. Messaging
  2. Acquisition

## Right stack

- exactly two stacked panels:
  1. Activity
  2. Tasks

---

## 5) Real data mapping (reuse/adapt/wrap)

| Final block | Current source | Action |
|---|---|---|
| KPI row | `getDashboardV3Data().metrics` + layout widget IDs | **Reuse** with visual refinement and 5-card track lock |
| Inventory hero | `InventoryAlertsCard` + `GET /api/intelligence/signals?domain=inventory` | **Adapt** layout density only |
| Deal pipeline hero | `DealPipelineCard` + `...domain=deals` | **Adapt** layout/density only |
| Operations queue/health | `FinanceNoticesCard` + `...domain=operations` | **Wrap/Adapt** into target slot |
| Customer tasks | `CustomerTasksCard` + `...domain=crm` | **Reuse** with placement change |
| Messaging | `UpcomingAppointmentsCard` (+ CRM surfaces) | **Adapt** placement/heading only |
| Acquisition | intelligence `acquisition` domain (signal adapter path) | **Wrap** in `InsightCard`/`SignalSummaryPanel` |
| Actions/activity | `RecommendedActionsCard`, `QuickActionsCard` | **Reuse/Adapt** to right-stack semantics |

Rules:

- all data remains real from existing services/routes
- visual recomposition happens at dashboard presenter layer only
- no new ad hoc design system primitives

---

## 6) Exact file plan (Step 2 implementation)

## Must update

- `apps/dealer/components/dashboard-v3/DashboardExecutiveClient.tsx`  
  Final 12-col composition, explicit row sections, responsive collapse behavior.
- `apps/dealer/components/dashboard-v3/MetricCard.tsx`  
  KPI density/typography alignment (tabular, hierarchy, optional mini-trend slot).
- `apps/dealer/components/dashboard-v3/InventoryAlertsCard.tsx`  
  Hero/table-like density alignment for row-2 left and lower-left usage.
- `apps/dealer/components/dashboard-v3/DealPipelineCard.tsx`  
  Pipeline density and stage grouping feel.
- `apps/dealer/components/dashboard-v3/FinanceNoticesCard.tsx`  
  Positioning and semantics for health/ops summary slot.
- `apps/dealer/components/dashboard-v3/RecommendedActionsCard.tsx`
- `apps/dealer/components/dashboard-v3/UpcomingAppointmentsCard.tsx`
- `apps/dealer/components/dashboard-v3/CustomerTasksCard.tsx`
- `apps/dealer/components/dashboard-v3/QuickActionsCard.tsx`
- `apps/dealer/components/dashboard-v3/FloorplanLendingCard.tsx`

## Optional add (only if required for clean composition)

- `apps/dealer/components/dashboard-v3/DashboardVFinalLayout.tsx`  
  Pure presentational layout wrapper to keep `DashboardExecutiveClient` readable.
- `apps/dealer/components/dashboard-v3/dashboard-vfinal-adapters.ts`  
  Thin presenter adapters for block-level mapping only.

## Docs/tests updates in later steps

- `apps/dealer/docs/UI_SYSTEM_USAGE.md`
- `apps/dealer/docs/DASHBOARD_VFINAL_REPORT.md`
- step 3/4/5 report docs per prompt
- focused dashboard tests/snapshots under dashboard-v3 and dashboard page tests

---

## 7) Deferred items (not forced this sprint)

- New backend KPI computations for true gross-profit metric if not already available.
- New messaging domain APIs beyond current CRM/appointments/task sources.
- Deep rewrite of dashboard layout persistence schema (`topRow/main` constraints remain).
- New kanban engine for pipeline if current signal/list representation already satisfies behavior.
- Any non-dashboard cross-page redesign.

---

## 8) Slice plan and acceptance criteria (Step 2 execution)

## SLICE A — final dashboard layout spec

- deliver this spec
- acceptance:
  - exact hierarchy documented
  - exact 12-col spans + responsive collapse defined
  - mapping + file plan explicit

## SLICE B — KPI row refinement

- enforce 5-card visual rhythm on desktop
- lock value hierarchy, tabular numerals, spacing
- acceptance:
  - KPI row matches mock density/proportion intent
  - no bespoke KPI component family introduced

## SLICE C — main split implementation

- row-2 left hero (inventory intelligence/table feel) + right pipeline hero
- acceptance:
  - left visibly dominant, right compact but legible
  - real data preserved; no business logic rewrite

## SLICE D — lower content grid implementation

- row-3 lower-left inventory summary, center messaging+acquisition, right activity+tasks
- acceptance:
  - stacking/order matches mock structure
  - concise operational card density maintained

## SLICE E — dark theme visual lock

- tune only token-based contrast, spacing, borders, shadow, type hierarchy
- acceptance:
  - dark dashboard feels matched to approved mock
  - no raw color classes on feature page composition

## SLICE F — light theme parity

- same layout/proportions/order as dark
- acceptance:
  - only theme changes; no structural divergence
  - spacing and card hierarchy unchanged

## SLICE G — hardening/tests/docs

- focused dashboard tests + snapshots as needed
- responsive sanity and state sanity (loading/empty/error)
- docs/report completion
- acceptance:
  - targeted tests pass
  - unrelated failures documented separately
  - final docs reflect actual implemented layout

---

## 9) Regression risks and mitigations

1. **Layout persistence conflict with VFinal composition**  
   Mitigation: keep `topRow/main` compatibility; VFinal composes within those zones without schema change.

2. **Permission-based card count breaks KPI rhythm**  
   Mitigation: 5-track visual wrapper with fallback health card occupies missing metric slot.

3. **Signal over-fetch/churn in dense layout**  
   Mitigation: preserve existing refresh flow and adapter limits; avoid additional mount-fetch loops.

4. **Dark/light divergence**  
   Mitigation: token-only style lock; no theme-conditional layout branching.

5. **Snapshot churn noise**  
   Mitigation: targeted snapshot updates only for intentional VFinal composition changes.

---

## 10) Definition of done (for full sprint)

- VFinal dashboard composition matches approved mock hierarchy and density intent.
- KPI row, main split, and lower grid implemented with locked structure.
- dark visual lock and light parity complete.
- performance/security/final docs delivered.
- targeted dashboard tests pass (or unrelated failures documented).
