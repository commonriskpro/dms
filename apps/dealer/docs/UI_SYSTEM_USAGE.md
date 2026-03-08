# UI System Usage (Slices A-J Status)

This document tracks the shared UI foundation and migration status through the current hardening pass.

## Where shared primitives live

- `apps/dealer/components/ui-system/layout/*`
- `apps/dealer/components/ui-system/navigation/*`
- `apps/dealer/components/ui-system/widgets/*`
- `apps/dealer/components/ui-system/tables/*`
- `apps/dealer/components/ui-system/feedback/*`
- `apps/dealer/components/ui-system/queues/*`
- `apps/dealer/components/ui-system/entities/*`
- `apps/dealer/components/ui-system/timeline/*`

## Theme and token rules

- Theme variables are defined in `apps/dealer/styles/theme.css`.
- Theme is managed by `apps/dealer/lib/ui/theme/theme-provider.tsx`.
- Use `useTheme()` only in client components that need theme switching UI.
- Use token-based classes from `apps/dealer/lib/ui/tokens.ts`; avoid raw Tailwind palette classes for page styling.

## Adapter-first compatibility

- Existing imports from `components/ui/page-shell` and `components/ui/status-badge` remain valid and route through `ui-system`.
- Legacy app shell wrappers in `components/app-shell/*` now delegate to `ui-system/navigation`.

## Table migration pattern

Use:

1. `TableLayout` for shell/state handling
2. `TableToolbar` for top controls
3. `ColumnHeader` for consistent header text treatment
4. `RowActions` for right-side action grouping
5. `StatusBadge` for semantic state chips

## Scope completed in this pass

- App shell (sidebar + top command bar)
- Dashboard widget base primitives
- Inventory list table shell
- Deals list table shell
- Customers list table shell
- Delivery queue shell migration
- Funding queue shell migration
- Title queue shell migration
- CRM jobs queue shell migration (low-risk, presentation-only)
- Deal detail page shell/header/workspace standardization
- Inventory detail header standardization
- Customer detail header standardization
- Dashboard widget state and layout alignment hardening
- Core admin page shell/header standardization (Audit, Files, Roles, Users, Dealership)
- Reports page shell/header standardization

## Current adoption status

- **Foundation primitives:** `layout`, `navigation`, `widgets`, `tables`, `feedback`, `queues`, `entities`, `timeline` are implemented.
- **Core app shell:** migrated (sidebar + top command bar).
- **Dashboard:** on shared widget primitives; hardening pass completed for state consistency and context-rail behavior.
- **Core list pages:** inventory/deals/customers + queue pages are on shared table/queue patterns.
- **Core detail pages:** deals/inventory/customers use shared entity/workspace/timeline wrappers at shell/header level.
- **Admin/report wrappers:** major core-platform pages and reports now use shared shell/header patterns.

## Queue migration pattern

Use:

1. `QueueLayout` for queue-level page structure
2. `QueueKpiStrip` for KPI summary row
3. `TableToolbar` in the shared filter/search row
4. `QueueTable` for loading/empty/error state shell + pagination
5. `StatusBadge` + `RowActions` for consistent row rendering

## Detail page shell pattern

Use:

1. `EntityHeader` (or `CustomerHeader`/`VehicleHeader`) for standardized top matter
2. `DealWorkspace` for shared main/rail framing
3. `ActivityTimeline` + `TimelineItem` for chronological event lists

Keep business logic and data fetching in module presenters; use these primitives only as presentation wrappers.
