# UI Foundation Implementation Spec

Version: v1  
Status: Step 1 Architect Output (Sprint Scope)  
Owner: Dealer App UI Foundation  
Last Updated: 2026-03-07

---

## 1) Objective

Implement the approved Dealer OS UI language across shared foundations and core pages without changing backend behavior, RBAC semantics, tenant isolation, routes, or API contracts.

This sprint is presentation-standardization first:

- build a canonical `PageShell` system and page composition primitives
- rebuild sidebar + top command bar using route-safe, RBAC-safe navigation
- standardize widgets, tables, queues, entity headers, and detail workspace framing
- add stable light/dark mode via shared tokens
- migrate core pages to new shared primitives
- leave business logic in existing module presenters/services

---

## 2) Authoritative Inputs and Current-State Findings

### Authoritative docs used

- `apps/dealer/docs/UI_SYSTEM_ARCHITECTURE_V1.md`
- `apps/dealer/docs/UI_VISUAL_SYSTEM_V1.md`
- `apps/dealer/docs/UI_COMPONENT_LIBRARY_SPEC.md`
- `apps/dealer/docs/UI_NAVIGATION_ARCHITECTURE.md`
- `apps/dealer/docs/UI_PAGE_LAYOUT_STANDARD.md`
- `apps/dealer/docs/UI_PAGE_BLUEPRINTS.md`
- `apps/dealer/docs/UI_COMPONENT_INVENTORY.md`
- `apps/dealer/docs/UI_PATTERNS.md`
- `apps/dealer/docs/UI_MODAL_ARCHITECTURE.md`
- `apps/dealer/docs/UI_WORKFLOW_MAP.md`
- `apps/dealer/docs/UI_RECONSTRUCTION_ROADMAP.md`

### Current implementation observations (repo-verified)

- App shell is currently `apps/dealer/components/app-shell/*` with custom `Sidebar` + `Topbar`.
- A basic `PageShell` exists at `apps/dealer/components/ui/page-shell.tsx` but does not cover full required system (`FilterBar`, `ContextRail`, table/queue/layout families).
- Shared UI system folder `apps/dealer/components/ui-system` does not exist yet.
- Theme variables currently live in `apps/dealer/app/globals.css` (light-oriented); no dedicated `styles/theme.css` and no global user-controlled dark mode system yet.
- Dashboard V3 exists and already uses reusable cards (`components/dashboard-v3/*`) but not yet aligned to target shared `ui-system/widgets` contract.
- Tables/queues are duplicated across modules (`inventory`, `deals`, `customers`, `crm jobs`) with repeated table scaffolding.
- Detail pages (`deals/[id]`, `inventory/[id]`, `customers/[id]`) are large, module-owned presenters with inconsistent top/header framing.
- Intercepting modal routes are active under `app/(app)/@modal` and must remain compatible.

---

## 3) Shared Component Tree to Build

All shared components below must live under `apps/dealer/components/ui-system/`.

```text
ui-system/
  index.ts
  types.ts
  layout/
    PageShell.tsx
    PageHeader.tsx
    FilterBar.tsx
    ContextRail.tsx
    index.ts
  navigation/
    AppSidebar.tsx
    SidebarItem.tsx
    SidebarGroupLabel.tsx
    TopCommandBar.tsx
    navigation.config.ts
    index.ts
  widgets/
    Widget.tsx
    MetricCard.tsx
    AlertCard.tsx
    InsightCard.tsx
    index.ts
  tables/
    TableLayout.tsx
    TableToolbar.tsx
    ColumnHeader.tsx
    RowActions.tsx
    StatusBadge.tsx
    index.ts
  queues/
    QueueLayout.tsx
    QueueKpiStrip.tsx
    QueueTable.tsx
    index.ts
  entities/
    EntityHeader.tsx
    CustomerHeader.tsx
    VehicleHeader.tsx
    DealWorkspaceShell.tsx
    index.ts
  timeline/
    ActivityTimeline.tsx
    TimelineItem.tsx
    index.ts
  feedback/
    EmptyStatePanel.tsx
    ErrorStatePanel.tsx
    LoadingSkeletonSet.tsx
    index.ts
  forms/
    FormSectionCard.tsx
    FormErrorSummary.tsx
    InlineFieldHelp.tsx
    index.ts
```

Notes:

- Shared components are typed, theme-safe, and presentation-only.
- Module-specific logic stays in `apps/dealer/modules/*/ui`.
- Existing legacy shared UI (`components/ui/page-shell.tsx`, `components/ui/status-badge.tsx`) is migrated to wrappers or replaced by `ui-system` exports during rollout to avoid big-bang breakage.

---

## 4) Exact File Plan

## New foundation files

- `apps/dealer/styles/theme.css`
- `apps/dealer/components/ui-system/**` (tree above)
- `apps/dealer/lib/ui/theme/*` (theme provider + persistence helpers)
- `apps/dealer/lib/ui/navigation/*` (typed nav contracts if separated from component folder)

## Core updates

- `apps/dealer/app/layout.tsx` (ensure theme bootstrapping/provider hookup)
- `apps/dealer/app/globals.css` (token sourcing handoff to `styles/theme.css`)
- `apps/dealer/app/(app)/layout.tsx` (switch from legacy `AppShell` wiring to new `PageShell` host layout while preserving providers/modal slot)
- `apps/dealer/components/app-shell/*` (deprecate/migrate usage; keep compatibility adapters during transition)
- `apps/dealer/lib/ui/tokens.ts` (semantic token API aligned to docs)
- `apps/dealer/lib/ui/recipes/*` (reuse or adapt as implementation detail for ui-system)

## Page migrations in sprint

- `apps/dealer/app/(app)/dashboard/page.tsx` + `apps/dealer/components/dashboard-v3/*`
- `apps/dealer/app/(app)/inventory/page.tsx` + `apps/dealer/modules/inventory/ui/*` (list + key card/table usage)
- `apps/dealer/app/(app)/deals/page.tsx` + `apps/dealer/modules/deals/ui/*` (list)
- `apps/dealer/app/(app)/customers/page.tsx` + `apps/dealer/modules/customers/ui/*` (list)
- `apps/dealer/app/(app)/deals/delivery/page.tsx`
- `apps/dealer/app/(app)/deals/funding/page.tsx`
- `apps/dealer/app/(app)/deals/title/page.tsx`
- `apps/dealer/app/(app)/crm/jobs/page.tsx` (if low-risk under queue system)
- `apps/dealer/app/(app)/deals/[id]/page.tsx`
- `apps/dealer/app/(app)/inventory/vehicle/[id]/page.tsx`
- `apps/dealer/app/(app)/customers/profile/[id]/page.tsx` (shell/header framing first; deep body untouched)

## Documentation/test updates in sprint

- `apps/dealer/docs/UI_FOUNDATION_IMPLEMENTATION_SPEC.md` (this file)
- `apps/dealer/docs/UI_FOUNDATION_PERF_NOTES.md`
- `apps/dealer/docs/UI_FOUNDATION_SECURITY_QA.md`
- `apps/dealer/docs/UI_FOUNDATION_FINAL_REPORT.md`
- targeted test files under affected feature paths

---

## 5) Token and Theming Approach

## Source of truth

- CSS variables in `apps/dealer/styles/theme.css` for light and dark themes.
- `apps/dealer/lib/ui/tokens.ts` exports semantic class recipes and constants only (no page-specific hardcoded values).

## Theme model

- Use class-based theme strategy (`html` or `body` class, e.g. `light` / `dark`).
- Persist user preference in `localStorage`.
- Resolve initial theme with:
  1. stored preference if present
  2. OS preference fallback
  3. default light
- Theme toggle lives in `TopCommandBar`.

## Required semantic token groups

- surfaces: page/card/sidebar/topbar/rail/muted
- text: primary/secondary/muted/inverse
- borders/dividers
- accent + focus ring
- status semantic set: success/warning/error/info/neutral
- spacing/radius/shadow/transition scales

## Enforcement

- No raw Tailwind palette classes in feature pages.
- No hex literals in module page presenters.
- Shared primitives consume only semantic tokens.

---

## 6) Sidebar + Top Command Bar Structure

Navigation must match `UI_NAVIGATION_ARCHITECTURE.md` and existing route reality.

## Sidebar groups

- Dashboard
- Inventory
- CRM
- Deals
- Operations
- Finance
- Reports
- Admin

## Route-safety constraints

- Only render links for implemented routes.
- Embedded workflows (recon/photos/floorplan/DMV) link to valid entry routes as documented.
- Keep platform-admin links behind platform admin checks.

## RBAC visibility

- Gate groups/items by existing permissions from session context.
- Preserve current permission behavior (no widening).
- If user lacks group permission, hide item (do not render disabled fake links).

## Top command bar

- global search/command entry
- quick-create menu (vehicle/customer/deal/opportunity flow-safe fallback)
- notifications shortcut
- theme toggle
- user/account menu + sign out

---

## 7) Standardization Plan by UI Family

## Page shell/layout

- Adopt `ui-system/layout/PageShell` as mandatory wrapper for authenticated major pages.
- `PageHeader` used on all major list/queue/detail/dashboard pages.
- `FilterBar` used for list and queue surfaces.
- `ContextRail` optional on dashboard/detail/high-density list pages.

## Dashboard widgets

- Base everything on `widgets/Widget` + specialized cards (`MetricCard`, `AlertCard`, `InsightCard`).
- Preserve existing data wiring from `getDashboardV3Data` and related services.
- Ensure widget states: loading/empty/error/default.

Target dashboard content mapping (existing capabilities):

- inventory intelligence + alerts
- price-to-market/aging/recon/title indicators
- messaging/inbox preview
- CRM tasks/activities
- acquisition insights
- deals pipeline snapshot
- funding/title queue summaries

## Table system

- `tables/TableLayout` wraps list pages.
- `TableToolbar` standard controls (search/filter/view/export slots).
- `ColumnHeader`, `RowActions`, `StatusBadge` shared across list domains.
- Migrate inventory list, deals list, customers/opportunities list first.

## Queue system

- `queues/QueueLayout` + `QueueKpiStrip` + `QueueTable`.
- Apply to delivery, funding, title, then CRM jobs if straightforward.
- Keep queue actions and API behavior unchanged.

## Detail/workspace headers

- Introduce `entities/EntityHeader` and typed variants (`CustomerHeader`, `VehicleHeader`).
- Add `DealWorkspaceShell` for predictable section framing without rewriting existing deal logic.

## Feedback/timeline/forms

- unify empty/error/loading components across widgets/tables/queues/detail blocks
- `ActivityTimeline` + `TimelineItem` used where existing activity data is already present
- `FormSectionCard`, `FormErrorSummary`, `InlineFieldHelp` for multi-section forms

---

## 8) Page Migration Order (Sprint)

Order prioritizes maximum consistency gain with lowest backend/regression risk.

1. Global foundation wiring (`theme`, `tokens`, `PageShell host`, navigation shell)
2. Dashboard (already centralized and high-visibility)
3. Inventory list (table-heavy reference implementation)
4. Deals list
5. Customers list
6. Queues: delivery -> funding -> title -> CRM jobs
7. Detail headers/workspaces: deals/[id] -> inventory/[id] -> customers/[id] (header/shell-first)

---

## 9) In-Sprint vs Deferred

## In-sprint migration scope

- New `ui-system` foundation components (required set in prompt)
- App-level shell conversion (sidebar + top command bar + page shell)
- Theme system with stable light/dark support
- Dashboard widget standardization
- Table standardization on inventory/deals/customers (or opportunities if lower risk)
- Queue standardization on delivery/funding/title (+ CRM jobs if low risk)
- Detail header/workspace framing for deals and inventory, customers if low-risk shell migration
- Documentation and targeted tests/hardening

## Deferred (explicitly out of this sprint)

- Full CRM board redesign (`/crm`) beyond compatibility wrapping
- Deep refactor of complex detail tab internals (deal finance/title/documents logic remains module-owned)
- Finance/accounting/report full-family visual migration (except low-risk shared table adoption)
- Any route additions/renames

---

## 10) Acceptance Criteria by Slice

## SLICE A — Theme + tokens foundation

Checklist:

- Create `styles/theme.css` with light/dark variables and semantic naming.
- Update `lib/ui/tokens.ts` to expose semantic, reusable token helpers.
- Add theme provider + local preference persistence.
- Wire theme bootstrap in root/app layout.

Acceptance criteria:

- Light and dark themes both render correctly on shell + cards + tables + queues.
- No feature page hardcodes Tailwind palette colors or hex values.
- Theme switch does not require full reload and persists across navigation/refresh.

## SLICE B — PageShell + layout primitives

Checklist:

- Implement `PageShell`, `PageHeader`, `FilterBar`, `ContextRail` under `ui-system/layout`.
- Provide typed props and responsive behavior.
- Add compatibility adapters where needed to avoid big-bang migration.

Acceptance criteria:

- Major migrated pages are composed from shared layout primitives.
- No page-specific shell wrappers for migrated routes.
- Loading/empty/error placement remains consistent.

## SLICE C — Sidebar + top command bar

Checklist:

- Implement `AppSidebar`, `SidebarItem`, `SidebarGroupLabel`, `TopCommandBar`.
- Create route-safe nav config aligned with navigation architecture doc.
- Preserve RBAC visibility and platform-admin gating.

Acceptance criteria:

- Sidebar hierarchy matches approved workflow groupings.
- Active states are correct for nested paths.
- Hidden routes remain hidden when permission is missing.

## SLICE D — Shared widget/card system

Checklist:

- Implement `Widget`, `MetricCard`, `AlertCard`, `InsightCard`.
- Migrate dashboard cards to widget primitives.
- Ensure state slots (loading/empty/error/default) are standardized.

Acceptance criteria:

- Dashboard visuals match approved card language and spacing rhythm.
- Widget internals do not fetch business data directly.
- KPI card and insight semantics are token-driven only.

## SLICE E — Table system + status badges

Checklist:

- Implement `TableLayout`, `TableToolbar`, `ColumnHeader`, `RowActions`, `StatusBadge`.
- Migrate inventory, deals, customers/opportunities table surfaces.
- Map domain statuses to shared semantic badge variants.

Acceptance criteria:

- Standard row/header heights and paddings on migrated tables.
- Shared toolbar/action patterns across migrated table pages.
- No bespoke table wrappers remain on migrated targets.

## SLICE F — Queue system

Checklist:

- Implement `QueueLayout`, `QueueKpiStrip`, `QueueTable`.
- Migrate delivery/funding/title pages; include CRM jobs if low-risk.
- Preserve existing actions and endpoint behavior.

Acceptance criteria:

- Queue pages share one structural skeleton and state treatment.
- Queue KPI strip and table feel visually consistent across domains.
- Queue action links and mutations remain unchanged functionally.

## SLICE G — Entity headers + detail workspace primitives

Checklist:

- Implement `EntityHeader`, `CustomerHeader`, `VehicleHeader`, `DealWorkspaceShell`.
- Wrap `deals/[id]`, `inventory/[id]`, and optionally `customers/[id]` with shared framing.
- Keep tab/body business logic in module presenters.

Acceptance criteria:

- Detail pages begin with canonical header block.
- Section framing is consistent without business logic regressions.
- Modal/full-page parity remains intact.

## SLICE H — Migrate dashboard

Checklist:

- Move dashboard to new shell + widget primitives + command bar integration.
- Keep server data fetch and layout persistence flow intact.

Acceptance criteria:

- Dashboard remains server-first data loading path.
- All widget states and actions function as before.
- Light/dark parity and spacing hierarchy match approved direction.

## SLICE I — Migrate inventory/deals/crm core pages

Checklist:

- Inventory list + key detail shell migration.
- Deals list + detail shell migration.
- Customers (or opportunities) list migration, plus core detail shell if low-risk.
- Queue migrations from Slice F included here for core workflow continuity.

Acceptance criteria:

- Core workflow pages use shared shell/table/queue/entity primitives.
- No route/API contract changes.
- RBAC and tenant-safe behavior unchanged.

## SLICE J — Docs/tests/hardening

Checklist:

- Add usage docs for `PageShell`, widgets, tables, queues, theme compliance.
- Add/adjust high-value structural tests for shared primitives and nav visibility.
- Run dealer tests and fix regressions.
- Produce perf/security/final reports.

Acceptance criteria:

- Documentation enables predictable new-page implementation.
- Tests pass with no route or permission regressions.
- Final report includes dark/light sanity, shell adoption, and state coverage.

---

## 11) Regression Risks and Mitigations

1. Navigation RBAC regressions  
   Mitigation: central typed nav config + permission matrix tests + route existence checks.

2. Theme regressions (contrast or variable drift)  
   Mitigation: single token source, dual-theme snapshot/visual checks on shell/widgets/tables.

3. Modal route breakage after shell rewrite  
   Mitigation: keep `app/(app)/@modal` contract untouched; test open/close/back/deep-link flows.

4. Unintentional clientification/perf regressions  
   Mitigation: keep server fetch in route/page layers; shared components presentation-only; client islands only for interaction.

5. Table/queue behavioral regressions (pagination/sort/actions)  
   Mitigation: migrate wrappers first, then column internals; preserve existing query param and endpoint usage.

6. Detail page instability due to large presenters  
   Mitigation: shell-first wrapper migration only; do not rewrite finance/title/documents tab logic this sprint.

7. Design drift from approved mock language  
   Mitigation: token-only policy + primitive-only composition + no one-off cards/tables/queues.

---

## 12) Definition of Done for Step 2 Implementation

- `apps/dealer/components/ui-system` exists with required primitives and typed exports.
- Light/dark theme is user-toggleable and persistent.
- Sidebar/top command bar rebuilt to architecture doc and RBAC-safe visibility.
- Dashboard, core tables, queues, and key detail headers migrated per scope.
- Modal architecture remains compatible.
- Docs and tests updated; dealer checks pass.

