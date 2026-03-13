# Dealer SQL Scalability Execution Checklist

Concrete implementation checklist derived from:
- [DEALER_SQL_SCALABILITY_OPTIMIZATION_SPEC.md](/Users/saturno/Downloads/dms/apps/dealer/docs/DEALER_SQL_SCALABILITY_OPTIMIZATION_SPEC.md)
- [DEALER_DATABASE_WORKTREE.md](/Users/saturno/Downloads/dms/apps/dealer/docs/DEALER_DATABASE_WORKTREE.md)
- [CRM_UNIFIED_INBOX_IMPLEMENTATION_SPEC.md](/Users/saturno/Downloads/dms/apps/dealer/docs/CRM_UNIFIED_INBOX_IMPLEMENTATION_SPEC.md)

Goal:
- improve scalability for the dealer app
- preserve current tenant-security guarantees
- sequence the work in low-risk, testable phases

---

## Phase 1. Instrumentation And Hot Query Audit

### Objectives
- identify actual p95/p99 hotspots before changing query structure
- tag slow queries by route/service family
- generate evidence for index additions instead of guessing

### Files to change
- [db.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db.ts)
- [handler.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/api/handler.ts)

### Tasks
- [ ] Add request/route labeling into slow-query logging context
- [ ] Thread request metadata through API/service boundaries where useful
- [ ] Lower dev slow-query threshold temporarily for profiling runs
- [ ] Document a repeatable profiling process in `docs/`

### Output
- top 10 slow route/service families
- representative SQL patterns to analyze with `EXPLAIN ANALYZE`

---

## Phase 2. Query Plan Review And Index Patch Set

### Objectives
- verify which hot queries are scanning or sorting badly
- add missing composite indexes aligned to real filters and sorts

### Schema file
- [schema.prisma](/Users/saturno/Downloads/dms/apps/dealer/prisma/schema.prisma)

### Target areas

#### Customers
- [customers.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/db/customers.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/customers/route.ts)

Checklist:
- [ ] Review `where + orderBy` for customer list
- [ ] Add composite indexes for hottest list paths if missing
- [ ] Evaluate trigram indexes for name/phone/email search if plans show table scans

#### Inventory
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/inventory/route.ts)
- inventory db/service files under [/Users/saturno/Downloads/dms/apps/dealer/modules/inventory]( /Users/saturno/Downloads/dms/apps/dealer/modules/inventory )

Checklist:
- [ ] Review vehicle list filters and sort columns
- [ ] Add missing `dealership_id + filter + sort` indexes
- [ ] Validate VIN and stock-number lookup plans

#### CRM opportunities
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/opportunities/route.ts)
- [opportunity.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/db/opportunity.ts)

Checklist:
- [ ] Review stage/owner/status filtered queries
- [ ] Add composite indexes for board/list ordering

#### Inbox
- [messages.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-inbox/db/messages.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/inbox/conversations/route.ts)

Checklist:
- [ ] Validate `InboxConversation(lastMessageAt)` access
- [ ] Validate `InboxMessage(conversationId, createdAt)` paging access
- [ ] Add any missing queue indexes after actual read switch

### Output
- migration(s) with validated index additions

---

## Phase 3. Keyset Pagination Rollout

### Objectives
- remove expensive deep offset scans on large operational lists

### Shared helpers
- [paginate.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db/paginate.ts)

### New helper work
- [ ] Add cursor pagination helper(s) under [/Users/saturno/Downloads/dms/apps/dealer/lib/db]( /Users/saturno/Downloads/dms/apps/dealer/lib/db )
- [ ] Standardize cursor encoding/decoding
- [ ] Standardize tie-break sort using `id`

### Customer list
- [customers.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/db/customers.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/customers/route.ts)
- [CustomersPageClient.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/ui/CustomersPageClient.tsx)
- [CustomersListContent.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/ui/CustomersListContent.tsx)

Checklist:
- [ ] Convert list API from offset response to cursor response
- [ ] Update UI paging state
- [ ] Preserve current filters and debounced search behavior

### Inventory list
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/inventory/route.ts)
- [InventoryListContent.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/inventory/ui/InventoryListContent.tsx)
- [InventoryPageContentV2.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/inventory/ui/InventoryPageContentV2.tsx)

Checklist:
- [ ] Convert inventory API and clients to cursor pagination

### Opportunities
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/opportunities/route.ts)
- [OpportunitiesWorkspacePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/ui/OpportunitiesWorkspacePage.tsx)

Checklist:
- [ ] Convert opportunities list view pagination
- [ ] Keep board view separate if board is not page-based

### Inbox
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/inbox/conversations/route.ts)
- [InboxPageClient.tsx](/Users/saturno/Downloads/dms/apps/dealer/app/(app)/crm/inbox/InboxPageClient.tsx)

Checklist:
- [ ] Use cursor pagination for conversations
- [ ] Use cursor pagination for thread messages once canonical read route exists

---

## Phase 4. Query Slimming With Summary And Detail Selects

### Objectives
- eliminate broad `include` trees from hot list routes
- reduce JSON payload size and DB work

### Shared selects file
- [common-selects.ts](/Users/saturno/Downloads/dms/apps/dealer/lib/db/common-selects.ts)

### Tasks
- [ ] Add domain select shapes:
  - customer summary/detail
  - vehicle summary/detail
  - opportunity summary/detail
  - inbox conversation summary
- [ ] Replace inline `include` usage on list endpoints with `select`
- [ ] Keep richer relation fetches only on explicit detail routes

### High-priority files
- [customers.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/db/customers.ts)
- [opportunity.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/db/opportunity.ts)
- inventory db modules under [/Users/saturno/Downloads/dms/apps/dealer/modules/inventory/db]( /Users/saturno/Downloads/dms/apps/dealer/modules/inventory/db )
- report db modules under [/Users/saturno/Downloads/dms/apps/dealer/modules/reports/db]( /Users/saturno/Downloads/dms/apps/dealer/modules/reports/db )

---

## Phase 5. Finish Unified Inbox Read Switch

### Objectives
- stop aggregating conversations from `CustomerActivity`
- make canonical inbox tables the read source for queue and thread views

### Canonical inbox files
- [messages.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-inbox/db/messages.ts)
- [messages.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-inbox/service/messages.ts)

### New files to add
- [conversations.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-inbox/db/conversations.ts)
- [conversations.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-inbox/service/conversations.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/inbox/conversations/[id]/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/inbox/conversations/[id]/messages/route.ts)

### Existing files to change
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/crm/inbox/conversations/route.ts)
- [InboxPageClient.tsx](/Users/saturno/Downloads/dms/apps/dealer/app/(app)/crm/inbox/InboxPageClient.tsx)
- [inbox.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/service/inbox.ts)
- [activity.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/customers/db/activity.ts)

### Checklist
- [ ] Add db reader for `InboxConversation`
- [ ] Add db reader for `InboxMessage`
- [ ] Switch conversations route to canonical inbox
- [ ] Switch inbox UI to canonical queue response
- [ ] Add thread messages route
- [ ] Keep `CustomerActivity` timeline projection intact
- [ ] Deprecate old inbox aggregation helpers

---

## Phase 6. Dashboard And Command Center Aggregate Consolidation

### Objectives
- reduce repeated scans and large fan-out `count()` patterns

### Main files
- [getDashboardV3Data.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/dashboard/service/getDashboardV3Data.ts)
- [command-center.ts](/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/service/command-center.ts)

### Tasks
- [ ] Inventory all current parallel `count()` families
- [ ] Consolidate related metrics into grouped SQL or shared aggregate readers
- [ ] Split “fresh every request” metrics from “can be projected” metrics

### Likely code additions
- db helper module(s) under:
  - [/Users/saturno/Downloads/dms/apps/dealer/modules/dashboard/db]( /Users/saturno/Downloads/dms/apps/dealer/modules/dashboard/db )
  - [/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/db]( /Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation/db )

---

## Phase 7. Read Models / Projection Tables

### Objectives
- stop rebuilding heavy queue/dashboard surfaces from raw transactional tables

### Suggested tables/read models

#### Dashboard summaries
- dealership-scoped KPI rollups
- vehicle counts by status
- opportunity counts by stage
- stale task/callback counts

#### Command center queues
- waiting conversation summary
- overdue callback summary
- stale opportunity summary
- sequence work summary

#### Pipeline summaries
- stage total counts
- stage value totals
- stage activity/movement summary

### Files likely impacted
- [schema.prisma](/Users/saturno/Downloads/dms/apps/dealer/prisma/schema.prisma)
- jobs/services under:
  - [/Users/saturno/Downloads/dms/apps/dealer/modules/dashboard]( /Users/saturno/Downloads/dms/apps/dealer/modules/dashboard )
  - [/Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation]( /Users/saturno/Downloads/dms/apps/dealer/modules/crm-pipeline-automation )
  - [/Users/saturno/Downloads/dms/apps/dealer/modules/intelligence]( /Users/saturno/Downloads/dms/apps/dealer/modules/intelligence )

### Checklist
- [ ] Define projection table schemas
- [ ] Define projection update path:
  - sync-on-write
  - async job
  - scheduled refresh
- [ ] Switch dashboard reads to projections
- [ ] Switch command center reads to projections

---

## Phase 8. Search Optimization

### Objectives
- improve customer/inventory text search without weakening tenant isolation

### Targets
- customers by name/phone/email
- vehicles by VIN/stock/make/model
- inbox free-text queue search

### Checklist
- [ ] Confirm current query plans for `contains` searches
- [ ] Add trigram indexes only where plans justify them
- [ ] Keep tenant filter in every search query
- [ ] Consider separate search document columns only if trigram is not enough

### Files
- [schema.prisma](/Users/saturno/Downloads/dms/apps/dealer/prisma/schema.prisma)
- customer db modules
- inventory db modules
- future inbox conversation db module

---

## Phase 9. Safe Tenant-Scoped Caching

### Objectives
- reduce repeated load on stable summary endpoints

### Good cache candidates
- dashboard KPI endpoints
- command center counts
- pipeline summary routes
- inbox queue counts
- inventory summary routes

### Files likely impacted
- API routes under:
  - [/Users/saturno/Downloads/dms/apps/dealer/app/api/dashboard]( /Users/saturno/Downloads/dms/apps/dealer/app/api/dashboard )
  - [/Users/saturno/Downloads/dms/apps/dealer/app/api/crm]( /Users/saturno/Downloads/dms/apps/dealer/app/api/crm )
  - [/Users/saturno/Downloads/dms/apps/dealer/app/api/inventory]( /Users/saturno/Downloads/dms/apps/dealer/app/api/inventory )

### Checklist
- [ ] Introduce cache utility with required `dealershipId` keying
- [ ] Add TTL strategy by route type
- [ ] Avoid caching mutable edit/detail routes
- [ ] Add invalidation rules only where freshness requires them

---

## Phase 10. Reporting Optimization

### Objectives
- keep reports/export routes performant on larger datasets

### Files
- [/Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/inventory.ts]( /Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/inventory.ts )
- [/Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/sales.ts]( /Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/sales.ts )
- [/Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/finance.ts]( /Users/saturno/Downloads/dms/apps/dealer/modules/reports/db/finance.ts )

### Checklist
- [ ] Profile date-range report queries with realistic tenant data
- [ ] Add summary/index support for common range filters
- [ ] Use raw SQL for grouped report workloads when Prisma generates inefficient shapes
- [ ] Consider pre-aggregated report snapshots only after hot routes are identified

---

## Cross-Cutting Security Checklist

Apply this to every phase:

- [ ] Every query still includes `dealershipId`
- [ ] Every raw SQL query remains parameterized
- [ ] No cache key omits tenant scope
- [ ] Service layer still enforces `requireTenantActiveForRead/Write`
- [ ] Permissions remain enforced before business actions
- [ ] No projection job crosses dealership boundaries

---

## Recommended Next Implementation Order

1. Phase 1 instrumentation
2. Phase 2 index review
3. Phase 5 inbox read switch
4. Phase 3 keyset pagination on customers/inventory/opportunities
5. Phase 4 select-shape slimming
6. Phase 6 dashboard/command-center aggregate consolidation
7. Phase 7 read models
8. Phase 9 tenant-safe caching

This order is deliberate:
- inbox is a foundational architecture move
- pagination/indexing give immediate operational wins
- projections and caching should land after query shapes are cleaned up

