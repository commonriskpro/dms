# Dealer SQL Scalability Optimization Spec

Repo-specific plan for scaling the dealer app database layer while preserving the current security model.

Primary constraint:
- keep tenant isolation anchored on `dealershipId`
- keep permission enforcement in API/service layers
- optimize query shape, indexing, projections, and caching without bypassing the existing security posture

Related references:
- [schema.prisma](/Users/saturno/Downloads/dms/apps/dealer/prisma/schema.prisma)
- [DEALER_DATABASE_WORKTREE.md](/Users/saturno/Downloads/dms/apps/dealer/docs/DEALER_DATABASE_WORKTREE.md)
- [db.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db.ts)
- [paginate.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db/paginate.ts)
- [common-selects.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db/common-selects.ts)
- [CRM_UNIFIED_INBOX_IMPLEMENTATION_SPEC.md](/Users/saturno/Downloads/dms/apps/dealer/docs/CRM_UNIFIED_INBOX_IMPLEMENTATION_SPEC.md)

---

## 1. Current Observations

The current codebase is reasonably structured, but not fully optimized for scale yet.

What is already good:
- most operational models are tenant-scoped by `dealershipId`
- service layer uses `requireTenantActiveForRead` / `requireTenantActiveForWrite`
- many hot tables already have useful composite indexes
- slow query logging exists in [db.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db.ts)
- some heavy paths already use grouped SQL instead of naive ORM loops

Main bottlenecks likely still present:
- offset pagination (`skip/take`) on growing operational lists
- broad `include` trees on summary/list endpoints
- repeated `count()` and `findMany()` calls on dashboard and command-center surfaces
- customer/inbox flows still partially built on `CustomerActivity`
- no broad projection/read-model strategy yet for all heavy dashboards and queues

---

## 2. Security Invariants

These are non-negotiable and must survive every optimization:

1. Every query path remains tenant-scoped by `dealershipId`.
2. No raw SQL may run without an explicit dealership filter where tenant data is involved.
3. Auth context remains resolved through [handler.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/api/handler.ts).
4. Read/write tenant activity checks remain in service layer, not pushed down into UI assumptions.
5. Permission checks remain before business operations.
6. Cache keys must include `dealershipId` and, when needed, user-specific scope.
7. Read-model tables and projection jobs must never aggregate across dealerships.

---

## 3. Hottest Query Families

These are the best places to optimize first.

### A. Inventory list and vehicle workspace

Main code surfaces:
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/inventory/route.ts)
- [InventoryListContent.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/inventory/ui/InventoryListContent.tsx)
- [InventoryPageContentV2.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/inventory/ui/InventoryPageContentV2.tsx)

Likely pressure points:
- filtered vehicle lists
- counts and sorting over vehicle status/createdAt
- vehicle detail side data fetched in multiple calls

### B. Customer list and customer detail

Main code surfaces:
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/customers/route.ts)
- [customers.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/db/customers.ts)
- [CustomersPageClient.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/ui/CustomersPageClient.tsx)

Likely pressure points:
- search over name/phone/email
- draft/final filters
- list paging and sorting
- customer detail panels with related tasks, activity, opportunities, callbacks

### C. CRM opportunities and pipeline board

Main code surfaces:
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/opportunities/route.ts)
- [opportunity.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/db/opportunity.ts)
- [OpportunitiesWorkspacePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/ui/OpportunitiesWorkspacePage.tsx)

Likely pressure points:
- stage-grouped counts
- list and board views over same data
- owner/stage/status filters
- opportunity context hydration

### D. CRM inbox

Main code surfaces:
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/inbox/conversations/route.ts)
- [inbox.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/service/inbox.ts)
- [activity.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/db/activity.ts)
- [InboxPageClient.tsx](/Users/saturno/Downloads/dms/apps/dealer/app/(app)/crm/inbox/InboxPageClient.tsx)

Likely pressure points:
- queue aggregation from `CustomerActivity`
- conversation latest-message derivation
- timeline/thread hydration
- future multi-channel volume

### E. Dashboard and command center

Main code surfaces:
- [getDashboardV3Data.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/dashboard/service/getDashboardV3Data.ts)
- [command-center.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/service/command-center.ts)

Likely pressure points:
- many separate `count()` calls
- wide fan-out aggregate reads
- repeated scans over the same tenant slice

### F. Reports

Main code surfaces:
- [inventory.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/inventory.ts)
- [sales.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/sales.ts)
- [finance.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/finance.ts)

Likely pressure points:
- export/report scans over larger date windows
- joins between deals, customers, finance, vehicles

---

## 4. Query Shape Changes

### 4.1 Replace offset pagination on large operational surfaces

Current pattern:
- shared helper in [paginate.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db/paginate.ts)
- `skip + take + count`

Recommended change:
- use cursor/keyset pagination for hot operational lists

Best targets:
- customers list
- inventory list
- opportunities list
- inbox conversations
- inbox messages
- timeline/activity feeds

Suggested cursor columns:
- `createdAt`
- `updatedAt`
- `lastMessageAt`
- `nextActionAt`
- tie-break on `id`

Expected impact:
- deep paging becomes dramatically cheaper
- fewer large offset scans
- better stability as tenant datasets grow

Estimated gain:
- deep pages: `2x` to `10x`
- typical list response: from `300-1500ms` to `80-300ms`

### 4.2 Replace broad `include` trees with explicit `select` shapes

Current pattern:
- many list endpoints pull more related data than they need

Recommended change:
- create domain-level `SUMMARY_SELECT` and `DETAIL_SELECT` objects
- use `select` by default
- reserve `include` for rare true detail loads

Targets:
- customers
- vehicles
- opportunities
- lenders/applications lists
- documents and inbox list rows

Expected impact:
- lower DB work
- lower JSON payload size
- less front-end overfetch

Estimated gain:
- `20%` to `60%` query improvement
- `30%` to `70%` payload reduction on list routes

### 4.3 Consolidate repeated aggregate queries

Current pattern:
- dashboard and command-center use many independent Prisma `count()` calls

Recommended change:
- use grouped SQL with `FILTER`, conditional aggregates, or summary tables

Best targets:
- dashboard KPI cards
- command-center queue counts
- pipeline stage counts
- inbox queue counts

Expected impact:
- fewer DB round trips
- fewer repeated scans per tenant

Estimated gain:
- `40%` to `85%` on heavy aggregate endpoints

### 4.4 Raw SQL only where it is actually justified

Use raw SQL for:
- grouped aggregates
- “latest event per entity”
- queue projections
- report/window queries

Do not use raw SQL for:
- standard CRUD
- small relation fetches Prisma already handles well

Security rule:
- always parameterized
- always tenant-scoped
- always kept inside db modules

---

## 5. Index Plan

### 5.1 General rule

For hot operational tables:
- put `dealership_id` first in tenant-scoped composite indexes
- then the primary filter columns
- then the sort column

### 5.2 Candidate index review by domain

These are not guaranteed missing; they are the first review targets against actual query plans.

#### Customer

Existing schema is already decent.

Review/add if query plans show scans:
- `(dealership_id, is_draft, updated_at desc)`
- `(dealership_id, assigned_to, updated_at desc)`
- `(dealership_id, status, updated_at desc)`

For search:
- consider Postgres trigram indexes for `Customer.name`, `CustomerPhone.value`, `CustomerEmail.value`
- only after validating that current `contains` search is a hotspot

#### Vehicle

Review/add:
- `(dealership_id, status, created_at desc)`
- `(dealership_id, stock_number)`
- `(dealership_id, vin)`
- `(dealership_id, deleted_at, created_at desc)` if list queries frequently exclude soft-deleted rows

#### Opportunity

Review/add:
- `(dealership_id, stage_id, updated_at desc)`
- `(dealership_id, owner_id, updated_at desc)`
- `(dealership_id, status, next_action_at)`

#### InboxConversation

Now that canonical inbox exists, prioritize:
- `(dealership_id, last_message_at desc)`
- `(dealership_id, waiting_on, last_message_at desc)`
- `(dealership_id, assigned_to_user_id, last_message_at desc)`
- `(dealership_id, status, last_message_at desc)`

#### InboxMessage

Priority:
- `(conversation_id, created_at desc)`
- `(dealership_id, provider, provider_message_id)`
- `(dealership_id, customer_id, created_at desc)`

#### CustomerActivity

During migration window:
- keep current indexes
- avoid adding too many more if inbox reads are moving off it soon

---

## 6. Projection / Read Model Plan

This is the biggest long-term scaling lever.

### 6.1 Unified inbox

Already started.

Plan:
- switch inbox reads from `CustomerActivity` to canonical inbox tables
- keep `CustomerActivity` as projection only

Expected impact:
- queue reads become simpler and cheaper
- future WhatsApp / Meta channels become practical

Estimated gain:
- inbox queue `2x` to `5x`
- thread load `30%` to `70%`

### 6.2 Dashboard summaries

Introduce dealership-scoped summary tables or snapshots for:
- vehicle counts by status
- opportunity counts by stage
- stale tasks/callbacks
- inventory valuation rollups

Possible storage:
- reuse or extend summary snapshot patterns already in schema
- scheduled refresh and/or event-driven updates

Expected impact:
- dashboard reads stop scanning large transactional tables

Estimated gain:
- dashboard from `800-3000ms` to `100-400ms`

### 6.3 Command center queues

Create dedicated read models for:
- waiting conversations
- overdue callbacks
- stale opportunities
- pending sequence work

Expected impact:
- command center becomes queue-driven instead of aggregate-on-demand

Estimated gain:
- `700-2500ms` to `120-450ms`

### 6.4 Pipeline board summaries

Create stage summary projections:
- stage totals
- stage value totals
- stage recent movement

Expected impact:
- board view renders cheaply
- filters become lighter

Estimated gain:
- `400-1800ms` to `100-300ms`

---

## 7. Caching Plan

### Safe caching targets

- dashboard KPIs
- command center KPI blocks
- pipeline stage summaries
- inbox queue counts
- inventory summary cards

### Not safe for caching

- mutable record edit forms
- write-after-read screens expecting immediate fresh state
- security-sensitive personalized records unless cache key includes user scope

### Cache key rules

Every key must include:
- `dealershipId`

Include also when relevant:
- `userId`
- filter set
- view mode

Suggested TTLs:
- KPI/summary blocks: `15-60s`
- queue counts: `10-30s`
- reports: route-dependent, possibly longer

Expected gain:
- repeated reads `5x` to `20x` perceived improvement
- cached responses often `20-80ms`

---

## 8. Code Impact

### Low impact

- [db.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db.ts)
- [schema.prisma](/Users/saturno/Downloads/dms/apps/dealer/prisma/schema.prisma)
- [paginate.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db/paginate.ts)
- `db` helper utilities

Typical changes:
- query logging improvements
- index additions
- cursor helper utilities

### Medium impact

- customers db/services
- inventory db/services
- opportunities db/services
- inbox services
- list API routes
- list page clients

Typical changes:
- cursor pagination
- slimmer select shapes
- endpoint response shape adjustments

### High impact

- dashboard service layer
- command center service layer
- unified inbox read switch
- read-model creation and projection jobs

Typical changes:
- new summary tables or projection services
- route implementations switching to read models

---

## 9. Estimated Performance Outcomes

These are practical engineering estimates for a larger single-dealership dataset.

### Customer list
- current likely: `250-1200ms`
- optimized target: `80-220ms`

### Inventory list
- current likely: `300-1500ms`
- optimized target: `90-250ms`

### Opportunity list / pipeline board
- current likely: `400-1800ms`
- optimized target: `100-300ms`

### Inbox queue
- current likely: `300-1200ms`
- optimized target: `80-250ms`

### Inbox thread
- current likely: `200-900ms`
- optimized target: `70-180ms`

### Dashboard / command center
- current likely: `800-3000ms`
- optimized target: `100-450ms`

### Heavy reports
- current likely: `1.5-8s`
- optimized target: `300ms-2s`

These are only realistic if:
- indexes match hot query shapes
- keyset pagination replaces offset where appropriate
- dashboards/queues move to projections or grouped SQL

---

## 10. Rollout Order

### Phase 1: instrumentation and query-plan audit

Do:
- tag slow-query logs with route/service names
- gather top offenders
- run `EXPLAIN ANALYZE` on hot queries

Risk:
- very low

### Phase 2: index review and additions

Do:
- audit hot filters/sorts
- add missing composite indexes

Risk:
- low

### Phase 3: keyset pagination

Do:
- customers
- inventory
- opportunities
- inbox

Risk:
- medium
- API and UI paging behavior changes

### Phase 4: select-shape slimming

Do:
- replace broad includes on list endpoints
- add shared summary/detail selects

Risk:
- medium

### Phase 5: aggregate consolidation

Do:
- dashboard
- command center
- pipeline counts

Risk:
- medium

### Phase 6: switch inbox reads to canonical inbox

Do:
- move `/api/crm/inbox/conversations` and thread reads to `InboxConversation` / `InboxMessage`

Risk:
- medium to high

### Phase 7: add read models for dashboard and command center

Do:
- summary/projection tables
- background refresh or event-driven updates

Risk:
- high

### Phase 8: tenant-safe caching

Do:
- cache summary endpoints
- monitor freshness and invalidation pressure

Risk:
- medium

---

## 11. Recommended Immediate Next Steps

1. Instrument the top 10 slow query families with route/service labels.
2. Audit current hot list endpoints for offset pagination.
3. Switch inbox reads to canonical inbox before adding more channels.
4. Build summary/read-model strategy for dashboard and command center.
5. Only after that, add tenant-safe caching on top.

---

## 12. Success Criteria

The optimization effort is successful when:

- all hot operational queries remain dealership-scoped
- no security checks are bypassed
- inbox no longer depends on `CustomerActivity` for reads
- deep list pages stay fast under large tenant datasets
- dashboard and command center stop issuing large fan-out query sets
- observed p95 response time drops materially on customer, inventory, inbox, and pipeline surfaces

