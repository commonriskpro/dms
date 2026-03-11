# Dashboard GM Redesign Brief

Status: Implemented as the active dealer dashboard direction on the shared route, with GM, Sales, and Ops presets on the same live payload.

## Goal
Promote the dealer dashboard from a flat card grid into a GM / Owner command view that answers four questions first:
- Are we healthy today?
- Where is profit or risk moving?
- What is blocked right now?
- What needs executive attention next?

This redesign started as a pure re-composition of the existing V3 payload. It now includes additive contract extensions for:
- `opsQueues`, so the Ops preset can surface title, delivery, and funding queue depth directly
- real gross-profit fields on `metrics`, so the GM preset no longer relies on a finance-volume proxy

## Implemented UI Entry
- Dashboard route: `/Users/saturno/Downloads/dms/apps/dealer/app/(app)/dashboard/page.tsx`
- Active dashboard client: `/Users/saturno/Downloads/dms/apps/dealer/components/dashboard-v3/DashboardExecutiveClient.tsx`
- Preset metadata: `/Users/saturno/Downloads/dms/apps/dealer/components/dashboard-v3/dashboardExecutivePresets.ts`
- Preset derivation helpers: `/Users/saturno/Downloads/dms/apps/dealer/components/dashboard-v3/dashboardExecutiveLogic.ts`
- Existing server payload source remains: `/Users/saturno/Downloads/dms/apps/dealer/modules/dashboard/service/getDashboardV3Data.ts`

## Implemented Presets
The dashboard now ships as one route with three live presets:
- `GM` (default): executive health, blockers, revenue, and accountability
- `Sales`: demand-first weighting for lead flow, appointments, follow-up pressure, and active deal movement
- `Ops`: blocker-first weighting for finance notices, inventory readiness, desk throughput, and queue clearance

Preset switching is query-param based on the same route:
- GM: `/dashboard`
- Sales: `/dashboard?preset=sales`
- Ops: `/dashboard?preset=ops`

## Current Source-of-Truth Payload
The dashboard stays inside the current `DashboardV3Data` contract from `/Users/saturno/Downloads/dms/apps/dealer/components/dashboard-v3/types.ts`.

Live payload sections used:
- `metrics`
- `inventoryAlerts`
- `dealPipeline`
- `dealStageCounts`
- `appointments`
- `financeNotices`
- `floorplan`
- `customerTasks`
- `opsQueues`
- `materialChanges`
- `dashboardGeneratedAt`

## GM Layout Map
### 1. Hero KPI rail
Purpose: immediate health and throughput scan.

Widgets in the current dashboard:
- Inventory
- Active Deals
- New Leads
- Gross Profit
- Ops Score

Code-backed mapping:
- `metrics.inventoryCount`, `metrics.inventoryDelta7d`, `metrics.inventoryTrend`
- `metrics.dealsCount`, `metrics.dealsDelta7d`, `metrics.dealsTrend`
- `metrics.leadsCount`, `metrics.leadsDelta7d`, `metrics.leadsTrend`
- `metrics.grossProfitCents`, `metrics.grossProfitDelta7dCents`, `metrics.grossProfitTrend`
- `metrics.opsTrend` plus derived unresolved blocker count from inventory, finance, and deal signals

### 2. Executive summary / question layer
Purpose: replace generic equal-weight cards with a decision-oriented summary.

Implemented summary lenses:
- Are we healthy today?
- Where is profit moving?
- What is blocked now?
- What needs attention next?

Code-backed mapping:
- health: derived from inventory warning/danger rows, finance notices, and deal warning/danger rows
- profit direction: realized contracted-deal gross movement (`metrics.grossProfitDelta7dCents`)
- blockers: derived unresolved blocker count
- next attention: highest active queue from `customerTasks`, `dealPipeline`, and `appointments`

### 3. Executive exceptions panel
Purpose: show blocker queues before routine widgets.

Implemented content:
- finance notices
- inventory blocker rows with counts
- severe deal-pipeline rows

Code-backed mapping:
- `financeNotices`
- `inventoryAlerts`
- `dealPipeline`
- `opsQueues` in the Ops preset

### 4. Revenue + pipeline panel
Purpose: show stage pressure and revenue flow.

Implemented content:
- deal stage pills
- top deal-pipeline queue rows

Code-backed mapping:
- `dealStageCounts`
- `dealPipeline`

### 5. Customer demand panel
Purpose: surface demand-side flow instead of burying it in side cards.

Implemented content:
- upcoming appointments list
- follow-up pressure list

Code-backed mapping:
- `appointments`
- `customerTasks`

### 6. Inventory command view
Purpose: keep the live inventory workbench as the main operational command panel.

Implemented content:
- inventory workbench card
- inventory signal list
- acquisition insights

Code-backed mapping:
- workbench and signals: current dashboard / inventory surfaces already used by V3
- inventory alerts: `inventoryAlerts`
- acquisition insights: existing async domain signal fetch already used in the current dashboard client

### 7. Activity / accountability rail
Purpose: make owner-level next actions explicit.

Implemented content:
- combined owner agenda from customer tasks, appointments, and deal pipeline
- explicit coverage panel showing what is code-backed vs deferred

Code-backed mapping:
- `customerTasks`
- `appointments`
- `dealPipeline`
- `opsQueues` for title, delivery, and funding queue depth in the Ops preset

### 8. Recent material changes
Purpose: keep dealer-wide change visibility on the dashboard without sending users into detail pages just to learn what moved recently.

Implemented content:
- recent deal status transitions
- recent inventory create/update events
- recent customer activity

Code-backed mapping:
- `materialChanges`
- sourced from dealer-scoped `DealHistory`, `Vehicle` create/update timestamps, and `CustomerActivity`

## What Changed Visually
The new dashboard intentionally changes hierarchy, not backend semantics.

Key shifts:
- fewer same-weight blocks at the top
- a large executive summary panel instead of only a KPI strip plus utility cards
- a dedicated exceptions panel on the right
- revenue and demand each get their own clear domain zone
- inventory remains a large command surface instead of being collapsed into small widgets
- owner agenda is separated from general activity noise

## Shared Preset Framework Notes
The dashboard is now a shared framework with:
- shared shell and visual language
- shared KPI-card system
- shared summary-lens pattern
- shared exception and agenda rails
- role-specific ordering and emphasis only

This keeps one payload and one route while allowing role-sensitive composition.

## Deferred / Not Yet Code-Backed
The dashboard does not pretend these exist when they do not:
- salesperson ranking / rep scorecards
- role-specific saved dashboard presets for GM, Sales, and Ops
- richer profitability depth beyond the current realized gross KPI, such as split front/back views and richer trend windows

The current material-change feed is intentionally practical, not exhaustive:
- it is dealer-scoped and permission-scoped
- it merges recent deal, inventory, and customer changes
- it is not yet a full audit/event bus with deep actor metadata or cross-domain semantic dedupe

These remain future dashboard product work, not part of the current API contract.

## Responsive Strategy
Desktop is the flagship layout.

Responsive collapse strategy already reflected in the current structure:
- KPI rail collapses from five columns to stacked cards
- executive summary and exceptions stack vertically
- revenue, customer demand, and inventory command zones collapse into one-column order
- right-rail content becomes lower sections instead of sidebars

## Guardrails
- no dashboard API changes
- no RBAC changes
- no tenant-isolation changes
- no route contract changes
- current dashboard payload remains the source of truth
- unsupported widgets are documented as deferred rather than implied
