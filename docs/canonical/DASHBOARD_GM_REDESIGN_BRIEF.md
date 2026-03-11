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
- queue aging on `opsQueues`, so those queues can escalate based on stale backlog instead of raw count only
- real gross-profit fields on `metrics`, so the GM preset no longer relies on a finance-volume proxy
- `salesManager`, so the Sales preset can surface real manager-facing rep performance instead of only funnel proxies
- coaching-oriented Sales metrics on `salesManager`, so Sales can surface stale leads, overdue follow-up pressure, and same-day appointment activity without inventing unsupported conversion math

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

Preset selection is also persisted client-side per dealership and user:
- explicit `?preset=` links still win
- when no preset query is present, the dashboard restores the saved preset for that user in that dealership

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
- `salesManager`
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
- `metrics.frontGrossProfitCents`, `metrics.frontGrossProfitDelta7dCents`
- `metrics.backGrossProfitCents`, `metrics.backGrossProfitDelta7dCents`
- `metrics.opsTrend` plus derived unresolved blocker count from inventory, finance, and deal signals

### 2. Executive summary / question layer
Purpose: replace generic equal-weight cards with a decision-oriented summary.

Implemented summary lenses:
- Are we healthy today?
- Where is profit moving?
- What is blocked now?
- What needs attention next?

Implemented supporting profitability split:
- front gross
- back gross

Code-backed mapping:
- health: derived from inventory warning/danger rows, finance notices, and deal warning/danger rows
- profit direction: realized contracted-deal gross movement (`metrics.grossProfitDelta7dCents`)
- blockers: derived unresolved blocker count
- next attention: highest active queue from `customerTasks`, `dealPipeline`, and `appointments`
- front/back mix: realized front-end and back-end gross pulled separately from contracted deals and finance rows

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
- `opsQueues` in the Ops preset, including oldest-item age for title, delivery, and funding queues

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
- `salesManager` for top closer, top gross rep, average gross per deal, and ranked rep coverage in the Sales preset
- `salesManager.staleLeadCount`, `salesManager.oldestStaleLeadAgeDays`, `salesManager.overdueFollowUpCount`, `salesManager.appointmentsSetToday`, and `salesManager.callbacksScheduledToday` for Sales coaching pressure

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
- actor attribution where available
- severity styling by event type
- relative age plus absolute timestamp context

Code-backed mapping:
- `materialChanges`
- sourced from dealer-scoped `DealHistory`, `Vehicle` create/update timestamps, and `CustomerActivity`
- actor attribution comes from `DealHistory.changedByProfile` and `CustomerActivity.actor` where available

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

## Hardening Status
Focused dashboard hardening is now in place:
- preset restore and preset persistence behavior have targeted render coverage
- material change severity and actor attribution have targeted render and payload coverage
- ops queue oldest-age semantics have targeted payload coverage
- Sales manager metrics now come from the existing salesperson performance reporting service instead of client-only heuristics
- Sales coaching metrics now come from existing customer, task, and team-activity data paths instead of UI-only estimates

## Deferred / Not Yet Code-Backed
The dashboard does not pretend these exist when they do not:
- role-specific saved dashboard presets for GM, Sales, and Ops
- richer profitability depth beyond the current realized gross KPI, such as split front/back views and richer trend windows

The current material-change feed is intentionally practical, not exhaustive:
- it is dealer-scoped and permission-scoped
- it merges recent deal, inventory, and customer changes
- it adds actor context where the source model supports it
- it is not yet a full audit/event bus with deep audit semantics or cross-domain semantic dedupe

These remain future dashboard product work, not part of the current API contract.

## Responsive Strategy
Desktop is the flagship layout.

Responsive collapse strategy already reflected in the current structure:
- KPI rail collapses from five columns to stacked cards
- executive summary and exceptions stack vertically
- revenue, customer demand, and inventory command zones collapse into one-column order
- right-rail content becomes lower sections instead of sidebars
- ultra-wide screens use denser exception and agenda rows so more signals fit above the fold
- exception and agenda rails now support local collapse/expand controls for operator-driven compression

## Guardrails
- no dashboard API changes
- no RBAC changes
- no tenant-isolation changes
- no route contract changes
- current dashboard payload remains the source of truth
- unsupported widgets are documented as deferred rather than implied
