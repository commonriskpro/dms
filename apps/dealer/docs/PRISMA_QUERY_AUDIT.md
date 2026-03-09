# Prisma Query Plan & Index Audit — apps/dealer

**Date:** 2026-03-06  
**Scope:** modules/*/db, modules/*/service; priority: inventory, deals, customers, reports, dashboard  
**Method:** Static analysis of Prisma calls, schema indexes, and pagination/cache usage  
**Instruction:** Analysis only — no code modified

---

## Summary

| Category | Count | Severity mix |
|----------|--------|--------------|
| Slow query risks | 5 | 2 high, 2 medium, 1 low |
| Missing indexes | 3 | 1 high, 2 medium |
| N+1 patterns | 4 | 2 high, 2 medium |
| Pagination issues | 3 | 2 medium, 1 low |
| Aggregation hotspots | 4 | All wrapped in withCache where applicable; 1 unbounded feed |

**Estimated performance gains:** 20–40% on report/dashboard and backfill paths if fixes applied.  
**Recommended new indexes:** 3 (DealHistory, Customer listStaleLeads, optional Vehicle aging).  
**Next steps:** Address high-severity items first; add indexes via migrations; refactor N+1 in vehicle-photo backfill and optional listStaleLeads.

---

## 1. SLOW QUERY RISKS

Queries that can return large result sets or perform full scans without adequate limits or indexes.

| File | Query / pattern | Reason | Recommended fix | Severity |
|------|------------------|--------|------------------|----------|
| `modules/reports/db/inventory.ts` | `listVehiclesForAging(dealershipId)` — `prisma.vehicle.findMany({ where: { dealershipId, deletedAt: null }, select: {...} })` | Unbounded: loads all vehicles for the dealership into memory. | Add pagination (limit/offset or cursor) or a dedicated aggregate/groupBy + sum query; or cap with a max limit (e.g. 10_000) and document. | **High** |
| `modules/reports/db/sales.ts` | `contractedCountByPeriod` — `prisma.dealHistory.findMany({ where: { dealershipId, toStatus: CONTRACTED, createdAt: { gte, lte } }, select: { dealId, createdAt } })` | Unbounded in date range; then in-memory grouping by deal and period. | Use raw SQL or Prisma groupBy with date truncation if supported; or paginate/stream DealHistory and aggregate in chunks. | **Medium** |
| `modules/customers/db/customers.ts` | `listStaleLeads` — `prisma.customer.findMany({ where: { dealershipId, deletedAt: null }, select: { id, name, createdAt, updatedAt } })` plus 3× groupBy/findMany (activity, note, task) | Loads all customers then filters/sorts in JS and slices to `limit`. | Prefer DB-side filter: e.g. subquery or join for “last activity &lt; cutoff” and order by lastActivity, then take(limit). Add composite index (dealershipId, deletedAt, updatedAt) or similar to support “stale” filter. | **High** |
| `modules/reports/db/inventory.ts` | `listVehiclesForExport` — `prisma.vehicle.findMany({ where })` with optional status filter, no take | Unbounded export; can be very large. | Enforce a max limit (e.g. 5_000–10_000) or stream/cursor-based export with take + skip or cursor. | **Medium** |
| `modules/inventory/db/vehicle.ts` | `searchVehiclesByTerm` — `findMany` with OR on vin/stockNumber (contains, mode: insensitive) | No limit other than passed `limit`; contains prevents index-only use. | Ensure callers always pass a small limit (e.g. ≤20). Consider trigram index (pg_trgm) for ILIKE if search volume is high. | **Low** |

---

## 2. MISSING INDEXES

Composite indexes that would better support observed query patterns. Schema already has many `dealershipId` and (dealershipId, status) indexes.

| Model | Query pattern | Current indexes | Gap | Recommended index | Severity |
|-------|----------------|------------------|-----|-------------------|----------|
| DealHistory | `where: { dealershipId, dealId: { in: dealIds }, toStatus: CONTRACTED }` (getFirstContractedHistoryByDeal) | `@@index([dealershipId])`, `@@index([dealershipId, dealId, createdAt])` | No index on `toStatus`; filter on toStatus scans by dealId. | `@@index([dealershipId, toStatus, dealId])` or `@@index([dealershipId, dealId, toStatus])` to speed “first CONTRACTED per deal” lookups. | **High** |
| Customer | listStaleLeads: all customers then JS sort/slice; getCustomerMetrics: count by status, createdAt ranges | `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])`, etc. | “Stale” logic (lastActivity &lt; cutoff) is computed in app after loading all; no index for “last activity” style filter. | If moving to DB-side stale query: consider expression index or composite (e.g. dealershipId, deletedAt, updatedAt). Otherwise medium (application-side limit + index on dealershipId, deletedAt). | **Medium** |
| Vehicle | listVehiclesForAging / listVehiclesForExport: where dealershipId, deletedAt: null, optional status | `@@index([dealershipId])`, `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])` | Already covered for list; aging/export are full scans by design. | Optional: `@@index([dealershipId, deletedAt])` to make “active” vehicle scans (deletedAt: null) more efficient if not already covered by status/createdAt usage. | **Low** |

---

## 3. N+1 PATTERNS

Prisma (or DB) calls inside loops that can be replaced with batched queries, include, or bulk operations.

| File | Pattern | Snippet / description | Recommended fix | Severity |
|------|---------|------------------------|-----------------|----------|
| `modules/inventory/service/vehicle-photo-backfill.ts` | Per-vehicle DB calls in loop | `for (const vehicleId of ids)` then `listFileObjectsForVehicleWithoutVehiclePhoto(dealershipId, vehicleId)` and `listVehiclePhotosWithOrder(dealershipId, vehicleId)`; inside transaction `for (let i = 0; i < toCreate.length; i++) await tx.vehiclePhoto.create(...)` | Batch: load “file objects without vehicle photo” for all `ids` in one or two queries (e.g. by vehicleId in ids); load all existing vehicle photos for those ids; build in-memory maps and loop only over in-memory data. Use createMany where possible for vehiclePhoto creates. | **High** |
| `modules/inventory/service/bulk.ts` | Per-row create in apply loop | `for (let i = 0; i < dataRows.length; i++) { await vehicleService.createVehicle(...) }` | Inherent to row-by-row validation and create; consider batching 10–50 creates in a single transaction (e.g. Promise.all in chunks) to reduce round-trips while keeping per-row error handling if required. | **Medium** |
| `modules/deals/service/deal-desk.ts` | Sequential deletes/updates in transaction | `for (const f of toDelete) await tx.dealFee.delete(...)`; `for (const item of input.fees) await tx.dealFee.update(...)`; similar for products | Use deleteMany({ where: { id: { in: toDeleteIds } } }) and batch updates (updateMany where applicable, or Promise.all of updates) instead of per-row await in loop. | **Medium** |
| `modules/provisioning/service/provision.ts` | Permission upserts in loop | `for (const key of ALL_PROVISION_PERMISSION_KEYS) await tx.permission.upsert({ where: { key }, ... })` | One-time provisioning; acceptable. Optionally use createMany with onConflict or multiple upserts in a single transaction to reduce round-trips. | **Low** |

---

## 4. PAGINATION ISSUES

All list endpoints use limit/offset (skip/take). Cursor-based pagination is not required for current scale but recommended for very large tables if they grow.

| File | Usage | Issue | Recommendation | Severity |
|------|--------|--------|------------------|----------|
| `modules/reports/db/inventory.ts` | `listVehiclesForAging`, `listVehiclesForExport` | No skip/take; full table scan for dealership | Add limit (and offset if needed) for export; for aging, consider aggregate-only queries instead of full list. | **Medium** |
| `modules/customers/db/customers.ts` | `listStaleLeads` | Fetches all customers then slice(0, limit) in JS | Move to DB-side ordering and take(limit) with a proper where/orderBy (see Slow query risks). | **Medium** |
| `modules/inventory/db/vehicle.ts`, `modules/deals/db/deal.ts`, etc. | `skip: offset`, `take: limit` | Offset pagination: expensive for large offset (e.g. skip(10000)) | For tables that may exceed ~10k rows per tenant, consider cursor-based pagination (cursor: id or createdAt) for “next page” flows. | **Low** |

---

## 5. AGGREGATION HOTSPOTS

Dashboard and report services using groupBy / count / sum. Verifying indexes and cache usage.

| File | Query | Index / cache | Notes | Severity |
|------|--------|----------------|--------|----------|
| `modules/dashboard/service/getDashboardV3Data.ts` | Multiple `prisma.vehicle.count`, `prisma.opportunity.count`, `prisma.deal.count`, `prisma.deal.groupBy`, `prisma.financeSubmission.count`, `prisma.financeApplication.count`, `prisma.financeStipulation.count` | Wrapped in `withCache(dashboardKpisKey(...), 20, ...)`. Vehicle: `@@index([dealershipId, status])`; Deal: `@@index([dealershipId, status])`; Opportunity: `@@index([dealershipId, status])`. | Indexes and cache in place. No change required. | — |
| `modules/reports/service/sales-summary.ts` | Uses reportsDb listContractedDealsInRange, countDealsByStatus, getLeadSourceByCustomerId, getLocationByVehicleId; in-memory grouping | Report wrapped in `withCache(reportKey(...), ...)`. Deal has (dealershipId, status, createdAt). | groupBy and list queries are scoped; cache present. DealHistory first-by-deal query would benefit from DealHistory index on (dealershipId, toStatus, dealId). | **Low** |
| `modules/reports/service/inventory-aging.ts` | reportsDb.listVehiclesForAging (unbounded findMany), then in-memory buckets and sums | Wrapped in `withCache(reportKey(...), ...)`. | Caching mitigates repeat load; single run still loads all vehicles. Prefer aggregate + groupBy in DB or paginated aggregation. | **Medium** |
| `modules/reports/service/finance-penetration.ts` | reportsDb listDealsForFinancePenetration, listDealFinanceByDealIds | Wrapped in `withCache(reportKey(...), ...)`. | Cached; ensure date range and dealershipId are indexed (Deal, DealFinance already have relevant indexes). | — |
| `modules/customers/db/customers.ts` | getCustomerMetrics: count + groupBy (status, tasks due today) | Not wrapped in withCache (dashboard v3 uses listNewProspects + listMyTasks counts instead). Customer has `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])`. | Indexes adequate. If this path is used on a hot path, consider short TTL cache. | **Low** |
| `modules/crm-pipeline-automation/db/stage.ts` | getPipelineFunnelCounts: stages findMany then opportunity.groupBy by stageId | Opportunity has `@@index([dealershipId, stageId])`. | Index supports groupBy. No change required. | — |

---

## 6. DETAILED FINDINGS (by section)

### 6.1 Query inventory (priority modules)

- **Inventory (db/vehicle, service):** listVehicles (paginated), listVehicleIds, countFloorPlanned, countPreviouslySold, searchVehiclesByTerm, getVehicleById, findActiveVehicleByStockNumber, findActiveVehicleByVin, aging/dashboard aggregates (count, aggregate). All list paths use take/skip except listVehiclesForAging and listVehiclesForExport in reports.
- **Deals (db/deal, fee, trade, history):** listDeals (paginated), getDealById, count by status; listDealFees, listTrades (paginated); listDealHistory (paginated). Reports: listContractedDealsInRange, getFirstContractedHistoryByDeal, countDealsByStatus, contractedCountByPeriod, listContractedDealsForExport.
- **Customers (db/customers, tasks, activity, callbacks, notes, timeline):** listCustomers (paginated), getCustomerById, listStaleLeads (unbounded findMany + JS slice), getCustomerMetrics (count + groupBy); listTasks, listMyTasks, listCallbacks, listActivity (paginated); timeline merges notes/activities/callbacks (each with take).
- **Reports (db/sales, inventory, finance):** listContractedDealsInRange, getFirstContractedHistoryByDeal, getLeadSourceByCustomerId, getLocationByVehicleId, countDealsByStatus, contractedCountByPeriod, listContractedDealsForExport, getDisplayNamesForUserIds; listVehiclesForAging, listVehiclesForExport, countVehiclesByStatus; listDealsForFinancePenetration, listDealFinanceByDealIds.
- **Dashboard (service/getDashboardV3Data):** Single Promise.all of counts and groupBy; result wrapped in withCache(dashboardKpisKey, 20, ...).

### 6.2 Index analysis (schema.prisma)

- **Vehicle:** `@@index([dealershipId])`, `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])`, `@@index([dealershipId, stockNumber])`, `@@unique([dealershipId, vin])`. Covers list/filter by status and date; no index on deletedAt (queries use deletedAt: null).
- **Deal:** `@@index([dealershipId])`, `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])`, `@@index([dealershipId, customerId])`, `@@index([dealershipId, vehicleId])`, `@@index([dealershipId, deletedAt])`. Adequate for reports and dashboard.
- **DealHistory:** `@@index([dealershipId])`, `@@index([dealershipId, dealId, createdAt])`. Missing composite that includes `toStatus` for “first CONTRACTED per deal” (see Missing indexes).
- **Customer:** `@@index([dealershipId])`, `@@index([dealershipId, status])`, `@@index([dealershipId, stageId])`, `@@index([dealershipId, createdAt])`, and others. Stale-leads pattern (all customers then sort in JS) would benefit from DB-side filter and possibly composite index.
- **Opportunity:** `@@index([dealershipId, status])`, `@@index([dealershipId, stageId])`, etc. Adequate for funnel and dashboard.
- **FileObject:** `@@index([dealershipId, bucket, entityType, entityId])`. Used by documents and vehicle-photo backfill.

### 6.3 Raw queries

- **lib/job-run-stats.ts:** `prisma.$queryRaw` for daily job run aggregates (day, dealership_id, counts). Uses Prisma.sql template.
- **lib/rate-limit-stats.ts:** `prisma.$queryRaw` for rate limit events and daily aggregates.
- **app/api/health/route.ts:** `prisma.$queryRaw\`SELECT 1 as ok\`` for health check.
- **modules/crm-pipeline-automation/db/job.ts:** `prisma.$queryRaw` for pending jobs with custom ordering.

No missing indexes inferred from raw SQL without seeing the exact queries; job-run and rate-limit tables already have @@index([day, ...]) and similar.

---

## 7. RECOMMENDED INDEXES (concrete)

1. **DealHistory**  
   Add: `@@index([dealershipId, toStatus, dealId])`  
   Rationale: getFirstContractedHistoryByDeal filters by dealershipId, dealId in list, toStatus = CONTRACTED; this supports that lookup and avoids full scan on dealId + toStatus.

2. **Customer (optional)**  
   If moving listStaleLeads to DB: add composite supporting “last activity” or “stale” filter, e.g. `@@index([dealershipId, deletedAt, updatedAt])` or an expression index on (dealershipId, last_activity) if you add a computed column. Otherwise rely on existing indexes and application-side limit.

3. **Vehicle (optional)**  
   `@@index([dealershipId, deletedAt])` — can help “active” lists (deletedAt: null) when combined with other filters; lower priority if current list performance is acceptable.

---

## 8. NEXT STEPS

1. **High:** Add `DealHistory` composite index `(dealershipId, toStatus, dealId)` (or `(dealershipId, dealId, toStatus)`) via migration.  
2. **High:** Refactor vehicle-photo backfill to batch-load “file objects without vehicle photo” and “existing vehicle photos” for all vehicle IDs in the batch; use createMany or batched creates instead of N creates per vehicle.  
3. **High/Medium:** Cap or paginate `listVehiclesForAging` and `listVehiclesForExport` (or replace with DB-side aggregates).  
4. **Medium:** Refactor `listStaleLeads` to a single (or few) DB query with where/orderBy and take(limit), and add index if needed.  
5. **Medium:** In deal-desk, replace per-fee/per-product delete/update loops with deleteMany and batched updates.  
6. **Low:** Consider cursor-based pagination for vehicle and deal lists if tenant size can exceed ~10k rows.  
7. **Low:** Optionally add `Vehicle` index on (dealershipId, deletedAt) and `Customer` index for stale-leads if DB-side refactor is done.

---

*Audit completed via static scan of modules and schema; no runtime profiling. Re-run after schema or query changes.*
