Repo inspection summary

- Source-only inspection completed across `apps/dealer`, `apps/platform`, `apps/worker`, `packages/contracts`, `scripts`, and Prisma schema/migrations.
- API surface discovered: `251` dealer routes (`apps/dealer/app/api/**/route.ts`) + `46` platform routes (`apps/platform/app/api/**/route.ts`).
- Database surface discovered: `88` Prisma models in `apps/dealer/prisma/schema.prisma`.
- UI surface discovered: `55` dealer app pages under `apps/dealer/app/(app)` + `19` platform pages under `apps/platform/app`.
- Background execution discovered: DB-backed CRM job engine (`Job`, `DealerJobRun`, automation/sequence pipeline) plus Redis/BullMQ worker app (`apps/worker`).
- Integrations discovered in code: Supabase, Twilio, SendGrid, Resend, NHTSA vPIC VIN decode API, Slack webhook, internal platform-to-dealer signed API.

# 1. Repository Structure

## Application directories

- `apps/dealer`
  - `app/(app)` dealer UI routes and modal route overlays.
  - `app/api` dealer HTTP API endpoints (inventory, deals, CRM, reports, admin, internal/platform bridge).
  - `modules/*` domain slices with `db`, `service`, `ui`, `tests`.
  - `lib/*` shared infrastructure (auth, RBAC, tenant, api helpers, cache, events, jobs, metrics, money, audit).
  - `prisma/schema.prisma` + `prisma/migrations/*`.
  - `scripts/*` dealer maintenance/data scripts.
- `apps/platform`
  - `app/(platform)` platform admin UI.
  - `app/api/platform/*` platform API endpoints (auth, applications, dealerships, users, subscriptions, monitoring).
  - `lib/*` platform service/db/auth/integration helpers.
  - `prisma/migrations/*`.
  - `scripts/*` platform seed script.
- `apps/worker`
  - Redis/BullMQ background workers (`vinDecode`, `bulkImport`, `analytics`, `alerts`).

## Shared contracts

- `packages/contracts/src`
  - Dealer contracts: monitoring/invite.
  - Platform contracts: users/dealerships/applications/audit/monitoring.
  - Internal contracts: provisioning/owner-invite.

## Service layers (major)

- Dealer module services:
  - `modules/inventory/service/*`
  - `modules/deals/service/*`
  - `modules/customers/service/*`
  - `modules/crm-pipeline-automation/service/*`
  - `modules/finance-core/service/*`
  - `modules/finance-shell/service/*`
  - `modules/lender-integration/service/*`
  - `modules/accounting-core/service/*`
  - `modules/reports/service/*`
  - `modules/reporting-core/service/*`
  - `modules/core-platform/service/*`
  - `modules/integrations/service/*`
  - `modules/documents/service/*`
  - `modules/dashboard/service/*`
  - `modules/search/service/*`
  - `modules/provisioning/service/*`
  - `modules/platform-admin/service/*`
- Platform services:
  - `apps/platform/lib/service/*`
  - `apps/platform/lib/db/*`
  - `apps/platform/lib/application-onboarding.ts`
  - `apps/platform/lib/platform-users-service.ts`
  - `apps/platform/lib/call-dealer-internal.ts`

## Infrastructure layers

- Dealer:
  - `apps/dealer/lib/api/*` (handler/validation/errors/rate-limit/pagination).
  - `apps/dealer/lib/infrastructure/cache/*` (cache keys/helpers/invalidation/client).
  - `apps/dealer/lib/infrastructure/events/eventBus.ts`.
  - `apps/dealer/lib/infrastructure/jobs/*` (Redis + enqueue producers).
  - `apps/dealer/lib/infrastructure/metrics/prometheus.ts`.
  - `apps/dealer/lib/infrastructure/rate-limit/rateLimit.ts`.
- Platform:
  - `apps/platform/lib/platform-auth.ts`, `apps/platform/lib/rate-limit.ts`, `apps/platform/lib/audit.ts`.
  - `apps/platform/lib/monitoring-db.ts`, `apps/platform/lib/monitoring-retention.ts`.

## Integrations directories

- Dealer integrations:
  - `apps/dealer/modules/integrations/service/sms.ts` (Twilio).
  - `apps/dealer/modules/integrations/service/email.ts` (SendGrid).
  - `apps/dealer/modules/integrations/service/webhooks.ts` (Twilio + SendGrid webhook handling).
  - `apps/dealer/modules/integrations/service/marketplace.ts` (feed generation).
  - `apps/dealer/modules/inventory/service/vin-decode-cache.ts` (NHTSA vPIC).
- Platform integrations:
  - `apps/platform/lib/email/resend.ts` (Resend email API).
  - `apps/platform/lib/check-dealer-health-service.ts` (Slack + Resend REST usage).
  - `apps/platform/lib/supabase/*`.

## Scripts

- Root scripts: `scripts/prisma-migrate.ts`, `scripts/prisma-reset.ts`, `scripts/audit-db-schema.ts`, `scripts/repair-dealer-roles.ts`, `scripts/fetch-supabase-env.ts`, `scripts/delete-all-supabase-users.ts`, `scripts/dedupe-vins.ts`, `scripts/policy-check.mjs`, `scripts/test-db-connection.mjs`.
- Dealer scripts: `apps/dealer/scripts/backfill-vehicle-photos.ts`, `cleanup-legacy-vehicle-fileobjects.ts`, `dedupe-vins.ts`, `repair-provisioned-roles.ts`.
- Platform scripts: `apps/platform/scripts/seed-owner.ts`.

## Migrations

- Dealer migrations: `apps/dealer/prisma/migrations/*` (core platform, customers, deals, finance, CRM automation, inventory slices, accounting, monitoring/rate-limit, title/funding).
- Platform migrations: `apps/platform/prisma/migrations/*` (platform SaaS layer and platform-side schemas).

# 2. Database Model Map

Models are extracted from `apps/dealer/prisma/schema.prisma` and grouped by inferred domain.

## Shared / Tenant / Identity

- `Dealership` — tenant root; parent for most business models.
- `DealershipLocation` — lot/location records linked to dealership and vehicles.
- `Profile` — user identity profile used across memberships/tasks/audit.
- `AuditLog` — cross-domain audit trail.
- `FileObject` — uploaded file metadata and storage pointer.
- `DashboardLayoutPreference` — per-user dashboard layout preferences.
- `ProvisioningIdempotency` — internal provisioning dedupe ledger.
- `OwnerInviteIdempotency` — owner-invite dedupe ledger.
- `InternalApiJti` — internal token replay prevention.

## Platform/Admin/RBAC

- `PendingApproval` — pending user approval queue.
- `PlatformAdmin` — platform admin grant for profile.
- `DealershipInvite` — invite flow to dealership.
- `Membership` — user membership in dealership with role.
- `Permission` — global permission catalog.
- `Role` — dealership-scoped role.
- `RolePermission` — role-permission join.
- `UserRole` — direct user-role join.
- `UserPermissionOverride` — allow/deny overrides by user.
- `UserActiveDealership` — active dealership pointer for user.

## Inventory

- `Vehicle` — inventory stock unit (pricing/status/location, linked to deals/opportunities/photos).
- `VehiclePhoto` — vehicle photo join to `FileObject`.
- `VehicleVinDecode` — VIN decode snapshots per vehicle.
- `VinDecodeCache` — VIN cache by dealership+vin.
- `VehicleValuation` — valuation snapshots.
- `VehicleBookValue` — book value values by source.
- `VehicleMarketValuation` — market-based pricing comps and recommendations.
- `InventoryAlertDismissal` — user dismissal state for inventory alerts.
- `VehicleRecon` — recon header for vehicle.
- `VehicleReconLineItem` — recon line items.
- `ReconItem` — recon activity/cost tracking by vehicle.
- `VehicleFloorplan` — floorplan financing profile by vehicle/lender.
- `VehicleFloorplanCurtailment` — floorplan curtailment payments.
- `FloorplanLoan` — floorplan loan ledger entries.
- `VehicleAppraisal` — appraisal records for acquisition/trade.
- `InventorySourceLead` — inventory acquisition lead source records.
- `AuctionListingCache` — cached auction listing data.
- `AuctionPurchase` — purchased-at-auction records.
- `PricingRule` — pricing automation rules.
- `VehicleListing` — syndication/listing status per external platform.
- `BulkImportJob` — inventory bulk import tracking.

## Customers / CRM

- `Customer` — CRM customer/lead master.
- `CustomerPhone` — phone contacts.
- `CustomerEmail` — email contacts.
- `CustomerNote` — notes.
- `CustomerTask` — tasks/reminders.
- `SavedFilter` — saved filter definitions.
- `SavedSearch` — saved search UI state.
- `CustomerActivity` — activity timeline including message provider metadata.
- `CustomerCallback` — callback scheduling.
- `Pipeline` — CRM pipeline.
- `Stage` — stages in pipeline.
- `Opportunity` — opportunity linking customer/vehicle/deal/stage.
- `OpportunityActivity` — stage transition + opportunity activity history.

## Deals

- `Deal` — core sales transaction.
- `DealFee` — fee line items.
- `DealTrade` — trade-in line items.
- `DealHistory` — status history.
- `DealTitle` — title processing state.
- `DealDmvChecklistItem` — DMV checklist line items.
- `DealFunding` — funding progression and state.

## Finance / Compliance / Accounting

- `DealFinance` — deal finance terms.
- `DealFinanceProduct` — F&I products.
- `Lender` — lender master data/integration config.
- `FinanceApplication` — finance application wrapper.
- `FinanceApplicant` — applicant/co-applicant data.
- `FinanceSubmission` — lender submission records.
- `FinanceStipulation` — stipulations for submissions.
- `CreditApplication` — credit application data.
- `LenderApplication` — lender app/decision tied to credit app + deal.
- `LenderStipulation` — stipulations for lender applications.
- `DealDocument` — deal-linked documents.
- `ComplianceFormInstance` — compliance form generation/completion.
- `AccountingAccount` — chart of accounts.
- `AccountingTransaction` — transaction header.
- `AccountingEntry` — debit/credit entries.
- `DealershipExpense` — expense records.
- `TaxProfile` — tax profile setup.

## Automation / Jobs / Monitoring

- `AutomationRule` — automation definitions (trigger/schedule/actions).
- `AutomationRun` — execution history for automation rules.
- `Job` — DB-backed job queue records.
- `DealerJobRun` — worker run stats.
- `DealerJobRunsDaily` — daily job-run aggregates.
- `DealerRateLimitEvent` — per-route rate-limit events.
- `DealerRateLimitStatsDaily` — daily rate-limit aggregates.
- `SequenceTemplate` — sequence template.
- `SequenceStep` — sequence step definitions.
- `SequenceInstance` — per-entity sequence run.
- `SequenceStepInstance` — per-step execution state.

# 3. API Route Inventory

Route inventory is extracted from `apps/dealer/app/api/**/route.ts` and `apps/platform/app/api/**/route.ts`.

## Inventory

- `/api/inventory` `GET,POST` · service `modules/inventory/service/vehicle` · guard `inventory.read, inventory.write`
- `/api/inventory/[id]` `GET,PATCH,DELETE` · `vehicle` · `inventory.read, inventory.write`
- `/api/inventory/[id]/cost` `GET` · `vehicle` · `inventory.read`
- `/api/inventory/[id]/photos` `GET,POST` · `vehicle` · `inventory.read/documents.read` + `inventory.write/documents.write`
- `/api/inventory/[id]/photos/[fileId]` `DELETE` · `vehicle` · `inventory.write, documents.write`
- `/api/inventory/[id]/photos/primary` `PATCH` · `vehicle` · `inventory.write, documents.write`
- `/api/inventory/[id]/photos/reorder` `PATCH` · `vehicle` · `inventory.write, documents.write`
- `/api/inventory/[id]/vin` `GET` · `vin-decode` · `inventory.read`
- `/api/inventory/[id]/vin/decode` `POST` · `vin-decode` · `inventory.write`
- `/api/inventory/vin-decode` `POST` · `vin-decode-cache` · `inventory.write`
- `/api/inventory/[id]/book-values` `GET,POST` · `book-values` · `inventory.read, inventory.write`
- `/api/inventory/[id]/valuations` `GET,POST` · `valuation` · `inventory.read, finance.read`
- `/api/inventory/[id]/valuation` `GET` · `valuation-engine` · `inventory.read`
- `/api/inventory/[id]/valuation/recalculate` `POST` · `valuation-engine` · `inventory.pricing.write`
- `/api/inventory/[id]/pricing/preview` `POST` · `pricing` · `inventory.pricing.read`
- `/api/inventory/[id]/pricing/apply` `POST` · `pricing` · `inventory.pricing.write`
- `/api/inventory/pricing-rules` `GET,POST` · `pricing` · `inventory.pricing.read, inventory.pricing.write`
- `/api/inventory/pricing-rules/[id]` `PATCH` · `pricing` · `inventory.pricing.write`
- `/api/inventory/aging` `GET` · `vehicle` · `inventory.read`
- `/api/inventory/dashboard` `GET` · `dashboard` · `inventory.read`
- `/api/inventory/alerts` `GET` · `alerts` · `inventory.read`
- `/api/inventory/alerts/counts` `GET` · `alerts` · `inventory.read`
- `/api/inventory/alerts/dismiss` `POST` · `alerts` · `inventory.write`
- `/api/inventory/alerts/dismiss/[id]` `DELETE` · `alerts` · `inventory.write`
- `/api/inventory/recon/[reconItemId]` `PATCH` · `recon-items` · `inventory.write`
- `/api/inventory/[id]/recon` `GET,PATCH` · `recon` · `inventory.read, inventory.write`
- `/api/inventory/[id]/recon/items` `GET,POST` · `recon-items` · `inventory.read, inventory.write`
- `/api/inventory/[id]/recon/line-items` `POST` · `recon` · `inventory.write`
- `/api/inventory/[id]/recon/line-items/[lineItemId]` `PATCH,DELETE` · `recon` · `inventory.write`
- `/api/inventory/[id]/floorplan` `GET,PUT` · `floorplan` · `finance.read, finance.write`
- `/api/inventory/[id]/floorplan/curtailments` `POST` · `floorplan` · `finance.write`
- `/api/inventory/[id]/floorplan/payoff-quote` `POST` · `floorplan` · `finance.write`
- `/api/inventory/[id]/floorplan/loans` `GET,POST` · `floorplan-loans` · `inventory.read, inventory.write`
- `/api/inventory/floorplan/[floorplanLoanId]` `PATCH` · `floorplan-loans` · `inventory.write`
- `/api/inventory/appraisals` `GET,POST` · `appraisal` · `inventory.appraisals.read, inventory.appraisals.write`
- `/api/inventory/appraisals/[id]` `GET,PATCH` · `appraisal` · `inventory.appraisals.read, inventory.appraisals.write`
- `/api/inventory/appraisals/[id]/approve` `POST` · `appraisal` · `inventory.appraisals.write`
- `/api/inventory/appraisals/[id]/reject` `POST` · `appraisal` · `inventory.appraisals.write`
- `/api/inventory/appraisals/[id]/convert` `POST` · `appraisal` · `inventory.appraisals.write`
- `/api/inventory/acquisition` `GET,POST` · `acquisition` · `inventory.acquisition.read, inventory.acquisition.write`
- `/api/inventory/acquisition/[id]` `GET,PATCH` · `acquisition` · `inventory.acquisition.read, inventory.acquisition.write`
- `/api/inventory/acquisition/[id]/move-stage` `POST` · `acquisition` · `inventory.acquisition.write`
- `/api/inventory/auctions/search` `GET` · `auction` · `inventory.auctions.read`
- `/api/inventory/auctions/[id]` `GET` · `auction` · `inventory.auctions.read`
- `/api/inventory/auctions/[id]/appraise` `POST` · `auction` · `inventory.appraisals.write`
- `/api/inventory/auction-purchases` `GET,POST` · `auction-purchase` · `inventory.read, inventory.write`
- `/api/inventory/auction-purchases/[id]` `GET,PATCH` · `auction-purchase` · `inventory.read, inventory.write`
- `/api/inventory/bulk/import` `GET` · `bulk` · `inventory.read`
- `/api/inventory/bulk/import/preview` `POST` · `bulk` · `inventory.write`
- `/api/inventory/bulk/import/apply` `POST` · `bulk` · `inventory.write`
- `/api/inventory/bulk/import/[jobId]` `GET` · `bulk` · `inventory.read`
- `/api/inventory/bulk/update` `PATCH` · `bulk` · `inventory.write`
- `/api/inventory/feed` `GET` · `integrations/marketplace` · `inventory.read`
- `/api/inventory/[id]/listings` `GET` · `listings` · `inventory.publish.read`
- `/api/inventory/[id]/publish` `POST` · `listings` · `inventory.publish.write`
- `/api/inventory/[id]/unpublish` `POST` · `listings` · `inventory.publish.write`

## Customers

- `/api/customers` `GET,POST` · `customers/service/customer` · `customers.read, customers.write`
- `/api/customers/[id]` `GET,PATCH,DELETE` · `customer` · `customers.read, customers.write`
- `/api/customers/[id]/timeline` `GET` · `timeline` · `customers.read`
- `/api/customers/[id]/activity` `GET,POST` · `activity` · `customers.read, customers.write`
- `/api/customers/[id]/calls` `POST` · `activity` · `customers.write`
- `/api/customers/[id]/sms` `POST` · `activity` · `customers.write`
- `/api/customers/[id]/appointments` `POST` · `activity` · `customers.write`
- `/api/customers/[id]/notes` `GET,POST` · `note` · `customers.read, customers.write`
- `/api/customers/[id]/notes/[noteId]` `PATCH,DELETE` · `note` · `customers.write`
- `/api/customers/[id]/tasks` `GET,POST` · `task` · `customers.read, customers.write`
- `/api/customers/[id]/tasks/[taskId]` `PATCH,DELETE` · `task` · `customers.write`
- `/api/customers/[id]/callbacks` `GET,POST` · `callbacks` · `customers.read, customers.write`
- `/api/customers/[id]/callbacks/[callbackId]` `PATCH` · `callbacks` · `customers.write`
- `/api/customers/[id]/last-visit` `POST` · `last-visit` · `customers.read`
- `/api/customers/[id]/disposition` `POST` · `customer` · `customers.write`
- `/api/customers/saved-filters` `GET,POST` · `saved-filters` · `customers.read`
- `/api/customers/saved-filters/[id]` `DELETE` · `saved-filters` · `customers.read`
- `/api/customers/saved-searches` `GET,POST` · `saved-searches` · `customers.read`
- `/api/customers/saved-searches/[id]` `PATCH,DELETE` · `saved-searches` · `customers.read`
- `/api/customers/saved-searches/[id]/set-default` `POST` · `saved-searches` · `customers.read`

## Deals

- `/api/deals` `GET,POST` · `deals/service/deal` · `deals.read, deals.write`
- `/api/deals/[id]` `GET,PATCH,DELETE` · `deal` · `deals.read, deals.write`
- `/api/deals/[id]/status` `PATCH` · `deal` · `deals.write`
- `/api/deals/[id]/history` `GET` · `deal` · `deals.read`
- `/api/deals/[id]/desk` `POST` · `deal-desk` · `deals.write`
- `/api/deals/delivery` `GET` · `deal` · `deals.read`
- `/api/deals/[id]/delivery/ready` `POST` · `delivery` · `deals.write`
- `/api/deals/[id]/delivery/complete` `POST` · `delivery` · `deals.write`
- `/api/deals/funding` `GET` · `deal` · `deals.read`
- `/api/deals/[id]/funding` `POST` · `funding` · `finance.submissions.write`
- `/api/deals/[id]/funding/status` `PATCH` · `funding` · `finance.submissions.write`
- `/api/deals/title` `GET` · `title` · `deals.read`
- `/api/deals/[id]/title` `GET` · `title` · `deals.read`
- `/api/deals/[id]/title/start` `POST` · `title` · `deals.write`
- `/api/deals/[id]/title/status` `PATCH` · `title` · `deals.write`
- `/api/deals/[id]/dmv-checklist` `GET,POST` · `dmv` · `deals.read, deals.write`
- `/api/deals/dmv-checklist/[itemId]` `PATCH` · `dmv` · `deals.write`
- `/api/deals/[id]/fees` `GET,POST` · `deal` · `deals.read, deals.write`
- `/api/deals/[id]/fees/[feeId]` `PATCH,DELETE` · `deal` · `deals.write`
- `/api/deals/[id]/trade` `GET,POST` · `deal` · `deals.read, deals.write`
- `/api/deals/[id]/trade/[tradeId]` `PATCH,DELETE` · `deal` · `deals.write`
- `/api/deals/[id]/finance` `GET,PUT` · `finance-shell` · `finance.read, finance.write`
- `/api/deals/[id]/finance/status` `PATCH` · `finance-shell` · `finance.write`
- `/api/deals/[id]/finance/products` `GET,POST` · `finance-shell` · `finance.read, finance.write`
- `/api/deals/[id]/finance/products/[productId]` `PATCH,DELETE` · `finance-shell` · `finance.write`
- `/api/deals/[id]/applications` `GET,POST` · `lender-integration/application` · `finance.submissions.read, finance.submissions.write`
- `/api/deals/[id]/applications/[applicationId]` `GET,PATCH` · `application` · `finance.submissions.read, finance.submissions.write`
- `/api/deals/[id]/applications/[applicationId]/submissions` `GET,POST` · `submission` · `finance.submissions.read, finance.submissions.write`
- `/api/deals/[id]/applications/[applicationId]/submissions/[submissionId]` `GET,PATCH` · `submission` · `finance.submissions.read, finance.submissions.write`
- `/api/deals/[id]/applications/[applicationId]/submissions/[submissionId]/funding` `PATCH` · `submission` · `finance.submissions.write`
- `/api/deals/[id]/applications/[applicationId]/submissions/[submissionId]/stipulations` `GET,POST` · `stipulation` · `finance.submissions.read, finance.submissions.write`
- `/api/deals/[id]/applications/[applicationId]/submissions/[submissionId]/stipulations/[stipId]` `PATCH,DELETE` · `stipulation` · `finance.submissions.write`
- `/api/deals/[id]/profit` `GET` · `accounting-core/profit` · guard present without explicit `guardPermission` key

## Messaging

- `/api/messages/sms` `POST` · `integrations/service/sms` · `crm.write`
- `/api/messages/email` `POST` · `integrations/service/email` · `crm.write`
- `/api/webhooks/twilio` `POST` · `integrations/service/webhooks` · webhook auth/signature validation
- `/api/webhooks/twilio/status` `POST` · `integrations/service/webhooks` · webhook auth/signature validation
- `/api/webhooks/sendgrid` `POST` · `integrations/service/webhooks` · webhook auth/signature validation

## CRM

- `/api/crm/pipelines` `GET,POST` · `crm-pipeline-automation/service/pipeline` · `crm.read, crm.write`
- `/api/crm/pipelines/[pipelineId]` `GET,PATCH,DELETE` · `pipeline` · `crm.read, crm.write`
- `/api/crm/pipelines/[pipelineId]/stages` `GET,POST` · `stage` · `crm.read, crm.write`
- `/api/crm/stages/[stageId]` `PATCH,DELETE` · `stage` · `crm.write`
- `/api/crm/opportunities` `GET,POST` · `opportunity` · `crm.read, crm.write`
- `/api/crm/opportunities/[opportunityId]` `GET,PATCH` · `opportunity` · `crm.read, crm.write`
- `/api/crm/opportunities/[opportunityId]/stage` `PATCH` · `stage-transition` · `crm.write`
- `/api/crm/opportunities/[opportunityId]/activity` `GET` · `opportunity` · `crm.read`
- `/api/crm/opportunities/[opportunityId]/sequences` `GET,POST` · `sequence` · `crm.read, crm.write`
- `/api/crm/customers/[id]/stage` `PATCH` · `stage-transition` · `crm.write`
- `/api/crm/customers/[id]/sequences` `GET,POST` · `sequence` · route-level auth + CRM permission checks
- `/api/crm/inbox/conversations` `GET` · `customers/service/inbox` · `customers.read`
- `/api/crm/lead-sources` `GET` · `customers/service/customer` · `crm.read`
- `/api/crm/journey-bar` `GET` · `journey-bar` · `crm.read`

## Automation

- `/api/crm/automation-rules` `GET,POST` · `automation-rule` · `crm.read, crm.write`
- `/api/crm/automation-rules/[ruleId]` `GET,PATCH,DELETE` · `automation-rule` · `crm.read, crm.write`
- `/api/crm/sequence-templates` `GET,POST` · `sequence` · `crm.read, crm.write`
- `/api/crm/sequence-templates/[templateId]` `GET,PATCH,DELETE` · `sequence` · `crm.read, crm.write`
- `/api/crm/sequence-templates/[templateId]/steps` `POST` · `sequence` · `crm.write`
- `/api/crm/sequence-steps/[stepId]` `PATCH,DELETE` · `sequence` · `crm.write`
- `/api/crm/sequence-instances/[instanceId]` `GET,PATCH` · `sequence` · authenticated CRM scope
- `/api/crm/sequence-instances/[instanceId]/steps/[stepInstanceId]/skip` `POST` · `sequence` · authenticated CRM scope
- `/api/crm/jobs` `GET` · `crm-pipeline-automation/db/job` · `crm.read`
- `/api/crm/jobs/[jobId]` `GET` · `crm-pipeline-automation/db/job` · `crm.read`
- `/api/crm/jobs/run` `POST,GET` · `job-worker` · `crm.write` (POST), cron secret path (GET)

## Reports

- `/api/reports/sales-summary` `GET` · `reports/service` · `reports.read`
- `/api/reports/sales-by-user` `GET` · `reports/service` · `reports.read`
- `/api/reports/pipeline` `GET` · `reports/service` · `reports.read`
- `/api/reports/mix` `GET` · `reports/service` · `reports.read`
- `/api/reports/finance-penetration` `GET` · `reports/service` · `reports.read`
- `/api/reports/inventory-aging` `GET` · `reports/service` · `reports.read`
- `/api/reports/inventory-roi` `GET` · `reporting-core/service/inventory-roi` · `finance.submissions.read`
- `/api/reports/dealer-profit` `GET` · `reporting-core/service/dealer-profit` · `finance.submissions.read`
- `/api/reports/salesperson-performance` `GET` · `reporting-core/service/salesperson-performance` · `finance.submissions.read`
- `/api/reports/export/sales` `GET` · `reports/service/export` · `reports.export`
- `/api/reports/export/inventory` `GET` · `reports/service/export` · `reports.export`

## Auth

- Dealer auth/session:
  - `/api/auth/callback` `GET`
  - `/api/auth/logout` `POST`
  - `/api/auth/forgot-password` `POST`
  - `/api/auth/reset-password` `POST`
  - `/api/auth/verify-email/resend` `POST`
  - `/api/auth/session` `GET`
  - `/api/auth/session/switch` `PATCH`
  - `/api/auth/sessions` `GET`
  - `/api/auth/sessions/revoke` `POST`
  - `/api/auth/dealerships` `GET`
  - `/api/auth/onboarding-status` `GET`
- Dealer user context/support:
  - `/api/me` `GET`
  - `/api/me/dealerships` `GET`
  - `/api/me/current-dealership` `GET,POST`
  - `/api/support-session/consume` `GET`
  - `/api/support-session/end` `POST`
- Invite flows:
  - `/api/invite/accept` `POST`
  - `/api/invite/resolve` `GET`
  - `/api/invite/pending-check` `GET`

## Admin

- `/api/admin/users` `GET` · `core-platform/service/user-admin`
- `/api/admin/users/[userId]` `GET` · `core-platform/db/membership`
- `/api/admin/users/[userId]/roles` `PATCH` · `core-platform/service/user-admin` · `admin.roles.assign`
- `/api/admin/users/[userId]/permission-overrides` `PATCH` · `core-platform/service/user-admin` · `admin.permissions.manage`
- `/api/admin/permissions` `GET` · `core-platform/db/permission` · `admin.permissions.read`
- `/api/admin/roles` `GET,POST` · `core-platform/service/role` · `admin.roles.read, admin.roles.write`
- `/api/admin/roles/[id]` `GET,PATCH,DELETE` · `role` · `admin.roles.read, admin.roles.write`
- `/api/admin/memberships` `GET,POST` · `core-platform/service/membership`
- `/api/admin/memberships/[id]` `GET,PATCH,DELETE` · `membership`
- `/api/admin/dealership` `GET,PATCH` · `core-platform/service/dealership` · `admin.dealership.read, admin.dealership.write`
- `/api/admin/dealership/locations` `GET,POST` · `dealership` · `admin.dealership.read, admin.dealership.write`
- `/api/admin/dealership/locations/[id]` `PATCH` · `dealership` · `admin.dealership.write`
- `/api/admin/bootstrap-link-owner` `POST` · platform-admin bootstrap flow
- `/api/admin/inventory/vehicle-photos/backfill/preview` `POST` · `inventory/service/vehicle-photo-backfill`
- `/api/admin/inventory/vehicle-photos/backfill/apply` `POST` · `vehicle-photo-backfill`

## Platform/Internal bridge + monitoring + utility

- Dealer platform/internal endpoints:
  - `/api/platform/dealerships` `GET,POST`
  - `/api/platform/dealerships/[id]` `GET,PATCH`
  - `/api/platform/dealerships/[id]/enable` `POST`
  - `/api/platform/dealerships/[id]/disable` `POST`
  - `/api/platform/dealerships/[id]/roles` `GET`
  - `/api/platform/dealerships/[id]/members` `GET,POST`
  - `/api/platform/dealerships/[id]/members/[membershipId]` `PATCH`
  - `/api/platform/dealerships/[id]/invites` `GET,POST`
  - `/api/platform/dealerships/[id]/invites/[inviteId]` `PATCH`
  - `/api/platform/impersonate` `POST`
  - `/api/platform/pending-users` `GET`
  - `/api/platform/pending-users/[userId]/approve` `POST`
  - `/api/platform/pending-users/[userId]/reject` `POST`
- Dealer internal endpoints:
  - `/api/internal/provision/dealership` `POST`
  - `/api/internal/dealerships/[dealerDealershipId]/status` `POST`
  - `/api/internal/dealerships/[dealerDealershipId]/owner-invite` `POST`
  - `/api/internal/dealerships/[dealerDealershipId]/owner-invite-status` `GET`
  - `/api/internal/dealerships/[dealerDealershipId]/invites` `GET`
  - `/api/internal/dealerships/[dealerDealershipId]/invites/[inviteId]` `PATCH`
  - `/api/internal/monitoring/job-runs` `GET`
  - `/api/internal/monitoring/job-runs/daily` `GET`
  - `/api/internal/monitoring/rate-limits` `GET`
  - `/api/internal/monitoring/rate-limits/daily` `GET`
  - `/api/internal/monitoring/maintenance/run` `POST`
- Utility:
  - `/api/health` `GET`
  - `/api/metrics` `GET`
  - `/api/cache/stats` `GET`
  - `/api/search` `GET`
  - `/api/audit` `GET`

## Files/Documents/Finance/Accounting auxiliary

- Documents/files:
  - `/api/files/upload` `POST`
  - `/api/files/signed-url` `GET`
  - `/api/documents` `GET`
  - `/api/documents/upload` `POST`
  - `/api/documents/signed-url` `GET`
  - `/api/documents/[documentId]` `PATCH,DELETE`
  - `/api/deal-documents` `GET,POST`
  - `/api/deal-documents/[id]` `GET,DELETE`
  - `/api/deal-documents/[id]/download` `GET`
- Finance/compliance/accounting:
  - `/api/credit-applications` `GET,POST`
  - `/api/credit-applications/[id]` `GET,PATCH`
  - `/api/credit-applications/[id]/submit` `POST`
  - `/api/lender-applications` `GET,POST`
  - `/api/lender-applications/[id]` `GET,PATCH`
  - `/api/lender-applications/[id]/stipulations` `GET,POST`
  - `/api/lender-stipulations/[id]` `GET,PATCH`
  - `/api/lenders` `GET,POST`
  - `/api/lenders/[id]` `GET,PATCH,DELETE`
  - `/api/compliance-alerts` `GET`
  - `/api/compliance-forms` `GET`
  - `/api/compliance-forms/generate` `POST`
  - `/api/compliance-forms/[id]` `GET,PATCH`
  - `/api/accounting/accounts` `GET,POST`
  - `/api/accounting/transactions` `GET,POST`
  - `/api/accounting/transactions/[id]` `GET`
  - `/api/accounting/transactions/[id]/entries` `POST`
  - `/api/accounting/transactions/[id]/post` `POST`
  - `/api/accounting/export` `GET`
  - `/api/expenses` `GET,POST`
  - `/api/expenses/[id]` `GET,PATCH`
  - `/api/tax-profiles` `GET`
- Dashboard:
  - `/api/dashboard` `GET`
  - `/api/dashboard/layout` `POST`
  - `/api/dashboard/layout/reset` `POST`
  - `/api/dashboard/customer-metrics` `GET`
  - `/api/dashboard/v3` `GET`
  - `/api/dashboard/v3/customer-tasks` `GET`
  - `/api/dashboard/v3/inventory-alerts` `GET`

## Platform API (apps/platform)

- Health/bootstrap/auth:
  - `/api/health` `GET`
  - `/api/platform/bootstrap` `POST`
  - `/api/platform/auth/debug` `GET`
  - `/api/platform/auth/callback` `GET`
  - `/api/platform/auth/logout` `GET`
  - `/api/platform/auth/forgot-password` `POST`
  - `/api/platform/auth/reset-password` `POST`
  - `/api/platform/auth/verify-email/resend` `POST`
  - `/api/platform/auth/sessions` `GET`
  - `/api/platform/auth/sessions/revoke` `POST`
- Core platform resources:
  - `/api/platform/dashboard` `GET`
  - `/api/platform/accounts` `GET,POST`
  - `/api/platform/users` `GET,POST`
  - `/api/platform/users/[id]` `GET,PATCH,DELETE`
  - `/api/platform/users/invite` `POST`
  - `/api/platform/applications` `GET,POST`
  - `/api/platform/applications/[id]` `GET`
  - `/api/platform/applications/[id]/approve` `POST`
  - `/api/platform/applications/[id]/reject` `POST`
  - `/api/platform/applications/[id]/provision` `POST`
  - `/api/platform/applications/[id]/invite-owner` `POST`
  - `/api/platform/applications/[id]/onboarding-status` `GET`
  - `/api/platform/dealerships` `GET,POST`
  - `/api/platform/dealerships/[id]` `GET,PATCH`
  - `/api/platform/dealerships/[id]/status` `POST`
  - `/api/platform/dealerships/[id]/provision` `POST`
  - `/api/platform/dealerships/[id]/owner-invite` `POST`
  - `/api/platform/dealerships/[id]/invites` `GET`
  - `/api/platform/dealerships/[id]/invites/[inviteId]/revoke` `PATCH`
  - `/api/platform/subscriptions` `GET,POST`
  - `/api/platform/subscriptions/[id]` `PATCH`
  - `/api/platform/billing` `GET`
  - `/api/platform/impersonation/start` `POST`
- Reports/audit/monitoring:
  - `/api/platform/reports/funnel` `GET`
  - `/api/platform/reports/growth` `GET`
  - `/api/platform/reports/usage` `GET`
  - `/api/platform/audit` `GET`
  - `/api/platform/audit/[id]` `GET`
  - `/api/platform/monitoring/dealer-health` `GET`
  - `/api/platform/monitoring/check-dealer-health` `POST`
  - `/api/platform/monitoring/events` `GET`
  - `/api/platform/monitoring/job-runs` `GET`
  - `/api/platform/monitoring/job-runs/daily` `GET`
  - `/api/platform/monitoring/rate-limits` `GET`
  - `/api/platform/monitoring/rate-limits/daily` `GET`
  - `/api/platform/monitoring/maintenance/run` `POST`

# 4. Service Capability Map

## Inventory module (`apps/dealer/modules/inventory/service`)

- Vehicle lifecycle management · `vehicle.ts` · CRUD, list filters, photos, feed payloads.
- VIN decode and cache · `vin.ts`, `vin-decode.ts`, `vin-decode-cache.ts` · VIN normalization and decode via NHTSA/cached storage.
- Valuation + book values · `valuation.ts`, `valuation-engine.ts`, `book-values.ts`, `price-to-market.ts` · market/book valuation and pricing recommendation.
- Recon workflow · `recon.ts`, `recon-items.ts` · recon header/line-item tracking.
- Floorplan management · `floorplan.ts`, `floorplan-loans.ts` · floorplan profile, curtailments, payoff/loan tracking.
- Appraisal and acquisition · `appraisal.ts`, `acquisition.ts`, `auction.ts`, `auction-purchase.ts` · appraisals, acquisition pipeline, auction sourcing, purchase conversion.
- Listing syndication and feeds · `listings.ts`, `integrations/service/marketplace.ts` · publish/unpublish and external feed export.
- Inventory alerts and dashboard · `alerts.ts`, `dashboard.ts`, `inventory-intelligence-dashboard.ts` · alerting and inventory KPIs.
- Bulk operations · `bulk.ts` · import/preview/apply/update.

## Deals module (`apps/dealer/modules/deals/service`)

- Deal orchestration · `deal.ts`, `index.ts` · create/update/list/status transitions.
- Deal desk calculations/workspace · `deal-desk.ts`, `calculations.ts` · structuring deal economics.
- Funding pipeline · `funding.ts` · funding state updates/queue.
- Title and DMV workflow · `title.ts`, `dmv.ts` · title initiation, checklist, status progression.
- Delivery workflow · `delivery.ts` · ready/completed delivery flow.
- Pipeline/state controls · `deal-pipeline.ts`, `deal-transitions.ts` · allowed transitions and enforcement.

## Customers module (`apps/dealer/modules/customers/service`)

- Customer master CRUD · `customer.ts`.
- Activity timeline/calls/SMS/email touchpoints · `activity.ts`, `timeline.ts`.
- Notes/tasks/callbacks · `note.ts`, `task.ts`, `callbacks.ts`.
- Saved views/searches · `saved-filters.ts`, `saved-searches.ts`.
- Last visit + team activity · `last-visit.ts`, `team-activity.ts`.
- CRM inbox conversation shaping · `inbox.ts`.

## CRM pipeline automation module (`apps/dealer/modules/crm-pipeline-automation/service`)

- Pipeline/stage management · `pipeline.ts`, `stage.ts`, `stage-transition.ts`.
- Opportunity management · `opportunity.ts`.
- Sequence engine · `sequence.ts` (templates, steps, instances, step instances).
- Rule-based automation engine · `automation-rule.ts`, `automation-engine.ts`.
- Job execution worker (DB queue) · `job-worker.ts`.
- Journey bar/CRM summary projections · `journey-bar.ts`.

## Finance + lender integration modules

- Finance shell (deal finance package) · `apps/dealer/modules/finance-shell/service/index.ts` (+ `lock.ts`, `events.ts`) · finance terms/products/status.
- Finance core (credit/compliance/documents) · `apps/dealer/modules/finance-core/service/credit-application.ts`, `lender-application.ts`, `lender-stipulation.ts`, `documents.ts`, `compliance.ts`.
- Lender integration (apps/submissions/stips/lenders) · `apps/dealer/modules/lender-integration/service/application.ts`, `submission.ts`, `stipulation.ts`, `lender.ts`, `events.ts`.

## Accounting + reporting

- Accounting ledger/accounts/transactions/expenses/tax · `apps/dealer/modules/accounting-core/service/accounts.ts`, `transactions.ts`, `expenses.ts`, `tax.ts`, `profit.ts`.
- Reports domain · `apps/dealer/modules/reports/service/*` (sales, inventory aging, mix, pipeline, export, finance penetration).
- Reporting-core domain · `apps/dealer/modules/reporting-core/service/dealer-profit.ts`, `inventory-roi.ts`, `salesperson-performance.ts`, `accounting-export.ts`.

## Core platform/admin/documents/dashboard/search

- RBAC + membership + role + dealership admin · `apps/dealer/modules/core-platform/service/role.ts`, `membership.ts`, `dealership.ts`, `user-admin.ts`, `audit.ts`, `file.ts`.
- Dealer docs service · `apps/dealer/modules/documents/service/documents.ts`.
- Dashboard data and personalization · `apps/dealer/modules/dashboard/service/dashboard.ts`, `getDashboardV3Data.ts`, `dashboard-layout-persistence.ts`, `dashboard-layout-cache.ts`.
- Global search · `apps/dealer/modules/search/service/global-search.ts`.
- Provisioning and platform-admin bridge · `apps/dealer/modules/provisioning/service/provision.ts`, `apps/dealer/modules/platform-admin/service/*`.

## Integration services

- SMS (Twilio) · `apps/dealer/modules/integrations/service/sms.ts`.
- Email (SendGrid) · `apps/dealer/modules/integrations/service/email.ts`.
- Webhook receivers/parsers (Twilio status + SendGrid inbound) · `apps/dealer/modules/integrations/service/webhooks.ts`.
- Marketplace feed shaping · `apps/dealer/modules/integrations/service/marketplace.ts`.

## Infra service capabilities (lib layer)

- API orchestration and guard rails · `apps/dealer/lib/api/handler.ts`, `validate.ts`, `errors.ts`, `rate-limit.ts`.
- Domain event bus and listeners · `apps/dealer/lib/infrastructure/events/eventBus.ts`.
- Cache read/write/invalidation helpers · `apps/dealer/lib/infrastructure/cache/*`.
- Job producers (Redis/BullMQ) · `apps/dealer/lib/infrastructure/jobs/enqueueVinDecode.ts`, `enqueueBulkImport.ts`, `enqueueAnalytics.ts`.
- Monitoring and metrics · `apps/dealer/lib/infrastructure/metrics/prometheus.ts`, `job-run-stats.ts`, `rate-limit-stats.ts`.

# 5. UI Page Map

## Dealer app primary pages (`apps/dealer/app/(app)`)

- `/dashboard` · module `dashboard` · KPI overview + widgets · data `/api/dashboard`, `/api/dashboard/v3*`, `/api/dashboard/layout*` · components `DashboardV3Client`.
- `/inventory` · `inventory` · inventory list/filtering · data `/api/inventory`, `/api/inventory/alerts*`, `/api/inventory/dashboard` · components `InventoryPageContentV2`.
- `/inventory/new` · `inventory` · create vehicle flow · data `/api/inventory`, `/api/inventory/vin-decode` · components `AddVehiclePage`, `VehicleForm`.
- `/inventory/[id]` · `inventory` · vehicle detail · data `/api/inventory/[id]`, related recon/floorplan/photos/valuations routes · components `VehicleDetailPage`.
- `/inventory/[id]/edit` · `inventory` · edit vehicle · data `/api/inventory/[id]` + dependent inventory endpoints · components `VehicleForm`.
- `/inventory/aging` · `inventory` · aging view · data `/api/inventory/aging` · components `AgingPage`.
- `/inventory/pricing-rules` · `inventory` · pricing rule setup · data `/api/inventory/pricing-rules*` · components pricing rules UI.
- `/inventory/acquisition` · `inventory` · acquisition pipeline · data `/api/inventory/acquisition*`, appraisals/auctions routes · components acquisition board/forms.
- `/inventory/appraisals` · `inventory` · appraisal queue/workflow · data `/api/inventory/appraisals*` · components appraisal table/form.
- `/inventory/auctions` · `inventory` · auction search + appraisal conversion · data `/api/inventory/auctions/*` · components `AuctionsPageClient`.
- `/inventory/auction-purchases` · `inventory` · purchased-at-auction tracking · data `/api/inventory/auction-purchases*` · components `AuctionPurchasesPageClient`.
- `/inventory/dashboard` · `inventory/dashboard` · inventory intelligence view · data inventory dashboard endpoints · components inventory dashboard cards.

- `/deals` · `deals` · deals pipeline/list · data `/api/deals`, `/api/deals/delivery`, `/api/deals/funding`, `/api/deals/title` · components `DealsPage`.
- `/deals/new` · `deals` · create deal · data `/api/deals` + lookup endpoints · components `CreateDealPage`.
- `/deals/[id]` · `deals` · deal workspace/detail · data `/api/deals/[id]` + fees/trade/finance/title/funding/history routes · components `DetailPage`, `DealDeskWorkspace`.
- `/deals/delivery` · `deals` · delivery queue · data `/api/deals/delivery`, `/api/deals/[id]/delivery/*` · components `DeliveryQueuePage`.
- `/deals/funding` · `deals` · funding queue · data `/api/deals/funding`, `/api/deals/[id]/funding*` · components `FundingQueuePage`.
- `/deals/title` · `deals` · title queue · data `/api/deals/title`, `/api/deals/[id]/title*`, `/api/deals/[id]/dmv-checklist*` · components `TitleQueuePage`.

- `/customers` · `customers` · customer list/search/saved views · data `/api/customers*`, `/api/dashboard/customer-metrics` · components `CustomersPageClient`.
- `/customers/new` · `customers` · create customer · data `/api/customers` · components `CreateCustomerPage`.
- `/customers/[id]` · `customers` + CRM · customer profile/timeline/tasks/activity · data `/api/customers/[id]/*`, CRM sequence/stage endpoints · components `DetailPage`.

- `/crm` · `crm-pipeline-automation` · pipeline board · data `/api/crm/pipelines*`, `/api/crm/opportunities*`, `/api/crm/journey-bar` · components `CrmBoardPage`.
- `/crm/opportunities` · `crm-pipeline-automation` · opportunities table · data `/api/crm/opportunities` · components `OpportunitiesTablePage`.
- `/crm/opportunities/[id]` · `crm-pipeline-automation` · opportunity detail · data `/api/crm/opportunities/[id]*`, sequences/activity/stage routes · components `OpportunityDetailPage`.
- `/crm/sequences` · `crm-pipeline-automation` · sequence templates/instances · data `/api/crm/sequence-*` · components `SequencesPage`.
- `/crm/automations` · `crm-pipeline-automation` · automation rule editor/list · data `/api/crm/automation-rules*` · components `AutomationRulesPage`.
- `/crm/jobs` · `crm-pipeline-automation` · automation job operations · data `/api/crm/jobs*`, `/api/crm/jobs/run` · components `JobsPage`.
- `/crm/inbox` · `customers/crm` · conversation inbox · data `/api/crm/inbox/conversations` · components inbox views.

- `/reports` · `reports` · reporting hub · data `/api/reports/*` + export routes · components `ReportsPage`.
- `/reports/profit` · `reporting-core` · dealer profit report · data `/api/reports/dealer-profit` · components profit report page.
- `/reports/inventory-roi` · `reporting-core` · inventory ROI report · data `/api/reports/inventory-roi` · components ROI report page.
- `/reports/salespeople` · `reporting-core` · salesperson performance · data `/api/reports/salesperson-performance` · components salesperson report page.

- `/accounting/accounts` · `accounting-core` · chart of accounts · data `/api/accounting/accounts` · components `AccountsPageClient`.
- `/accounting/transactions` · `accounting-core` · transaction journal/posting · data `/api/accounting/transactions*` · components `TransactionsPageClient`.
- `/accounting/expenses` · `accounting-core` · dealership expenses · data `/api/expenses*` · components `ExpensesPageClient`.
- `/accounting` · redirects to accounting subpage.

- `/admin/users` + `/admin/users/[userId]` · `core-platform` · user membership/roles/overrides · data `/api/admin/users*` · components admin users pages.
- `/admin/roles` · `core-platform` · role management · data `/api/admin/roles*`, `/api/admin/permissions` · components `RolesPage`.
- `/admin/audit` · `core-platform` · audit log viewer · data `/api/audit` · components `AuditPage`.
- `/admin/dealership` · `core-platform` · dealership settings/locations · data `/api/admin/dealership*` · components `DealershipPage`.
- `/files` · `core-platform/documents` · file upload and signed URL access · data `/api/files/*`, `/api/documents/*` · components `FilesPage`.
- `/settings` · `settings` · dealership/user settings · data settings endpoints and profile context · components `SettingsContent`.
- `/lenders` · `lender-integration` · lender directory/config · data `/api/lenders*` · components `LendersDirectoryPage`.

- `/pending`, `/closed`, `/get-started` · onboarding/account-state screens.

## Dealer modal entry points

- `@modal/(.)deals/new`, `@modal/(.)deals/[id]`.
- `@modal/(.)inventory/new`, `@modal/(.)inventory/[id]`, `@modal/(.)inventory/[id]/edit`.
- `@modal/(.)customers/new`, `@modal/(.)customers/[id]`.
- `@modal/(.)settings`.

## Platform pages (`apps/platform/app`)

- `/platform` dashboard shell.
- `/platform/login`, `/platform/forgot-password`, `/platform/reset-password`, `/platform/forbidden`, `/platform/bootstrap`.
- `/platform/users`, `/platform/accounts`, `/platform/account`.
- `/platform/applications`, `/platform/applications/[id]`.
- `/platform/dealerships`, `/platform/dealerships/[id]`.
- `/platform/subscriptions`, `/platform/billing`.
- `/platform/reports`, `/platform/audit`, `/platform/monitoring`.

# 6. Automation Systems

## DB-backed automation + job engine (dealer app)

- Trigger model:
  - `AutomationRule` defines trigger event + actions + schedule.
  - `AutomationRun` captures execution lifecycle.
  - `Job` stores delayed/pending/running jobs (`automation`, `sequence_step` queues).
- Trigger events wired in `automation-engine.ts`:
  - `opportunity.created`
  - `opportunity.stage_changed`
  - `opportunity.status_changed`
  - `customer.task_completed`
  - `customer.created`
- Action types implemented:
  - `create_task`
  - `update_stage`
  - `add_tag`
  - `assign_salesperson`
  - `send_message` (stub/no-op)
  - delayed/scheduled follow-up via queued jobs.
- Worker execution (`job-worker.ts`):
  - claims pending jobs in batches
  - retries with exponential backoff
  - dead-letter path after max retries
  - reclaim of stuck jobs
  - audit logging + run metrics persistence (`DealerJobRun`).

## Scheduler entrypoints

- `/api/crm/jobs/run`:
  - `POST` tenant-scoped run.
  - `GET` cron fan-out across dealerships (secret-protected).
- Internal maintenance:
  - `/api/internal/monitoring/maintenance/run` (dealer)
  - `/api/platform/monitoring/maintenance/run` (platform orchestration/cron path).

## Event-bus automation + enqueue

- `apps/dealer/instrumentation.ts` registers listeners:
  - cache invalidation listeners.
  - analytics enqueue on `vehicle.created`, `vehicle.vin_decoded`, `deal.sold`.
  - bulk import enqueue on `bulk_import.requested`.
  - generic analytics request enqueue.
  - CRM automation handler registration.

## Worker/queue systems

- `apps/worker` BullMQ workers:
  - queues: `vinDecode`, `bulkImport`, `analytics`, `alerts`.
  - workers: `vinDecode.worker.ts`, `bulkImport.worker.ts`, `analytics.worker.ts`, `alerts.worker.ts`.
  - Redis connection via `apps/worker/src/redis.ts`.
- Dealer producers in `apps/dealer/lib/infrastructure/jobs/*` enqueue same queue types when Redis is configured.

## Job types identified

- CRM automation action jobs.
- CRM sequence step jobs.
- VIN decode jobs.
- Bulk import jobs.
- Analytics jobs.
- Alert jobs.
- Monitoring rollups and maintenance jobs (internal monitoring APIs + daily stats tables).

# 7. Integrations

- Supabase
  - Module: dealer/platform auth and storage layers (`lib/supabase/*`).
  - Capabilities: auth callback/session/reset/logout, admin user enrichment, storage signed URLs/upload support.
- Twilio
  - Module: `apps/dealer/modules/integrations/service/sms.ts`, webhook routes.
  - Capabilities: outbound SMS delivery, provider message IDs, status webhook ingestion.
- SendGrid
  - Module: `apps/dealer/modules/integrations/service/email.ts`, webhook parser.
  - Capabilities: outbound email send, inbound event/message webhook handling.
- Resend
  - Module: `apps/platform/lib/email/resend.ts`.
  - Capabilities: platform owner-invite and alert email delivery.
- NHTSA vPIC VIN API
  - Module: `apps/dealer/modules/inventory/service/vin-decode-cache.ts`.
  - Capabilities: VIN decode normalization and cache hydration.
- Slack webhook
  - Module: `apps/platform/lib/check-dealer-health-service.ts`.
  - Capabilities: dealer health alert notifications.
- Internal platform-to-dealer signed API
  - Module: `apps/platform/lib/call-dealer-internal.ts`.
  - Capabilities: provisioning, dealership status updates, owner invite actions, job/rate-limit monitoring.
- Marketplace feed integration
  - Module: `apps/dealer/modules/integrations/service/marketplace.ts`.
  - Capabilities: feed generation (facebook/autotrader-compatible payload shape).
- Auction/book value provider status
  - Auction search service currently mock-backed (`inventory/service/auction.ts`).
  - Book value writes are internal persistence (`inventory/service/book-values.ts`) without external provider call in service.

# 8. Feature Checklist

Status labels: `Implemented`, `Implemented (internal-only)`, `Implemented (mock/external stub)`.

## Inventory

- [x] Vehicle CRUD and inventory list · module `inventory` · API `/api/inventory*` · UI `/inventory*` · `Implemented`
- [x] Vehicle photos management · module `inventory` + `core-platform/file` · API `/api/inventory/[id]/photos*` · UI vehicle detail/edit · `Implemented`
- [x] VIN decode + cache · module `inventory` · API `/api/inventory/vin-decode`, `/api/inventory/[id]/vin*` · UI new/edit vehicle flows · `Implemented`
- [x] Valuation/book value/market valuation · module `inventory` · API `/api/inventory/[id]/book-values`, `/valuations`, `/valuation*` · UI detail/pricing views · `Implemented`
- [x] Pricing rules + pricing apply/preview · module `inventory` · API `/api/inventory/pricing-rules*`, `/pricing/*` · UI `/inventory/pricing-rules` · `Implemented`
- [x] Recon workflow · module `inventory` · API `/api/inventory/*/recon*` · UI vehicle detail/recon surfaces · `Implemented`
- [x] Floorplan management/curtailments/loans · module `inventory` · API `/api/inventory/*/floorplan*` · UI inventory/deal detail finance surfaces · `Implemented`
- [x] Acquisition pipeline and appraisals · module `inventory` · API `/api/inventory/acquisition*`, `/appraisals*` · UI `/inventory/acquisition`, `/inventory/appraisals` · `Implemented`
- [x] Auction search and auction purchases · module `inventory` · API `/api/inventory/auctions*`, `/auction-purchases*` · UI `/inventory/auctions`, `/inventory/auction-purchases` · `Implemented (auction search provider mock-backed)`
- [x] Listing publish/syndication + feed · module `inventory` + `integrations` · API `/api/inventory/[id]/publish`, `/unpublish`, `/listings`, `/feed` · UI inventory detail/listing controls · `Implemented`
- [x] Bulk import/update · module `inventory` · API `/api/inventory/bulk/*` · UI import workflows · `Implemented`

## CRM

- [x] Pipelines and stages · module `crm-pipeline-automation` · API `/api/crm/pipelines*`, `/api/crm/stages/*` · UI `/crm` · `Implemented`
- [x] Opportunities and stage transitions · module `crm-pipeline-automation` · API `/api/crm/opportunities*` · UI `/crm/opportunities*` · `Implemented`
- [x] Sequence templates/instances/step execution · module `crm-pipeline-automation` · API `/api/crm/sequence-*` · UI `/crm/sequences` · `Implemented`
- [x] Journey bar and CRM summary · module `crm-pipeline-automation` · API `/api/crm/journey-bar` · UI `/crm` · `Implemented`
- [x] CRM jobs operations · module `crm-pipeline-automation` · API `/api/crm/jobs*`, `/api/crm/jobs/run` · UI `/crm/jobs` · `Implemented`

## Customers

- [x] Customer CRUD/search/filter/saved views · module `customers` · API `/api/customers*` + saved filter/search routes · UI `/customers` · `Implemented`
- [x] Customer timeline/activity logging · module `customers` · API `/api/customers/[id]/timeline`, `/activity` · UI `/customers/[id]` · `Implemented`
- [x] Notes/tasks/callbacks · module `customers` · API `/api/customers/[id]/notes*`, `/tasks*`, `/callbacks*` · UI detail page tabs/panels · `Implemented`
- [x] Last visit/disposition/lead-source hooks · module `customers` · API `/api/customers/[id]/last-visit`, `/disposition`, `/api/crm/lead-sources` · UI customer and CRM flows · `Implemented`

## Messaging

- [x] Outbound SMS · module `integrations` · API `/api/messages/sms` · UI customer/CRM messaging actions · `Implemented (Twilio)`
- [x] Outbound email · module `integrations` · API `/api/messages/email` · UI customer/CRM messaging actions · `Implemented (SendGrid)`
- [x] Webhook ingestion/status updates · module `integrations/webhooks` · API `/api/webhooks/twilio*`, `/api/webhooks/sendgrid` · UI indirect via activity updates · `Implemented`

## Deals

- [x] Deal CRUD and pipeline lists · module `deals` · API `/api/deals*` · UI `/deals*` · `Implemented`
- [x] Deal desk structuring and calculations · module `deals` + `finance-shell` · API `/api/deals/[id]/desk`, `/finance*` · UI `/deals/[id]` · `Implemented`
- [x] Fees and trade-in handling · module `deals` · API `/api/deals/[id]/fees*`, `/trade*` · UI `/deals/[id]` · `Implemented`
- [x] Delivery queue and completion flow · module `deals` · API `/api/deals/delivery`, `/api/deals/[id]/delivery/*` · UI `/deals/delivery` · `Implemented`
- [x] Title queue and DMV checklist · module `deals` · API `/api/deals/title`, `/api/deals/[id]/title*`, `/dmv-checklist*` · UI `/deals/title` · `Implemented`
- [x] Funding queue and status progression · module `deals` · API `/api/deals/funding`, `/api/deals/[id]/funding*` · UI `/deals/funding` · `Implemented`

## Finance

- [x] Finance shell terms/products/status · module `finance-shell` · API `/api/deals/[id]/finance*` · UI deal detail desk/finance section · `Implemented`
- [x] Credit applications · module `finance-core` · API `/api/credit-applications*` · UI finance workflows · `Implemented`
- [x] Lender applications + stipulations · module `finance-core` + `lender-integration` · API `/api/lender-applications*`, `/api/lender-stipulations/*`, `/api/deals/[id]/applications*` · UI lender/finance surfaces · `Implemented`
- [x] Deal documents + compliance forms · module `finance-core` · API `/api/deal-documents*`, `/api/compliance-forms*`, `/api/compliance-alerts` · UI deal finance/compliance sections · `Implemented`
- [x] Lender directory management · module `lender-integration` · API `/api/lenders*` · UI `/lenders` · `Implemented`
- [x] Tax profiles · module `accounting-core` · API `/api/tax-profiles` · UI finance/accounting settings surfaces · `Implemented`

## Reports

- [x] Sales summary/by user/mix/pipeline/finance penetration · module `reports` · API `/api/reports/*` · UI `/reports` · `Implemented`
- [x] Dealer profit report · module `reporting-core` · API `/api/reports/dealer-profit` · UI `/reports/profit` · `Implemented`
- [x] Inventory ROI report · module `reporting-core` · API `/api/reports/inventory-roi` · UI `/reports/inventory-roi` · `Implemented`
- [x] Salesperson performance report · module `reporting-core` · API `/api/reports/salesperson-performance` · UI `/reports/salespeople` · `Implemented`
- [x] CSV/exports (sales/inventory/accounting) · modules `reports`, `reporting-core` · API `/api/reports/export/*`, `/api/accounting/export` · UI report/export actions · `Implemented`

## Automation

- [x] Rule-based automation engine · module `crm-pipeline-automation` · API `/api/crm/automation-rules*` · UI `/crm/automations` · `Implemented`
- [x] Sequence automation engine · module `crm-pipeline-automation` · API `/api/crm/sequence-*` · UI `/crm/sequences` · `Implemented`
- [x] DB job worker with retries/dead-letter/run telemetry · module `crm-pipeline-automation` · API `/api/crm/jobs*`, internal monitoring endpoints · UI `/crm/jobs` · `Implemented`
- [x] BullMQ worker stack (vin/bulk/analytics/alerts) · app `apps/worker` + dealer enqueue lib · API indirect via enqueueing events/routes · UI indirect · `Implemented`

## Platform

- [x] Platform auth/session/recovery · app `apps/platform` · API `/api/platform/auth/*` · UI `/platform/login`, `/platform/reset-password` · `Implemented`
- [x] Platform dashboard/accounts/users · app `apps/platform` · API `/api/platform/dashboard`, `/accounts`, `/users*` · UI `/platform`, `/platform/accounts`, `/platform/users` · `Implemented`
- [x] Application onboarding review flow · app `apps/platform` · API `/api/platform/applications*` + approve/reject/provision/invite-owner · UI `/platform/applications*` · `Implemented`
- [x] Dealership management and status sync · app `apps/platform` · API `/api/platform/dealerships*` · UI `/platform/dealerships*` · `Implemented`
- [x] Subscriptions/billing scaffolding · app `apps/platform` · API `/api/platform/subscriptions*`, `/billing` · UI `/platform/subscriptions`, `/platform/billing` · `Implemented`
- [x] Monitoring proxy to dealer internals · app `apps/platform` · API `/api/platform/monitoring/*` · UI `/platform/monitoring` · `Implemented`
- [x] Platform audit/reporting · app `apps/platform` · API `/api/platform/audit*`, `/platform/reports/*` · UI `/platform/audit`, `/platform/reports` · `Implemented`

## Admin

- [x] Dealer RBAC roles/permissions/overrides · module `core-platform` · API `/api/admin/roles*`, `/api/admin/permissions`, `/api/admin/users/*/roles`, `/permission-overrides` · UI `/admin/roles`, `/admin/users` · `Implemented`
- [x] Membership and dealership administration · module `core-platform` · API `/api/admin/memberships*`, `/api/admin/dealership*` · UI `/admin/dealership`, `/admin/users` · `Implemented`
- [x] Dealer audit log viewer · module `core-platform` · API `/api/audit` · UI `/admin/audit` · `Implemented`
- [x] File/document admin utilities · modules `core-platform`, `documents` · API `/api/files/*`, `/api/documents/*` · UI `/files` · `Implemented`

# 9. UI Feature Matrix

## Inventory

- features implemented:
  - vehicle management and media
  - acquisition and appraisal pipeline
  - auction sourcing and purchase conversion
  - recon workflow
  - floorplan + curtailment + payoff management
  - pricing rules, valuation/book value intelligence
  - listing syndication and feed exports
  - bulk import/update
- pages that should expose them:
  - `/inventory`, `/inventory/new`, `/inventory/[id]`, `/inventory/[id]/edit`
  - `/inventory/acquisition`, `/inventory/appraisals`
  - `/inventory/auctions`, `/inventory/auction-purchases`
  - `/inventory/aging`, `/inventory/pricing-rules`, `/inventory/dashboard`
- recommended screen grouping:
  - Inventory List + Filters
  - Vehicle Detail Workspace (Pricing, Recon, Floorplan, Media, Listings)
  - Acquisition Hub (Leads/Appraisals/Auctions)
  - Inventory Intelligence (Aging, Valuation, Alerts)

## CRM

- features implemented:
  - pipeline/stage management
  - opportunities lifecycle
  - sequence templates + run instances
  - rule automation engine and run controls
  - journey bar + CRM job operations
- pages that should expose them:
  - `/crm`, `/crm/opportunities`, `/crm/opportunities/[id]`
  - `/crm/sequences`, `/crm/automations`, `/crm/jobs`
- recommended screen grouping:
  - CRM Board
  - Opportunity Workspace
  - Engagement Automation Center
  - Job Operations Console

## Customers

- features implemented:
  - customer CRUD/search and saved views
  - notes/tasks/callback scheduling
  - timeline/activity and last-visit tracking
  - inbox/conversation context
- pages that should expose them:
  - `/customers`, `/customers/new`, `/customers/[id]`, `/crm/inbox`
- recommended screen grouping:
  - Customer Directory
  - Customer Profile Workspace
  - Customer Activities & Follow-up
  - Inbox/Conversations

## Messaging

- features implemented:
  - outbound SMS/email
  - webhook status/event ingestion
  - provider-linked activity logging
- pages that should expose them:
  - `/customers/[id]`, `/crm/opportunities/[id]`, `/crm/inbox`
- recommended screen grouping:
  - Conversation Panel
  - Outbound Composer
  - Delivery/Status Timeline

## Deals

- features implemented:
  - deal desk lifecycle
  - fees/trades and structured finance inputs
  - delivery queue
  - title/DMV queue
  - funding queue
- pages that should expose them:
  - `/deals`, `/deals/new`, `/deals/[id]`, `/deals/delivery`, `/deals/title`, `/deals/funding`
- recommended screen grouping:
  - Deal List & Pipeline
  - Deal Workspace (Desk + Finance + Compliance)
  - Post-Sale Operations (Delivery, Title, Funding)

## Finance

- features implemented:
  - finance shell terms/products
  - credit and lender applications
  - stipulations and compliance forms
  - deal documents and lender directory
  - accounting/tax link points
- pages that should expose them:
  - `/deals/[id]`, `/lenders`, `/accounting/*`, report pages
- recommended screen grouping:
  - F&I Package Builder
  - Lender Submission Pipeline
  - Compliance & Docs Center
  - Finance Ops/Admin

## Reports

- features implemented:
  - sales, pipeline, mix, penetration
  - dealer profit
  - inventory ROI
  - salesperson performance
  - exports
- pages that should expose them:
  - `/reports`, `/reports/profit`, `/reports/inventory-roi`, `/reports/salespeople`
- recommended screen grouping:
  - Executive Summary
  - Profitability Suite
  - Inventory Performance
  - Team Performance + Export Center

## Automation

- features implemented:
  - event-trigger automation rules
  - delayed/scheduled actions
  - sequence automation
  - DB job engine + telemetry
  - Redis worker queues for async pipelines
- pages that should expose them:
  - `/crm/automations`, `/crm/sequences`, `/crm/jobs`, monitoring screens
- recommended screen grouping:
  - Rule Designer
  - Sequence Designer
  - Run History + Job Health
  - Queue/Worker Observability

## Platform

- features implemented:
  - platform auth and account bootstrap
  - users/accounts/dealership/application/subscription management
  - cross-system provisioning and owner invites
  - monitoring and audit
  - reporting
- pages that should expose them:
  - `/platform`, `/platform/users`, `/platform/accounts`
  - `/platform/applications*`, `/platform/dealerships*`
  - `/platform/subscriptions`, `/platform/billing`
  - `/platform/reports`, `/platform/audit`, `/platform/monitoring`
- recommended screen grouping:
  - Platform Operations Home
  - Onboarding & Provisioning Center
  - Tenant Management
  - Monitoring & Compliance

## Admin

- features implemented:
  - role/permission management
  - user role assignment and permission overrides
  - membership/dealership administration
  - dealer audit and file operations
- pages that should expose them:
  - `/admin/users`, `/admin/roles`, `/admin/dealership`, `/admin/audit`, `/files`
- recommended screen grouping:
  - Access Control Center
  - Organization Management
  - Audit & Governance
  - File/Document Operations
