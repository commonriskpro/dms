# UI Patterns

Purpose: define reusable, cross-module UI interaction patterns for enterprise consistency.

## Design Token Foundation

- Use shared token system from `apps/dealer/lib/ui/tokens.ts`.
- Use existing recipe utilities under `apps/dealer/lib/ui/recipes/*`.
- All patterns should be implemented with `@/components/ui/*` (shadcn-based primitives).

## Status Badges

## Badge semantics

- `success`
  - completed, funded, delivered, active, approved.
- `warning`
  - pending docs, overdue tasks, nearing SLA thresholds.
- `error`
  - failed submissions, blocked workflows, hard validation failures.
- `info`
  - draft/in-progress/review states.

## Usage domains

- Deals: status, delivery/funding/title states.
- Inventory: recon/floorplan/listing/alert states.
- CRM: opportunity stage/status, sequence/automation run state.
- Admin/Platform: invite/member/user states.

## Queue Pattern

Purpose: consistent operational queue UI for delivery, funding, title, and jobs.

- Structure:
  - queue KPI strip (counts by status).
  - filter/search bar.
  - sortable queue table.
  - row actions (primary + overflow).
  - side preview pane (optional).
- Required states:
  - loading, empty, error, stale/retry indicator.
- Reuse targets:
  - `/deals/delivery`
  - `/deals/funding`
  - `/deals/title`
  - `/crm/jobs`

## Activity Timeline Pattern

Purpose: chronological event and communication history.

- Event item model:
  - timestamp
  - actor
  - event type
  - summary
  - metadata chips
  - optional action link
- Reuse targets:
  - customer detail (`/customers/[id]`)
  - deal detail (`/deals/[id]`)
  - vehicle detail (`/inventory/[id]`)
- Data sources:
  - customer activity/timeline endpoints
  - deal history endpoints
  - inventory/audit traces where available

## Quick Actions Pattern

Purpose: single-click entry into high-frequency create flows.

- Actions:
  - Add vehicle
  - Add customer
  - Create opportunity
  - Create deal
- Placement:
  - global header action menu
  - dashboard quick actions widget
  - contextual empty states
- Route strategy:
  - launch intercepting modal routes where available
  - fallback to full-page route on hard refresh/deep link

## Form Pattern

- Built with React Hook Form + Zod schemas.
- Inline field errors and section-level error summary for long forms.
- Disable submit while pending; preserve dirty state where safe.
- Sectioned cards for complex entities (deal desk, vehicle create/edit).

## Data Table Pattern

- Standard controls:
  - search, filters, column visibility, sort, pagination.
- Consistent row anatomy:
  - primary identity column
  - status/severity
  - key metrics
  - updated time
  - actions
- Accessibility:
  - keyboard row navigation and actionable controls.

## Card + KPI Pattern

- Metric cards for dashboard/report summaries.
- Alert cards for action-required issues.
- Support trend, delta, and threshold indicators.

## Pattern Governance

- No module-specific one-off visual semantics for shared states.
- New state labels must map to existing semantic badge variants.
- Queue and timeline layouts should be shared components, not duplicated page-level ad hoc markup.
