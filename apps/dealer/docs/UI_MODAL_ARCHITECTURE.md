# UI Modal Architecture

Purpose: define quick-create modal architecture using current Next.js intercepting route patterns in dealer app.

## Modal Strategy

- Use intercepting routes under `apps/dealer/app/(app)/@modal`.
- Keep one canonical resource route per entity, with modal and full-page entry paths.
- Preserve deep-linking: modal URL must be shareable and refresh-safe.
- Preserve browser history and back/forward behavior.

## Implemented/Target Modal Routes

## Quick Add Vehicle

- Modal route: `@modal/(.)inventory/new`
- Full page route: `/inventory/new`
- Behavior:
  - open in modal from list/dashboard quick action.
  - hard refresh resolves to full page route.

## Quick Add Customer

- Modal route: `@modal/(.)customers/new`
- Full page route: `/customers/new`

## Quick Create Deal

- Modal route: `@modal/(.)deals/new`
- Full page route: `/deals/new`

## Quick Create Opportunity

- Current full page route: `/crm/opportunities` (create action in page flow).
- Architecture target:
  - add modal intercepting route mirroring pattern (`@modal/(.)crm/opportunities/new`) only when backing full-page route exists.
  - until then, quick action routes to current create flow in opportunities UI.

## Existing Detail Modals

- Deals detail:
  - modal `@modal/(.)deals/[id]`
  - full page `/deals/[id]`
- Inventory detail/edit:
  - modal `@modal/(.)inventory/vehicle/[id]`, `@modal/(.)inventory/vehicle/[id]/edit`
  - full pages `/inventory/vehicle/[id]`, `/inventory/vehicle/[id]/edit`
- Customer detail:
  - modal `@modal/(.)customers/profile/[id]`
  - full page `/customers/profile/[id]`
- Settings:
  - modal `@modal/(.)settings`
  - full page `/settings`

## URL and State Rules

- Modal open:
  - push modal route so URL reflects active entity/action.
- Modal close:
  - back navigation closes modal when entered from parent page.
  - fallback close should route to parent list page if no prior history entry.
- Deep links:
  - direct navigation should render full page context safely.
- Query state:
  - preserve parent filter query params when opening modal from list pages.

## Shared Route Contract

- Form logic and schemas are shared between modal and full-page variants.
- API usage remains identical; only shell differs.
- Validation and submission responses should redirect/refresh parent list consistently.

## Non-breaking Rollout

- Keep existing modal routes as source of truth for implemented entities.
- Introduce missing quick-create modal routes only after equivalent full routes and page components are stabilized.
- Do not fork module business logic for modal-specific implementations.
