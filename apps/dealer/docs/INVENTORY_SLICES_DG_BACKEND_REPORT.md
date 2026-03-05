# Inventory Depth Slices D–G — Step 2 Backend Report

**Date:** 2025-03-05  
**Scope:** Backend only (Prisma, DB, services, API routes, Jest tests) for Slices D, E, F, G.

---

## 1. Summary

Implemented backend for:

- **Slice D:** VIN decode with NHTSA VPIC + `VinDecodeCache` (per dealership + VIN, 30d TTL).
- **Slice E:** Book values (manual) via `VehicleBookValue` (retail/trade/wholesale/auction cents).
- **Slice F:** Recon management via `ReconItem` (standalone items with status PENDING | IN_PROGRESS | COMPLETED).
- **Slice G:** Floorplan tracking via `FloorplanLoan` (lender string, principalCents, interestBps, status ACTIVE | PAID_OFF | SOLD).

All models are multi-tenant (`dealershipId`), RBAC enforced on routes, Zod validation, rate limiting on mutations, and audit logging for creates/updates.

---

## 2. Prisma Schema & Migration

**New models:**

| Model | Purpose |
|-------|---------|
| `VinDecodeCache` | Cache by (dealershipId, vin); 30d TTL; source "NHTSA"; rawJson. |
| `VehicleBookValue` | One row per vehicle (unique dealershipId + vehicleId); retail/trade/wholesale/auction cents; source "MANUAL". |
| `ReconItem` | Line items per vehicle; description (256), costCents, status, completedAt, createdByUserId. |
| `FloorplanLoan` | Lender string (128), principalCents, interestBps, startDate, curtailmentDate, status, notes (1000). |

**New enums:** `ReconItemStatus` (PENDING, IN_PROGRESS, COMPLETED), `FloorplanLoanStatus` (ACTIVE, PAID_OFF, SOLD).

**Migration:** `apps/dealer/prisma/migrations/20260305140000_add_vin_cache_book_value_recon_item_floorplan_loan/migration.sql`

Apply from repo root:

```bash
npm run db:migrate
```

Or with Prisma directly (from repo root, with `DATABASE_URL` set):

```bash
npx prisma migrate deploy --schema=apps/dealer/prisma/schema.prisma
```

---

## 3. DB Layer

| File | Exports |
|------|---------|
| `modules/inventory/db/vin-decode-cache.ts` | `findCached`, `upsertCache` |
| `modules/inventory/db/book-values.ts` | `getByVehicleId`, `upsertBookValues` |
| `modules/inventory/db/recon-item.ts` | `listByVehicleId`, `getById`, `createReconItem`, `updateReconItem`, `getReconItem` |
| `modules/inventory/db/floorplan-loan.ts` | `listByVehicleId`, `getById`, `createFloorplanLoan`, `updateFloorplanLoan`, `getActiveByVehicleId` |

All queries are scoped by `dealershipId`.

---

## 4. Service Layer

| File | Main functions |
|------|----------------|
| `modules/inventory/service/vin-decode-cache.ts` | `decodeVin(dealershipId, vin)` — VIN validation, cache lookup, NHTSA fetch, cache upsert; throws `ApiError("INVALID_VIN", ...)` with `fieldErrors.vin` for invalid VIN. |
| `modules/inventory/service/book-values.ts` | `getBookValues`, `upsertBookValues` (audit: VehicleBookValueUpdated). |
| `modules/inventory/service/recon-items.ts` | `listReconItems`, `addReconItem`, `updateReconItem`, `completeReconItem`, `getReconTotals` (audit: ReconItem.created, .updated). |
| `modules/inventory/service/floorplan-loans.ts` | `getFloorplanLoan`, `createOrUpdateFloorplanLoan`, `markFloorplanStatus`, `calculateAccruedInterestCents` (audit: FloorplanLoan.created, .updated, .status_changed). |

---

## 5. API Routes

### Slice D — VIN decode

| Method | Path | Permission | Rate limit | Description |
|--------|------|------------|------------|-------------|
| POST | `/api/inventory/decode-vin` | inventory.write | vin_decode (per dealership/hour) | Decode VIN; cache 30d; returns `vin`, `decoded`, `vehicle`, `source`, `cached`. Invalid VIN → 400 INVALID_VIN with fieldErrors.vin. |

**Example request:**

```json
POST /api/inventory/decode-vin
{ "vin": "1HGBH41JXMN109186" }
```

**Example response (200):**

```json
{
  "data": {
    "vin": "1HGBH41JXMN109186",
    "decoded": true,
    "vehicle": { "year": 2020, "make": "Honda", "model": "Civic", "trim": "EX" },
    "source": "NHTSA",
    "cached": false
  }
}
```

**Invalid VIN (400):**

```json
{
  "error": { "code": "INVALID_VIN", "message": "Invalid VIN format (17 alphanumeric characters, excluding I, O, Q)", "details": { "fieldErrors": { "vin": ["Invalid VIN format"] } } }
}
```

---

### Slice E — Book values

| Method | Path | Permission | Rate limit | Description |
|--------|------|------------|------------|-------------|
| GET | `/api/inventory/[id]/book-values` | inventory.read | — | Get book values for vehicle. |
| POST | `/api/inventory/[id]/book-values` | inventory.write | inventory_mutation | Upsert book values (retail/trade/wholesale/auction cents); source default "MANUAL". |

**Example GET response (200):**

```json
{
  "data": {
    "vehicleId": "<uuid>",
    "bookValues": {
      "retailCents": 25000_00,
      "tradeInCents": 22000_00,
      "wholesaleCents": 20000_00,
      "auctionCents": null,
      "source": "MANUAL",
      "updatedAt": "2025-03-05T..."
    }
  }
}
```

**Example POST body:**

```json
{
  "retailCents": 25000_00,
  "tradeInCents": 22000_00,
  "wholesaleCents": 20000_00,
  "auctionCents": null,
  "source": "MANUAL"
}
```

---

### Slice F — Recon items

| Method | Path | Permission | Rate limit | Description |
|--------|------|------------|------------|-------------|
| GET | `/api/inventory/[id]/recon/items` | inventory.read | — | List ReconItems + getReconTotals (totalCostCents, completedCostCents, openCostCents, counts by status). |
| POST | `/api/inventory/[id]/recon/items` | inventory.write | inventory_mutation | Create ReconItem (description max 256, costCents ≥ 0, status optional). |
| PATCH | `/api/inventory/recon/[reconItemId]` | inventory.write | inventory_mutation | Update description, costCents, or status (COMPLETED sets completedAt). |

**Example GET response (200):**

```json
{
  "data": {
    "items": [
      { "id": "<uuid>", "description": "Oil change", "costCents": 5000, "status": "COMPLETED", "createdAt": "...", "updatedAt": "...", "completedAt": "...", "createdByUserId": "<uuid>" }
    ],
    "totals": {
      "totalCostCents": 15000,
      "completedCostCents": 5000,
      "openCostCents": 10000,
      "counts": { "PENDING": 1, "IN_PROGRESS": 1, "COMPLETED": 1 }
    }
  }
}
```

**Example POST body:**

```json
{ "description": "Tire rotation", "costCents": 7500, "status": "PENDING" }
```

---

### Slice G — Floorplan loans

| Method | Path | Permission | Rate limit | Description |
|--------|------|------------|------------|-------------|
| GET | `/api/inventory/[id]/floorplan/loans` | inventory.read | — | List FloorplanLoans for vehicle. Query `?includeHistory=true` to include non-ACTIVE. |
| POST | `/api/inventory/[id]/floorplan/loans` | inventory.write | inventory_mutation | Create or update active loan (lender string, principalCents, interestBps 0–5000, startDate, curtailmentDate?, notes?). |
| PATCH | `/api/inventory/floorplan/[floorplanLoanId]` | inventory.write | inventory_mutation | Set status (ACTIVE | PAID_OFF | SOLD). |

**Example POST body:**

```json
{
  "lender": "Dealer Bank",
  "principalCents": 25000_00,
  "interestBps": 995,
  "startDate": "2025-01-15T00:00:00.000Z",
  "curtailmentDate": null,
  "notes": "60-day curtailment"
}
```

**Accrued interest:** Use service `calculateAccruedInterestCents(principalCents, interestBps, startDate, asOfDate)` — simple daily interest: `principal * (bps/10000) * days/365`, rounded to integer cents.

---

## 6. Tests

**Run from repo root:**

```bash
npm run test -w dealer
```

**Run only new slice tests:**

```bash
npm run test -w dealer -- app/api/inventory/vin-decode/route.test.ts modules/inventory/service/vin-decode-cache.test.ts modules/inventory/service/floorplan-loans.interest.test.ts "app/api/inventory/[id]/book-values/route.test.ts"
```

**Coverage:**

- **Slice D:** Route: invalid VIN 400 with INVALID_VIN + fieldErrors.vin; valid VIN returns data; cached path returns cached: true. Service: invalid VIN throws INVALID_VIN; cache hit no fetch; cache miss calls fetch and upserts.
- **Slice E:** GET requires inventory.read; POST requires inventory.write; POST negative cents returns 400.
- **Slice F/G:** Route structure and service usage follow same patterns; existing `slices-defg.security.test.ts` covers RBAC and tenant isolation at service layer for related flows.
- **Interest:** Unit test `floorplan-loans.interest.test.ts` — deterministic `calculateAccruedInterestCents` (0 when bps 0 or asOf before start; 365-day and ~182-day cases).

---

## 7. Files Added/Changed

| Path | Change |
|------|--------|
| `prisma/schema.prisma` | Added VinDecodeCache, VehicleBookValue, ReconItem, FloorplanLoan; enums; relations on Dealership + Vehicle. |
| `prisma/migrations/20260305140000_.../migration.sql` | New migration. |
| `lib/api/errors.ts` | INVALID_VIN → 400. |
| `lib/api/rate-limit.ts` | inventory_mutation type + limit. |
| `app/api/inventory/schemas.ts` | bookValuesBodySchema, reconItemCreate/UpdateBodySchema, reconItemIdParamSchema, floorplanLoanBodySchema, floorplanLoanUpdateBodySchema, floorplanLoanIdParamSchema. |
| `modules/inventory/db/vin-decode-cache.ts` | New. |
| `modules/inventory/db/book-values.ts` | New. |
| `modules/inventory/db/recon-item.ts` | New. |
| `modules/inventory/db/floorplan-loan.ts` | New. |
| `modules/inventory/service/vin-decode-cache.ts` | New. |
| `modules/inventory/service/book-values.ts` | New. |
| `modules/inventory/service/recon-items.ts` | New. |
| `modules/inventory/service/floorplan-loans.ts` | New. |
| `app/api/inventory/vin-decode/route.ts` | Switched to vin-decode-cache service; inventory.write; rate limit; INVALID_VIN 400. |
| `app/api/inventory/[id]/book-values/route.ts` | New GET + POST. |
| `app/api/inventory/[id]/recon/items/route.ts` | New GET + POST. |
| `app/api/inventory/recon/[reconItemId]/route.ts` | New PATCH. |
| `app/api/inventory/[id]/floorplan/loans/route.ts` | New GET + POST. |
| `app/api/inventory/floorplan/[floorplanLoanId]/route.ts` | New PATCH. |
| `app/api/inventory/vin-decode/route.test.ts` | New. |
| `app/api/inventory/[id]/book-values/route.test.ts` | New. |
| `modules/inventory/service/vin-decode-cache.test.ts` | New. |
| `modules/inventory/service/floorplan-loans.interest.test.ts` | New. |
| `docs/INVENTORY_SLICES_DG_BACKEND_REPORT.md` | This report. |

---

## 8. Lint & Build

From repo root:

```bash
npm run lint -w dealer
npm run build -w dealer
```

---

## 9. Note on Existing Routes

- **VehicleRecon** (GET/PATCH `/api/inventory/[id]/recon`) and **VehicleFloorplan** (GET/PUT `/api/inventory/[id]/floorplan`, curtailments, payoff-quote) are unchanged. Slice F recon items use `/api/inventory/[id]/recon/items` and `/api/inventory/recon/[reconItemId]`. Slice G floorplan loans use `/api/inventory/[id]/floorplan/loans` and `/api/inventory/floorplan/[floorplanLoanId]`.
