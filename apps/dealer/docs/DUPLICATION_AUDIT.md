# DMS Dealer App — Duplication Audit

**Date:** 2026-03-06  
**Scope:** `apps/dealer/app/api/`, `modules/*/`, `lib/`, `components/`  
**Method:** Static analysis across 181 route files, ~60 service files, ~50 db files, and all UI components

---

## Executive Summary

| Category | Duplicates Found | Est. Lines Saved | Priority |
|---|---|---|---|
| API route boilerplate | 27 split imports; 4 missing `guardPermission`; 2 wrong error shapes; 1 missing try/catch | ~1,600 via wrapper | High |
| Service/DB patterns | 12 `Promise.all([findMany, count])` copies; 10 fetch-before-update copies; 8 inline select shapes; 20+ `tenantWhere` literals | ~500 | High |
| Cache | 3 services use raw `Map` / non-standard keys | ~60 | Medium |
| Events | All services on untyped bus; typed bus (`eventBus.ts`) never used by production code | Structural | Medium |
| Components | 2 identical `SummaryCard`; 4 duplicate `*statusToVariant` fns; `StatusBadge` vs `Badge` overlap; 2 card wrapper systems | ~300 | High |

---

## SECTION 1 — API Routes

### 1.1 Critical Issues

#### a) `auth/forgot-password/route.ts` — No top-level try/catch
The entire handler body runs outside any `try/catch`. A Supabase timeout or `auditLog` throw produces an unhandled rejection with no Sentry context and no structured error response.

**Fix:** Wrap with `try/catch` + `handleApiError(e)`.

#### b) `cache/stats` and `metrics` routes — Wrong error shape
Both use `{ error: "UNAUTHORIZED" }` (bare string), violating the standard `{ error: { code, message } }` envelope. Any API client expecting the standard shape will break on auth failure from these routes.

**Fix:** Replace with `handleApiError` and standard `ApiError` throws.

#### c) 4 dashboard routes missing `guardPermission`
`dashboard/route.ts`, `dashboard/v3/route.ts`, `dashboard/v3/customer-tasks/route.ts`, `dashboard/v3/inventory-alerts/route.ts` all call `getAuthContext` but never call `guardPermission`. Any authenticated member with an active dealership can access these endpoints unrestricted.

**Fix:** Add `await guardPermission(ctx, "dashboard.read")` to each.

### 1.2 High — Split Imports (27 files)
27 files import from `@/lib/api/handler` on two separate lines, violating workspace rule #37.

Files: `auth/reset-password`, `auth/verify-email/resend`, `auth/sessions/revoke`, `lenders/[id]`, `lenders/route`, all 6 `platform/` files, all 7 `deals/[id]/applications/**` files, `inventory/[id]/valuations`, `customers/saved-searches/[id]`, `customers/saved-searches/[id]/set-default`, `customers/saved-filters/[id]`.

**Fix:** Merge imports on a single line per source module.

### 1.3 Medium — Rate Limit 429 Pattern Inconsistency

Two patterns co-exist:
- **Pattern A (throw):** `throw new ApiError("RATE_LIMITED", ...)` — goes through Sentry. Used by `deals/`, most auth routes.
- **Pattern B (direct return):** `return Response.json({ error: ... }, { status: 429 })` — bypasses Sentry silently. Used by `customers/`, `dashboard/layout/`, `me/current-dealership`.

**Fix:** Standardize on Pattern A in all routes.

### 1.4 Medium — ZodError catch-block missing
Routes that lack `if (e instanceof z.ZodError)` in the catch block will return a 500 for validation errors on query params. Affected: `dashboard/*`, `inventory/dashboard`, `auth/session`, `auth/dealerships`, `auth/logout`, `admin/bootstrap-link-owner`, `admin/roles/[id]` (partial), `admin/dealership` (partial).

**Fix:** Add ZodError check to each catch block.

### 1.5 Low — Minor Issues
- **Dynamic import bug** in `deals/[id]/finance/route.ts`: `errorResponse` is dynamically imported inside a hot path. Convert to static import.
- **`Response.json()` for success** in `auth/sessions`, `auth/sessions/revoke`, `auth/forgot-password`: Switch to `jsonResponse()` for consistency.
- **Missing `export const dynamic = "force-dynamic"`** in ~100 files.

### 1.6 withApiHandler Wrapper Opportunity (deferred)
A `withApiHandler` wrapper could eliminate ~8 structural lines per handler across ~200 category-1 handlers (~1,600 lines total). This is a larger refactor with risk of altering behavior; defer to a dedicated changeset after the targeted fixes above are complete.

---

## SECTION 2 — Service / DB Layer

### 2.1 High — `Promise.all([findMany, count])` — 12 identical copies

The pattern:
```typescript
const [data, total] = await Promise.all([
  prisma.entity.findMany({ where, orderBy, take: limit, skip: offset }),
  prisma.entity.count({ where }),
]);
return { data, total };
```

Found in: `inventory/db/vehicle.ts`, `customers/db/customers.ts`, `deals/db/deal.ts`, `crm-pipeline-automation/db/opportunity.ts`, `crm-pipeline-automation/db/pipeline.ts`, `crm-pipeline-automation/db/job.ts`, `core-platform/db/membership.ts`, `documents/db/documents.ts`, `customers/db/tasks.ts`, `lender-integration/db/application.ts`, `lender-integration/db/submission.ts`.

**Fix:** Extract `paginatedQuery` helper to `lib/db/paginate.ts`.

### 2.2 High — Inline Prisma select shapes — 12+ copies

`PROFILE_SELECT = { id: true, fullName: true, email: true }` appears inline in 8+ db files.  
`VEHICLE_SUMMARY_SELECT = { id: true, vin: true, year: true, make: true, model: true, stockNumber: true }` appears 4x in `deals/db/deal.ts` alone.

**Fix:** Extract to `lib/db/common-selects.ts`.

### 2.3 High — `vehicleCostCents` formula — 4 divergent implementations

The formula `auctionCostCents + transportCostCents + reconCostCents + miscCostCents` is computed in 4 places with different return types (`bigint`, `number`, `string`):
- `inventory/service/vehicle.ts` (exported `totalCostCents`, returns `bigint`)
- `inventory/db/vehicle.ts:481` (inline `Number()` cast — wrong type)
- `reports/db/inventory.ts:74-78` (BigInt + — correct)
- `reports/service/inventory-aging.ts:84-88` (BigInt + — correct)

**Fix:** Consolidate to the existing `totalCostCents` in `inventory/service/vehicle.ts`, imported by all other locations.

### 2.4 Medium — Soft-delete write — 5 identical copies

`{ deletedAt: new Date(), deletedBy }` is written identically in `vehicle`, `customer`, `deal`, `document`, `task`.

**Fix:** Export `softDeleteData(deletedBy: string)` helper from `lib/db/update-helpers.ts`.

### 2.5 Medium — `tenantWhere` base clause — 20+ literal copies

`{ dealershipId, deletedAt: null }` (sometimes named `baseWhere`, sometimes spread inline) appears in every list and aggregate function across every module.

**Fix:** Export `tenantWhere(dealershipId, extra?)` from `lib/db/tenant-where.ts`.

### 2.6 Medium — `startOfTodayUtc` divergent implementations

`deals/db/deal.ts` uses UTC correctly. `customers/db/customers.ts` uses local time. Both should use a shared helper.

**Fix:** Export from `lib/db/date-utils.ts`:
```typescript
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export function daysBetween(from: Date, to?: Date): number;
export function startOfTodayUtc(): Date;
```

### 2.7 Low — `buildSparsePayload` (fetch-before-update) — 10 copies

The `Record<string, unknown>` payload builder pattern (`if (x !== undefined) payload.x = x`) appears in 10 update functions.

**Fix:** `buildSparsePayload<T>(input, allowed)` in `lib/db/update-helpers.ts`. (Lower risk/reward since each update has different field lists.)

### 2.8 Low — in-memory Map groupBy in `reports/service/sales-summary.ts`

The same Map-accumulate-convert loop runs 3 times in the same file for different grouping keys.

**Fix:** Extract `groupDealsByKey(deals, getKey)` locally within `sales-summary.ts`.

---

## SECTION 3 — Cache

### 3.1 Medium — 3 services bypass `cacheClient` and `cacheKeys.ts`

| Service | Key Pattern | Problem |
|---|---|---|
| `dashboard/service/dashboard-layout-cache.ts` | `dashboard_layout:{id}:{userId}` | Wrong format; uses `createTtlCache` directly; not tracked by `getTrackedKeys()` |
| `dashboard/service/floorplan-cache.ts` | bare `dealershipId` UUID | Module-level `new Map()`, hand-rolled TTL, invisible to stats endpoint |
| `inventory/service/vin.ts` | bare VIN string | Module-level `new Map()`, hand-rolled TTL |

Services that correctly use `cacheKeys.ts` + `withCache`: `getDashboardV3Data.ts`, `deal-pipeline.ts`, `inventory-intelligence-dashboard.ts`, `sales-summary.ts`, `finance-penetration.ts`, `inventory-aging.ts`.

**Fix:** Add keys to `cacheKeys.ts`; migrate `dashboard-layout-cache` and `floorplan-cache` to use `withCache`. For `vin.ts`, document the intentional exemption (VIN data is not tenant-scoped and is appropriate for a process-local cache).

---

## SECTION 4 — Events

### 4.1 Medium — Typed `eventBus.ts` is dead code in production

Two event systems co-exist:

| System | Path | Used By |
|---|---|---|
| Untyped bus | `@/lib/events` | All 21 service files (production) |
| Typed bus | `@/lib/infrastructure/events/eventBus` | Tests only (never used by services) |

The typed bus has full payload types (`DomainEventMap`) but services never import `emitEvent`. `cacheInvalidation.ts` listens on the untyped bus (correct for production). Tests only exercise the typed bus, meaning tests validate a code path that never runs.

Additionally, 30+ event names emitted by services have no type definition in `DomainEventMap`.

**Fix options:**
- **Option A (recommended):** Extend `@/lib/events` with a `DomainEventMap` type and typed `emit`/`register` overloads. Deprecate `lib/infrastructure/events/eventBus.ts`.
- **Option B:** Migrate all service emit calls to `emitEvent` from `eventBus.ts` and wire `cacheInvalidation.ts` listeners to the typed bus.

Option A has lower blast radius. Option B is architecturally cleaner but requires touching all service files.

---

## SECTION 5 — Components

### 5.1 High — Identical `SummaryCard` in two modules

`modules/customers/ui/components/CustomersSummaryCards.tsx` and `modules/deals/ui/components/DealsSummaryCards.tsx` contain byte-for-byte identical `SummaryCard` local components (36 lines each) differing only in the default `CARD_ACCENT` constant.

**Fix:** Extract to `components/ui/summary-card.tsx` and import in both files.

### 5.2 High — `dealStatusToVariant` duplicated within the deals module

`modules/deals/ui/ListPage.tsx:46` and `modules/deals/ui/DetailPage.tsx:62` define the same `dealStatusToVariant` function with the same switch cases.

Same issue: `opportunityStatusToVariant` appears in `modules/crm-pipeline-automation/ui/OpportunitiesTablePage.tsx` and `modules/crm-pipeline-automation/ui/OpportunityDetailPage.tsx`.

**Fix:** Move each mapper to the module's `ui/types.ts` and import from there.

### 5.3 High — `StatusBadge` vs `Badge` overlap

`components/ui/badge.tsx` and `components/ui/status-badge.tsx` are two independently maintained badge components with overlapping variants (`info/success/warning/danger`). Neither references the other.

**Fix:** Delete `StatusBadge`. Migrate callers to `Badge` with the equivalent variant. The `neutral` variant in `StatusBadge` maps to `secondary` in `Badge`.

### 5.4 Medium — Two card wrapper systems (`DMSCard` vs `AppCard`)

Both wrap shadcn's `Card` primitive. `AppCard` adds a `Footer` export. Different modules inconsistently use one or the other.

**Fix:** Standardize on `DMSCard` (more widely used). Add `DMSCardFooter` export. Migrate `AppCard` callers. Delete `AppCard`.

### 5.5 Low — Local KPI card components never exported

`KpiCard` (inventory), `SummaryCard` (customers/deals), `MetricCard` (dashboard-v3) are all structurally similar stat cards defined locally in each feature file. `MetricCard` in `components/dashboard-v3/MetricCard.tsx` is already at the shared level but not reused.

**Fix (deferred):** After 5.1, evaluate whether a single `StatCard` in `components/ui/stat-card.tsx` could serve all five use cases.

---

## Safe Refactor Plan

### Phase 1 — Critical fixes (no behavior change risk)
1. Add try/catch to `auth/forgot-password/route.ts`
2. Fix error shapes in `cache/stats` and `metrics` routes
3. Add `guardPermission` to 4 dashboard routes
4. Merge split imports in 27 files

### Phase 2 — DB/Service shared helpers (low risk, isolated to lib/)
5. Create `lib/db/paginate.ts` — `paginatedQuery` helper
6. Create `lib/db/common-selects.ts` — `PROFILE_SELECT`, `VEHICLE_SUMMARY_SELECT`
7. Create `lib/db/date-utils.ts` — `MS_PER_DAY`, `daysBetween`, `startOfTodayUtc`
8. Create `lib/db/update-helpers.ts` — `softDeleteData`
9. Consolidate `vehicleCostCents` to existing `totalCostCents` export
10. Extract `groupDealsByKey` in `reports/service/sales-summary.ts`

### Phase 3 — UI component deduplication (medium risk, visual regression possible)
11. Delete `StatusBadge`, migrate callers to `Badge`
12. Extract shared `SummaryCard` to `components/ui/`
13. Move `dealStatusToVariant` and `opportunityStatusToVariant` to module `ui/types.ts`
14. Add `DMSCardFooter`, migrate `AppCard` callers, delete `AppCard`

### Phase 4 — Cache & Events (higher risk, deferred)
15. Migrate `dashboard-layout-cache` and `floorplan-cache` to `withCache` + `cacheKeys.ts`
16. Resolve the two-bus event system (Option A or B above)
17. Standardize rate limit 429 pattern (Pattern A everywhere)
18. Add ZodError catch-block to remaining routes
19. Evaluate `withApiHandler` wrapper for Phase 5

### Out of Scope (this changeset)
- `withApiHandler` wrapper (large blast radius, separate PR)
- Migrating all 21 service files to typed event bus (large blast radius)
- `missing export const dynamic` on ~100 files (low risk but high noise)

---

## Complexity Estimates

| Phase | Files Touched | Risk | Effort |
|---|---|---|---|
| Phase 1 | ~35 | Low | 2h |
| Phase 2 | ~20 | Low | 3h |
| Phase 3 | ~15 | Medium | 3h |
| Phase 4 | ~25 | Medium-High | 4h |
| Total | ~95 | — | ~12h |
