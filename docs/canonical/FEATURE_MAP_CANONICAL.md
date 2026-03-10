# Feature Map Canonical

Feature status definitions:
- `Implemented and code-backed`
- `Implemented but partial`
- `Scaffolded/stubbed`
- `Planned only`
- `Deprecated/superseded`

## 1. Access, Auth, Tenancy

| Feature | Status | Evidence |
|---|---|---|
| Dealer web login/logout/reset flows | Implemented and code-backed | Dealer auth routes under `apps/dealer/app/api/auth/*`, public pages under `apps/dealer/app/*login*` and tests. |
| Dealer mobile auth | Implemented and code-backed | `apps/mobile/src/auth/auth-service.ts`, auth screens, secure store session handling. |
| Platform web auth | Implemented and code-backed | `apps/platform/app/api/platform/auth/*`, `apps/platform/lib/platform-auth.ts`, platform login/reset pages. |
| Active dealership switching | Implemented and code-backed | Dealer `/api/auth/session/switch`, `/api/me/current-dealership`, mobile dealership switcher. |
| Encrypted active-dealership cookie | Implemented and code-backed | `apps/dealer/lib/tenant.ts`, `apps/dealer/lib/cookie.ts`. |
| Tenant lifecycle enforcement (`ACTIVE/SUSPENDED/CLOSED`) | Implemented and code-backed | Session context and dealer/platform status routes. |
| Dealer RBAC | Implemented and code-backed | `apps/dealer/lib/rbac.ts`, seeded roles/permissions, route guards. |
| Platform RBAC | Implemented and code-backed | `apps/platform/lib/platform-auth.ts`, route role checks. |

## 2. Onboarding and Provisioning

| Feature | Status | Evidence |
|---|---|---|
| Public dealer application draft and submit | Implemented and code-backed | `/api/apply/*`, `apps/dealer/modules/dealer-application/*`. |
| Invite-linked application flow | Implemented and code-backed | `/api/apply/invite/[token]`, dealer invite resolution and submit paths. |
| Platform application review and approval | Implemented and code-backed | `/api/platform/applications/*`, platform pages/tests. |
| Dealer tenant provisioning from platform | Implemented and code-backed | Platform provision routes plus dealer internal provision endpoint and shared contract. |
| Owner invite creation and acceptance | Implemented and code-backed | Dealer `/api/invite/*`, platform owner invite routes, internal dealer bridge. |
| Post-provision dealer onboarding checklist | Implemented and code-backed | Dealer onboarding module, `/api/onboarding`, `/api/auth/onboarding-status`, get-started UI. |

## 3. Inventory

| Feature | Status | Evidence |
|---|---|---|
| Vehicle CRUD | Implemented and code-backed | `/api/inventory`, `/api/inventory/[id]`, inventory service/tests, web/mobile UI. |
| Inventory list filters and pagination | Implemented and code-backed | Inventory list schemas, service filters, UI tests. |
| Vehicle detail | Implemented and code-backed | Dealer detail pages and `/api/inventory/[id]`. |
| Vehicle photos upload/manage | Implemented and code-backed | `/api/inventory/[id]/photos*`, storage metadata, tests. |
| Cost ledger and cost documents | Implemented and code-backed | `/api/inventory/[id]/cost*`, vendor-linked entries, UI tests. |
| Recon tracking | Implemented and code-backed | `/api/inventory/[id]/recon*`, recon models/services/tests. |
| Floorplan loans and curtailments | Implemented and code-backed | `/api/inventory/[id]/floorplan*`, floorplan models/tests. |
| Pricing rules | Implemented and code-backed | `/api/inventory/pricing-rules*`, pricing preview/apply routes. |
| Valuations and book values | Implemented and code-backed | `/api/inventory/[id]/valuation*`, `/book-values`, market/book value models. |
| VIN decode | Implemented and code-backed | `/api/inventory/vin-decode`, `/api/inventory/[id]/vin/decode`, NHTSA integration, tests. |
| Inventory dashboard and alerts | Implemented and code-backed | `/api/inventory/dashboard`, `/api/inventory/alerts*`, dealer dashboard integration. |
| Bulk import | Implemented but partial | Preview/apply/job endpoints and models exist; worker execution is partial. |
| Acquisition pipeline | Implemented and code-backed | `/api/inventory/acquisition*`, source lead and appraisal models. |
| Appraisals | Implemented and code-backed | `/api/inventory/appraisals*`. |
| Auction search/provider integration | Implemented but partial | Auction APIs and cache exist, but provider is `MOCK` in service code. |
| Auction purchases | Implemented but partial | CRUD/status support exists, but tied to mock auction inputs. |
| Listing publish/unpublish | Implemented but partial | `VehicleListing` and publish/unpublish routes exist; external marketplace push is not implemented. |
| Marketplace feed | Implemented but partial | `/api/inventory/feed` generates feed output; no outbound marketplace transport. |

## 4. Customers

| Feature | Status | Evidence |
|---|---|---|
| Customer CRUD | Implemented and code-backed | `/api/customers*`, customer services/tests, web/mobile UI. |
| Phones/emails/address/tags | Implemented and code-backed | Customer schema and serializers. |
| Notes | Implemented and code-backed | `/api/customers/[id]/notes*`. |
| Tasks | Implemented and code-backed | `/api/customers/[id]/tasks*`. |
| Activity/timeline | Implemented and code-backed | `/api/customers/[id]/activity`, `/timeline`, tests. |
| Callbacks | Implemented and code-backed | `/api/customers/[id]/callbacks*`. |
| Saved filters/searches | Implemented and code-backed | `/api/customers/saved-filters*`, `/saved-searches*`. |
| Appointments | Implemented but partial | Appointment endpoint exists under customer routes, but this is not a broad standalone scheduling subsystem. |

## 5. CRM and Automation

| Feature | Status | Evidence |
|---|---|---|
| Pipelines and stages | Implemented and code-backed | `/api/crm/pipelines*`, `/stages*`, DB models. |
| Opportunities | Implemented and code-backed | `/api/crm/opportunities*`, UI and tests. |
| Journey bar | Implemented and code-backed | `/api/crm/journey-bar`, UI tests. |
| Automation rules | Implemented and code-backed | `/api/crm/automation-rules*`, `AutomationRule` model. |
| CRM job execution | Implemented but partial | `/api/crm/jobs*`, DB-backed worker service exists. |
| Sequences and sequence instances | Implemented and code-backed | `/api/crm/sequence-*`, sequence models/tests. |
| CRM inbox conversations | Implemented but partial | `/api/crm/inbox/conversations` and UI exist, but inbox depth is narrower than a full omnichannel system. |
| Lead source reporting | Implemented and code-backed | `/api/crm/lead-sources`. |

## 6. Deals and F&I

| Feature | Status | Evidence |
|---|---|---|
| Deal CRUD and list/board views | Implemented and code-backed | `/api/deals`, `/api/deals/board`, dealer pages/tests. |
| Deal desk | Implemented and code-backed | `/api/deals/[id]/desk`, desk UI tests. |
| Status transitions and immutability rules | Implemented and code-backed | Service tests for transitions and contracted immutability. |
| Fees and trades | Implemented and code-backed | `/api/deals/[id]/fees*`, `/trade*`. |
| Delivery workflow | Implemented and code-backed | `/api/deals/[id]/delivery/*`, `/api/deals/delivery`. |
| Funding workflow | Implemented and code-backed | `/api/deals/[id]/funding*`, `/api/deals/funding`. |
| Title and DMV workflow | Implemented and code-backed | `/api/deals/[id]/title*`, `/api/deals/dmv-checklist*`, tests. |
| Deal profit | Implemented and code-backed | `/api/deals/[id]/profit`, reporting/accounting crossovers. |
| Deal history | Implemented and code-backed | `/api/deals/[id]/history`. |
| Finance shell calculations | Implemented and code-backed | Finance-shell service/tests and deal finance APIs. |
| Credit applications | Implemented and code-backed | `/api/credit-applications*`. |
| Lender applications and stipulations | Implemented and code-backed | `/api/lender-applications*`, `/api/lender-stipulations*`. |
| External lender system submission | Implemented but partial | External-system fields exist and workflow models exist, but live integrations are limited. |

## 7. Compliance, Documents, Messaging

| Feature | Status | Evidence |
|---|---|---|
| Compliance form generation and status | Implemented and code-backed | `/api/compliance-forms*`, finance-core services/tests. |
| Compliance alerts | Implemented and code-backed | `/api/compliance-alerts`. |
| General documents | Implemented and code-backed | `/api/documents*`, upload/signed-url routes. |
| Deal documents | Implemented and code-backed | `/api/deal-documents*`. |
| File uploads and signed URLs | Implemented and code-backed | `/api/files/upload`, `/api/files/signed-url`. |
| Outbound SMS | Implemented and code-backed | `/api/messages/sms`, Twilio service/tests. |
| Inbound Twilio webhooks | Implemented and code-backed | `/api/webhooks/twilio`, `/twilio/status`. |
| Outbound email | Implemented and code-backed | `/api/messages/email`, SendGrid service/tests. |
| Inbound SendGrid webhook | Implemented and code-backed | `/api/webhooks/sendgrid`. |

## 8. Reporting and Search

| Feature | Status | Evidence |
|---|---|---|
| Sales summary | Implemented and code-backed | `/api/reports/sales-summary`. |
| Sales by user / salesperson performance | Implemented and code-backed | `/api/reports/sales-by-user`, `/salesperson-performance`. |
| Dealer profit | Implemented and code-backed | `/api/reports/dealer-profit`. |
| Inventory aging and ROI | Implemented and code-backed | `/api/reports/inventory-aging`, `/inventory-roi`. |
| Finance penetration | Implemented and code-backed | `/api/reports/finance-penetration`. |
| Pipeline report | Implemented and code-backed | `/api/reports/pipeline`. |
| Exports | Implemented and code-backed | `/api/reports/export/inventory`, `/sales`. |
| Global search | Implemented and code-backed | `/api/search`, search module tests. |

## 9. Platform Control Plane

| Feature | Status | Evidence |
|---|---|---|
| Platform user management | Implemented and code-backed | `/api/platform/users*`, platform user service/tests. |
| Platform auth/session management | Implemented and code-backed | `/api/platform/auth/*`. |
| Platform applications review | Implemented and code-backed | `/api/platform/applications*`. |
| Platform dealership registry and mapping | Implemented and code-backed | `/api/platform/dealerships*`, platform schema. |
| Provisioning bridge to dealer app | Implemented and code-backed | `callDealerProvision`, dealer internal routes. |
| Owner invite orchestration | Implemented and code-backed | `/api/platform/dealerships/[id]/owner-invite`. |
| Accounts | Implemented and code-backed | `/api/platform/accounts`. |
| Subscriptions | Implemented but partial | CRUD/status support exists without external billing automation. |
| Billing overview | Scaffolded/stubbed | `/api/platform/billing` explicitly serves display-level plan/limits data only. |
| Monitoring and health checks | Implemented and code-backed | `/api/platform/monitoring/*`, service/tests. |
| Audit logs | Implemented and code-backed | `/api/platform/audit*`. |
| Usage/growth/funnel reports | Implemented but partial | Summary APIs exist, not a full analytics suite. |
| Impersonation start | Implemented and code-backed | `/api/platform/impersonation/start` plus dealer support-session flow. |

## 10. Mobile Coverage

| Feature | Status | Evidence |
|---|---|---|
| Login / forgot password / reset password | Implemented and code-backed | Mobile auth screens and service. |
| Accept invite | Implemented and code-backed | Mobile auth invite screen and public dealer APIs. |
| Dashboard | Implemented and code-backed | Mobile dashboard route and endpoints. |
| Inventory | Implemented and code-backed | List/detail/create/edit plus photo upload helpers. |
| Customers | Implemented and code-backed | List/detail/create/edit plus notes/timeline access. |
| Deals | Implemented and code-backed | List/detail/create/edit. |
| Dealer switcher | Implemented and code-backed | Mobile dealership switcher components and `/api/me/*`. |
| Push notifications | Scaffolded/stubbed | Feature flag is false and backend token persistence endpoint does not exist. |
| More/settings surface | Implemented but partial | Present, but not a deep settings product. |

## 11. Background Jobs and Automation

| Feature | Status | Evidence |
|---|---|---|
| Dealer DB-backed CRM jobs | Implemented and code-backed | CRM module job worker/service/tests. |
| Redis queue enqueue helpers | Implemented and code-backed | Dealer job enqueue helpers and Redis wrapper. |
| Separate BullMQ worker app | Implemented and code-backed | Worker bootstraps queues, handlers, retries, and dealer internal job execution. |
| Analytics queue execution | Implemented but partial | Worker-backed analytics recomputation exists, but remains bounded in scope. |
| Bulk import queue execution | Implemented and code-backed | Worker-backed bulk import processing persists progress and terminal state. |
| VIN decode queue execution | Implemented but partial | Queue/worker exist, but overall async pipeline is not the only execution path. |
| Alerting queue execution | Implemented but partial | Worker-backed alerts/signal refresh exists, but remains narrower than a broad alerting platform. |

## 12. Deprecated or Superseded Concepts

| Concept | Status | Notes |
|---|---|---|
| Vitest as current test runner | Deprecated/superseded | Current repo uses Jest in dealer/platform/mobile/contracts packages. |
| `pg-boss` as current background-job implementation | Deprecated/superseded | Current code uses BullMQ/ioredis plus dealer DB-backed job flows. |
| Dealer-hosted platform control plane in `apps/dealer/app/platform` and dealer public `/api/platform/*` routes | Deprecated/superseded | Removed in the platform cutover; `apps/platform` is now the only platform control plane. |
| Stripe-backed billing automation | Planned only | No Stripe/webhook code present. |
| Real external marketplace syndication | Planned only | Current listing/feed code is internal-state/feed generation only. |
