# Performance Audit Report — Dealer App

**Date:** 2026-03-07
**Scope:** apps/dealer — server, database, React rendering, network

---

## 1. Database Query Issues

### High Severity

| Issue | File | Details |
|-------|------|---------|
| N+1: per-vehicle DB calls in backfill loop | `modules/inventory/service/vehicle-photo-backfill.ts` | Two queries per vehicle inside `for (const vehicleId of ids)` |
| Create loop inside transaction | `modules/inventory/service/vehicle-photo-backfill.ts:158-171` | `vehiclePhoto.create` called per item; replaceable with `createMany` |
| Heavy transaction with redundant deal loads | `modules/deals/service/deal-desk.ts:143-398` | Deal loaded 3 times inside same transaction; fee/product delete loops instead of `deleteMany` |
| Sequential fee/product delete loops | `modules/deals/service/deal-desk.ts:180-181,317-322` | Individual `delete`/`update` calls per item instead of batch |

### Medium Severity

| Issue | File | Details |
|-------|------|---------|
| Sequential independent queries | `app/api/auth/session/switch/route.ts:25-40` | membership, dealership, previousRow fetched sequentially |
| Sequential independent queries | `app/api/platform/dealerships/[id]/members/route.ts:75-90` | dealership, role, profile fetched sequentially |
| Missing select on membership queries | `lib/tenant.ts:41,104,245` | Full membership rows returned; only `id` needed |
| Missing caching on dashboard v1 | `modules/dashboard/service/dashboard.ts` | No withCache; 4 sequential DB queries |
| Missing caching on reports | `modules/reports/service/pipeline.ts`, `mix.ts`, `sales-by-user.ts` | Aggregation queries uncached |
| Missing caching on customer metrics | `modules/customers/service/customer.ts` | Count + groupBy queries uncached |
| Dashboard sequential queries | `modules/dashboard/service/dashboard.ts:109-149` | 4 sections fetched sequentially |

### Low Severity

| Issue | File | Details |
|-------|------|---------|
| Missing select on profile/dealership lookups | `lib/auth.ts:77`, `lib/internal-api-auth.ts:49`, platform routes | Full model returned for existence checks |
| Sequential permission lookups in tests | Multiple test files | `findFirst` calls could use `Promise.all` |

---

## 2. Server Performance Issues

### Medium Severity

| Issue | File | Details |
|-------|------|---------|
| Expensive serialization check on every request | `app/api/dashboard/v3/route.ts:57-82` | `JSON.stringify` + recursive `findNonSerializable` runs in production |
| Sequential dealership job processing | `app/api/crm/jobs/run/route.ts:31-37` | Sequential `for` loop; could parallelize with concurrency limit |

---

## 3. React Rendering Issues

### High Severity

| Issue | File | Details |
|-------|------|---------|
| Inline `onOpenOpportunity` callback | `modules/crm-pipeline-automation/ui/CrmBoardPage.tsx:276` | Arrow function recreated every render |
| Unmemoized computed arrays | `CrmBoardPage.tsx:224-241` | `pipelineOptions`, `stageOptions`, `oppsByStage` recomputed every render |
| Inline customer select options | `CrmBoardPage.tsx:296-299` | `.map()` inside JSX creates new array every render |

### Medium Severity

| Issue | File | Details |
|-------|------|---------|
| Large detail pages without component extraction | `modules/customers/ui/DetailPage.tsx` (1486 lines), `modules/deals/ui/DetailPage.tsx` (1114 lines) | Monolithic components; tab callbacks inline |
| Missing memoization | `modules/reports/ui/ReportsPage.tsx:623,549` | `rows` and `pieData` computed every render |

---

## 4. Image / Asset Issues

| Issue | File | Details |
|-------|------|---------|
| `<img>` instead of `next/image` | `app/(app)/inventory/new/components/PhotosStatusCard.tsx:206,261` | Uses blob URLs from file picker; `next/image` not suitable for blob URLs |

---

## 5. Network Payload Issues

| Issue | Details |
|-------|---------|
| Reports return aggregated data only | Payload sizes are reasonable |
| Dashboard v3 already cached (20s TTL) | Good pattern |

No critical over-fetching found at the API response level.

---

## Summary

| Category | High | Medium | Low |
|----------|------|--------|-----|
| Database | 4 | 7 | 5 |
| Server | 0 | 2 | 0 |
| React | 3 | 2 | 0 |
| Assets | 0 | 0 | 1 |
| Network | 0 | 0 | 0 |
| **Total** | **7** | **11** | **6** |
