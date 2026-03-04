# Step 2: Dashboard V3 — Backend Implementation Report

## Summary

Backend for Dealer Dashboard V3 was implemented per `docs/DASHBOARD_V3_SPEC.md`: service returns full `DashboardV3Data` with metrics (including delta placeholders), WidgetRow arrays for customer tasks / inventory alerts / deal pipeline, floorplan cache, observability logging, and RBAC/tenant-scoped queries. Frontend types and components were aligned to the new contract (type alignment only).

---

## Files Modified / Created

### Created
- `apps/dealer/modules/dashboard/service/floorplan-cache.ts` — Server-only floorplan cache (TTL 60s, key = dealershipId, safe fields only; `clearFloorplanCacheForTesting()` for tests).
- `apps/dealer/modules/dashboard/tests/floorplan-cache.test.ts` — Jest tests for cache (provider called once per dealership within TTL, different dealerships get separate cache entries).

### Modified
- `apps/dealer/modules/dashboard/service/getDashboardV3Data.ts` — Reworked to:
  - Return `DashboardV3Data` with `dashboardGeneratedAt`, metrics (with `*Delta7d` / `*Delta30d` as `null`), `customerTasks` / `inventoryAlerts` / `dealPipeline` as `WidgetRow[]`, `floorplan` (via cache), `appointments`, `financeNotices` (severity `info` | `success` | `warning` | `danger`).
  - Enforce query limits: CustomerTasks/InventoryAlerts/DealPipeline rows ≤ 5, FinanceNotices ≤ 5, Appointments ≤ 5.
  - Use `getCachedFloorplan(dealershipId, provider)` for floorplan; provider returns `[]` until a real source exists.
  - Emit structured logs: `dashboard_v3_load_start`, `dashboard_v3_load_complete`, `dashboard_v3_load_error` (via `@/lib/logger`) with `requestId`, `dealershipIdTail`, `userIdTail`, `loadTimeMs`, `widgetCounts`; no PII/tokens/cookies.
- `apps/dealer/modules/dashboard/tests/getDashboardV3Data.test.ts` — Jest: full shape, tenant isolation (vehicle/opportunity scoped by dealershipId), RBAC (empty widgets when no permissions), query limit (listNewProspects with limit 5, financeNotices ≤ 5), metric deltas null, logging safety (no email/token/cookie), severity enum validation.
- `apps/dealer/components/dashboard-v3/types.ts` — Contract aligned with backend: `WidgetRow`, `dashboardGeneratedAt`, metrics with `*Delta7d`/`*Delta30d`, `customerTasks`/`inventoryAlerts`/`dealPipeline` as `WidgetRow[]`, optional `meta`/`timeLabel`/`subtitle`/`dateLabel`, severity `info`|`success`|`warning`|`danger`.
- `apps/dealer/components/dashboard-v3/MetricCard.tsx` — Accepts `delta7d`/`delta30d` (optional), shows one delta chip with tooltip “since last 7d” / “since last 30d”.
- `apps/dealer/components/dashboard-v3/CustomerTasksCard.tsx` — Accepts `rows: WidgetRow[]` instead of count object.
- `apps/dealer/components/dashboard-v3/InventoryAlertsCard.tsx` — Accepts `rows: WidgetRow[]`; optional severity left border.
- `apps/dealer/components/dashboard-v3/DealPipelineCard.tsx` — Accepts `rows: WidgetRow[]`; optional severity left border.
- `apps/dealer/components/dashboard-v3/FinanceNoticesCard.tsx` — Severity map includes `success` and `danger`; optional `subtitle`/`dateLabel` render.
- `apps/dealer/components/dashboard-v3/DashboardV3Client.tsx` — Passes `delta7d`/`delta30d` to MetricCards and `rows` to CustomerTasksCard, InventoryAlertsCard, DealPipelineCard.
- `apps/dealer/components/dashboard-v3/UpcomingAppointmentsCard.tsx` — Renders optional `meta` and `timeLabel`.
- `apps/dealer/app/dashboard/__tests__/page.test.tsx` — Mock data updated to new shape (WidgetRow arrays, metrics with deltas).
- `apps/dealer/app/dashboard/__tests__/dashboard-v3-render.test.tsx` — Same mock data update.

---

## Delta Strategy per Metric

- **Inventory / Leads / Deals / BHPH:** `*Delta7d` and `*Delta30d` are returned as `null`. Spec allows this when historical counts are not available; no snapshot tables or expensive historical queries were added. UI shows “—” or omits the chip when null. Future (V3.2+) may add snapshot tables for point-in-time deltas.

---

## Cache (Floorplan)

- **TTL:** 60 seconds; override via `DASHBOARD_FLOORPLAN_CACHE_TTL_SECONDS`.
- **Key:** `dealershipId`.
- **Cached shape:** `{ name, utilizedCents, limitCents, statusLabel? }[]`. No account numbers, credentials, or PII.
- **Provider:** Currently returns `[]`; can be wired to a real floorplan/lending source later.

---

## Tests Added / Updated

- **getDashboardV3Data.test.ts:** Full shape (dashboardGeneratedAt, metrics with deltas, WidgetRow arrays, limits); tenant isolation (vehicle + opportunity by dealershipId); RBAC (empty widgets when no permissions); listNewProspects(dealershipId, 5); financeNotices length ≤ 5; deltas null; logger context without email/token/cookie; financeNotices severity in allowed set.
- **floorplan-cache.test.ts:** Provider called once per dealership; second call for same dealership within TTL uses cache; different dealershipIds each trigger provider.

---

## Commands Executed

From repo root:

- `npm -w apps/dealer run test -- --testPathPatterns=dashboard --no-cache` — all dashboard-related tests passed.

---

## Security / QA Checklist

- **Tenant isolation:** All Prisma queries use `dealershipId` in `where`. Tests assert vehicle and opportunity scoped by dealershipId and by another dealershipId.
- **Severity enum:** Unified to `info` | `success` | `warning` | `danger` in types and financeNotices; tests assert allowed values.
- **No PII in logs:** Only `requestId`, `dealershipIdTail`, `userIdTail`, `loadTimeMs`, `widgetCounts` (and on error `errorCode`). No tokens, emails, cookies.
- **RBAC:** Service receives `permissions`; missing permission yields zero counts and empty widget rows for that area. Tests cover empty widgets when permissions are `[]`.
- **No new public routes:** No new API routes added; dashboard remains server-rendered via existing page calling `getDashboardV3Data`.

---

## Performance

- Single `Promise.all` for all dashboard data (counts, groupBy, listNewProspects, listMyTasks, finance counts, cached floorplan); no N+1.
- Queries use `count()` or `groupBy` / minimal selects; no full entity loads for dashboard aggregates.
- Floorplan cached per dealership to avoid repeated work within TTL.

---

## Manual Test Checklist

1. Log in as a user with a single dealership; open Dashboard. Confirm metric cards (Inventory, Leads, Deals, BHPH) show numbers and no delta chip (or “—” when deltas are null).
2. Confirm Customer Tasks, Inventory Alerts, Deal Pipeline show up to 5 rows each; Finance Notices up to 5; Appointments up to 5.
3. Remove permissions (e.g. different role); reload Dashboard. Confirm no data for removed sections (zeros / empty lists) and no errors.
4. Switch dealership (if applicable); confirm counts and widgets reflect the active dealership only.
5. Check server logs for `dashboard_v3_load_start` and `dashboard_v3_load_complete`; confirm no email/token/cookie in log payloads.
