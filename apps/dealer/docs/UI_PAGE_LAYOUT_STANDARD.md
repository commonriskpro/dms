# UI Page Layout Standard

Purpose: define a reusable SaaS page shell that can be applied across dealer modules without breaking current server-first routing.

## Standard Layout

```text
PageHeader
--------------------------------
Filters / Search
--------------------------------
Main Content
--------------------------------
Right Context Rail
```

## Core Components

## `PageShell`

- Responsibility:
  - consistent vertical rhythm, responsive grid, and page-level spacing.
  - owns main content + optional right rail composition.
- Usage:
  - wraps all major routes in `apps/dealer/app/(app)/*`.
- Server compatibility:
  - default server component wrapper; client children allowed.

## `PageHeader`

- Responsibility:
  - title, subtitle, status chips, primary and secondary actions.
  - optional breadcrumbs for deep routes (`/deals/[id]`, `/customers/profile/[id]`, `/inventory/vehicle/[id]`).
- Required slots:
  - `title`
  - `description`
  - `actions`
  - `meta` (counts, last updated, stage/status)

## `FilterBar`

- Responsibility:
  - search, faceted filters, view toggles, saved view presets.
- Behavior:
  - query params as source of truth.
  - server-first fetch path with client enhancements.
- Reuse targets:
  - inventory list, customers list, opportunities list, queue pages, reports.

## `TableLayout`

- Responsibility:
  - standard table/list shell with loading, empty, and error states.
  - built-in pagination + sorting patterns.
- Data contract:
  - list endpoint + total + pagination metadata.
- Reuse targets:
  - inventory, customers, deals, queues, accounting, reports.

## `ContextRail`

- Responsibility:
  - right-side secondary insights/actions.
- Content examples:
  - alerts, activity snippets, quick tasks, KPI mini cards, related entities.
- Behavior:
  - optional and collapsible per page.

## Page Variants

- List pages:
  - full `PageHeader + FilterBar + TableLayout + optional ContextRail`.
- Workspace/detail pages:
  - `PageHeader + main split layout + ContextRail`.
- Kanban pages (`/crm`):
  - `PageHeader + FilterBar + board layout + ContextRail`.
- Dashboard:
  - `PageHeader + widget grid + contextual rail`.

## Rendering Model

- Server-first baseline:
  - data fetched in route/page server components where possible.
  - interactive filters/boards/tables in client components.
- URL-driven state:
  - filters and tab state persisted in URL params when feasible.
- Progressive hydration:
  - static shell renders immediately; heavy widgets hydrate client-side.

## Compatibility with Existing Pages

- Direct fit:
  - `/inventory`, `/customers`, `/deals`, `/reports`, `/accounting/*`, `/crm/opportunities`.
- Detail/workspace fit:
  - `/inventory/vehicle/[id]`, `/customers/profile/[id]`, `/deals/[id]`, `/crm/opportunities/[id]`.
- Queue fit:
  - `/deals/delivery`, `/deals/funding`, `/deals/title`, `/crm/jobs`.

## Implementation Guidance (Non-breaking)

- Introduce layout primitives in `apps/dealer/components/layout` and compose into existing pages incrementally.
- Keep existing module UI components (`modules/*/ui`) as feature containers; wrap them with shared shell components.
- Avoid moving business logic from module UI/service; only standardize shell/presentation boundaries.
