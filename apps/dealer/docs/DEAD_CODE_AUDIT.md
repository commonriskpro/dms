# Dead Code & Unused Dependency Audit — apps/dealer

**Date:** 2026-03-06  
**Scope:** apps/dealer (Next.js App Router + Prisma + TS)  
**Method:** Static import-graph tracing via grep/ripgrep across all source files  
**Instruction:** Analysis only — no deletions or modifications made

---

## Summary

| Category | Items Found | Estimated LOC | Risk to Remove |
|---|---|---|---|
| Unused Files | 14 | ~2,133 | Low–Medium |
| Unused Exports | 3 key items | ~207 (eventBus prod surface) | Low |
| Unused API Routes (likely orphan) | 2 | n/a | Low |
| Unused API Routes (external usage possible) | 4 | n/a | Medium |
| Unused Cache Keys | 0 | — | — |
| Unused Events (eventBus.ts producers) | All 9 event types | n/a | Low–Medium |
| Unused Dependencies | 3 | n/a | Low |

**Estimated removable code: ~2,133–2,340 LOC** (excluding cascading test cleanup)

---

## SECTION 1 — UNUSED FILES

Files that are never imported by any application route, page, or non-test source file.

### 1.1 Superseded Inventory UI Pages — HIGH confidence

The dealer app routes use newer implementations; these old module pages remain as dead stubs. They ARE referenced only by a single test file (`modules/inventory/ui/__tests__/inventory-permissions.test.tsx`), but that test is effectively validating dead production code.

| File | LOC | Reason Unused | Active Replacement |
|---|---|---|---|
| `modules/inventory/ui/InventoryPage.tsx` | 320 | Never imported anywhere | `modules/inventory/ui/InventoryPageContentV2.tsx` |
| `modules/inventory/ui/ListPage.tsx` | 395 | Only in permission test, not wired to any route | `InventoryPageContentV2` via `app/(app)/inventory/page.tsx` |
| `modules/inventory/ui/DetailPage.tsx` | 358 | Only in permission test, not wired to any route | `modules/inventory/ui/VehicleDetailPage.tsx` |
| `modules/inventory/ui/CreateVehiclePage.tsx` | 124 | Only in permission test, not wired to any route | `app/(app)/inventory/new/AddVehiclePage.tsx` |
| `modules/inventory/ui/EditVehiclePage.tsx` | 175 | Only in permission test, not wired to any route | `app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx` |

**Note:** If these files are removed, `inventory-permissions.test.tsx` must be rewritten to test the live implementations.

### 1.2 Superseded Customer UI Pages — HIGH confidence

| File | LOC | Reason Unused | Active Replacement |
|---|---|---|---|
| `modules/customers/ui/ListPage.tsx` | 304 | Never imported anywhere; exports `CustomersListPage` under same name as the live `CustomersListPage.tsx` — likely the old version | `modules/customers/ui/CustomersListPage.tsx` + `CustomersPageClient.tsx` |
| `modules/customers/ui/CustomersPage.tsx` | 285 | Never imported anywhere (not in app pages, not in tests) | `modules/customers/ui/CustomersPageClient.tsx` |

### 1.3 Dead Re-export Shim Components — HIGH confidence

These files were created as compatibility aliases but nothing imports them:

| File | LOC | Reason Unused |
|---|---|---|
| `components/layout/Sidebar.tsx` | 4 | Re-exports `Sidebar` from `app-shell/sidebar` but zero import references |
| `components/layout/Topbar.tsx` | 4 | Re-exports `Topbar` from `app-shell/topbar` but zero import references |

### 1.4 Unused UI Primitive Components — HIGH confidence

`AppButton`, `AppCard`, `AppInput`, and `ModalErrorBody` are defined but never imported by any consumer. The application exclusively uses `@/components/ui/button`, `@/components/ui/dms-card`, `@/components/ui/input`, etc.

| File | LOC | Reason Unused |
|---|---|---|
| `components/ui/app-button.tsx` | 23 | `AppButton` — zero import references outside this file |
| `components/ui/app-card.tsx` | 74 | `AppCard`, `AppCardContent`, `AppCardHeader`, etc. — zero import references |
| `components/ui/app-input.tsx` | 19 | `AppInput` — zero import references outside this file |
| `components/ui/modal-error-body.tsx` | 9 | `ModalErrorBody` — zero import references |

### 1.5 Unused Barrel File — HIGH confidence

| File | LOC | Reason Unused |
|---|---|---|
| `lib/api/index.ts` | 4 | Re-exports from `errors`, `pagination`, `rate-limit`, `validate`. Nobody imports from `@/lib/api` or `@/lib/api/index` — all consumers import directly from specific sub-paths (e.g. `@/lib/api/handler`, `@/lib/api/validate`). |

---

## SECTION 2 — UNUSED EXPORTS

### 2.1 `emitEvent` in `lib/infrastructure/events/eventBus.ts` — HIGH confidence

**Critical finding:** `emitEvent()` is **never called in any production source file**. Searching all `*.ts` and `*.tsx` files confirms zero production call-sites — only `modules/core/tests/event-bus.test.ts` calls it.

`instrumentation.ts` does call `registerListener()` for 5 events:
- `vehicle.created` → enqueue VIN decode  
- `vehicle.vin_decoded` → log/metric  
- `deal.sold` → enqueue analytics  
- `bulk_import.requested` → enqueue bulk import  
- `analytics.requested` → enqueue analytics  

Because no production code ever calls `emitEvent(...)`, **all 5 of these listeners silently never fire**.

**Root cause:** Two parallel event systems exist:
- `lib/events.ts` — older untyped bus (`emit`/`register`). Used by ~20 service files in production. Cache invalidation is wired to this bus via `lib/infrastructure/cache/cacheInvalidation.ts`.
- `lib/infrastructure/events/eventBus.ts` — newer typed `DomainEventBus` (`emitEvent`/`registerListener`). Has typed payloads, listeners in instrumentation, but zero production emitters.

The typed event bus infrastructure is wired but produces no events. Background jobs for VIN decode, analytics, and bulk import are **never enqueued** by the event system (though they may be enqueued inline in route handlers directly).

**Unused exported symbols from `eventBus.ts` in production:**
`emitEvent`, all payload types as function-level usage (`VehicleCreatedPayload`, `DealSoldPayload`, etc. are used only in tests/type declarations).

### 2.2 `warnIfForbiddenClasses` in `lib/ui/style-policy.ts` — HIGH confidence (cascading)

Only imported by `app-button.tsx`, `app-card.tsx`, and `app-input.tsx` — all three of which are themselves unused (Section 1.4). If those files are removed, `lib/ui/style-policy.ts` becomes fully dead.

**Exported symbols:** `warnIfForbiddenClasses`, `FORBIDDEN_PATTERNS`  
**Lines:** 35

### 2.3 `lib/api/index.ts` barrel exports — HIGH confidence

The 4 re-exported symbols (`errorResponse`, `parsePagination`, `checkRateLimit`, `validationErrorResponse`) are imported by many files, but always via direct sub-path imports (`@/lib/api/errors`, `@/lib/api/pagination`, etc.). The barrel itself (`@/lib/api` or `@/lib/api/index`) is never the import source.

---

## SECTION 3 — UNUSED API ROUTES

### 3.1 Likely Orphans (no client reference found anywhere)

| Route | Method | File | Reason | Confidence |
|---|---|---|---|---|
| `GET /api/support-session/consume` | GET | `app/api/support-session/consume/route.ts` | No frontend fetch call found; intended for platform-to-dealer redirect handoff with a JWT token in URL — but the platform app's impersonate flow is not confirmed to call this URL | Medium |
| `GET /api/invite/pending-check` | GET | `app/api/invite/pending-check/route.ts` | No frontend fetch found; `GET /api/auth/onboarding-status` already returns `pendingInvitesCount`, making this endpoint redundant | High |

### 3.2 External Usage Possible (no dealer-frontend reference)

These routes have no `apiFetch(...)` or `fetch(...)` calls in the dealer frontend source, but serve legitimate external clients (platform admin app, mobile, Prometheus scraper, CLI tools).

| Route | File | External Use Case |
|---|---|---|
| `GET /api/cache/stats` | `app/api/cache/stats/route.ts` | Platform admin diagnostic dashboard; restricted to platform admins |
| `GET /api/metrics` | `app/api/metrics/route.ts` | Prometheus scrape target; accepts `METRICS_SECRET` bearer token |
| `GET /api/me/current-dealership` + `POST` | `app/api/me/current-dealership/route.ts` | Multi-dealership switch; likely consumed by mobile app or future dealership switcher UI |
| `GET /api/me/dealerships` | `app/api/me/dealerships/route.ts` | List user's dealerships; likely mobile or platform admin |

**Note:** `/api/auth/dealerships` (similar name) IS used by `app/(app)/get-started/page.tsx`.

---

## SECTION 4 — UNUSED CACHE KEYS

**All cache keys in `lib/infrastructure/cache/cacheKeys.ts` are actively used.**

| Key Function | Used By |
|---|---|
| `dashboardKpisKey` | `modules/dashboard/service/getDashboardV3Data.ts` |
| `inventoryIntelKey` | `modules/inventory/service/inventory-intelligence-dashboard.ts` |
| `pipelineKey` | `modules/deals/service/deal-pipeline.ts` |
| `reportKey` | `modules/reports/service/sales-summary.ts`, `inventory-aging.ts`, `finance-penetration.ts` |
| `dashboardPrefix` | `lib/infrastructure/cache/cacheInvalidation.ts` |
| `inventoryPrefix` | `lib/infrastructure/cache/cacheInvalidation.ts` |
| `pipelinePrefix` | `lib/infrastructure/cache/cacheInvalidation.ts` |
| `reportsPrefix` | `lib/infrastructure/cache/cacheInvalidation.ts` |
| `allCachePrefix` | Available but used via `invalidatePrefix` in tests |
| `paramsHash` | `modules/reports/service/*.ts` |
| `permissionsHash` | `modules/dashboard/service/getDashboardV3Data.ts` |

**Finding: No unused cache keys.**

---

## SECTION 5 — UNUSED EVENTS

### 5.1 `lib/events.ts` (production bus) — No issues

The production event bus (`emit`/`register`) is actively used:
- **Emitters (production):** ~15 service files (`vehicle.ts`, `deal.ts`, `customer.ts`, `note.ts`, `task.ts`, `membership.ts`, `file.ts`, `role.ts`, etc.)
- **Listeners (production):** `cacheInvalidation.ts` via `instrumentation.ts`, `lender-integration/service/events.ts`, `finance-shell/service/events.ts`, `crm-pipeline-automation/service/automation-engine.ts`

All events emitted on `lib/events.ts` are consumed. No orphan events on this bus.

### 5.2 `lib/infrastructure/events/eventBus.ts` (typed bus) — CRITICAL

As detailed in Section 2.1, **every event type registered in `instrumentation.ts` is effectively dead** because `emitEvent()` is never called in production:

| Event Name | Listener in instrumentation.ts | Producer (`emitEvent`) call | Status |
|---|---|---|---|
| `vehicle.created` | ✅ Yes — enqueue VIN decode | ❌ None in production | **Dead listener** |
| `vehicle.vin_decoded` | ✅ Yes — log/metric | ❌ None in production | **Dead listener** |
| `deal.sold` | ✅ Yes — enqueue analytics | ❌ None in production | **Dead listener** |
| `bulk_import.requested` | ✅ Yes — enqueue bulk import | ❌ None in production | **Dead listener** |
| `analytics.requested` | ✅ Yes — enqueue analytics | ❌ None in production | **Dead listener** |
| `vehicle.updated` | ❌ No listener | ❌ None in production | **Unused** |
| `deal.created` | ❌ No listener | ❌ None in production | **Unused** |
| `deal.status_changed` | ❌ No listener | ❌ None in production | **Unused** |
| `customer.created` | ❌ No listener | ❌ None in production | **Unused** |

**Impact:** Background job enqueueing (VIN decode, analytics, bulk import) that was intended to be triggered by domain events **never fires** via this path. If these jobs ARE being enqueued, it happens inline in route handlers outside the event bus.

---

## SECTION 6 — UNUSED DEPENDENCIES

### 6.1 apps/dealer/package.json

| Package | Listed In | Actual Usage | Recommendation |
|---|---|---|---|
| `ioredis` | `dependencies` | Not directly imported anywhere in `apps/dealer` source. BullMQ bundles its own ioredis dependency. The `apps/dealer/lib/infrastructure/jobs/redis.ts` imports only `ConnectionOptions` from `bullmq`, not from `ioredis`. | **Remove from dealer dependencies** — ioredis is a BullMQ transitive dep, not a direct dep. Confidence: Medium (runtime peer dep behavior should be verified) |
| `clsx` | Both `dependencies` AND `devDependencies` | Used in `lib/utils.ts` (`cn` helper) — correctly a runtime dep | **Remove from devDependencies** — duplicate listing. Only needed in `dependencies`. |
| `tailwind-merge` | Both `dependencies` AND `devDependencies` | Used in `lib/utils.ts` (`cn` helper) — correctly a runtime dep | **Remove from devDependencies** — duplicate listing. Only needed in `dependencies`. |

### 6.2 apps/worker/package.json

Worker package is lean and appropriate. `bullmq` and `ioredis` are both legitimately direct dependencies of the worker.

---

## RISK ASSESSMENT

### Safe to Remove (Low Risk)
- `components/layout/Sidebar.tsx` and `Topbar.tsx` — 8 LOC, pure re-export stubs
- `components/ui/app-button.tsx`, `app-card.tsx`, `app-input.tsx`, `modal-error-body.tsx` — 125 LOC total, no consumers
- `lib/api/index.ts` — 4 LOC barrel, no imports from this path
- `clsx`/`tailwind-merge` duplicate in `devDependencies` — safe cleanup

### Moderate Risk (Requires Test Updates)
- `modules/inventory/ui/ListPage.tsx`, `DetailPage.tsx`, `CreateVehiclePage.tsx`, `EditVehiclePage.tsx` — `inventory-permissions.test.tsx` must be migrated to test live implementations
- `modules/customers/ui/ListPage.tsx`, `CustomersPage.tsx` — customer UI tests reference `CustomersListPage.tsx` (different file), but validate before removing

### Requires Investigation Before Action
- **Dead event bus (`eventBus.ts`):** Before removing, determine if `emitEvent` was intended to replace `lib/events.ts`. If so, all production service files need to be migrated from `emit()` → `emitEvent()`. If not, the typed bus's `instrumentation.ts` registration block should be removed.
- **`ioredis` in dealer deps:** Verify that BullMQ dynamic import at runtime doesn't need ioredis pre-installed in dealer's `node_modules`. Test in a clean install.
- **`/api/me/current-dealership` and `/api/me/dealerships`:** Confirm whether mobile app or any non-dealer client calls these before pruning.
- **`/api/invite/pending-check`:** Confirm via grep across the full monorepo (not just apps/dealer) whether any other app calls this endpoint.

---

## FILE INVENTORY BY CATEGORY

### Files safe to delete (no test dependencies)
```
components/layout/Sidebar.tsx                     (4 LOC)
components/layout/Topbar.tsx                      (4 LOC)
components/ui/app-button.tsx                      (23 LOC)
components/ui/app-card.tsx                        (74 LOC)
components/ui/app-input.tsx                       (19 LOC)
components/ui/modal-error-body.tsx                (9 LOC)
lib/api/index.ts                                  (4 LOC)
modules/customers/ui/CustomersPage.tsx            (285 LOC)
modules/inventory/ui/InventoryPage.tsx            (320 LOC)
```
Subtotal: ~742 LOC

### Files requiring test migration before deletion
```
modules/inventory/ui/ListPage.tsx                 (395 LOC)
modules/inventory/ui/DetailPage.tsx               (358 LOC)
modules/inventory/ui/CreateVehiclePage.tsx        (124 LOC)
modules/inventory/ui/EditVehiclePage.tsx          (175 LOC)
modules/customers/ui/ListPage.tsx                 (304 LOC)
```
Subtotal: ~1,356 LOC

### Files requiring architecture decision before action
```
lib/infrastructure/events/eventBus.ts             (207 LOC)
lib/ui/style-policy.ts                            (35 LOC) — cascading from app-button/app-card
```

### Likely orphan API routes to investigate
```
app/api/support-session/consume/route.ts
app/api/invite/pending-check/route.ts
```

---

*Generated by static import-graph analysis. Test files, Next.js special files (page.tsx, layout.tsx, loading.tsx, error.tsx), Prisma schema, and migrations were excluded from unused-file analysis.*
