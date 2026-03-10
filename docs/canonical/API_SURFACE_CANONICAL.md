# API Surface Canonical

This file documents the current API surface by domain and access model.

## 1. API Conventions

Dealer route pattern:
- Located under `apps/dealer/app/api`
- Usually follows:
  - `getAuthContext(request)`
  - `guardPermission(...)` or `guardAnyPermission(...)`
  - Zod validation
  - domain service
  - `jsonResponse(...)`

Platform route pattern:
- Located under `apps/platform/app/api/platform`
- Usually follows:
  - `requirePlatformAuth()`
  - `requirePlatformRole(...)`
  - Zod validation
  - service or Prisma-backed orchestration

Tenancy:
- Dealer routes resolve dealership context on the server.
- Platform routes do not use dealer tenant context for auth; they operate as a control plane.

## 2. Dealer Public and Session Routes

| Route Group | Methods | Access | Notes |
|---|---|---|---|
| `/api/auth/*` | `GET`, `POST`, `PATCH` | public/session-bound | Login callback, logout, forgot/reset password, session inspection, session switch, session list, verify-email resend. |
| `/api/me` | `GET` | authenticated | Returns current user summary. |
| `/api/me/dealerships` | `GET` | authenticated | Lists dealerships available to the user. |
| `/api/me/current-dealership` | `GET`, `POST` | authenticated | Reads or sets active dealership context. |
| `/api/invite/*` | `GET`, `POST` | public/auth mix | Resolve and accept invite flows. |
| `/api/apply/*` | `GET`, `POST`, `PATCH` | public | Dealer application draft, fetch, submit, invite-linked application. |
| `/api/health` | `GET` | public | Dealer app health and env/db sanity. |
| `/api/metrics` | `GET` | operational | Prometheus-style metrics surface. |
| `/api/support-session/*` | `GET`, `POST` | special flow | Used for platform support-session consume/end behavior. |

## 3. Dealer Admin Routes

### Dealer admin

| Route Group | Methods | Typical Permissions | Notes |
|---|---|---|---|
| `/api/admin/dealership*` | `GET`, `POST`, `PATCH` | admin dealership/user permissions | Dealer-side dealership and location management. |
| `/api/admin/users*` | `GET`, `PATCH` | `admin.users.*`, `admin.memberships.*` families | User listing and effective-role management. |
| `/api/admin/memberships*` | `GET`, `POST`, `PATCH`, `DELETE` | `admin.users.*`, `admin.memberships.*` families | Membership CRUD. |
| `/api/admin/roles*` | `GET`, `POST`, `PATCH`, `DELETE` | admin role permissions | Role management. |
| `/api/admin/permissions` | `GET` | admin permissions | Permissions catalog endpoint. |
| `/api/admin/bootstrap-link-owner` | `POST` | bootstrap/admin flow | Development/bootstrap helper path. |

Important distinction:
- Dealer app no longer exposes a public `/api/platform/*` control-plane surface.
- `apps/platform` is the only canonical platform control-plane API surface.

## 4. Dealer Domain APIs

### Dashboard and intelligence

| Route Group | Methods | Permissions | Notes |
|---|---|---|---|
| `/api/dashboard` | `GET` | `dashboard.read` | Main dealer dashboard aggregate. |
| `/api/dashboard/layout*` | `POST` | `dashboard.read` | Dashboard layout persistence/reset. Widget visibility still depends on underlying domain permissions. |
| `/api/dashboard/v3*` | `GET` | `dashboard.read` and related dashboard widget permissions | Dashboard-v3 widget data. |
| `/api/intelligence/signals` | `GET` | intelligence permission families | Cross-domain signal reads. |
| `/api/intelligence/jobs/run` | `GET`, `POST` | intelligence run permissions | Manual/operational intelligence execution. |

### Inventory

| Route Group | Methods | Permissions | Notes |
|---|---|---|---|
| `/api/inventory` | `GET`, `POST` | `inventory.read`, `inventory.write` | List/create vehicles. |
| `/api/inventory/[id]` | `GET`, `PATCH`, `DELETE` | `inventory.read`, `inventory.write` | Vehicle detail mutate path. |
| `/api/inventory/[id]/photos*` | `GET`, `POST`, `PATCH`, `DELETE` | inventory and document/file write permissions | Photo upload, reorder, primary, delete. |
| `/api/inventory/[id]/cost*` | `GET`, `POST`, `PATCH`, `DELETE` | inventory write/read families | Cost ledger and cost-document operations. |
| `/api/inventory/[id]/recon*` | `GET`, `POST`, `PATCH`, `DELETE` | `inventory.read`, `inventory.write` | Recon entity and line items. |
| `/api/inventory/[id]/floorplan*` | `GET`, `POST`, `PUT`, `PATCH` | inventory/finance-related permissions | Floorplan management and payoff quote. |
| `/api/inventory/[id]/valuation*` and `/book-values` | `GET`, `POST` | `inventory.read`, `inventory.write` | Book value and valuation data. |
| `/api/inventory/[id]/pricing/*` | `POST` | `inventory.pricing.read`, `inventory.pricing.write` | Preview/apply pricing-rule results. |
| `/api/inventory/[id]/listings` | `GET` | `inventory.read` | Listing-status reads were normalized off `inventory.publish.read` onto the main inventory read permission. |
| `/api/inventory/[id]/publish` and `/unpublish` | `POST` | `inventory.publish.write` | Internal listing state transitions. |
| `/api/inventory/pricing-rules*` | `GET`, `POST`, `PATCH` | `inventory.pricing.read`, `inventory.pricing.write` | Dealer pricing rules CRUD. |
| `/api/inventory/dashboard` | `GET` | `inventory.read` | Inventory dashboard aggregate. |
| `/api/inventory/alerts*` | `GET`, `POST`, `DELETE` | `inventory.read` | Alert reads and dismiss/snooze actions. |
| `/api/inventory/aging` | `GET` | `inventory.read` | Aging list/report view. |
| `/api/inventory/appraisals*` | `GET`, `POST`, `PATCH` | `inventory.appraisals.read`, `inventory.appraisals.write` | Appraisal workflow. |
| `/api/inventory/acquisition*` | `GET`, `POST`, `PATCH` | `inventory.acquisition.read`, `inventory.acquisition.write` | Acquisition lead tracking. |
| `/api/inventory/auctions*` | `GET`, `POST` | `inventory.auctions.read` and `inventory.appraisals.write` for appraise actions | Auction search/detail/appraise over mock-backed provider. |
| `/api/inventory/auction-purchases*` | `GET`, `POST`, `PATCH` | `inventory.write` and read | Auction purchase tracking. |
| `/api/inventory/bulk/import*` | `GET`, `POST` | `inventory.write` | Bulk import preview/apply/job status. |
| `/api/inventory/bulk/update` | `PATCH` | `inventory.write` | Bulk updates. |
| `/api/inventory/vin-decode` and `/[id]/vin/decode` | `POST` | `inventory.read` or write depending path | NHTSA-backed VIN decode paths. |
| `/api/inventory/feed` | `GET` | `inventory.read` | Feed generation endpoint for listings/marketplace output. |

### Customers

| Route Group | Methods | Permissions | Notes |
|---|---|---|---|
| `/api/customers` | `GET`, `POST` | `customers.read`, `customers.write` | List/create customers. |
| `/api/customers/[id]` | `GET`, `PATCH`, `DELETE` | `customers.read`, `customers.write` | Customer detail mutate path. |
| `/api/customers/[id]/notes*` | `GET`, `POST`, `PATCH`, `DELETE` | `customers.read`, `customers.write` | Notes. |
| `/api/customers/[id]/tasks*` | `GET`, `POST`, `PATCH`, `DELETE` | `customers.read`, `customers.write` | Tasks. |
| `/api/customers/[id]/activity` | `GET`, `POST` | `customers.read`, `customers.write` | Activity log. |
| `/api/customers/[id]/timeline` | `GET` | `customers.read` | Combined timeline view. |
| `/api/customers/[id]/callbacks*` | `GET`, `POST`, `PATCH` | `customers.read`, `customers.write` | Callback workflow. |
| `/api/customers/[id]/appointments` | `POST` | `customers.write` | Appointment creation path. |
| `/api/customers/[id]/calls`, `/sms`, `/last-visit`, `/disposition` | `POST` | `customers.write` | Operational customer-touch actions. |
| `/api/customers/saved-filters*` | `GET`, `POST`, `DELETE` | `customers.read` at route boundary; `admin.settings.manage` for shared-item mutations | Saved filter management. Shared visibility elevation is enforced in service logic. |
| `/api/customers/saved-searches*` | `GET`, `POST`, `PATCH`, `DELETE` | `customers.read` at route boundary; `admin.settings.manage` for shared-item mutations | Saved search management and default-setting. Shared visibility elevation is enforced in service logic. |

### CRM and automation

| Route Group | Methods | Permissions | Notes |
|---|---|---|---|
| `/api/crm/pipelines*` and `/stages*` | `GET`, `POST`, `PATCH`, `DELETE` | `crm.read`, `crm.write` | Pipeline and stage CRUD. |
| `/api/crm/opportunities*` | `GET`, `POST`, `PATCH` | `crm.read`, `crm.write` | Opportunity CRUD and stage movement. |
| `/api/crm/opportunities/[id]/activity` | `GET` | `crm.read` | Opportunity activity. |
| `/api/crm/automation-rules*` | `GET`, `POST`, `PATCH`, `DELETE` | `crm.read`, `crm.write` | Automation rule CRUD. |
| `/api/crm/jobs*` | `GET`, `POST` | `crm.read`, `crm.write` | Dealer DB-backed job inspection and manual run. |
| `/api/crm/sequence-templates*`, `/sequence-steps*`, `/sequence-instances*` | `GET`, `POST`, `PATCH`, `DELETE` | `crm.read`, `crm.write` | Sequence system. |
| `/api/crm/customers/[id]/sequences` and `/stage` | `GET`, `POST`, `PATCH` | `crm.read`, `crm.write` | Customer-side CRM actions. |
| `/api/crm/inbox/conversations` | `GET` | `crm.read` | Inbox conversation listing surface. |
| `/api/crm/journey-bar` | `GET` | `crm.read` | Journey summary. |
| `/api/crm/lead-sources` | `GET` | `crm.read` | Lead source summary. |

### Deals, finance, compliance

| Route Group | Methods | Permissions | Notes |
|---|---|---|---|
| `/api/deals` | `GET`, `POST` | `deals.read`, `deals.write` | List/create deals. |
| `/api/deals/[id]` | `GET`, `PATCH`, `DELETE` | `deals.read`, `deals.write` | Deal detail mutate path. |
| `/api/deals/board`, `/delivery`, `/funding`, `/title` | `GET` | `deals.read` | Board and workflow list views. |
| `/api/deals/[id]/status` | `PATCH` | `deals.write` | Deal status transition. |
| `/api/deals/[id]/desk` | `POST` | `deals.write` | Deal desk updates. |
| `/api/deals/[id]/fees*` and `/trade*` | `GET`, `POST`, `PATCH`, `DELETE` | `deals.read`, `deals.write` | Fee and trade management. |
| `/api/deals/[id]/history` | `GET` | `deals.read` | Timeline/history. |
| `/api/deals/[id]/profit` | `GET` | `deals.read` or `finance.submissions.read` | Profit read route. |
| `/api/deals/[id]/title*` and `/dmv-checklist*` | `GET`, `POST`, `PATCH` | deals/write/read families | Title and DMV workflow. |
| `/api/deals/[id]/delivery/*` | `POST` | deals write family | Delivery readiness and completion. |
| `/api/deals/[id]/funding*` | `POST`, `PATCH` | finance/deals write family | Funding actions and status. |
| `/api/deals/[id]/finance*` | `GET`, `PUT`, `PATCH`, `POST`, `DELETE` | finance permissions | Deal finance shell and products. |
| `/api/credit-applications*` | `GET`, `POST`, `PATCH` | `finance.submissions.read`, `finance.submissions.write` | Credit application intake. |
| `/api/lender-applications*` and `/lender-stipulations*` | `GET`, `POST`, `PATCH`, `DELETE` | `finance.submissions.read`, `finance.submissions.write` | Lender application lifecycle. |
| `/api/lenders*` | `GET`, `POST`, `PATCH`, `DELETE` | `lenders.read`, `lenders.write` | Lender CRUD. |
| `/api/compliance-forms*` and `/compliance-alerts` | `GET`, `POST`, `PATCH` | `finance.submissions.read`, `finance.submissions.write` | Compliance forms and alerts. |

### Documents, files, messaging, reports, supporting domains

| Route Group | Methods | Permissions | Notes |
|---|---|---|---|
| `/api/documents*` | `GET`, `POST`, `PATCH`, `DELETE` | `documents.read`, `documents.write` | General document list and file metadata operations. |
| `/api/deal-documents*` | `GET`, `POST`, `DELETE` | document/deal permissions | Deal-linked documents. |
| `/api/files/upload`, `/files/signed-url` | `POST`, `GET` | document/file permissions | Upload and access helper routes. |
| `/api/messages/sms`, `/messages/email` | `POST` | `crm.write` | Outbound messaging. |
| `/api/webhooks/twilio*`, `/webhooks/sendgrid` | `POST` | webhook signature/path-based | Inbound integration endpoints. |
| `/api/reports/*` | `GET` | `reports.read` or export permissions | Sales, profit, finance penetration, pipeline, inventory, exports. |
| `/api/search` | `GET` | cross-domain read access | Global search. |
| `/api/accounting/*` | `GET`, `POST`, `PATCH` | `finance.submissions.read`, `finance.submissions.write` | Accounts, transactions, export. |
| `/api/expenses*` | `GET`, `POST`, `PATCH` | `finance.submissions.read`, `finance.submissions.write` | Dealership expense tracking. |
| `/api/vendors*` | `GET`, `POST`, `PATCH`, `DELETE` | inventory/accounting vendor permissions | Vendor management. |
| `/api/audit` | `GET` | `admin.audit.read` | Dealer audit log read surface. |
| `/api/cache/stats` | `GET` | operational | Cache observability. |

## 5. Dealer Internal Routes

These are not public tenant APIs.

| Route Group | Access | Purpose |
|---|---|---|
| `/api/internal/provision/dealership` | signed internal JWT | Dealer tenant provisioning from platform. |
| `/api/internal/applications*` | signed internal JWT | Platform reads/updates dealer application state. |
| `/api/internal/dealerships/[id]/invites*` | signed internal JWT | Platform-triggered dealership invite listing and revoke support. |
| `/api/internal/dealerships/[id]/owner-invite*` | signed internal JWT | Platform-triggered owner invite lifecycle. |
| `/api/internal/dealerships/[id]/status` | signed internal JWT | Platform-driven dealer status sync. |
| `/api/internal/monitoring/job-runs*` | signed internal JWT | Platform monitoring proxy target. |
| `/api/internal/monitoring/rate-limits*` | signed internal JWT | Platform monitoring proxy target. |
| `/api/internal/monitoring/maintenance/run` | signed internal JWT | Platform-triggered maintenance. |

## 6. Platform App APIs

### Platform auth and bootstrap

| Route Group | Methods | Access | Notes |
|---|---|---|---|
| `/api/platform/auth/*` | `GET`, `POST` | public/session | Platform login/logout/reset/session flows. |
| `/api/platform/bootstrap` | special | bootstrap | Seeds first platform owner when needed. |
| `/api/health` | `GET` | public | Platform app health. |

### Platform operator domains

| Route Group | Methods | Roles | Notes |
|---|---|---|---|
| `/api/platform/users*` | `GET`, `POST`, `PATCH`, `DELETE` | owner for writes, all roles for reads | Platform user CRUD. |
| `/api/platform/accounts` | `GET`, `POST` | owner for writes, all roles for reads | Platform account CRUD. |
| `/api/platform/applications*` | `GET`, `POST` | owner/compliance for approvals, owner for provisioning | Application review and provisioning orchestration. |
| `/api/platform/dealer-applications*` | `GET`, `PATCH` | platform roles | Platform-side dealer application list/detail surface. |
| `/api/platform/dealerships*` | `GET`, `POST`, `PATCH` | all roles read, owner for critical writes | Platform dealership registry and mapping-related actions. |
| `/api/platform/dealerships/[id]/owner-invite` | `POST` | owner | Owner invite orchestration through dealer bridge plus Resend email. |
| `/api/platform/dealerships/[id]/provision` | `POST` | owner | Creates dealer-side tenant mapping through internal bridge. |
| `/api/platform/dealerships/[id]/status` | `POST` | owner | Platform dealership lifecycle changes. |
| `/api/platform/subscriptions*` | `GET`, `POST`, `PATCH` | all roles read, owner write | Internal subscription record management. |
| `/api/platform/billing` | `GET` | all platform roles | Display-level billing/plan overview only. |
| `/api/platform/audit*` | `GET` | all platform roles | Platform audit retrieval with redaction. |
| `/api/platform/reports/*` | `GET` | all platform roles | Usage, growth, funnel summaries. |
| `/api/platform/monitoring/*` | `GET`, `POST` | all platform roles for reads, owner/support depending route | Dealer health, job-run, rate-limit, maintenance, event checks. |
| `/api/platform/impersonation/start` | `POST` | owner | Starts support-session/impersonation into dealer app. |
| `/api/platform/dashboard` | `GET` | platform roles | Platform dashboard summary. |

## 7. Validation and Error Handling Notes

Confirmed patterns:
- Zod validation is common across both apps.
- Dealer routes typically return HTTP `400` for Zod issues using `validationErrorResponse`.
- Platform routes commonly return `422` for validation failures using `errorResponse("VALIDATION_ERROR", ...)`.
- Route handlers consistently normalize API errors into JSON payloads.

Notable operational rules:
- Dealer routes are tenant-scoped.
- Platform bridge routes use signed internal auth rather than dealer tenant auth.
- Webhook routes are not dealer-session-authenticated.

## 8. API Summary

Dealer API shape:
- Broad, product-facing, tenant-scoped, permission-guarded.

Platform API shape:
- Narrower but powerful control-plane surface with role-based access.

Most important distinction:
- `apps/platform` owns the platform control plane.
- Dealer only exposes signed internal bridge endpoints and support-session helpers that exist to serve `apps/platform`.
