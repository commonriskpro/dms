# Inventory Acquisition Engine — Repo Inspection Summary

**Date:** 2025-03-07  
**Sprint:** Inventory Acquisition Engine  
**Purpose:** Identify existing inventory acquisition, appraisal, auction, and cost code to implement the sprint with minimal duplication and correct placement.

---

## 1. Existing Prisma Models

| Model | Location | Notes |
|-------|----------|--------|
| **Vehicle** | `schema.prisma` ~573 | Has `auctionCostCents`, `transportCostCents`, `reconCostCents`, `miscCostCents`, `salePriceCents`. No `vehicleId` on acquisition entities; Vehicle is target of conversion. |
| **VehicleAppraisal** | `schema.prisma` ~813 | Full model: `dealershipId`, `vin`, `sourceType` (TRADE_IN/AUCTION/MARKETPLACE/STREET), `vehicleId?`, `appraisedByUserId`, `acquisitionCostCents`, `reconEstimateCents`, `transportEstimateCents`, `feesEstimateCents`, `expectedRetailCents`, `expectedWholesaleCents`, `expectedTradeInCents`, `expectedProfitCents`, `status` (DRAFT/APPROVED/REJECTED/PURCHASED/CONVERTED), `notes`, `createdAt`/`updatedAt`. Indexes on dealershipId, status, createdAt, vehicleId. |
| **InventorySourceLead** | `schema.prisma` ~859 | Pipeline lead: `dealershipId`, `vin`, `sourceType`, `sellerName`/`sellerPhone`/`sellerEmail`, `askingPriceCents`, `negotiatedPriceCents`, `status` (NEW/CONTACTED/NEGOTIATING/WON/LOST), `appraisalId?`. Indexes on dealershipId, status, createdAt, appraisalId. |
| **AuctionListingCache** | `schema.prisma` ~890 | Cached auction listing (search): `dealershipId`, `provider`, `auctionLotId`, `vin`, `year`/`make`/`model`/`mileage`, `currentBidCents`, `buyNowCents`, `auctionEndAt`, `location`, `rawJson`. **No AuctionPurchase model** — actual purchase tracking not yet in schema. |

**Gaps for sprint:**  
- **AuctionPurchase** — not present. Needed for: vehicleId, auctionName, lotNumber, purchasePriceCents, feesCents, shippingCents, etaDate, status.  
- **AcquisitionOpportunity** — not present. Sprint asks for stages LEAD / APPRAISAL / NEGOTIATING / PURCHASED / LOST. Existing **InventorySourceLead** has NEW / CONTACTED / NEGOTIATING / WON / LOST and links to appraisal; can map WON→PURCHASED, NEW→LEAD and use existing pipeline, or add a separate AcquisitionOpportunity model if product requires a distinct entity.

---

## 2. Inventory Module Structure (`apps/dealer/modules/inventory/`)

| Layer | Appraisals | Acquisition (pipeline) | Auctions | Cost |
|-------|------------|------------------------|----------|------|
| **db/** | `db/appraisal.ts` (list, get, create, update, setStatus, setVehicleId) | `db/acquisition.ts` (list leads, get, create, update, setStatus) | `db/auction-cache.ts` | — |
| **service/** | `service/appraisal.ts` (list, get, create, update, approve, reject, convert; tenant + audit) | `service/acquisition.ts` (list, get, create, update, moveStage; validates appraisalId) | `service/auction.ts` (search, get listing, create appraisal from listing) | `service/vehicle.ts` exports `totalCostCents(v)`, `projectedGrossCents(v)` |

**Cost:** Vehicle-level cost is already computed in `modules/inventory/service/vehicle.ts`: `totalCostCents(v)` sums auction, transport, recon, misc. No dedicated `calculateVehicleCost()` or GET cost API yet.

---

## 3. API Routes (`apps/dealer/app/api/inventory/`)

| Area | Existing routes | RBAC |
|------|-----------------|------|
| **Appraisals** | `GET/POST appraisals`, `GET/PATCH appraisals/[id]`, `POST appraisals/[id]/approve`, `reject`, `convert` | `inventory.appraisals.read` / `inventory.appraisals.write` |
| **Acquisition** | `GET/POST acquisition`, `GET/PATCH acquisition/[id]`, `POST acquisition/[id]/move-stage` | `inventory.acquisition.read` / `inventory.acquisition.write` |
| **Auctions** | `GET auctions/search`, `GET auctions/[id]`, `POST auctions/[id]/appraise` | `inventory.auctions.read`; appraise → `inventory.appraisals.write` |
| **Vehicle cost** | **None** | — |

**Gaps:**  
- No **GET /api/inventory/[id]/cost** for vehicle cost breakdown.  
- No **GET/POST /api/inventory/auctions** (or similar) for **auction purchases** (AuctionPurchase); current “auctions” routes are for search cache and appraise-from-listing.

---

## 4. Frontend (`apps/dealer/app/(app)/inventory/`)

| Page / feature | Path | Notes |
|----------------|------|--------|
| Acquisition board | `/inventory/acquisition` | AcquisitionPageClient, AcquisitionBoard, columns by lead status, AcquisitionLeadForm, AcquisitionCard (move stage). |
| Appraisals | `/inventory/appraisals` | AppraisalsPageClient, AppraisalsTable, AppraisalForm, AppraisalFilters; approve, reject, convert. |
| Auctions | `/inventory/auctions` | AuctionsPageClient, AuctionSearchBar, AuctionResults; search + create appraisal from listing. |
| Inventory layout | `inventory/layout.tsx` | Minimal wrapper; no nested nav. |
| Sidebar | `components/app-shell/sidebar.tsx` | Single “Inventory” link to `/inventory`; no “Acquisition” sub-section. |

Sprint asks for “Inventory → Acquisition” with pages: `/acquisition`, `/acquisition/appraisals`, `/acquisition/opportunities`, `/acquisition/auctions`. **Current implementation** uses `/inventory/acquisition`, `/inventory/appraisals`, `/inventory/auctions`. Recommendation: keep routes under `/inventory/` for consistency and add an “Acquisition” sub-nav under Inventory (e.g. Acquisition board, Appraisals, Opportunities, Auctions) that point to these pages; “opportunities” can be the existing acquisition pipeline (board or table).

---

## 5. RBAC & Tenant Patterns

- **Permissions (seed):** `inventory.read`, `inventory.write`, `inventory.appraisals.read`, `inventory.appraisals.write`, `inventory.acquisition.read`, `inventory.acquisition.write`, `inventory.auctions.read`.  
- **API pattern:** `getAuthContext(request)` → `guardPermission(ctx, "inventory.*")`; all list/get/mutate scoped by `ctx.dealershipId`.  
- **Cross-tenant:** By convention, wrong tenant returns 404 NOT_FOUND (e.g. get-by-id after scope check).  
- **Audit:** Appraisal service logs `vehicle_appraisal.created`, `vehicle_appraisal.approved`, etc. Acquisition mutations do not yet audit in the inspected code; spec may require audit for lead create/update/stage.

---

## 6. Testing

- **Inventory tests:** `modules/inventory/tests/` — tenant isolation, rbac, audit, dashboard, vin-decode, acquisition-pricing, etc.  
- **totalCostCents:** Covered in `inventory-hardening.test.ts`.  
- **Convention:** Tests run from repo root; Jest only (no Vitest/Playwright per .cursorrules).

---

## 7. Where to Add New Work

| Item | Location |
|------|----------|
| **AuctionPurchase model** | Prisma schema (new model + migration). |
| **Auction purchase API** | New route: e.g. `GET/POST /api/inventory/auction-purchases` (to avoid overloading existing `auctions/search` and `auctions/[id]`). |
| **Vehicle cost API** | `GET /api/inventory/[id]/cost` in existing `app/api/inventory/[id]/` (new `cost/route.ts`). |
| **calculateVehicleCost()** | Either a thin wrapper in `modules/inventory/service/vehicle.ts` (or a small `service/cost.ts`) that returns breakdown + total using existing `totalCostCents` and vehicle cost fields. |
| **Acquisition “opportunities”** | Use existing InventorySourceLead pipeline and UI; optionally add a table view at `/inventory/acquisition/opportunities` or relabel current board. No new model unless product explicitly requires AcquisitionOpportunity. |
| **Nav “Inventory → Acquisition”** | Sidebar or inventory layout: add sub-links for Acquisition, Appraisals, Opportunities, Auctions under Inventory. |

---

## 8. Summary

- **Vehicle appraisal:** Implemented (model, db, service, API, UI).  
- **Acquisition pipeline:** Implemented as **InventorySourceLead** (NEW→…→WON/LOST); APIs and acquisition board exist.  
- **Auction search / appraise:** Implemented (AuctionListingCache, search, get by id, create appraisal from listing).  
- **Missing:** (1) **AuctionPurchase** model and list/create API for purchase tracking; (2) **GET /api/inventory/[id]/cost** and optional **calculateVehicleCost()**; (3) optional **AcquisitionOpportunity** or explicit stage mapping (LEAD/PURCHASED) in UI; (4) **Inventory → Acquisition** sub-nav and optional opportunities table view.

Use this document as the basis for STEP 1 (spec) and STEP 2 (backend) so new work fits the existing patterns and avoids duplicate models or routes.
