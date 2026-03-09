# Step 4 — Inventory Legacy Cutover Performance Report

**Scope:** Internal comps cache, list/detail paths, backfill.

---

## Checklist

### Internal comps cache

- **Effect:** Repeated list or detail loads for the same dealership within 25s reuse the same internal-comps-by-make-model map; one fewer DB call per request after the first.
- **TTL:** 25s; no explicit invalidation. Acceptable for list/detail intelligence.
- **Size:** maxEntries 500; key per dealership; low memory.

### List / detail

- **List:** Single batch of vehicles; one retail map query + one comps query (or cache hit). No N+1. Legacy fallback removal does not add work; it removes an alternate code path that could have run when no VehiclePhotos existed.
- **Detail:** GET [id] unchanged in number of queries; photo shape alignment is response mapping only. No extra round-trips.

### Backfill

- All-dealership mode iterates dealerships in sequence; each dealership uses existing batch size (e.g. 100 vehicles). No unbounded load.

---

## Summary

- Cache reduces repeated comps work for the same dealership within TTL.
- No new N+1 or duplicate serialization; legacy fallback removal does not worsen performance.
- No regressions identified for the cutover scope.
