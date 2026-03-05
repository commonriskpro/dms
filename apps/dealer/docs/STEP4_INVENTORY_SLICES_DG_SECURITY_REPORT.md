# Step 4 — Inventory Slices D–G Security Report

**Scope:** Slices D–G (VIN decode, Book Values, Recon Items, Floorplan Loans).  
**Purpose:** What was hardened, what tests were added, threats mitigated, known limitations.

---

## 1. What was checked

- **API routes:** POST /api/inventory/vin-decode; GET/POST /api/inventory/[id]/book-values; GET/POST /api/inventory/[id]/recon/items; PATCH /api/inventory/recon/[reconItemId]; GET/POST /api/inventory/[id]/floorplan/loans; PATCH /api/inventory/floorplan/[floorplanLoanId].
- **Invariants:** Tenant isolation (dealershipId on every service call), RBAC (inventory.read / inventory.write), Zod validation at edge, rate limiting on mutations and vin_decode, audit logging on all mutations, response hygiene (no stack/details leak on 502), money (cents only, interestBps 0–5000), string lengths (recon 256, lender 128, notes 1000).
- **Services:** book-values, recon-items, floorplan-loans, vin-decode-cache (NHTSA timeout 10s, cache TTL).

---

## 2. What was fixed

- **Vin-decode route:** 502 response no longer includes `details.cause` with raw error message; AbortError/TimeoutError from NHTSA fetch now mapped to 502 with sanitized message.
- **Validation response:** `validationErrorResponse` now includes `fieldErrors` (Zod flatten) in addition to `issues`, so API consumers get field-level errors consistently; signature accepts `ZodError | ZodIssue[]`.
- **INVALID_VIN:** Confirmed mapped to 400 in `toErrorPayload`; test added in lib/api/errors.test.ts.

---

## 3. Tests added or extended

- **slices-defg.security.test.ts:**  
  - RBAC: GET/POST book-values, GET/POST recon/items, PATCH recon/[reconItemId], GET/POST floorplan/loans, PATCH floorplan/[floorplanLoanId] (inventory.read / inventory.write).  
  - Tenant isolation: getBookValues, upsertBookValues, listReconItems, addReconItem, updateReconItem (cross-dealer), getFloorplanLoan, createOrUpdateFloorplanLoan, markFloorplanStatus (cross-dealer).  
  - Validation: bookValuesBodySchema, reconItemCreateBodySchema (description 256), reconItemUpdateBodySchema, floorplanLoanBodySchema (lender 128, notes 1000, interestBps 0–5000), floorplanLoanUpdateBodySchema, reconItemIdParamSchema, floorplanLoanIdParamSchema.  
  - Audit: VehicleBookValueUpdated, ReconItem.created, FloorplanLoan.created, FloorplanLoan.status_changed.
- **vin-decode route.test.ts:** 502 on NHTSA error (no details), 429 when rate limited, 502 on AbortError (timeout).
- **lib/api/errors.test.ts:** INVALID_VIN → 400.

---

## 4. Threats mitigated

- **Cross-tenant access:** All services take dealershipId; vehicle/recon/loan belong to tenant; cross-tenant id returns NOT_FOUND 404.
- **Privilege escalation:** guardPermission on every route; missing inventory.read or inventory.write → 403.
- **DoS / abuse:** vin_decode rate limit (per dealership, 30/hour); inventory_mutation on all mutations (60/min per user+dealership); VIN length and format validated; NHTSA fetch timeout 10s.
- **Information leakage:** 502 responses do not expose stack or internal messages; validation errors expose field-level errors only.
- **Money/APR safety:** Cents and bps validated by Zod; negative or non-integer rejected; interestBps capped 0–5000.
- **Input abuse:** Description 256, lender 128, notes 1000 enforced in schema and DB.

---

## 5. Known limitations

- **Rate limit:** In-memory; production should use shared store (e.g. Redis) for multi-instance consistency.
- **Vehicle detail load:** Book values, recon items, and floorplan loans are loaded by client cards (fetch on mount) rather than a single server-side Promise.all; acceptable for current scope; consider batching in a future optimization.
- **Recon/floorplan list:** No explicit limit on items per vehicle; bounded by single-vehicle scope; add limit if items can grow very large.
- **Body size:** No global rejectIfBodyTooLarge on mutation routes; Zod and schema string caps limit payload size; add body size middleware if project standard exists.
