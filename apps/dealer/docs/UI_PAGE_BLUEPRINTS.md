# UI Page Blueprints

Purpose: define target information architecture for key enterprise pages using existing data/routes.

## Dashboard Blueprint (`/dashboard`)

## Primary goals

- show dealership health at a glance.
- surface high-priority operational queues and follow-ups.
- provide fast entry into core workflows.

## Widget map

- Inventory Alerts
  - source: `/api/dashboard/v3/inventory-alerts`, inventory alert endpoints.
- Deal Pipeline
  - source: `/api/dashboard`, `/api/deals`, `/api/deals/* queues`.
- Tasks
  - source: customer tasks + CRM tasks endpoints.
- Floorplan
  - source: inventory floorplan aggregates from dashboard services.
- Messaging
  - source: customer activity/inbox-derived summaries.
- Appointments
  - source: customer activity callbacks/appointments.

## Layout

- Top:
  - `PageHeader` + quick actions + date range/context.
- Body:
  - responsive widget grid.
- Right rail:
  - urgent alerts + today action list.

## Inventory Blueprint (`/inventory`)

## Layout structure

- Header:
  - stock counts, aging highlights, quick add/import actions.
- Filters zone:
  - search, status, age bucket, source, pricing flags.
- Main:
  - vehicle table (`InventoryTable` target component).
- Right rail:
  - inventory alerts and recommended actions.

## Included sub-workflows

- vehicle detail drill-in (`/inventory/vehicle/[id]`).
- acquisition and appraisal shortcuts.
- listing publish actions and photo/recon/floorplan status indicators.

## Customer Detail Blueprint (`/customers/profile/[id]`)

## Header

- customer identity, lead status, assigned rep, quick communication actions.

## Tab architecture

- Overview
  - core profile, contact methods, stage, assignment.
- Activity
  - timeline feed (calls, sms, email, notes, stage updates).
- Deals
  - related deals with status and links.
- Vehicles
  - linked/interested vehicles.
- Notes
  - note list + inline create/edit.
- Files
  - customer/deal linked document references where available.

## Deal Workspace Blueprint (`/deals/[id]`)

## Section stack

- Deal Summary
  - status, deal type, totals, key dates.
- Customer
  - linked customer panel + contact quick actions.
- Vehicle
  - vehicle panel with stock/pricing context.
- Trade
  - trade values/payoff fields.
- Products
  - finance products and terms.
- Delivery
  - readiness and completion tasks.
- Funding
  - funding submission/approval/progress.
- Title
  - title status + DMV checklist state.

## Secondary rail

- compliance/doc status
- timeline/history
- blockers and required next steps

## CRM Pipeline Blueprint (`/crm`)

## Board model

- Kanban by stage.
- card content:
  - customer/opportunity summary
  - vehicle/deal linkage
  - priority indicators
  - next task and due date
- interactions:
  - drag stage transitions
  - quick actions (task, note, message, assign)

## Companion views

- table view in `/crm/opportunities`.
- detail workspace in `/crm/opportunities/[id]`.
- automation overlays in `/crm/automations` and `/crm/sequences`.

## Queue Page Blueprints

- Delivery Queue (`/deals/delivery`)
- Funding Queue (`/deals/funding`)
- Title Queue (`/deals/title`)

Shared structure:
- queue KPIs
- queue table
- status filters
- row actions
- side detail preview

## Blueprint Constraints

- Use current routes and module boundaries.
- Do not introduce new domain pages before existing workflows are represented.
- Keep embedded flows (recon/photos/floorplan/DMV) in their existing route ecosystems.
