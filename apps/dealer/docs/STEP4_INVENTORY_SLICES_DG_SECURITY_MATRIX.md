# Step 4 — Inventory Slices D–G Security Matrix & Invariants

**Scope:** VIN decode (D), Book Values (E), Recon Items (F), Floorplan Loans (G).  
**Purpose:** Enumerate each endpoint and UI flow with tenant isolation, RBAC, validation, rate limit, audit, and abuse/edge cases.

---

## 1. API Routes

### POST /api/inventory/vin-decode

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | No vehicle id; request is scoped by `ctx.dealershipId` from auth. Cache key and NHTSA usage are per dealership. No cross-tenant data returned. |
| **Required permission** | `inventory.write` (guardPermission before body parse). |
| **Validation** | Body: `vinDecodeBodySchema` — `vin` string min 8, max 17. Invalid VIN format (length, I/O/Q) → service throws `INVALID_VIN` → route returns 400 with `fieldErrors.vin`. |
| **Rate limit** | Bucket `vin_decode` (per dealership, 1-hour window, 30/hour). Returns 429 when exceeded. |
| **Audit** | VIN decode cache does not emit audit (stateless decode). Optional: if vehicle id were passed, audit would apply. |
| **Abuse/edge** | DoS: rate limit + VIN length cap + NHTSA fetch timeout (10s AbortController). Invalid VIN → 400, no external call. Timeout/fetch failure → 502 with sanitized message (no stack or internal URL). |

---

### GET /api/inventory/[id]/book-values

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `bookValuesService.getBookValues(ctx.dealershipId, id)`. Vehicle must belong to dealership; else NOT_FOUND 404. |
| **Required permission** | `inventory.read`. |
| **Validation** | Params: `idParamSchema` (UUID). Invalid id → 400 with validation error. |
| **Rate limit** | None (read). |
| **Audit** | None (read). |
| **Abuse/edge** | List bounded by single vehicle; no pagination needed. |

---

### POST /api/inventory/[id]/book-values

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `bookValuesService.upsertBookValues(ctx.dealershipId, id, ...)`. Vehicle must belong to dealership; else NOT_FOUND 404. |
| **Required permission** | `inventory.write`. |
| **Validation** | Params: `idParamSchema`. Body: `bookValuesBodySchema` — retailCents, tradeInCents, wholesaleCents, auctionCents (all optional, nonnegative int); source max 32. Negative cents → Zod or service 400. |
| **Rate limit** | `inventory_mutation` (per user+dealership, 60/min). Returns 429 when exceeded. |
| **Audit** | `VehicleBookValueUpdated`, entity `VehicleBookValue`, entityId = row id. |
| **Abuse/edge** | Money: cents only (integers). No floats. Body size: JSON body; schema caps source length. |

---

### GET /api/inventory/[id]/recon/items

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `reconItemsService.listReconItems(ctx.dealershipId, id)` and `getReconTotals(ctx.dealershipId, id)`. Vehicle must belong to dealership; else NOT_FOUND 404. |
| **Required permission** | `inventory.read`. |
| **Validation** | Params: `idParamSchema` (UUID). |
| **Rate limit** | None (read). |
| **Audit** | None (read). |
| **Abuse/edge** | List per vehicle; no unbounded list. OrderBy createdAt; consider limit if items can grow large (currently no limit; single vehicle scope keeps it bounded). |

---

### POST /api/inventory/[id]/recon/items

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `reconItemsService.addReconItem(ctx.dealershipId, id, ...)`. Vehicle must belong to dealership; else NOT_FOUND 404. |
| **Required permission** | `inventory.write`. |
| **Validation** | Params: `idParamSchema`. Body: `reconItemCreateBodySchema` — description min 1, max 256; costCents nonnegative int; status optional enum. |
| **Rate limit** | `inventory_mutation`. Returns 429 when exceeded. |
| **Audit** | `ReconItem.created`, entity `ReconItem`, entityId = item id. |
| **Abuse/edge** | Description max 256 (Zod + schema). costCents nonnegative integer. |

---

### PATCH /api/inventory/recon/[reconItemId]

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `reconItemsService.updateReconItem(ctx.dealershipId, reconItemId, ...)`. DB layer filters by `dealershipId` + id; other tenant’s item → NOT_FOUND 404. |
| **Required permission** | `inventory.write`. |
| **Validation** | Params: `reconItemIdParamSchema` (UUID). Body: `reconItemUpdateBodySchema` — description 1–256 optional, costCents nonnegative optional, status optional. |
| **Rate limit** | `inventory_mutation`. Returns 429 when exceeded. |
| **Audit** | `ReconItem.updated`, entity `ReconItem`, entityId = reconItemId. |
| **Abuse/edge** | Description max 256; costCents nonnegative. |

---

### GET /api/inventory/[id]/floorplan/loans

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `floorplanLoansService.getFloorplanLoan(ctx.dealershipId, id, ...)`. Vehicle must belong to dealership; else NOT_FOUND 404. |
| **Required permission** | `inventory.read`. |
| **Validation** | Params: `idParamSchema` (UUID). Query: `includeHistory` optional (boolean). |
| **Rate limit** | None (read). |
| **Audit** | None (read). |
| **Abuse/edge** | List per vehicle; orderBy createdAt desc; typically one active loan; includeHistory returns all statuses. Bounded per vehicle. |

---

### POST /api/inventory/[id]/floorplan/loans

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `floorplanLoansService.createOrUpdateFloorplanLoan(ctx.dealershipId, id, ...)`. Vehicle must belong to dealership; else NOT_FOUND 404. |
| **Required permission** | `inventory.write`. |
| **Validation** | Params: `idParamSchema`. Body: `floorplanLoanBodySchema` — lender 1–128 chars; principalCents nonnegative int; interestBps 0–5000 optional; startDate, curtailmentDate (datetime); notes max 1000. |
| **Rate limit** | `inventory_mutation`. Returns 429 when exceeded. |
| **Audit** | `FloorplanLoan.created` or `FloorplanLoan.updated`, entity `FloorplanLoan`, entityId = loan id. |
| **Abuse/edge** | Money: principalCents integer; interestBps 0–5000. Lender 128, notes 1000. |

---

### PATCH /api/inventory/floorplan/[floorplanLoanId]

| Invariant | Implementation |
|-----------|----------------|
| **Tenant isolation** | `floorplanLoansService.markFloorplanStatus(ctx.dealershipId, floorplanLoanId, ...)`. DB filters by dealershipId + id; other tenant’s loan → NOT_FOUND 404. |
| **Required permission** | `inventory.write`. |
| **Validation** | Params: `floorplanLoanIdParamSchema` (UUID). Body: `floorplanLoanUpdateBodySchema` — status enum (ACTIVE, PAID_OFF, SOLD). |
| **Rate limit** | `inventory_mutation`. Returns 429 when exceeded. |
| **Audit** | `FloorplanLoan.status_changed`, entity `FloorplanLoan`, entityId = floorplanLoanId. |
| **Abuse/edge** | Status enum only. |

---

## 2. UI Flows (Vehicle Detail)

| Flow | Tenant isolation | RBAC | Validation | Notes |
|------|------------------|------|------------|--------|
| **Add Vehicle VIN decode** | Request uses session dealership; no vehicle id in vin-decode API. | UI should gate on `inventory.write`. | VIN length/format validated by API. | Rate limit applies; timeout on NHTSA. |
| **Book Values edit/save** | Vehicle id from route; API scopes by ctx.dealershipId. | inventory.read (view), inventory.write (save). | Cents nonnegative; source length. | Mutation rate limited. |
| **Recon add/update/complete** | Vehicle id and reconItemId from route; API scopes by dealershipId. | inventory.read (list), inventory.write (add/update). | Description 256, costCents ≥ 0. | Mutation rate limited. |
| **Floorplan create/update/status** | Vehicle id and floorplanLoanId from route; API scopes by dealershipId. | inventory.read (list), inventory.write (create/update/status). | Lender 128, notes 1000, interestBps 0–5000. | Mutation rate limited. |

---

## 3. Invariants Checklist

- [x] Every query/mutation scoped by `dealershipId`; cross-tenant by id returns 404 (or 403 where appropriate).
- [x] RBAC: inventory.read for reads, inventory.write for mutations on these endpoints.
- [x] Validation: params and body validated with Zod; invalid input returns 400 with structured error (issues/fieldErrors).
- [x] Rate limiting: vin_decode (stricter bucket); all mutations use inventory_mutation.
- [x] Audit: every mutation emits correct entity type and action (VehicleBookValue, ReconItem, FloorplanLoan).
- [x] Response hygiene: no stack traces; INVALID_VIN and fetch failures return sanitized messages.
- [x] Money: cents-based integers only; interestBps 0–5000.
- [x] String lengths: recon description 256, floorplan lender 128, notes 1000.
