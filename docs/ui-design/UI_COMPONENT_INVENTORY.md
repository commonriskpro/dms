# UI Component Inventory

Purpose: define shared enterprise UI components needed to reconstruct the interface using existing modules/routes.

## Component Standards

- Base primitives: shadcn components from `@/components/ui/*`.
- Styling: design tokens from `@/lib/ui/tokens` and recipe helpers in `@/lib/ui/recipes/*`.
- Rendering: server-compatible shells with client islands for interaction-heavy components.

## Core Components

## `MetricCard`

- Purpose: KPI and trend display for dashboard/reports/queues.
- Reuse pages:
  - `/dashboard`, `/reports*`, `/deals/* queues`, `/crm/jobs`.
- Data shape:
  - label, value, delta, trend direction, severity.

## `AlertCard`

- Purpose: action-required notices.
- Reuse pages:
  - `/dashboard`, `/inventory`, `/inventory/[id]`, `/deals/[id]`.
- Types:
  - inventory alerts, funding blockers, title/DMV blockers, compliance alerts.

## `ActivityTimeline`

- Purpose: chronological events/messages/tasks/status changes.
- Reuse pages:
  - `/customers/[id]`, `/deals/[id]`, `/inventory/[id]`.

## `KanbanBoard`

- Purpose: stage-based pipeline visualization.
- Reuse pages:
  - `/crm`.
- Capabilities:
  - stage columns, draggable cards, quick actions, card metrics.

## `QueueTable`

- Purpose: standardized queue list for operations workflows.
- Reuse pages:
  - `/deals/delivery`, `/deals/funding`, `/deals/title`, `/crm/jobs`.
- Features:
  - sorting, filtering, row actions, SLA/status chips.

## `DealWorkspace`

- Purpose: composed deal detail application shell.
- Reuse pages:
  - `/deals/[id]`.
- Sections:
  - summary, customer, vehicle, trade, products, delivery, funding, title.

## `InventoryTable`

- Purpose: vehicle list with enterprise filtering and status indicators.
- Reuse pages:
  - `/inventory`, inventory-related list widgets.

## `CustomerHeader`

- Purpose: canonical customer identity and action strip.
- Reuse pages:
  - `/customers/[id]`, CRM opportunity/customer-linked contexts.

## `VehicleHeader`

- Purpose: canonical vehicle identity and operational status strip.
- Reuse pages:
  - `/inventory/[id]`, `/deals/[id]` vehicle panel.

## Supporting Shared Components

- `PageShell`
- `PageHeader`
- `FilterBar`
- `ContextRail`
- `StatusBadge` (semantic variants)
- `QuickActionsMenu`
- `EntityLinkChips` (customer/vehicle/deal links)
- `EmptyStatePanel`
- `ErrorStatePanel`
- `LoadingSkeletonSet`

## Server Component Compatibility

- Server-preferred:
  - `PageShell`, `PageHeader`, static metric cards, shell-level context rails.
- Client-required:
  - `KanbanBoard`, interactive tables/filters, timelines with live updates, quick action menus.
- Mixed composition:
  - server page loads initial data, client components handle interactions and optimistic updates.

## Implementation Notes

- Keep module-specific UI under `modules/*/ui` as feature presenters.
- Promote only truly shared abstractions to `components/*`.
- Do not duplicate API fetch logic across shared components; pass typed data props from page/module containers.
