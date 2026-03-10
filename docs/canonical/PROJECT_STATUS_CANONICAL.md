# Project Status Canonical

This document is the code-truth project status report for the repository as inspected on March 10, 2026.

Source-of-truth order:
1. current code under `apps/*`, `packages/*`, `scripts/*`, and Prisma schemas
2. current canonical docs under `docs/canonical/*`
3. legacy docs only when explicitly identified as superseded reference

## 1. Repo Summary

Repository shape:
- `apps/dealer`: primary product, Next.js App Router, 260 API routes, 68 page routes, 96 Prisma models, 23 dealer modules
- `apps/platform`: control-plane app, 48 API routes, 21 page routes, 11 Prisma models
- `apps/mobile`: Expo mobile client over dealer APIs
- `apps/worker`: BullMQ worker process with 5 queue consumers
- `packages/contracts`: shared internal and platform/dealer contracts

Observed maturity profile:
- dealer app is the most mature and carries most of the real business system
- platform app is materially implemented and is the canonical control plane for operations, onboarding, provisioning, monitoring, and user control
- mobile app is real and useful for core dealer workflows, but not close to web parity
- worker is now a real BullMQ-backed async subsystem, though rollout confidence still depends on live-environment deployment discipline

Conservative overall project completion estimate:
- `78%`

Interpretation:
- this is a real, substantial product, not a scaffold
- the remaining gaps are concentrated in external integrations, billing automation, mobile depth, and operational hardening rather than in basic domain modeling

## 2. High-Level Maturity Summary

Strongest areas:
- dealer auth, tenancy, and RBAC foundation
- dealer inventory domain breadth
- dealer customers and CRM core workflows
- dealer deals and finance shell workflows
- dealer reporting and search
- platform application review, provisioning, monitoring, and audit
- documentation clarity after canonization and RBAC normalization

Weakest areas:
- external marketplace syndication reality
- external auction and lender connector reality
- platform billing/payment automation
- mobile parity beyond dashboard, inventory, customers, and deals
- deeper observability and rollout confidence for worker-dependent flows
- test automation for deeper mobile flows and CI breadth
- CI/release automation maturity relative to codebase breadth

## 3. Status By Domain

### 3.1 Architecture and Foundation

Status:
- `Strong, mostly implemented`

What is clearly implemented:
- npm workspace monorepo with four apps and shared contracts
- separate dealer and platform Prisma schemas and databases
- dealer modular-monolith structure by domain
- signed dealer/platform internal API bridge
- health routes, request logging patterns, metrics endpoint, platform monitoring routes
- normalized dealer RBAC model and live-environment rollout tooling
- `main` as the active deploy branch in current GitHub Actions
- `.cursorrules` as the rule file that matches the active stack and conventions
- Phase 1 optimization quick wins landed in code: request-scoped auth/tenant/RBAC caching, queue singleton reuse for key producers, worker success-log gating, and dashboard grouped trend aggregation

What remains partial:
- dealer still retains dealer internal bridge endpoints behind the now-completed platform cutover
- async execution architecture is now aligned in code to BullMQ execution plus Postgres durable state, but still needs stronger rollout proof and Redis-backed integration coverage
- deployment/test CI automation is thinner than the application footprint

### 3.2 Dealer App

Status:
- `Mature and broad`

Current reality:
- the dealer app is the center of gravity for the system
- it contains the deepest domain coverage, strongest test coverage, and most production-like logic
- most high-value business flows are code-backed here

Most mature dealer areas:
- inventory
- customers
- deals
- finance shell and finance-core support flows
- reports
- admin/users/roles/audit
- onboarding and application intake

Weaker dealer areas:
- settings surface depth
- some dashboard v1 legacy section logic versus v3 shell maturity
- marketplace/auction/lender external-connectivity depth
- some UI tabs still contain placeholders in vehicle edit flows

### 3.3 Platform App

Status:
- `Strong operational control plane, not full SaaS back office`

What is clearly implemented:
- `apps/platform` is the canonical platform control plane
- platform auth and role gating
- application intake review and approval
- dealership registry and dealer mapping
- owner invite orchestration
- provisioning bridge to dealer app
- platform users and accounts
- monitoring, health, maintenance, audit, and reporting summaries
- internal subscription records with CRUD/status management

What remains partial:
- billing is internal plan/status management, not external billing automation
- reporting is useful but limited to summary/ops reporting rather than full BI
- some operational flows still depend on the dealer app being reachable and correctly configured
- residual dealer support depends on signed dealer internal endpoints and dealer-side invite/support helpers

### 3.4 Mobile App

Status:
- `Real but limited`

What is clearly implemented:
- Supabase auth, invite acceptance, forgot/reset flows
- dashboard screen backed by dealer dashboard APIs
- inventory list/detail/create/edit with photo upload and VIN-related support
- customers list/detail/create/edit with notes/timeline support
- deals list/detail/create/edit with status mutation
- dealership switching
- bearer-token support against dealer APIs

What remains partial:
- more/settings screen is shallow and explicitly contains placeholder copy
- no admin, reports, lender, accounting, or deeper CRM automation tooling on mobile
- push notification service is feature-flagged and depends on backend endpoints that do not exist
- test coverage is light and focused mostly on validation/utilities

Realistic interpretation:
- the mobile app is good enough for core field workflows
- it is not feature-parity with the dealer web app

### 3.5 Worker and Background Processing

Status:
- `Implemented and materially useful, with operational follow-up remaining`

What is clearly implemented:
- dealer-side CRM automation/job persistence in Postgres, with BullMQ now owning the CRM execution trigger boundary
- BullMQ enqueue helpers in dealer app
- standalone worker boot path, Redis connection, queue naming, and consumer registration
- dealer internal worker endpoints with signed JWT authentication
- bulk import worker-backed execution with persisted job progress and completion/failure state
- analytics and alerts worker-backed execution through cache invalidation plus intelligence-signal recomputation
- VIN follow-up worker execution that warms VIN cache and attaches decode snapshots when appropriate
- CRM worker-backed execution through the `crmExecution` queue and dealer internal CRM execution endpoint
- dealer job-run telemetry for internal worker executions
- focused worker/dealer async test coverage

Operational implication:
- async architecture is real and product-backed
- BullMQ is the canonical execution layer
- Postgres remains the durable workflow-state layer
- the main remaining async gaps are rollout proof, Redis-backed end-to-end coverage, and simplification of the preserved CRM claim/state loop rather than a missing BullMQ executor boundary

### 3.6 Auth, Tenancy, and RBAC

Status:
- `Strong and recently normalized`

What is clearly implemented:
- Supabase-backed auth for dealer, platform, and mobile
- encrypted active-dealership cookie for web
- bearer-token dealership resolution for mobile
- dealership lifecycle enforcement
- role union plus user override dealer RBAC model
- normalized canonical dealer permission vocabulary
- platform role-based RBAC model in the platform app
- live-environment RBAC normalization scripts and rollout documentation

Remaining risks:
- non-reset environments still require rollout discipline for RBAC normalization scripts
- platform-to-dealer operator flows still depend on signed dealer internal endpoints and support-session token exchange

### 3.7 Inventory

Status:
- `One of the strongest domains`

What is clearly implemented:
- vehicle CRUD, list, filters, detail, create/edit flows
- VIN decode with cache support
- vehicle photos
- cost ledger and cost documents
- recon tracking
- floorplan support and payoff/curtailment endpoints
- pricing rules and pricing application
- valuations and book values
- acquisition pipeline
- appraisals with approve/reject/convert flows
- inventory alerts and dashboard metrics
- marketplace feed generation and internal listing publish state

What remains partial:
- bulk import async execution is now real, but live-environment rollout and supervision still need confirmation
- auction search/purchase flows are modeled, but service behavior is still mock-backed
- publish/unpublish and feed generation exist, but no confirmed outbound marketplace transport is implemented in this repo
- some inventory edit sub-tabs remain placeholder UI

### 3.8 Customers and CRM

Status:
- `Strong, with some narrower subsystems`

What is clearly implemented:
- customer CRUD with phones/emails/address/tags
- notes, tasks, callbacks, timeline/activity
- saved filters and saved searches
- pipelines, stages, opportunities, journey bar
- automation rules, sequences, sequence instances, stage transitions
- CRM jobs with Postgres-backed workflow state and BullMQ-triggered execution
- global search integration and customer-linked workflow surfaces

What remains partial:
- CRM inbox exists, but it is narrower than a full omnichannel inbox product
- appointments exist only as a limited customer/CRM activity concept, not as a full scheduling subsystem
- customer detail UI still includes at least one explicit future placeholder card for deal summaries

### 3.9 Deals, Finance, and Desking

Status:
- `Strong overall, with partial external connectivity`

What is clearly implemented:
- deal CRUD and board/list views
- deal desk math and calculations
- fees and trades
- title, DMV, delivery, and funding workflows
- finance shell calculations and product support
- credit applications, lender applications, submissions, stipulations, funding status
- compliance forms and deal document flows
- profit and history surfaces

What remains partial:
- live lender-system integration is not proven from this repo
- finance stack is broad but spread across multiple modules, which increases operational complexity
- some advanced lender/external-provider behavior is modeled rather than deeply integrated

### 3.10 Reports and Analytics

Status:
- `Strong dealer reporting, lighter platform analytics`

Dealer reporting clearly implemented:
- sales summary
- sales by user
- inventory aging
- inventory ROI
- dealer profit
- finance penetration
- pipeline report
- exports

Platform reporting clearly implemented:
- usage, funnel, and growth summary APIs/pages

What remains partial:
- platform reporting is operational summary reporting, not a full analytics platform
- worker-based analytics recomputation is real, but still bounded to cache invalidation and intelligence-signal refresh rather than a separate analytics warehouse
- intelligence/signals exist but are narrower than a broad AI/analytics system

### 3.11 Integrations

Status:
- `Mixed: messaging is real, many ecosystem connectors are partial`

Clearly real in code:
- Supabase
- Twilio outbound and inbound/status webhooks
- SendGrid outbound and inbound parse handling
- Resend for platform emails
- Slack webhook alerting for platform monitoring
- NHTSA vPIC VIN decode path
- signed dealer/platform JWT bridge

Partial or limited:
- BullMQ/Redis path is real and now executes business work through signed dealer internal job endpoints
- marketplace support is feed generation plus listing state, not proven external syndication
- auction support is modeled but mock-backed
- lender external systems are modeled but not proven live-integrated
- QuickBooks/integration permission families were intentionally removed from canonical dealer RBAC and no active integration implementation was found

### 3.12 Platform SaaS, Provisioning, and Subscriptions

Status:
- `Provisioning strong, billing weak`

Clearly implemented:
- application review and approval
- provisioning dealer tenants from platform
- owner invite orchestration
- dealership mapping and status changes
- platform subscriptions records and plan/billing-status CRUD

Partial/scaffolded:
- billing overview route explicitly says it is display-only
- no Stripe, payment methods, invoice flows, or billing webhooks were found
- subscription records are operational metadata, not proof of real billing automation

### 3.13 Docs, Developer Experience, and Operations

Status:
- `Much improved, still some ops gaps`

Clearly implemented:
- canonical documentation set under `docs/canonical`
- `.cursorrules` is the active development rule source and matches the current stack
- developer runbooks for RBAC rollout and migration review
- migration/reset/generate scripts for dealer and platform
- health endpoints and monitoring helpers

What remains partial:
- no dedicated test CI workflow was found
- worker tests are focused and meaningful, but still not broad integration/Redis coverage
- live rollout still depends on operator discipline and environment-specific verification
- legacy docs and obsolete rule files still exist outside the canonical path and can still cause drift if opened first

### 3.14 Testing, QA, and Production Readiness

Status:
- `Backend testing strong, overall readiness moderate`

What is strong:
- dealer test surface is broad and deep across routes, modules, RBAC, and tenant isolation
- platform API RBAC and monitoring coverage is strong
- critical dealer domains have real unit/integration coverage

What is weaker:
- mobile tests are limited
- worker tests are focused rather than broad end-to-end Redis/dealer integration coverage
- no browser E2E framework or dedicated test CI workflow was found
- production readiness still depends on confirming worker deployment and env configuration in every live environment
- optimization gains are implemented but still need staging/production telemetry baselines to quantify realized performance impact

## 4. Strongest Completed Areas

Most trustworthy code-backed areas today:
- dealer auth/tenancy/RBAC foundation
- dealer inventory breadth
- dealer customers + CRM core
- dealer deals + finance shell + title/funding/delivery
- dealer reporting and search
- platform applications/provisioning
- platform monitoring and audit

## 5. Weakest Or Most Incomplete Areas

Least mature areas today:
- external marketplace syndication
- external auction provider integration
- external lender-system integration depth
- platform billing automation and payment-provider integration
- mobile push notifications
- mobile admin/reporting/settings parity
- CI/test automation breadth relative to system size

## 6. Operational Risks

High-signal operational risks from current code:
- worker deployment and actual usage cannot be proven from repo alone
- environments with older dealer RBAC data still need normalization rollout discipline
- billing/subscription surfaces could be mistaken for full billing automation when they are not
- marketplace/auction/lender route surfaces are broader than the confirmed external-integration depth
- worker env/config drift could silently disable async execution if `REDIS_URL`, `DEALER_INTERNAL_API_URL`, or `INTERNAL_API_JWT_SECRET` are missing
- mobile app breadth may be overestimated if judged only by route count

## 7. Unresolved Ambiguities

These cannot be fully proven from repository inspection alone:
- whether all production-like environments actually run the standalone worker
- whether any real auction, lender, or marketplace connectors are deployed outside this repo
- whether platform billing is intentionally internal-only or awaiting external billing integration
- how many live custom dealer roles still need post-normalization review in long-lived environments

## 8. Realistic Completion Picture By Domain

Approximate maturity by major area:
- architecture/foundation: strong
- dealer app: strong
- platform app: strong for ops, partial for commercial back office
- mobile: meaningful but not broad
- worker: mid-to-late maturity structurally and behaviorally, with rollout confidence still needing confirmation
- integrations: selective and uneven
- testing: strong for core backend, weaker elsewhere

The project is not blocked by lack of core domain implementation.
It is mainly limited by:
- external connector depth
- live-environment async rollout confidence
- mobile parity
- operational hardening and rollout discipline

## 9. Recommended Next Priorities

1. Roll out and verify the completed worker stack in every live environment, including env vars and process supervision.
2. Decide which external integrations are real product commitments and remove ambiguity around marketplace, auction, and lender connectivity.
3. Add CI test automation and broader worker integration coverage to reduce operational blind spots.
4. Measure post-Phase-1 optimization impact in staging/prod-like environments (auth/tenant query counts, dashboard cache-miss latency, worker log-volume reduction).
5. Decide whether platform billing will stay internal-record-only or become a real payment/subscription system.
