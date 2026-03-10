# Module Registry Canonical

Status legend:
- `Implemented`
- `Partial`
- `Scaffolded`

## Dealer Modules

| Module | Status | Purpose | Primary Paths | Main Route Roots | Notes |
|---|---|---|---|---|---|
| `accounting-core` | Partial | Chart of accounts, transactions, entries, dealership expenses, tax profile support | `apps/dealer/modules/accounting-core` | `/api/accounting/*`, `/api/expenses`, `/api/tax-profiles` | Real CRUD/reporting paths exist. External accounting integration is not implemented. |
| `core` | Implemented | Shared infrastructure helpers: cache, metrics, events, jobs tests | `apps/dealer/modules/core` | indirect | Internal infrastructure module rather than product surface. |
| `core-platform` | Implemented | Dealer-side role/permission admin flows, audits, session switching support | `apps/dealer/modules/core-platform` | `/api/admin/*`, internal admin support | Contains important dealer-side compatibility logic and tests. Dealer canonical permission catalog now lives in `apps/dealer/lib/constants/permissions.ts`. |
| `crm-pipeline-automation` | Partial | Pipelines, stages, opportunities, automation rules, jobs, sequences, inbox support | `apps/dealer/modules/crm-pipeline-automation` | `/api/crm/*`, parts of `/api/messages/*` | Strong CRUD and DB-backed job execution exist. Automation breadth is partial. |
| `customers` | Implemented | Customers, phones, emails, notes, tasks, callbacks, activity, saved searches/filters | `apps/dealer/modules/customers` | `/api/customers/*` | One of the most complete domains with strong tenant/RBAC tests. |
| `dashboard` | Implemented | Dashboard and dashboard-v3 data aggregation, layout persistence, metrics widgets | `apps/dealer/modules/dashboard` | `/api/dashboard*` | Real v1/v3 API surfaces and tests. Canonical access permission is `dashboard.read`; widget visibility still depends on underlying domain permissions. |
| `dealer-application` | Implemented | Dealer application draft/submit flow and related invite application paths | `apps/dealer/modules/dealer-application` | `/api/apply/*`, `/api/internal/applications/*` | Dealer-side half of platform onboarding pipeline. |
| `deals` | Implemented | Deal lifecycle, trade, fees, desk, title, delivery, funding, history | `apps/dealer/modules/deals` | `/api/deals/*` | Mature domain with transition, math, title/funding, and immutability tests. |
| `documents` | Implemented | Document metadata, uploads, signed URLs, deal documents | `apps/dealer/modules/documents` | `/api/documents/*`, `/api/deal-documents/*`, `/api/files/*` | Real storage metadata and signed URL issuance. |
| `finance-core` | Partial | Credit applications, lender applications, stipulations, compliance forms | `apps/dealer/modules/finance-core` | `/api/credit-applications/*`, `/api/lender-*`, `/api/compliance-*` | Real application/stipulation/compliance flows. External lender integrations are limited. |
| `finance-shell` | Partial | Deal finance calculations and finance shell UI logic | `apps/dealer/modules/finance-shell` | `/api/deals/[id]/finance*` | Calculation logic exists. Overall finance stack is split across modules. |
| `integrations` | Partial | SMS, email, webhooks, marketplace feed generation | `apps/dealer/modules/integrations` | `/api/messages/*`, `/api/webhooks/*`, `/api/inventory/feed` | Twilio/SendGrid are real. Marketplace is internal feed generation, not full syndication. |
| `intelligence` | Partial | Cross-domain signal engine and operator-facing signal surfaces | `apps/dealer/modules/intelligence` | `/api/intelligence/*` | Signal generation and reads exist; breadth is smaller than a full ML/decisioning platform. |
| `inventory` | Implemented | Vehicles, pricing, photos, recon, floorplan, listings, valuations, appraisals, acquisitions, auction cache/purchases, VIN decode, bulk import | `apps/dealer/modules/inventory` | `/api/inventory/*` | Largest dealer domain. Auction provider and some async paths remain partial/mock. |
| `lender-integration` | Partial | Lender CRUD and lender-related integration UI/service support | `apps/dealer/modules/lender-integration` | `/api/lenders/*` | Real CRUD and tests. External system coverage is mostly modeling, not full live integrations. |
| `onboarding` | Implemented | Dealer onboarding step tracking and launch readiness | `apps/dealer/modules/onboarding` | `/api/onboarding`, `/api/auth/onboarding-status` | Six-step DB-backed onboarding state. |
| `platform-admin` | Implemented | Dealer invite lifecycle helpers used by the platform bridge | `apps/dealer/modules/platform-admin` | dealer `/api/invite/*`, dealer `/api/internal/dealerships/*/invites*` | Legacy name, but current responsibility is dealer-owned invite bridge logic. It no longer owns dealer-hosted platform pages, public dealer `/api/platform/*` routes, or a dealer `PlatformAdmin` auth overlay. |
| `provisioning` | Implemented | Dealer-side provisioning helpers invoked by platform bridge | `apps/dealer/modules/provisioning` | `/api/internal/provision/*` | Internal-only dealer provisioning surface. |
| `reporting-core` | Implemented | Shared reporting calculations and exports | `apps/dealer/modules/reporting-core` | indirect and `/api/reports/*` | Core reporting logic with tenant isolation tests. |
| `reports` | Implemented | Sales, pipeline, finance penetration, inventory aging/ROI, exports | `apps/dealer/modules/reports` | `/api/reports/*` | Real reporting domain with unit and integration tests. |
| `search` | Implemented | Global search service and UI | `apps/dealer/modules/search` | `/api/search` | Smaller but complete feature slice. |
| `settings` | Partial | Settings UI, session management blocks | `apps/dealer/modules/settings` | UI only plus auth/session APIs elsewhere | Mostly UI-level settings surface. |
| `vendors` | Implemented | Vendor CRUD and vendor-linked cost entries | `apps/dealer/modules/vendors` | `/api/vendors/*` | Supporting domain for inventory/accounting workflows. |

## Platform App Subsystems

| Subsystem | Status | Purpose | Primary Paths | Main Route Roots | Notes |
|---|---|---|---|---|---|
| Platform auth | Implemented | Supabase-backed platform login and role gating | `apps/platform/lib/platform-auth.ts` | `/api/platform/auth/*` | Uses `PlatformUser` rows, not dealer memberships. |
| Applications | Implemented | Review, approve, reject, provision applications | `apps/platform/lib/application-onboarding.ts` | `/api/platform/applications*` | Central onboarding workflow. |
| Dealerships | Implemented | Platform dealership registry, provisioning, status changes, owner invite orchestration | `apps/platform/lib/service/dealerships.ts` | `/api/platform/dealerships*` | Real mapping to dealer tenants via internal bridge. |
| Users | Implemented | Platform user CRUD and invite support | `apps/platform/lib/platform-users-service.ts` | `/api/platform/users*` | Role-scoped APIs and tests are extensive. |
| Accounts | Implemented | Platform account CRUD | `apps/platform/lib/service/accounts.ts` | `/api/platform/accounts` | Lightweight but real. |
| Subscriptions | Partial | Platform subscription records and plan/billing status management | `apps/platform/lib/service/subscriptions.ts` | `/api/platform/subscriptions*` | Real internal records, no Stripe automation. |
| Billing view | Scaffolded | Display plan/limits data for dealerships | `apps/platform/app/api/platform/billing/route.ts` | `/api/platform/billing` | Explicitly scaffold-level display surface. |
| Monitoring | Implemented | Dealer health polling, maintenance, event retention, alerts | `apps/platform/lib/check-dealer-health-service.ts` and related files | `/api/platform/monitoring/*` | One of the stronger platform areas. |
| Audit | Implemented | Platform audit trail and redaction | `apps/platform/lib/audit.ts` | `/api/platform/audit*` | Real append-only operational audit surface. |
| Reports | Partial | Funnel, growth, usage summaries | `apps/platform/app/api/platform/reports/*` | `/api/platform/reports/*` | Operational summaries exist, not deep BI. |
| Internal dealer bridge | Implemented | Signed JWT bridge to dealer internal APIs | `apps/platform/lib/call-dealer-internal.ts` | indirect | Critical cross-app integration boundary. |

## Mobile App Domains

| Domain | Status | Purpose | Primary Paths | Notes |
|---|---|---|---|---|
| Auth | Implemented | Login, forgot password, reset password, invite acceptance | `apps/mobile/app/(auth)`, `apps/mobile/src/auth` | Uses Supabase directly and secure local session storage. |
| Dashboard | Implemented | Dashboard-v3 mobile summary | `apps/mobile/app/(tabs)/index.tsx` | Reads dealer dashboard data. |
| Inventory | Implemented | Inventory list, detail, create, edit, VIN decode, photo upload | `apps/mobile/app/(tabs)/inventory/*` | Good dealer API coverage. |
| Customers | Implemented | Customer list, detail, create, edit, notes/timeline access | `apps/mobile/app/(tabs)/customers/*` | Real CRUD-ish client. |
| Deals | Implemented | Deals list, detail, create, edit | `apps/mobile/app/(tabs)/deals/*` | Narrower than web but real. |
| Dealership switching | Implemented | Switch active dealership for mobile sessions | `apps/mobile/src/features/dealerships/*` | Depends on dealer `/api/me/*` endpoints. |
| Push notifications | Scaffolded | Future Expo push registration | `apps/mobile/src/services/push.ts` | Feature-flagged off and backend token storage is not implemented. |
| More/settings | Partial | Miscellaneous screen shell | `apps/mobile/app/(tabs)/more/index.tsx` | Mostly placeholder surface. |

## Worker and Shared Package

| Component | Status | Purpose | Primary Paths | Notes |
|---|---|---|---|---|
| `@dms/worker` | Implemented | BullMQ consumers for analytics, imports, VIN decode, alerts | `apps/worker/src` | Real process, queues, and business handlers. Remaining gaps are rollout/ops and broader integration coverage, not placeholder logic. |
| `@dms/contracts` | Implemented | Shared Zod contracts and TS types | `packages/contracts/src` | Used heavily by platform APIs and dealer/platform internal contracts. |

## UI Surfaces by App

Dealer app major page groups:
- Dashboard
- Inventory
- Customers
- CRM
- Deals
- Accounting
- Reports
- Vendors
- Files
- Settings
- Admin
- Get Started / onboarding
- Public auth/apply/invite routes

Platform app major page groups:
- Applications
- Dealer applications
- Dealerships
- Users
- Accounts
- Billing
- Subscriptions
- Audit
- Monitoring
- Reports
- Account/login/reset/forbidden/bootstrap

Mobile app major page groups:
- Auth
- Dashboard
- Inventory
- Customers
- Deals
- More

## Registry Summary

Most mature dealer domains:
- Inventory
- Customers
- Deals
- Reports
- Onboarding/auth/tenancy infrastructure

Most mature platform domains:
- Applications/provisioning
- Users/RBAC
- Monitoring
- Audit

Dealer RBAC state:
- Canonical dealer permission vocabulary is normalized to coarse `domain.read` / `domain.write` plus a small set of code-backed subdomains and rare exceptions.
- Dealer platform-admin access remains separate from dealer permission strings.

Most clearly partial or scaffolded areas:
- CRM DB-runner execution legacy
- Marketplace syndication beyond internal feed generation
- Auction provider integration
- Billing automation
- Mobile push notifications
