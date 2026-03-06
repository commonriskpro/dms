# Step 4 — Inventory Slices D–G Smoke Report

**Scope:** VIN decode, Book Values, Recon Items, Floorplan Loans (API + UI).  
**Purpose:** Manual smoke checklist and outcomes.

---

## Manual smoke checklist

| # | Flow | Steps | Expected | Outcome |
|---|------|--------|----------|---------|
| 1 | **VIN decode** | Add Vehicle → enter VIN → trigger decode | 200, decoded vehicle (year/make/model) or 400 INVALID_VIN with fieldErrors.vin | _Manual: run in browser; verify decode button, cache (second decode same VIN returns cached: true if within TTL)._ |
| 2 | **Book values save** | Vehicle detail → Book Values card → edit retail/wholesale/trade/auction → Save | 200, updated book values; audit VehicleBookValueUpdated | _Manual: verify form validation (negative cents → 400), save persists._ |
| 3 | **Recon add/complete** | Vehicle detail → Recon card → Add item (description ≤256, costCents ≥0) → Save; mark item Complete | 200 for add/update; audit ReconItem.created / ReconItem.updated | _Manual: verify description length 256, cost nonnegative; complete updates status._ |
| 4 | **Floorplan create/status** | Vehicle detail → Floorplan card → Add loan (lender ≤128, principalCents, notes ≤1000) → Save; change status to Paid off | 200; audit FloorplanLoan.created, FloorplanLoan.status_changed | _Manual: verify lender/notes length, interestBps 0–5000; status change persists._ |

---

## Outcomes

- **VIN decode:** API returns 400 with `fieldErrors.vin` for invalid VIN; 502 with sanitized message on NHTSA timeout/failure; 429 when rate limit exceeded. Cache returns `cached: true` when result is within TTL.
- **Book values:** GET/POST scoped by vehicle and tenant; POST rate-limited; audit on upsert.
- **Recon:** GET/POST items and PATCH item scoped by vehicle/tenant; description 256, costCents ≥0; audit on add/update.
- **Floorplan loans:** GET/POST loans and PATCH loan status scoped by vehicle/tenant; lender 128, notes 1000, interestBps 0–5000; audit on create and status change.

Manual execution of the above flows in a deployed or local environment should be performed before production signoff; this document serves as the checklist template.
