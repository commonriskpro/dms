# Step 4 — Inventory Slices D–G Performance Notes

**Scope:** Query shape, indexes, response time, NHTSA fetch timeout.

---

## 1. Database queries and indexes

- **Book values:** Single row per vehicle (getByVehicleId / upsert). Index on (dealershipId, vehicleId) in VehicleBookValue (or equivalent) for fast lookup.
- **Recon items:** listByVehicleId(dealershipId, vehicleId) with orderBy createdAt asc; getById(dealershipId, id). Index on (dealershipId, vehicleId) and (dealershipId, id) for ReconItem.
- **Floorplan loans:** listByVehicleId with optional status filter (ACTIVE vs includeHistory); getById(dealershipId, id). Index on (dealershipId, vehicleId), (dealershipId, id) for FloorplanLoan.
- **VIN decode cache:** findCached by (dealershipId, vin, decodedAfter); upsert by (dealershipId, vin). Index on (dealershipId, vin) and decodedAt/updatedAt for TTL queries.

Schema indexes should match the above; no N+1 in the listed flows (single-vehicle scope, bounded lists).

---

## 2. List bounded / pagination

- **Recon items:** Per-vehicle list; no pagination today. Bounded by single vehicle; add limit (e.g. 100) if items can grow large.
- **Floorplan loans:** Per-vehicle list; typically one active loan; includeHistory returns all statuses. orderBy createdAt desc; consider limit if history is unbounded.

---

## 3. Vehicle detail server load

- **Current:** GET /api/inventory/[id] returns vehicle + photos only. Book values, recon items, and floorplan loans are loaded by client components (VehicleValuationsCard, VehicleReconCard, VehicleFloorplanCard) via separate API calls on mount.
- **Recommendation:** For fewer round-trips and better LCP, consider a server-side detail loader that uses Promise.all to fetch vehicle, book values, recon items, and floorplan loans in parallel and passes them as props. Not required for Step 4 signoff; documented as a future optimization.

---

## 4. NHTSA fetch timeout

- **Implementation:** vin-decode-cache uses `fetch(url, { signal: AbortSignal.timeout(10000) })` (10s). On timeout, AbortError is thrown; route maps to 502 with message “VIN decode service unavailable” (no internal details).
- **No N+1:** VIN decode is a single external call per request; cache reduces repeat calls within TTL (30 days).
