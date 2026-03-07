# DMS Module Registry

Per-module reference for `apps/dealer/modules/`. All paths are relative to `apps/dealer/`.

---

## core

| Field | Content |
|-------|---------|
| **Location** | `modules/core/` |
| **Responsibilities** | Infrastructure support: in-memory TTL cache used by distributed cache fallback; tests for cache, event bus, jobs, metrics, rate-limit. No domain entities. |
| **Primary entities** | None (cache only). |
| **Key services** | `cache/ttl-cache.ts` — `createTtlCache`. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## core-platform

| Field | Content |
|-------|---------|
| **Location** | `modules/core-platform/` |
| **Responsibilities** | Dealership, membership, roles, permissions, file storage, audit log access, user admin (roles/overrides). Platform-facing UI: DealershipPage, RolesPage, UsersPage, FilesPage, AuditPage. |
| **Primary entities** | Dealership, Membership, Role, Permission, UserRole, UserPermissionOverride, FileObject, AuditLog (read). |
| **Key services** | `service/role.ts`, `service/membership.ts`, `service/file.ts`, `service/user-admin.ts`, `service/audit.ts`, `service/dealership.ts`, `db/permission.ts`, `db/membership.ts`, etc. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## crm-pipeline-automation

| Field | Content |
|-------|---------|
| **Location** | `modules/crm-pipeline-automation/` |
| **Responsibilities** | CRM pipelines, stages, opportunities, sequences (templates and instances), automation rules, job runs, journey bar. Listens to opportunity and task events to drive automation. |
| **Primary entities** | Pipeline, Stage, Opportunity, SequenceTemplate, SequenceStep, SequenceInstance, AutomationRule, Job (run history). |
| **Key services** | `service/pipeline.ts`, `service/stage.ts`, `service/stage-transition.ts`, `service/opportunity.ts`, `service/sequence.ts`, `service/sequence-instance.ts`, `service/automation-rule.ts`, `service/automation-engine.ts`, `service/job-worker.ts`, `service/journey-bar.ts`. |
| **Events emitted** | `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`. |
| **Events consumed** | `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`, `customer.task_completed` (automation engine). |

---

## customers

| Field | Content |
|-------|---------|
| **Location** | `modules/customers/` |
| **Responsibilities** | Customer CRUD, notes, tasks, activity, timeline, callbacks, last-visit, saved filters and saved searches, team activity. |
| **Primary entities** | Customer, CustomerNote, CustomerTask, CustomerActivity, CustomerCallback, SavedFilter, SavedSearch. |
| **Key services** | `service/customer.ts`, `service/note.ts`, `service/task.ts`, `service/activity.ts`, `service/timeline.ts`, `service/callbacks.ts`, `service/last-visit.ts`, `service/saved-filters.ts`, `service/saved-searches.ts`, `service/team-activity.ts`. |
| **Events emitted** | `customer.created`, `customer.task_completed`. |
| **Events consumed** | None. |

---

## dashboard

| Field | Content |
|-------|---------|
| **Location** | `modules/dashboard/` |
| **Responsibilities** | Dashboard V3 data aggregation (KPIs, customer tasks, inventory alerts), layout persistence and merge, widget registry. No db layer; uses other modules and cache. |
| **Primary entities** | None (aggregation only). |
| **Key services** | `service/getDashboardV3Data.ts`, `service/dashboard-layout.ts`, `service/dashboard-layout-persistence.ts`, `service/merge-dashboard-layout.ts`, `service/dashboard-layout-cache.ts`, `service/floorplan-cache.ts`, `service/widget-registry.ts`. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## deals

| Field | Content |
|-------|---------|
| **Location** | `modules/deals/` |
| **Responsibilities** | Deal lifecycle, calculations, fees, trade-ins, history, deal pipeline, deal desk (workspace state). |
| **Primary entities** | Deal, DealFee, DealTrade, DealHistory. |
| **Key services** | `service/deal.ts`, `service/calculations.ts`, `service/deal-pipeline.ts`, `service/fee.ts`, `service/trade.ts`, `service/history.ts`, `service/deal-desk.ts`. |
| **Events emitted** | `deal.created`, `deal.status_changed`, `deal.sold`. |
| **Events consumed** | None. |

---

## documents

| Field | Content |
|-------|---------|
| **Location** | `modules/documents/` |
| **Responsibilities** | Deal document storage, upload validation, signed URL issuance. |
| **Primary entities** | Document (deal-linked). |
| **Key services** | `service/documents.ts`. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## finance-shell

| Field | Content |
|-------|---------|
| **Location** | `modules/finance-shell/` |
| **Responsibilities** | Finance shell per deal, CONTRACTED lock (no edits when deal is CONTRACTED), calculations. |
| **Primary entities** | DealFinance, finance products/state. |
| **Key services** | `service/` (index), `service/lock.ts`, `service/calculations.ts`, `service/events.ts`. |
| **Events emitted** | None. |
| **Events consumed** | `deal.status_changed` (lock finance when CONTRACTED). |

---

## inventory

| Field | Content |
|-------|---------|
| **Location** | `modules/inventory/` |
| **Responsibilities** | Vehicle CRUD, VIN decode, bulk import, floorplan loans, recon, alerts, book values, dashboard aggregates, vehicle photos, price-to-market, aging. |
| **Primary entities** | Vehicle, VehiclePhoto, FloorplanLoan, ReconItem, etc. |
| **Key services** | `service/vehicle.ts`, `service/vin-decode.ts`, `service/vin-decode-cache.ts`, `service/bulk.ts`, `service/floorplan.ts`, `service/floorplan-loans.ts`, `service/recon.ts`, `service/recon-items.ts`, `service/alerts.ts`, `service/book-values.ts`, `service/dashboard.ts`, `service/price-to-market.ts`, `service/vehicle-photo-backfill.ts`, `service/inventory-page.ts`, `service/inventory-intelligence-dashboard.ts`. |
| **Events emitted** | `vehicle.created`, `vehicle.updated`, `vehicle.vin_decoded`, `bulk_import.requested`. |
| **Events consumed** | None. |

---

## lender-integration

| Field | Content |
|-------|---------|
| **Location** | `modules/lender-integration/` |
| **Responsibilities** | Finance applications, submissions, stipulations, lender directory. |
| **Primary entities** | FinanceApplication, FinanceSubmission, Stipulation, Lender. |
| **Key services** | `service/application.ts`, `service/submission.ts`, `service/stipulation.ts`, `service/lender.ts`, `service/applicant.ts`, `service/events.ts`, `serialize.ts`, `schemas.ts`. |
| **Events emitted** | None. |
| **Events consumed** | `deal.status_changed`. |

---

## platform-admin

| Field | Content |
|-------|---------|
| **Location** | `modules/platform-admin/` |
| **Responsibilities** | Invite and pending-user flows; used by platform API and dealer invite endpoints. |
| **Primary entities** | Invite, PendingApproval (or equivalent). |
| **Key services** | `service/invite.ts`, `service/pending-users.ts`, `service/pending-approval.ts`, `db/invite.ts`. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## provisioning

| Field | Content |
|-------|---------|
| **Location** | `modules/provisioning/` |
| **Responsibilities** | Dealership provisioning (creation/setup). Service only; no db in module. |
| **Primary entities** | None (or delegated to core-platform/tenant). |
| **Key services** | `service/provision.ts`. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## reports

| Field | Content |
|-------|---------|
| **Location** | `modules/reports/` |
| **Responsibilities** | Sales summary, finance penetration, inventory aging, mix, pipeline, sales-by-user, export (inventory/sales). |
| **Primary entities** | None (read-only aggregates from deals/inventory/customers). |
| **Key services** | `service/index.ts` (getSalesSummary, getFinancePenetration, getInventoryAging, getMix, etc.), `service/export.ts`, `service/pipeline.ts`, `service/sales-by-user.ts`. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## search

| Field | Content |
|-------|---------|
| **Location** | `modules/search/` |
| **Responsibilities** | Global typeahead search across customers, deals, inventory. Permission-gated; tenant-scoped. No db layer; calls customers, deals, inventory db. |
| **Primary entities** | None. |
| **Key services** | `service/global-search.ts`. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## settings

| Field | Content |
|-------|---------|
| **Location** | `modules/settings/` |
| **Responsibilities** | Settings UI only (e.g. sessions, profile). No db or service in module. |
| **Primary entities** | None. |
| **Key services** | None. |
| **Events emitted** | None. |
| **Events consumed** | None. |

---

## API Route → Module / Permission Summary

| Route group | Module(s) | Typical permission(s) |
|-------------|-----------|----------------------|
| `/api/admin/*` | core-platform (roles, memberships, users, permissions) | admin.roles.read/write, admin.permissions.read |
| `/api/audit` | core-platform (audit) | — |
| `/api/auth/*` | lib/auth, tenant, session | — (auth only) |
| `/api/cache/stats` | lib/infrastructure/cache | — |
| `/api/crm/*` | crm-pipeline-automation | crm.read, crm.write |
| `/api/customers/*` | customers | customers.read, customers.write |
| `/api/dashboard/*` | dashboard | — (permission-aware in service) |
| `/api/deals/*` | deals, finance-shell, lender-integration | deals.read/write, finance.read/write |
| `/api/documents/*` | documents | documents.write |
| `/api/files/*` | core-platform (file) | — |
| `/api/health` | — | — |
| `/api/internal/*` | platform-admin, provisioning, core-platform | Internal API auth |
| `/api/inventory/*` | inventory | inventory.read, inventory.write |
| `/api/invite/*` | platform-admin | — |
| `/api/lenders/*` | lender-integration | lenders.read, lenders.write |
| `/api/me/*` | lib/tenant, core-platform | — |
| `/api/metrics` | lib/infrastructure/metrics | — |
| `/api/platform/*` | core-platform, platform-admin | requirePlatformAdmin() |
| `/api/reports/*` | reports | reports.read, reports.export |
| `/api/search` | search | (permission-gated inside globalSearch) |
| `/api/support-session/*` | lib (cookie, verify) | — |

---

*Generated from repo scan. Update when adding or changing modules.*
