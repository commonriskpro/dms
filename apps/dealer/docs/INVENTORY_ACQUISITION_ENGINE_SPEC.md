# Inventory Acquisition Engine — Sprint Spec (STEP 1)

**Sprint:** Inventory Acquisition Engine  
**Goal:** Allow dealerships to acquire vehicles via appraisal workflow, acquisition pipeline, auction purchase tracking, and vehicle cost breakdown.

This spec builds on the existing implementation (see `INVENTORY_ACQUISITION_ENGINE_REPO_INSPECTION.md`). New work is limited to: **AuctionPurchase** model and APIs, **vehicle cost** API and service helper, and **nav/frontend** alignment. Appraisal and acquisition pipeline use existing models and routes.

---

## 1. Feature Set A — Vehicle Appraisal (Existing)

- **Model:** `VehicleAppraisal` (already in schema). Field mapping from sprint brief to schema:  
  `marketRetailCents` → `expectedRetailCents`, `tradeValueCents` → `expectedTradeInCents`, `auctionValueCents` → `expectedWholesaleCents`, `reconEstimateCents`, `profitEstimateCents` → `expectedProfitCents`, `createdByUserId` → `appraisedByUserId`.
- **Service:** `createAppraisal()`, `updateAppraisal()` (and approve, reject, convert) in `modules/inventory/service/appraisal.ts`.
- **Endpoints:**  
  - `GET /api/inventory/appraisals` — list (paginated, filters).  
  - `POST /api/inventory/appraisals` — create.  
  - `PATCH /api/inventory/appraisals/[id]` — update (DRAFT only).  
  - Plus existing approve, reject, convert.
- **RBAC:** `inventory.appraisals.read` / `inventory.appraisals.write`. All scoped by `dealershipId`.

No schema or API changes required for Feature A.

---

## 2. Feature Set B — Acquisition Pipeline (Existing)

- **Model:** `InventorySourceLead` with status enum: NEW, CONTACTED, NEGOTIATING, WON, LOST.  
  UI/story mapping: LEAD → NEW, APPRAISAL → (lead with appraisalId set), NEGOTIATING → NEGOTIATING, PURCHASED → WON, LOST → LOST.
- **Endpoints:**  
  - `GET /api/inventory/acquisition` — list leads.  
  - `POST /api/inventory/acquisition` — create lead.  
  - `PATCH /api/inventory/acquisition/[id]` — update lead.  
  - `POST /api/inventory/acquisition/[id]/move-stage` — set status.
- **RBAC:** `inventory.acquisition.read` / `inventory.acquisition.write`. Tenant-scoped.

No new model or routes. Optional: add audit for lead create/update/stage in `modules/inventory/service/acquisition.ts`.

---

## 3. Feature Set C — Auction Purchase Tracking (New)

- **Model:** Add `AuctionPurchase` to Prisma.

| Field | Type | Notes |
|-------|------|--------|
| id | String @id @db.Uuid | |
| dealershipId | String @map("dealership_id") @db.Uuid | FK Dealership |
| vehicleId | String? @map("vehicle_id") @db.Uuid | FK Vehicle (optional until vehicle created) |
| auctionName | String @map("auction_name") @db.VarChar(256) | |
| lotNumber | String @map("lot_number") @db.VarChar(128) | |
| purchasePriceCents | BigInt @map("purchase_price_cents") | |
| feesCents | BigInt @default(0) @map("fees_cents") | |
| shippingCents | BigInt @default(0) @map("shipping_cents") | |
| etaDate | DateTime? @map("eta_date") | |
| status | Enum AuctionPurchaseStatus | e.g. PENDING, IN_TRANSIT, RECEIVED, CANCELLED |
| notes | String? @db.Text | |
| createdAt | DateTime @map("created_at") | |
| updatedAt | DateTime @updatedAt @map("updated_at") | |

**Enum:** `AuctionPurchaseStatus`: PENDING, IN_TRANSIT, RECEIVED, CANCELLED.

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, status])`, `@@index([vehicleId])`.

**Relations:** Dealership, Vehicle?.

- **DB layer:** New file `modules/inventory/db/auction-purchase.ts` — list, getById, create, update; all by dealershipId.
- **Service layer:** New file `modules/inventory/service/auction-purchase.ts` — list, get, create, update; tenant + optional audit.
- **Endpoints:**  
  - `GET /api/inventory/auction-purchases` — list (paginated, optional filters: status, vehicleId).  
  - `POST /api/inventory/auction-purchases` — create.  
  - `GET /api/inventory/auction-purchases/[id]` — get one.  
  - `PATCH /api/inventory/auction-purchases/[id]` — update (e.g. status, vehicleId, etaDate).
- **RBAC:** `inventory.read` for GET; `inventory.write` for POST/PATCH (or dedicated `inventory.auctions.write` if added to seed). For consistency with existing auctions.read, use `inventory.read` / `inventory.write` for purchase list/create/update.
- **Serialization:** All cents as string in JSON. Dates as ISO string.

---

## 4. Feature Set D — Vehicle Cost Breakdown (New)

- **Service:** Add `calculateVehicleCost(vehicle)` in `modules/inventory/service/vehicle.ts` (or a small `service/cost.ts`) returning:  
  `{ purchasePriceCents, auctionCostCents, transportCostCents, reconCostCents, miscCostCents, totalCostCents }` (all bigint; total = sum of the four cost fields, matching existing `totalCostCents()`).  
  Use existing Vehicle fields and `totalCostCents()`.
- **Endpoint:**  
  - `GET /api/inventory/[id]/cost` — returns cost breakdown + total for the vehicle.  
  - 404 if vehicle not found or not in tenant.  
  - Response: `{ vehicleId, auctionCostCents, transportCostCents, reconCostCents, miscCostCents, totalCostCents }` (cents as string).
- **RBAC:** `inventory.read`. Tenant-scoped via existing getVehicle.

---

## 5. Frontend

- **Navigation:** Under **Inventory**, add an “Acquisition” sub-section (or sub-nav) with links to:  
  - Acquisition (board) → `/inventory/acquisition`  
  - Appraisals → `/inventory/appraisals`  
  - Opportunities → `/inventory/acquisition` (same pipeline; optional table view at `/inventory/acquisition/opportunities`)  
  - Auctions → `/inventory/auctions`  
  - Auction purchases (new) → `/inventory/auction-purchases` (new page: table, create, status updates)
- **Pages:**  
  - Existing: `/inventory/acquisition`, `/inventory/appraisals`, `/inventory/auctions`.  
  - New: `/inventory/auction-purchases` — list AuctionPurchase, create form, row actions (edit, update status).  
- **Vehicle detail:** On vehicle detail page, optionally show cost breakdown (e.g. link to cost API or inline card using GET `/api/inventory/[id]/cost`).

Design: Use existing enterprise SaaS dashboard layout and design tokens; tables with loading/empty/error states; forms with React Hook Form + Zod.

---

## 6. Backend Layout

- **No new top-level module.** All code remains under `modules/inventory/`:  
  - `db/auction-purchase.ts` (new)  
  - `service/auction-purchase.ts` (new)  
  - `service/vehicle.ts` — add `calculateVehicleCost()` or export breakdown type and use `totalCostCents` in route  
  - `app/api/inventory/[id]/cost/route.ts` (new)  
  - `app/api/inventory/auction-purchases/route.ts` (new)  
  - `app/api/inventory/auction-purchases/[id]/route.ts` (new)
- **Reuse:** Existing inventory services, vehicle model, audit logger, `getAuthContext`, `guardPermission`, pagination, Zod schemas pattern.

---

## 7. Security & Compliance

- All queries filtered by `dealershipId` (from auth context; never from client).
- RBAC: `inventory.read` / `inventory.write` (and existing `inventory.appraisals.*`, `inventory.acquisition.*`, `inventory.auctions.read`).
- Cross-tenant access: return 404 NOT_FOUND.
- Audit: optional for AuctionPurchase create/update; required if policy demands it.

---

## 8. Testing

- **Tenant isolation:** Auction purchase list/get/create/update and GET cost scoped by dealershipId; cross-tenant id returns 404.
- **Stage transitions:** Existing acquisition move-stage tests; no new stages.
- **Cost calculations:** GET `/api/inventory/[id]/cost` returns correct breakdown and total; vehicle not in tenant → 404.

Tests run from repo root with Jest.

---

## 9. Performance

- Indexes on `AuctionPurchase`: dealershipId, dealershipId+status, vehicleId.
- List endpoints: paginated (e.g. limit 25, max 100); avoid N+1 (include vehicle when needed in list).

---

## 10. Summary of New Work

| Item | Type |
|------|------|
| Prisma: AuctionPurchase + AuctionPurchaseStatus | Schema + migration |
| db/auction-purchase.ts | New |
| service/auction-purchase.ts | New |
| service: calculateVehicleCost (or cost route using totalCostCents) | New helper / use existing |
| GET /api/inventory/[id]/cost | New route |
| GET/POST /api/inventory/auction-purchases, GET/PATCH auction-purchases/[id] | New routes |
| Nav: Inventory → Acquisition (sub-links) | UI |
| Page: /inventory/auction-purchases | UI |
| Tests: tenant isolation, cost API, auction purchase | Jest |

Existing: VehicleAppraisal, InventorySourceLead, appraisal and acquisition APIs and UI, auction search and appraise.
