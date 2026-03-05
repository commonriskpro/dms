# Inventory Intelligence Dashboard — Upgrades Spec

## Overview

Upgrades to the Inventory Intelligence Dashboard: service-level validation hardening, short server-side cache for aggregates, alert center ordering, price-to-market internal comps heuristic, and Last updated + Refresh UX.

---

## 1. Service Validation Policy

- The **service** must validate the incoming query and throw a **typed error** on invalid query.
- Implementation:
  - Inside the dashboard service: `const parsed = inventoryDashboardQuerySchema.safeParse(rawQuery)`.
  - If `!parsed.success`: throw `new ApiError("INVALID_QUERY", "Invalid query", { fieldErrors: parsed.error.flatten().fieldErrors })`.
  - The route (or caller) must handle this error and show error UI with “Clear and reload” (e.g. link to `/inventory/dashboard`).
- Do not rely only on route-level validation; the service is the authority for valid input.

---

## 2. Caching Policy

- **Cache only** aggregate dashboard blocks: KPIs + intelligence + alert center. **Do not cache** the paginated list.
- **TTL:** 10–30 seconds (implementation choice: 20 seconds, configurable constant).
- **Cache key:** Must include tenant and any query bits that affect aggregates.
  - Format: `inventory:intel-dashboard:${dealershipId}:${hash(aggregateRelevantQuery)}`.
  - Aggregates do not depend on `page`, `pageSize`, `sortBy`, `sortOrder`; they may depend on nothing else in v1, so key can be `inventory:intel-dashboard:${dealershipId}` or include a stable hash of non-list params if needed later.
- **Tenant isolation:** Cache key must include `dealershipId`; never share cache entries across tenants.
- **Implementation:** Use an existing cache utility if present; otherwise add a minimal in-memory TTL cache (e.g. `modules/core/cache/ttl-cache.ts`) with TTL and max entries, deterministic and safe.

---

## 3. Alert Ordering Policy

- **Severity rank:** high = 0, medium = 1, low = 2 (lower number = higher priority).
- **Filter:** By default show only alerts with `count > 0`. If **all** alerts have count 0, show a single row: “No active alerts” (muted text).
- **Sort:** Stable sort by (severityRank asc, count desc, title asc). Service returns alerts already ordered; UI must not re-sort.
- **Consistent prioritization:** High-severity alerts appear first, then by count descending, then by title for stability.

---

## 4. Price-to-Market Heuristic (Internal Comps Fallback Chain)

- **marketAvgCents fallback chain:**
  1. **Internal comps average:** Similar vehicles from inventory (list/asking price). Use `salePriceCents` as list/asking price.
  2. **Book value baseline:** Existing book values map (retail) when available.
  3. **Avg inventory cost/price fallback:** Current fleet average cost or sale price when no comps/book.

- **Similarity definition (v1):**
  - Same **make** + **model** (case-insensitive).
  - Optionally **year** within ±2 if available (when comparing to a specific vehicle; for fleet-level market avg we may use all non-SOLD inventory).
  - Ignore SOLD units.
  - Require at least **N comps** (e.g. MIN_COMPS = 3); else fall back to next step in the chain.

- **Implementation:** Add a DB helper (e.g. in `modules/inventory/db/vehicle.ts`):  
  `getSimilarVehiclePriceComps({ dealershipId, make, model, year?, limit })`  
  Returns average list/asking price (e.g. `salePriceCents`) across similar non-SOLD vehicles. If count < MIN_COMPS, return null so the service can fall back to book value or avg cost.

- **Fleet-level market avg:** For the dashboard we compute one fleet-level “market” baseline. Options:  
  (A) Average of each vehicle’s “market” value (comps for that vehicle or fallback), then average those; or  
  (B) Single fleet comps avg: get similar comps for the whole fleet (e.g. all non-SOLD) and average.  
  Spec: use (B) for simplicity — compute one internal comps average across all non-SOLD vehicles with same make+model (and optionally year ±2) where we have at least MIN_COMPS per “group”, then take weighted average; or simpler: one global average of salePriceCents for non-SOLD where we have enough similar units.  
  **Simplest v1:** For fleet-level dashboard, “internal comps” = average `salePriceCents` of non-SOLD vehicles where there are at least MIN_COMPS vehicles with the same make+model. If no such group exists, fall back to book value baseline, then avg cost.

- **Null safety:** Handle nulls safely for deltaPct and label (e.g. “NA” when no market baseline).

---

## 5. Last Updated + Refresh UX

- **Last updated:** Show “Last updated: &lt;time&gt;” from a server-render timestamp (e.g. `Date.now()` captured in the RSC and passed to the client).
- **Refresh control:** Add a **Refresh** button that triggers a client-side refresh of the route (`router.refresh()`). No manual fetch; rely on Next.js RSC refresh.
- **Implementation:** Use existing button style and icons from `@/lib/ui/icons` (e.g. `RefreshCw`). Use `ICON_SIZES.button` for the icon. No new design primitives.

---

## 6. Acceptance Criteria

- No design drift: use existing dashboard typography/spacing (CardHeader pb-2, CardTitle text-sm font-medium, token-safe classes only).
- No new Tailwind palette colors (token-safe only).
- New tests added/updated; all repo gates pass (lint, build, tests from repo root).
