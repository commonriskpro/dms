# Step 4 — Inventory Completion Performance Report

**Scope:** List and detail endpoints, intelligence computation, and UI.

---

## Checklist

### List endpoints

| Endpoint | Behavior | Notes |
|----------|----------|--------|
| `GET /api/inventory/bulk/import` | Paginated (limit ≤ 100) | Single DB query with limit/offset; no N+1. Bounded. |
| Inventory list (page overview) | `getInventoryPageOverview` | Adds one batch call to `getPriceToMarketForVehicles` (retail map + internal comps by make/model). Two extra bulk queries per request; no per-row async in loop. |

### Intelligence computation

| Area | Cost | Mitigation |
|------|------|------------|
| Price-to-market (list) | `getRetailCentsMap(dealershipId)` + `getInternalCompsAvgCentsByMakeModel(dealershipId)` | Two queries per list load; results applied in memory to current page items. No per-vehicle DB in loop. |
| Price-to-market (detail) | One `getPriceToMarketForVehicle` (internal comps or book value) | Two possible queries (comps then maybe book value). Acceptable for single-vehicle. |
| Days-to-turn | Pure computation from `createdAt` | No extra DB; already on vehicle row. |

### Caching

- **List:** No new cache layer for price-to-market in V1. Dashboard aggregate cache unchanged. If list load grows, consider short TTL cache for comps-by-make-model per dealership.
- **Detail:** No cache for single-vehicle intelligence; acceptable for V1.

### Backfill script

- Batch size 100 vehicles (configurable); cap 500 for API. Per-vehicle: list legacy FileObjects + list existing VehiclePhotos; then transaction for creates. No unbounded queries.

### UI

- Import history: fetch on dialog open; 10 jobs only. Table is small.
- List table: new columns are simple badges; no heavy render.
- Vehicle detail: one extra card when intelligence present; minimal.

---

## Summary

- List: Bounded pagination; two additional bulk queries for price-to-market (retail map + comps by make/model). No N+1.
- Detail: Up to two queries for price-to-market per vehicle; days-to-turn in-memory.
- Backfill: Batched; tenant-scoped.
- No obvious regressions; no new caching in V1. If needed later, add short TTL for comps-by-make-model.

**No critical performance issues identified for the sprint scope.**
