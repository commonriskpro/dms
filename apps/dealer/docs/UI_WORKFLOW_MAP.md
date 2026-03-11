# UI Workflow Map

Purpose: map implemented backend capabilities to concrete UI workflows and entry pages.

## Workflow Matrix

| Workflow | Primary Pages | Supporting Pages | Core APIs |
|---|---|---|---|
| Inventory | `/inventory`, `/inventory/vehicle/[id]`, `/inventory/acquisition`, `/inventory/appraisals` | `/inventory/auctions`, `/inventory/auction-purchases`, `/inventory/aging`, `/inventory/pricing-rules` | `/api/inventory*`, `/api/inventory/acquisition*`, `/api/inventory/appraisals*`, `/api/inventory/auctions*` |
| CRM | `/crm`, `/crm/opportunities`, `/crm/opportunities/[id]`, `/crm/inbox` | `/crm/sequences`, `/crm/automations`, `/crm/jobs`, `/customers/profile/[id]` | `/api/crm/*`, `/api/customers/*` |
| Deals | `/deals`, `/deals/[id]` | `/deals/new` | `/api/deals*`, `/api/deals/[id]/desk`, `/api/deals/[id]/fees*`, `/api/deals/[id]/trade*`, `/api/deals/[id]/finance*` |
| Operations | `/deals/title`, `/deals/delivery`, `/deals/funding` | `/deals/[id]` | `/api/deals/title*`, `/api/deals/[id]/dmv-checklist*`, `/api/deals/delivery*`, `/api/deals/funding*` |
| Finance | `/deals/[id]`, `/lenders`, `/accounting/accounts`, `/accounting/transactions`, `/accounting/expenses` | `/reports/profit`, `/reports/inventory-roi` | `/api/credit-applications*`, `/api/lender-applications*`, `/api/lenders*`, `/api/accounting/*`, `/api/tax-profiles` |
| Reports | `/reports`, `/reports/profit`, `/reports/inventory-roi`, `/reports/salespeople` | exports from report pages | `/api/reports/*`, `/api/reports/export/*`, `/api/accounting/export` |

## Inventory Workflow Detail

- Vehicles:
  - list/search/filter in `/inventory`.
  - detail + edit in `/inventory/vehicle/[id]` and `/inventory/vehicle/[id]/edit`.
- Acquisition:
  - lead/appraisal conversion in `/inventory/acquisition` and `/inventory/appraisals`.
- Recon:
  - vehicle-level recon under `/inventory/vehicle/[id]` via recon APIs.
- Photos:
  - managed in vehicle detail/edit surfaces.
- Marketplace:
  - auctions and purchases in dedicated routes; listing publish/unpublish from vehicle detail.

## CRM Workflow Detail

- Opportunities:
  - pipeline board and table + detail flow.
- Inbox:
  - conversation-centric view in `/crm/inbox`.
- Automation:
  - rules/sequences/jobs in `/crm/automations`, `/crm/sequences`, `/crm/jobs`.
- Customer linkage:
  - customer profile is operational CRM anchor (`/customers/profile/[id]`).

## Deals Workflow Detail

- Deal desk:
  - list -> create -> detail workspace.
- Financial structuring:
  - fees/trades/finance products and lender submissions in deal workspace.
- Post-sale transitions:
  - delivery, funding, and title queues with per-deal actions.

## Operations Workflow Detail

- Title queue:
  - worklist in `/deals/title`.
- DMV checklist:
  - checklist actions under title/deal APIs from title queue and deal workspace.
- Delivery and funding queues:
  - operational handoff steps tracked via queue pages.

## Finance Workflow Detail

- Floorplan:
  - vehicle-level floorplan operations in inventory detail surfaces.
- Accounting:
  - accounts/transactions/expenses pages.
- Credit/lender/compliance:
  - anchored in deal workspace and finance APIs.

## Reports Workflow Detail

- Executive reports hub:
  - summary report entry point in `/reports`.
- Specialized reports:
  - profit, inventory ROI, salesperson pages.
- Export path:
  - report-level exports through dedicated endpoints.

## Entry Point Coverage Validation

- Every major backend domain has at least one direct UI page entry.
- Queue-based capabilities (delivery, funding, title, jobs) have dedicated list views.
- Capability panels embedded in detail pages (recon, photos, floorplan, lender workflow) are explicitly represented in workflow flows.
