# UI Navigation Architecture

Purpose: define the dealer app navigation model using only implemented modules/routes in `apps/dealer/app/(app)` and existing module capabilities.

## Navigation Principles

- Route-safe: every nav item maps to an existing route.
- Module-safe: no phantom domains outside current modules.
- Role-safe: item visibility respects existing permission model (`guardPermission` / RBAC).
- SaaS-consistent: stable left sidebar + quick actions + contextual sub-navigation.

## Primary Navigation (Sidebar)

## Dashboard

- `Dashboard` -> `/dashboard`

## Inventory

- `Vehicles` -> `/inventory`
- `Acquisition` -> `/inventory/acquisition`
- `Recon` -> `/inventory` (entry) + deep links into vehicle detail recon panels (`/inventory/[id]`)
- `Photos` -> `/inventory` (entry) + vehicle media management in `/inventory/[id]` and `/inventory/[id]/edit`
- `Marketplace` -> `/inventory/auctions`, `/inventory/auction-purchases`, and listing/feed actions from `/inventory/[id]`

## CRM

- `Opportunities` -> `/crm/opportunities`
- `Customers` -> `/customers`
- `Inbox` -> `/crm/inbox`
- `Automation` -> `/crm/automations`, `/crm/sequences`, `/crm/jobs`

## Deals

- `Deal Desk` -> `/deals` and `/deals/[id]`
- `Delivery Queue` -> `/deals/delivery`
- `Funding Queue` -> `/deals/funding`

## Operations

- `Title Queue` -> `/deals/title`
- `DMV Checklist` -> `/deals/title` (checklist actions are in title/deal routes)

## Finance

- `Floorplan` -> `/inventory` (vehicle-level floorplan panels) + `/inventory/acquisition` (inventory finance context)
- `Accounting` -> `/accounting/accounts`, `/accounting/transactions`, `/accounting/expenses`

## Reports

- `Sales` -> `/reports` + `/reports/salespeople`
- `Inventory` -> `/reports/inventory-roi`
- `CRM` -> `/reports` (pipeline/mix/summary endpoints surfaced in reports hub)

## Admin

- `Users` -> `/admin/users`
- `Permissions` -> `/admin/roles` (roles + permission management)
- `Settings` -> `/settings` (dealer settings) and `/admin/dealership` (org settings)

## Supporting Navigation Layers

- Top utility nav:
  - global search/command trigger (wired to `/api/search`).
  - notifications/activity shortcut.
  - user/account/session menu.
- Domain sub-nav:
  - Inventory: `/inventory`, `/inventory/acquisition`, `/inventory/appraisals`, `/inventory/auctions`, `/inventory/auction-purchases`, `/inventory/aging`, `/inventory/pricing-rules`.
  - Deals: `/deals`, `/deals/delivery`, `/deals/funding`, `/deals/title`.
  - CRM: `/crm`, `/crm/opportunities`, `/crm/sequences`, `/crm/automations`, `/crm/jobs`, `/crm/inbox`.
  - Accounting: `/accounting/accounts`, `/accounting/transactions`, `/accounting/expenses`.
  - Reports: `/reports`, `/reports/profit`, `/reports/inventory-roi`, `/reports/salespeople`.

## Permission Visibility Matrix (Navigation)

- Always visible: `Dashboard`.
- Inventory group: show when user has any inventory read-capable permission (`inventory.read`, acquisition/appraisal/auctions/pricing/publish read where applicable).
- CRM group: show when user has `crm.read` or `customers.read`.
- Deals group: show when user has `deals.read`.
- Operations group: show when user has `deals.read`.
- Finance group: show when user has `finance.read` and/or accounting/report finance permissions.
- Reports group: show when user has `reports.read` or `reports.export`.
- Admin group: show when user has `admin.*` permissions.

## Route Compatibility Notes

- Current route structure already supports this architecture; no route renames required.
- Recon, photos, floorplan, and marketplace publication are currently feature panels/actions inside vehicle pages; nav links should open list/entry routes then drill down.
- DMV is operationally a sub-flow under deal/title routes, so it is represented as an Operations nav entry that lands in title queue context.
