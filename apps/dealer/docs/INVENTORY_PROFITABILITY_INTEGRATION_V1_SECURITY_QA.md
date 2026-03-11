# Inventory Profitability Integration V1 — Security QA

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/INVENTORY_PROFITABILITY_INTEGRATION_V1_SPEC.md`  
**Scope:** Tenant scoping, permission gating, cost/profit exposure, serializer leakage, route protection on all touched profitability surfaces.

---

## 1. Summary

- **Tenant scoping:** All ledger and vehicle data paths use `ctx.dealershipId` or `dealershipId` from the authenticated context; no client-supplied dealership id. DB layers filter by `dealershipId` and (where applicable) `vehicleId in` list derived from already-scoped queries.
- **Permission gating:** Cost/profit is exposed only on existing inventory or report surfaces; no new permissions and no exposure to users who could not already see vehicle list or detail. RSC and API routes enforce the same guards as before.
- **Serializer / response:** New field `totalInvestedCents` is returned only from existing GET list and GET detail routes, which remain protected by `inventory.read`. No new endpoints; no leakage of cost/profit to unauthorized callers.
- **Route protection:** No new routes; existing routes unchanged in guard pattern. Reports (aging, export) use `reports.read` and `reports.export` respectively with `ctx.dealershipId`.

---

## 2. Tenant Scoping

### 2.1 Ledger service and DB

| Layer | Behavior |
|-------|----------|
| **costLedger.getCostTotals** | `requireTenantActiveForRead(dealershipId)` then `costEntryDb.getCostTotalsByVehicleId(dealershipId, vehicleId)`. Query uses `where: { dealershipId, vehicleId, deletedAt: null }`. ✓ |
| **costLedger.getCostTotalsForVehicles** | `requireTenantActiveForRead(dealershipId)` then `costEntryDb.getCostTotalsByVehicleIds(dealershipId, vehicleIds)`. Query uses `where: { dealershipId, vehicleId: { in: vehicleIds }, deletedAt: null }`. ✓ |
| **cost-entry DB** | `getCostTotalsByVehicleId` / `getCostTotalsByVehicleIds` accept `dealershipId` as first argument; all Prisma queries include `dealershipId` in `where`. No use of client-provided tenant id. ✓ |

### 2.2 Where vehicleIds come from

| Caller | Source of vehicleIds | Tenant guarantee |
|--------|----------------------|-------------------|
| **GET /api/inventory** | `inventoryService.listVehicles(ctx.dealershipId, ...)` → `data.map(row => row.id)`. List is already scoped by `ctx.dealershipId`. ✓ |
| **getInventoryPageOverview** | `vehicleDb.listVehicles(ctx.dealershipId, ...)` → `rows.map(r => r.id)`. Same. ✓ |
| **getInventoryIntelligenceDashboard** (list) | `vehicleDb.listVehicles(ctx.dealershipId, ...)` → `listResult.data.map(r => r.id)`. Same. ✓ |
| **getInventoryIntelligenceDashboard** (aggregates) | `vehicleDb.getNonSoldVehicleIds(ctx.dealershipId)` → ids only for non-SOLD vehicles of that dealer. ✓ |
| **getInventoryAging** | `reportsDb.listVehiclesForAging(dealershipId)` → `vehicles.map(v => v.id)`. `listVehiclesForAging` uses `where: { dealershipId, deletedAt: null }`. ✓ |
| **exportInventoryCsv** | `reportsDb.listVehiclesForExport(dealershipId, asOfDate, status)` → `rows.map(r => r.id)`. Same pattern. ✓ |

Conclusion: Every call to `getCostTotalsForVehicles(dealershipId, vehicleIds)` uses a `dealershipId` from auth context and a `vehicleIds` list that was produced by a query already scoped by that same `dealershipId`. No cross-tenant vehicle id can be passed.

### 2.3 GET /api/inventory/[id] and PATCH

- Vehicle is loaded with `inventoryService.getVehicle(ctx.dealershipId, id)`; 404 if not in tenant. Then `costLedger.getCostTotals(ctx.dealershipId, id)` — same id, already validated as belonging to tenant. ✓

---

## 3. Permission Gating

### 3.1 API routes that return cost/profit

| Route | Guard | Cost/profit in response |
|-------|--------|--------------------------|
| **GET /api/inventory** | `guardPermission(ctx, "inventory.read")` | Yes: breakdown, totalInvestedCents, projectedGrossCents on each vehicle. Same permission as before; previously returned breakdown and projectedGross from ledger merge. ✓ |
| **GET /api/inventory/[id]** | `guardPermission(ctx, "inventory.read")`; vehicle loaded by `getVehicle(ctx.dealershipId, id)` | Yes: same fields. No new permission. ✓ |
| **PATCH /api/inventory/[id]** | `guardPermission(ctx, "inventory.write")`; vehicle updated then merged with ledger | Response includes cost/profit; only writers can mutate, readers already see detail. ✓ |
| **GET /api/reports/inventory-aging** | `guardPermission(ctx, "reports.read")` | Returns `totalInventoryValueCents` (ledger-derived cost sum). Only users with reports.read see it. ✓ |
| **GET /api/reports/export/inventory** | `guardPermission(ctx, "reports.export")` | CSV includes `purchaseValueCents` (ledger) per row. Only users with reports.export. ✓ |

No cost or profit is exposed on routes that do not already require inventory.read (or reports.read/export) for that data.

### 3.2 RSC / server-side entry points

| Entry point | Check before calling service | Service internal check |
|-------------|------------------------------|--------------------------|
| **Inventory page** (`app/(app)/inventory/page.tsx`) | `hasInventoryRead` (and dealershipId, userId); else “You don't have access to inventory.” | `getInventoryPageOverview` throws if `!ctx.permissions.includes("inventory.read")` and `requireTenantActiveForRead(ctx.dealershipId)`. ✓ |
| **Inventory list page** (`app/(app)/inventory/list/page.tsx`) | Same. | Same. ✓ |
| **Inventory dashboard** (`app/(app)/inventory/dashboard/page.tsx`) | Same. | `getInventoryIntelligenceDashboard` throws if `!ctx.permissions.includes("inventory.read")` and `requireTenantActiveForRead(ctx.dealershipId)`. ✓ |
| **Vehicle detail** (e.g. `app/(app)/inventory/vehicle/[id]/page.tsx`) | Same session/dealership/permission pattern where overview is used. | N/A for this sprint; detail data often from GET [id] API. ✓ |

Users who do not have `inventory.read` never reach the services that fetch ledger totals for list or dashboard. No hidden cost/profit exposure beyond existing inventory permissions.

---

## 4. Serializer / Response Shape

- **New field:** `totalInvestedCents` added to vehicle API response in `toVehicleResponse` (list and detail). It is computed from the same merged breakdown (ledger-derived) already used for `projectedGrossCents` and the four cost fields.
- **Where it appears:** Only in responses of GET /api/inventory and GET /api/inventory/[id] (and PATCH [id] response). Both are protected by `inventory.read` (or write for PATCH). No new endpoint; no new serializer path.
- **List RSC:** `getInventoryPageOverview` returns `VehicleListItem[]` with `costCents` (number). That value is now ledger-derived; it is still only part of the overview payload returned to the same RSC that already had list access. No separate “cost only” API.
- **Reports:** Aging returns aggregated `totalInventoryValueCents`; export returns `purchaseValueCents` per row. Both use `ctx.dealershipId` and are behind reports.read / reports.export. No serializer returns raw ledger entries or vehicle costs to a route that did not already have permission to see report data.

Conclusion: No serializer leakage; cost/profit remains behind existing inventory and report permissions.

---

## 5. Route Protection Consistency

- **Inventory list API:** GET /api/inventory — `getAuthContext` → `guardPermission(ctx, "inventory.read")`. Unchanged. ✓  
- **Inventory detail API:** GET/PATCH /api/inventory/[id] — same; vehicle id from path, validated by `getVehicle(ctx.dealershipId, id)`. Unchanged. ✓  
- **Inventory aging report:** GET /api/reports/inventory-aging — `getAuthContext` → `guardPermission(ctx, "reports.read")`; `dealershipId` from ctx. Unchanged. ✓  
- **Inventory export:** GET /api/reports/export/inventory — `getAuthContext` → `guardPermission(ctx, "reports.export")`; rate limit and audit. Unchanged. ✓  

No route was added or its guard removed. No inconsistent protection introduced.

---

## 6. Cross-Module Callers (Reports)

- **inventory-aging** and **export** (reports module) call `costLedger.getCostTotalsForVehicles(dealershipId, vehicleIds)` in the inventory module. `dealershipId` and `vehicleIds` are both produced inside the reports service from its own DB calls (`listVehiclesForAging`, `listVehiclesForExport`) that are already scoped by the same `dealershipId` passed from the route. No client input is used as dealership id. ✓  

---

## 7. Risks Addressed

| Risk | Mitigation |
|------|------------|
| **Cross-tenant cost visibility** | All ledger and vehicle queries use auth `dealershipId`; vehicleIds always from dealer-scoped lists. |
| **Weaker permission on new data** | Cost/profit only added to responses of routes that already require inventory.read or reports.read/export. |
| **Serializer returning cost to wrong route** | totalInvestedCents only on existing vehicle list/detail serializer; no new endpoints. |
| **Inconsistent route guards** | No new routes; no change to existing guard pattern. |

---

## 8. Conclusion

- Tenant scoping is correct: all ledger and vehicle access use auth context `dealershipId`; vehicle ids are always from dealer-scoped queries.
- Permission gating is unchanged: cost/profit is only visible where inventory (or reports) data was already allowed.
- No serializer or route protection regression; no new exposure.

*Security QA for Inventory Profitability Integration V1 complete.*
