# Inventory Acquisition Engine — Final Report

**Sprint:** Inventory Acquisition Engine  
**Date:** 2025-03-07

---

## 1. Delivered

### Repo inspection
- **Doc:** `apps/dealer/docs/INVENTORY_ACQUISITION_ENGINE_REPO_INSPECTION.md`  
- Summarizes existing VehicleAppraisal, InventorySourceLead, AuctionListingCache, inventory module layout, API routes, RBAC, and gaps (AuctionPurchase, cost API, nav).

### STEP 1 Spec
- **Doc:** `apps/dealer/docs/INVENTORY_ACQUISITION_ENGINE_SPEC.md`  
- Feature A (appraisal) and B (acquisition pipeline) use existing models and APIs.  
- Feature C: new AuctionPurchase model + GET/POST/PATCH auction-purchases API.  
- Feature D: `calculateVehicleCost()`, GET `/api/inventory/[id]/cost`.  
- Frontend: Acquisition sub-nav and new Auction purchases page.

### STEP 2 Backend
- **Prisma:** `AuctionPurchase` model and `AuctionPurchaseStatus` enum (PENDING, IN_TRANSIT, RECEIVED, CANCELLED). Migration: `prisma/migrations/20260307160000_add_auction_purchase/migration.sql`.  
- **DB:** `modules/inventory/db/auction-purchase.ts` — list, getById, create, update.  
- **Service:** `modules/inventory/service/auction-purchase.ts` — list, get, create, update; tenant checks and audit on create.  
- **Vehicle cost:** `calculateVehicleCost()` and `VehicleCostBreakdown` in `modules/inventory/service/vehicle.ts`.  
- **API routes:**  
  - `GET /api/inventory/[id]/cost` — cost breakdown (inventory.read).  
  - `GET /api/inventory/auction-purchases`, `POST /api/inventory/auction-purchases` — list/create (inventory.read/write).  
  - `GET /api/inventory/auction-purchases/[id]`, `PATCH /api/inventory/auction-purchases/[id]` — get/update.  
- **Zod:** `app/api/inventory/auction-purchases/schemas.ts`.

### STEP 3 Frontend
- **Layout:** `app/(app)/inventory/InventorySubNav.tsx` — Acquisition sub-nav (Pipeline, Appraisals, Auctions, Auction purchases) shown when on any of those routes.  
- **Layout:** `app/(app)/inventory/layout.tsx` — Renders `InventorySubNav` + children.  
- **Page:** `app/(app)/inventory/auction-purchases/page.tsx` — Server page; fetches list with optional status filter.  
- **Client:** `AuctionPurchasesPageClient.tsx` — Table (auction, lot, purchase/fees/shipping, ETA, vehicle link, status); Create purchase button; status Select per row (PATCH).  
- **Form:** `AuctionPurchaseForm.tsx` — Dialog: auction name, lot number, purchase price ($), fees, shipping, ETA, status, notes; POST on submit.

### STEP 4 Security & QA
- **Tests:** `modules/inventory/tests/acquisition-engine.test.ts`  
  - Cost: `calculateVehicleCost` returns correct breakdown and total; zero costs → zero total.  
  - Auction purchase tenant isolation (DB-dependent): list for dealer A excludes dealer B; get/update with wrong dealer → null / NOT_FOUND.  
- Existing inventory tests (tenant isolation, totalCostCents, etc.) unchanged.  
- All queries scoped by `dealershipId`; RBAC `inventory.read` / `inventory.write` on new routes; cross-tenant → NOT_FOUND.

---

## 2. Commands

```bash
# From repo root
npm run test:dealer

# Run only acquisition-engine + cost-related unit tests (no DB)
cd apps/dealer && npx jest modules/inventory/tests/acquisition-engine.test.ts modules/inventory/tests/inventory-hardening.test.ts --testNamePattern="totalCostCents|calculateVehicleCost|cost calculation"

# Apply migration (when DATABASE_URL is set)
cd apps/dealer && npx prisma migrate deploy

# Generate Prisma client (after schema change)
cd apps/dealer && npx prisma generate
```

---

## 3. What stayed as-is

- **VehicleAppraisal** and **InventorySourceLead** — No schema or API changes.  
- **Appraisal/Acquisition APIs** — Existing routes and permissions.  
- **Auction search / appraise** — `GET auctions/search`, `GET auctions/[id]`, `POST auctions/[id]/appraise` unchanged.  
- **No separate `modules/acquisition-core`** — New code lives under `modules/inventory` (db + service) and `app/api/inventory` to avoid duplication and keep a single inventory boundary.

---

## 4. Deferred / notes

- **AcquisitionOpportunity** — Sprint brief mentioned a model with stages LEAD/APPRAISAL/NEGOTIATING/PURCHASED/LOST. Implemented pipeline remains **InventorySourceLead** (NEW → CONTACTED → NEGOTIATING → WON/LOST). UI can map WON → “Purchased”, NEW → “Lead” if desired.  
- **Optional audit** for acquisition lead create/update/stage — Not added; can be added in `modules/inventory/service/acquisition.ts` if required.  
- **Auction purchase list filter by status** — Server supports `?status=`; client table has no filter UI yet (only pagination).  
- **Vehicle detail cost card** — GET `/api/inventory/[id]/cost` is implemented; vehicle detail page can add a small cost breakdown card that calls this endpoint.  
- **Integration tests** for auction purchase tenant isolation require `TEST_DATABASE_URL`; with DB they run in `acquisition-engine.test.ts`.

---

## 5. Files touched / added

| Path | Action |
|------|--------|
| `docs/INVENTORY_ACQUISITION_ENGINE_REPO_INSPECTION.md` | Added |
| `docs/INVENTORY_ACQUISITION_ENGINE_SPEC.md` | Added |
| `docs/INVENTORY_ACQUISITION_ENGINE_FINAL_REPORT.md` | Added |
| `prisma/schema.prisma` | Modified (AuctionPurchase, enum, Dealership/Vehicle relations) |
| `prisma/migrations/20260307160000_add_auction_purchase/migration.sql` | Added |
| `modules/inventory/db/auction-purchase.ts` | Added |
| `modules/inventory/service/auction-purchase.ts` | Added |
| `modules/inventory/service/vehicle.ts` | Modified (calculateVehicleCost, VehicleCostBreakdown) |
| `app/api/inventory/[id]/cost/route.ts` | Added |
| `app/api/inventory/auction-purchases/schemas.ts` | Added |
| `app/api/inventory/auction-purchases/route.ts` | Added |
| `app/api/inventory/auction-purchases/[id]/route.ts` | Added |
| `app/(app)/inventory/layout.tsx` | Modified (InventorySubNav) |
| `app/(app)/inventory/InventorySubNav.tsx` | Added |
| `app/(app)/inventory/auction-purchases/page.tsx` | Added |
| `app/(app)/inventory/auction-purchases/AuctionPurchasesPageClient.tsx` | Added |
| `app/(app)/inventory/auction-purchases/AuctionPurchaseForm.tsx` | Added |
| `modules/inventory/tests/acquisition-engine.test.ts` | Added |
