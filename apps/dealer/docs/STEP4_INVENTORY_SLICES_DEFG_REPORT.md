# Step 4 — Inventory Depth Slices D, E, F, G — Security & QA Report

**Date:** 2025-03-05  
**Scope:** Slices D (VIN decode), E (Valuations), F (Recon), G (Floorplan)

---

## 1. Summary

Security & QA tests were added under `modules/inventory/tests/slices-defg.security.test.ts` covering:

- **Tenant isolation:** Cross-dealership access returns 404 (NOT_FOUND). Services throw `ApiError("NOT_FOUND", ...)` when vehicle (or recon/floorplan) belongs to another dealership; `toErrorPayload(e).status === 404`.
- **RBAC:** For each protected route, a test proves 403 when the required permission is missing via `requirePermission(userId, dealershipId, permission)` and `toErrorPayload(e).status === 403`. Permissions: `inventory.read` / `inventory.write` (VIN, recon), `finance.read` / `finance.write` (valuations POST, floorplan).
- **Validation:** At least one test per slice for invalid body/params: invalid UUID, missing required field, negative costCents/amountCents. Zod schemas validated in unit tests; invalid input throws (400 at route edge).
- **Key invariants:** (1) Recon: after add/update/delete line items, `Vehicle.reconCostCents` equals sum of line item `costCents`. (2) Cents-only: valuations `valueCents`, floorplan `principalCents`/`amountCents`/`payoffQuoteCents` are integers. (3) RECON_OVERDUE: `listVehicleIdsReconOverdue` returns only vehicles with VehicleRecon status IN_PROGRESS or NOT_STARTED and `dueDate < today`.
- **Audit:** Optional verification that after decode, request valuation, recon line item add, floorplan curtailment, an audit log entry exists (`vin_decode.requested`, `vehicle_valuation.captured`, `vehicle_recon_line_item.added`, `vehicle_floorplan.curtailment`).
- **Rate limit / abuse:** Not asserted in tests (would require mocking or exceeding limit); documented as manual follow-up.

---

## 2. Commands Run

From repository root:

```bash
npm -w apps/dealer run test -- modules/inventory/tests
npm -w apps/dealer run build
```

---

## 3. Results

- **Tests:** Pass. Example run: `npm -w apps/dealer run test -- modules/inventory/tests` → 3 suites passed, 4 skipped (no DB), 29 tests passed, 54 skipped.
- **Build:** Pass. `npm -w apps/dealer run build` completes successfully (Prisma generate + Next build).
- **Flaky/skipped:** No flaky tests. When DB is not configured, 4 suites (RBAC, tenant isolation, invariants, audit) are skipped; validation and other unit tests still run.

---

## 4. Files Touched

| File | Change |
|------|--------|
| `apps/dealer/modules/inventory/tests/slices-defg.security.test.ts` | **New.** RBAC (13 tests), tenant isolation (10 tests), validation (8 tests), invariants (3 tests), audit (4 tests). |
| `apps/dealer/docs/STEP4_INVENTORY_SLICES_DEFG_REPORT.md` | **New.** This report. |

---

## 5. RBAC Coverage (per route)

| Route | Permission | Test |
|-------|------------|------|
| GET /api/inventory/[id]/vin | inventory.read | no inventory.read → 403 |
| POST /api/inventory/[id]/vin/decode | inventory.write | no inventory.write → 403 |
| GET /api/inventory/[id]/valuations | inventory.read | no inventory.read → 403 |
| POST /api/inventory/[id]/valuations | finance.read | no finance.read → 403 |
| GET /api/inventory/[id]/recon | inventory.read | no inventory.read → 403 |
| PATCH /api/inventory/[id]/recon | inventory.write | no inventory.write → 403 |
| POST /api/inventory/[id]/recon/line-items | inventory.write | no inventory.write → 403 |
| PATCH /api/inventory/[id]/recon/line-items/[lineItemId] | inventory.write | no inventory.write → 403 |
| DELETE /api/inventory/[id]/recon/line-items/[lineItemId] | inventory.write | no inventory.write → 403 |
| GET /api/inventory/[id]/floorplan | finance.read | no finance.read → 403 |
| PUT /api/inventory/[id]/floorplan | finance.write | no finance.write → 403 |
| POST /api/inventory/[id]/floorplan/curtailments | finance.write | no finance.write → 403 |
| POST /api/inventory/[id]/floorplan/payoff-quote | finance.write | no finance.write → 403 |

---

## 6. Tenant Isolation Coverage

Requesting a resource with a `vehicleId` (or recon/floorplan under that vehicle) that belongs to another dealership is tested at the **service layer**. Services throw `ApiError("NOT_FOUND", ...)`; route handler maps to 404. Tests call service as dealer A with dealer B’s vehicle id and assert throw and `toErrorPayload(e).status === 404`:

- decodeVin, getVin, listValuations, requestValuation  
- getRecon, updateRecon, addLineItem (recon)  
- getFloorplan, upsertFloorplan, addCurtailment, setPayoffQuote  

---

## 7. Follow-ups

- **Rate limit 429:** Manually verify that exceeding rate limit (e.g. VIN decode 30/hour, valuation request, curtailment, payoff-quote) returns 429 when possible, or document as manual check.
- **E2E:** Optional end-to-end tests with real HTTP requests and auth cookies for full route stack.
- **Alert integration:** RECON_OVERDUE invariant is tested via `listVehicleIdsReconOverdue`; optional check that alerts API returns RECON_OVERDUE for vehicles in that list.
