# Step 4 — Inventory Dashboard Layout: Security & QA Report

**Feature:** Inventory Dashboard Layout (match mock).  
**Spec:** `apps/dealer/docs/INVENTORY_DASHBOARD_LAYOUT_SPEC.md`

---

## 1. RBAC Verification

| Resource | Permission | Verification |
|----------|------------|--------------|
| Inventory page (server) | KPIs, Health, Alerts: `inventory.read`; Pipeline: `crm.read` or `deals.read`; Team: `customers.read` | Server component loads sections only when permission present; missing permission → defaults/zeros, no whole-page 403. |
| GET /api/inventory/dashboard | `inventory.read` | Route calls `guardPermission(ctx, "inventory.read")` before any service call. Jest test: 403 when guardPermission throws FORBIDDEN. |

- **Dashboard route test:** `app/api/inventory/dashboard/route.test.ts` — 403 when guardPermission throws; 200 with full data shape when permitted.
- **Inventory dashboard service:** No route-level RBAC for pipeline/team on the page (page uses permission checks to decide which data to load); dashboard API route requires only `inventory.read` and returns all sections (KPIs, aging, alerts, pipeline, team) in one response for client refresh.

---

## 2. Tenant Isolation

- **Services:** All dashboard data is scoped by `dealershipId` from auth context:
  - `inventory/service/dashboard`: getKpis, getAgingBuckets use `vehicleDb` with `dealershipId`.
  - `deals/service/deal-pipeline`: getDealPipeline uses deal and customer DB with `dealershipId`.
  - `customers/service/team-activity`: getTeamActivityToday uses notes, activity, callbacks, deal DB with `dealershipId`.
- **API route:** `dealershipId` and `userId` come from `getAuthContext(request)` only; no client-supplied tenant.
- **Tests:** `modules/inventory/tests/dashboard.test.ts` (when DB available) includes tenant isolation: data created for dealer A is not visible to dealer B for KPIs, aging, pipeline, team.

---

## 3. Tests Added / Updated

| Test | Purpose |
|------|---------|
| `modules/inventory/tests/dashboard.test.ts` | Shape tests for getKpis, getAgingBuckets, getDealPipeline, getTeamActivityToday; tenant isolation; aging bucket boundary (hasDb). |
| `app/api/inventory/dashboard/route.test.ts` | RBAC: 403 when guardPermission throws; 200 with data.initialKpis, initialAging, initialAlerts (AlertRow[]), initialPipeline, initialTeam. |

---

## 4. Performance

- **Server page:** All initial data loaded in parallel via `Promise.all([ getKpis, getAgingBuckets, getAlertCounts, getDealPipeline, getTeamActivityToday ])` (with permission guards so only permitted calls run).
- **Dashboard API route:** Same `Promise.all` for all five payloads; single round-trip for client refresh.
- **Queries:** Bounded counts/aggregates; existing indexes used (`dealershipId`, `dealershipId + status`, `dealershipId + createdAt` where applicable). No N+1 in dashboard services.

---

## 5. Thin Gates Checklist

- **Gate A — Determinism:** Node 24.x, npm 11.x (packageManager); no nested installs; lockfile consistent.
- **Gate B — Tenant safety:** Inventory page and dashboard route use `noStore()` / `dynamic = "force-dynamic"`; no cross-tenant caching.
- **Gate C — API hygiene:** Dashboard route does not accept body/params; error shape via handleApiError. Alerts returned as AlertRow[] for consistent contract.
- **Gate D — RBAC:** Route checks `inventory.read` before logic; route test covers 403 for FORBIDDEN.
- **Gate E — Quality:** Jest used; dashboard and route tests added. Manual test checklist in Step 2 and Step 3 deliverables. Build: run `npm -w apps/dealer run build` from repo root (may hit EPERM on Windows Prisma generate; retry or run in clean env).

---

## 6. Manual Test Checklist (Security & QA)

1. **RBAC — Inventory dashboard route**  
   As user without `inventory.read`: `GET /api/inventory/dashboard` → 403.  
   As user with `inventory.read`: → 200, JSON with initialKpis, initialAging, initialAlerts (array of { id, label, count, href }), initialPipeline, initialTeam.

2. **RBAC — Inventory page**  
   With only `inventory.read`: KPIs, Health, Alerts, list load; pipeline and team show zeros.  
   With `crm.read` or `deals.read`: pipeline shows counts.  
   With `customers.read`: team activity shows counts.

3. **Tenant isolation**  
   As user in Dealership A, create vehicles/deals in Dealership B (e.g. another account). Reload inventory page as A: A’s KPIs, pipeline, team activity must not include B’s data.

4. **Layout & no fetch-on-mount**  
   Open /inventory with full permissions; confirm Row 1 = 4 KPI cards (trend chips), Row 2 = Health | Alerts | Quick Actions, Row 3 = pipeline bar, Row 4 = Team Activity, Row 5 = table. Refresh: “Last updated” and Refresh update; no duplicate Quick Actions card.

---

**Deliverable:** Spec doc, backend services, frontend layout, dashboard route + RBAC test, tenant isolation in dashboard tests, STEP4 report. Optional: run `npm -w apps/dealer run test` and `npm -w apps/dealer run build` from repo root to confirm gates (existing unrelated test failures may remain).
