# Step 4 — Inventory Slices D–G Test Report

**Scope:** Automated tests for Slices D–G security and invariants.  
**Commands:** From repository root.

---

## Commands run (from repository root)

```bash
npm ci
npm run test -w dealer
npm run lint -w dealer
npm run build -w dealer
```

---

## Pass/fail summary

| Command | Result | Notes |
|---------|--------|--------|
| npm ci | Must pass | Deterministic install from root. If EPERM on Prisma binary, close other processes using it and retry. |
| npm run test -w dealer | Must pass | All Jest tests; integration suites require TEST_DATABASE_URL (SKIP_INTEGRATION_TESTS=1 to skip DB). |
| npm run lint -w dealer | Must pass | next lint (run from root with -w dealer). |
| npm run build -w dealer | Must pass | Prisma generate + Next build. |

---

## Test scope (Slices D–G)

- **app/api/inventory/vin-decode/route.test.ts:** POST vin-decode (400 INVALID_VIN with fieldErrors.vin, 200 success/cached, 400 missing vin, 502 NHTSA error no details, 429 rate limit, 502 AbortError).
- **app/api/inventory/[id]/book-values/route.test.ts:** GET 403 without read, 200 with data; POST 403 without write, 400 negative cents.
- **modules/inventory/service/vin-decode-cache.test.ts:** INVALID_VIN (length, I/O/Q), cache hit (no fetch), cache miss (fetch + upsert).
- **modules/inventory/tests/slices-defg.security.test.ts:**  
  - RBAC: vin/decode, vin GET, valuations, recon, recon/line-items, floorplan, book-values, recon/items, recon/[reconItemId], floorplan/loans, floorplan/[floorplanLoanId].  
  - Tenant isolation: decodeVin, getVin, valuations, recon, floorplan (legacy); getBookValues, upsertBookValues, listReconItems, addReconItem, updateReconItem (cross-dealer), getFloorplanLoan, createOrUpdateFloorplanLoan, markFloorplanStatus (cross-dealer).  
  - Validation: idParam, requestValuation, reconLineItem, reconUpdate, floorplanUpsert, curtailment, payoffQuote, reconLineItemId; bookValuesBodySchema, reconItemCreate/Update, floorplanLoan, floorplanLoanUpdate, reconItemIdParam, floorplanLoanIdParam.  
  - Invariants: recon total vs line items, integer cents, RECON_OVERDUE.  
  - Audit: vin_decode.requested, vehicle_valuation.captured, vehicle_recon_line_item.added, vehicle_floorplan.curtailment; VehicleBookValueUpdated, ReconItem.created, FloorplanLoan.created, FloorplanLoan.status_changed.
- **lib/api/errors.test.ts:** toErrorPayload INVALID_VIN → 400.

---

## Quarantined / skipped

- None. Integration blocks in slices-defg.security.test.ts are skipped when `SKIP_INTEGRATION_TESTS=1` or `TEST_DATABASE_URL` is unset; no quarantined tests.

---

## DB connection / lint notes

- If the full suite hits “Too many database connections,” run integration tests serially (e.g. Jest `runInBand` or `maxWorkers=1` for the integration project) and use a singleton Prisma client per process; document in this report.
- If lint fails with “Invalid project directory,” ensure apps/dealer has `"lint": "next lint"` and root uses `npm run lint -w dealer`; document fix here.
