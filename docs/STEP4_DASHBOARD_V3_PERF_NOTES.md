# Step 4 — Dashboard V3.1 Performance Notes

**Feature:** Dealer Dashboard V3.1  
**Scope:** Dealer app (server-first, no client fetch on mount)

---

## 1. Server-First Validation

- **Page:** `apps/dealer/app/dashboard/page.tsx` is a Server Component (no `"use client"`). It calls `unstable_noStore()` and sets `export const dynamic = "force-dynamic"` to avoid cross-tenant or stale caching.
- **Data:** Initial data is loaded in the server via `getDashboardV3Data(session.activeDealershipId, session.userId, session.permissions)` and passed as `initialData` to `DashboardV3Client`. There is no client-side fetch on mount for dashboard data.
- **Refresh:** Client uses `router.refresh()` only; no timers, no polling, no fetch-on-mount loop. Refresh re-runs the server component and gets fresh `initialData`.

---

## 2. Client Bundle

- Dashboard client components under `components/dashboard-v3/` use React, Next navigation, and shared UI (Button, Card, etc.). No chart or heavy visualization library is loaded for the dashboard (no chart libs on dashboard).
- If future widgets add charts, they should be lazy-loaded or confined to a separate route to keep dashboard TTI low.

---

## 3. Server-Side Query Behavior

- **Parallelism:** `getDashboardV3Data` uses a single `Promise.all` for the main data needs (inventory count, leads count, deals count, bhph, carsInRecon, dealStatusCounts, fundingIssuesCount, newProspectsCount, myTasksCount, creditAppsCount, pendingStipsCount, floorplanLines). Queries run in parallel; no unnecessary sequential awaits.
- **Limits:** All list-style results are capped (e.g. 5 rows per widget, 5 finance notices, 5 appointments). No unbounded lists; counts use Prisma `count()` or bounded helpers (e.g. `listNewProspects(dealershipId, 5)`).
- **Floorplan:** Cached per `dealershipId` with TTL from `DASHBOARD_FLOORPLAN_CACHE_TTL_SECONDS` (default 60s). Second request within TTL does not call the provider again.

---

## 4. Low-Risk Micro-Optimizations (Recommendations)

- **Select only needed columns:** If any Prisma call currently uses `findMany` with full model, consider switching to `select` with only required fields or keep using `count`/`groupBy` where only aggregates are needed. Current implementation already uses `count` and `groupBy` where appropriate.
- **Indexes:** Ensure indexes exist on `dealershipId` (and common filters like `status`, `deletedAt`) for `Vehicle`, `Opportunity`, `Deal`, `FinanceSubmission`, `FinanceApplication`, `FinanceStipulation`. (Index strategy is out of scope for this note but should be verified in DB layer.)
- **Cache TTL:** If dashboard traffic is high, consider tuning `DASHBOARD_FLOORPLAN_CACHE_TTL_SECONDS` (e.g. 60–300s) to balance freshness vs provider load.

---

## 5. What Was Changed (Step 4)

- No performance-related code changes in Step 4. Validation only: confirmed server-first, no fetch-on-mount, refresh via `router.refresh()`, parallel server queries, row limits, and floorplan cache behavior.

---

## 6. How to Reproduce Issues

- **Stale data:** Disable or shorten floorplan TTL and confirm second request within window uses cache (see floorplan-cache tests).
- **Heavy client bundle:** Run build and inspect dashboard chunk(s); ensure no large chart/visualization lib is included in the dashboard route.
- **Slow server response:** Add logging for `loadTimeMs` (already present in `dashboard_v3_load_complete`); monitor in production to spot slow queries.

---

**Status:** PASS — Server-first and query behavior validated; optional micro-optimizations documented; no regressions introduced in Step 4.
