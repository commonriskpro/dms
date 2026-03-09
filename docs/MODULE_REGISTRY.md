# DMS Module Registry

> Superseded: canonical module documentation now lives in [`docs/canonical/INDEX.md`](./canonical/INDEX.md) and [`docs/canonical/MODULE_REGISTRY_CANONICAL.md`](./canonical/MODULE_REGISTRY_CANONICAL.md). This file is retained for historical reference and may drift from current code.

Per-module reference for `apps/dealer/modules/`. Paths relative to `apps/dealer/`. Update when adding modules, services, entities, or events.

## core
**Location:** `modules/core/`
**Responsibilities:** In-memory TTL cache (distributed cache fallback); tests for cache, event bus, jobs, metrics, rate-limit. No domain entities.
**Key services:** `cache/ttl-cache.ts` — `createTtlCache`

## core-platform
**Location:** `modules/core-platform/`
**Responsibilities:** Dealership, membership, roles, permissions, file storage, audit log access, user admin (roles/overrides). Platform UI: DealershipPage, RolesPage, UsersPage, FilesPage, AuditPage.
**Entities:** Dealership, Membership, Role, Permission, UserRole, UserPermissionOverride, FileObject, AuditLog (read)
**Key services:** `service/role.ts`, `service/membership.ts`, `service/file.ts`, `service/user-admin.ts`, `service/audit.ts`, `service/dealership.ts`, `db/permission.ts`, `db/membership.ts`

## crm-pipeline-automation
**Location:** `modules/crm-pipeline-automation/`
**Responsibilities:** CRM pipelines, stages, opportunities, sequences (templates + instances), automation rules, job runs, journey bar.
**Entities:** Pipeline, Stage, Opportunity, SequenceTemplate, SequenceStep, SequenceInstance, AutomationRule, Job
**Key services:** `service/pipeline.ts`, `service/stage.ts`, `service/stage-transition.ts`, `service/opportunity.ts`, `service/sequence.ts`, `service/sequence-instance.ts`, `service/automation-rule.ts`, `service/automation-engine.ts`, `service/job-worker.ts`, `service/journey-bar.ts`
**Emits:** `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`
**Consumes:** `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`, `customer.task_completed`

## customers
**Location:** `modules/customers/`
**Responsibilities:** Customer CRUD, notes, tasks, activity, timeline, callbacks, last-visit, saved filters and saved searches, team activity.
**Entities:** Customer, CustomerNote, CustomerTask, CustomerActivity, CustomerCallback, SavedFilter, SavedSearch
**Key services:** `service/customer.ts`, `service/note.ts`, `service/task.ts`, `service/activity.ts`, `service/timeline.ts`, `service/callbacks.ts`, `service/last-visit.ts`, `service/saved-filters.ts`, `service/saved-searches.ts`, `service/team-activity.ts`
**Emits:** `customer.created`, `customer.task_completed`

## dashboard
**Location:** `modules/dashboard/`
**Responsibilities:** Dashboard V3 data aggregation (KPIs, customer tasks, inventory alerts), layout persistence and merge, widget registry. No db layer; aggregates from other modules + cache.
**Key services:** `service/getDashboardV3Data.ts`, `service/dashboard-layout.ts`, `service/dashboard-layout-persistence.ts`, `service/merge-dashboard-layout.ts`, `service/dashboard-layout-cache.ts`, `service/floorplan-cache.ts`, `service/widget-registry.ts`

## dealer-application
**Location:** `modules/dealer-application/`
**Responsibilities:** Dealer application and approval flow (pre-tenant). Draft/submit application (public apply + invite flow); internal API for platform list/detail/update; lifecycle (approve, reject, activation_sent, activated). Linked to DealershipInvite for activation.
**Entities:** DealerApplication, DealerApplicationProfile (dealer DB); no dealershipId until approved.
**Key services:** `service/application.ts`, `db/application.ts`

## deals
**Location:** `modules/deals/`
**Responsibilities:** Deal lifecycle, calculations, fees, trade-ins, history, deal pipeline, deal-desk workspace.
**Entities:** Deal, DealFee, DealTrade, DealHistory
**Key services:** `service/deal.ts`, `service/calculations.ts`, `service/deal-pipeline.ts`, `service/fee.ts`, `service/trade.ts`, `service/history.ts`, `service/deal-desk.ts`
**Emits:** `deal.created`, `deal.status_changed`, `deal.sold`

## documents
**Location:** `modules/documents/`
**Responsibilities:** Deal document storage, upload validation, signed URL issuance.
**Entities:** Document (deal-linked)
**Key services:** `service/documents.ts`

## finance-shell
**Location:** `modules/finance-shell/`
**Responsibilities:** Finance shell per deal, CONTRACTED lock (no edits when deal is CONTRACTED), calculations.
**Entities:** DealFinance, DealFinanceProduct
**Key services:** `service/index.ts`, `service/lock.ts`, `service/calculations.ts`, `service/events.ts`
**Consumes:** `deal.status_changed`

## inventory
**Location:** `modules/inventory/`
**Responsibilities:** Vehicle CRUD, VIN decode, bulk import, floorplan loans, recon, alerts, book values, dashboard aggregates, vehicle photos, price-to-market, aging; appraisal workflow, acquisition pipeline, auction search (MOCK), valuation engine, pricing rules, vehicle listings (publish/unpublish).
**Entities:** Vehicle, VehiclePhoto, FloorplanLoan, ReconItem, VehicleRecon, VehicleReconLineItem, VehicleBookValue, VehicleValuation, VehicleFloorplan, VehicleFloorplanCurtailment, VehicleAppraisal, InventorySourceLead, AuctionListingCache, VehicleMarketValuation, PricingRule, VehicleListing
**Key services:** `service/vehicle.ts`, `service/vin-decode.ts`, `service/vin-decode-cache.ts`, `service/bulk.ts`, `service/floorplan.ts`, `service/floorplan-loans.ts`, `service/recon.ts`, `service/recon-items.ts`, `service/alerts.ts`, `service/book-values.ts`, `service/dashboard.ts`, `service/price-to-market.ts`, `service/vehicle-photo-backfill.ts`, `service/inventory-page.ts`, `service/inventory-intelligence-dashboard.ts`, `service/appraisal.ts`, `service/acquisition.ts`, `service/auction.ts`, `service/valuation-engine.ts`, `service/pricing.ts`, `service/listings.ts`
**Emits:** `vehicle.created`, `vehicle.updated`, `vehicle.vin_decoded`, `bulk_import.requested`

## lender-integration
**Location:** `modules/lender-integration/`
**Responsibilities:** Finance applications, submissions, stipulations, lender directory.
**Entities:** FinanceApplication, FinanceApplicant, FinanceSubmission, FinanceStipulation, Lender
**Key services:** `service/application.ts`, `service/submission.ts`, `service/stipulation.ts`, `service/lender.ts`, `service/applicant.ts`, `service/events.ts`, `serialize.ts`, `schemas.ts`
**Consumes:** `deal.status_changed`

## platform-admin
**Location:** `modules/platform-admin/`
**Responsibilities:** Invite and pending-user flows; used by platform API and dealer invite endpoints.
**Entities:** DealershipInvite, PendingApproval
**Key services:** `service/invite.ts`, `service/pending-users.ts`, `service/pending-approval.ts`, `db/invite.ts`

## provisioning
**Location:** `modules/provisioning/`
**Responsibilities:** Dealership provisioning (creation/setup). Service only; no db in module.
**Key services:** `service/provision.ts`

## reports
**Location:** `modules/reports/`
**Responsibilities:** Sales summary, finance penetration, inventory aging, mix, pipeline, sales-by-user, CSV export.
**Key services:** `service/index.ts` (getSalesSummary, getFinancePenetration, getInventoryAging, getMix, getPipelineReport), `service/export.ts`, `service/pipeline.ts`, `service/sales-by-user.ts`

## search
**Location:** `modules/search/`
**Responsibilities:** Global typeahead search (customers, deals, inventory). Permission-gated; tenant-scoped. No db layer; calls customers, deals, inventory db.
**Key services:** `service/global-search.ts`

## settings
**Location:** `modules/settings/`
**Responsibilities:** Settings UI only (SessionsBlock, SettingsContent). No db or service layer.

## API Route → Module / Permission Map

| Route group | Module(s) | Permission(s) |
|-------------|-----------|---------------|
| `/api/admin/*` | core-platform | admin.roles.read/write, admin.permissions.read |
| `/api/audit` | core-platform | — |
| `/api/auth/*` | lib/auth, tenant, session | — |
| `/api/cache/stats` | lib/infrastructure/cache | — |
| `/api/crm/*` | crm-pipeline-automation | crm.read/write |
| `/api/customers/*` | customers | customers.read/write |
| `/api/dashboard/*` | dashboard | permission-aware in service |
| `/api/apply/*` | dealer-application | — (public; rate limited) |
| `/api/deals/*` | deals, finance-shell, lender-integration | deals.read/write, finance.read/write |
| `/api/documents/*` | documents | documents.write |
| `/api/files/*` | core-platform | — |
| `/api/internal/*` | platform-admin, provisioning, core-platform, dealer-application | internal auth |
| `/api/inventory/*` | inventory | inventory.read/write, inventory.appraisals.read/write, inventory.acquisition.read/write, inventory.auctions.read, inventory.pricing.read/write, inventory.publish.read/write |
| `/api/invite/*` | platform-admin | — |
| `/api/lenders/*` | lender-integration | lenders.read/write |
| `/api/me/*` | lib/tenant, core-platform | — |
| `/api/metrics` | lib/infrastructure/metrics | — |
| `/api/platform/*` | core-platform, platform-admin | requirePlatformAdmin() |
| `/api/reports/*` | reports | reports.read/export |
| `/api/search` | search | permission-gated in service |
| `/api/support-session/*` | lib (cookie, verify) | — |

*Update when adding or changing modules.*
