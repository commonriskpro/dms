# Inventory Acquisition & Pricing Engine — Spec

Lifecycle: **Source → Appraisal → Acquisition → Inventory → Valuation → Pricing → Marketing Publish**

This spec defines models, enums, API routes, UI pages, and RBAC for the inventory acquisition and pricing features. All monetary values are stored in **cents** (BigInt/Int). All business tables are **tenant-scoped** by `dealershipId`.

---

## 1. Models

All models include: `id` (UUID), `dealershipId`, `createdAt`, `updatedAt`. Snake_case in DB via `@map`.

### 1.1 VehicleAppraisal

Pre-inventory appraisal (trade-in, auction, marketplace, street).

| Field | Type | Notes |
|-------|------|--------|
| id | String @id @db.Uuid | |
| dealershipId | String @db.Uuid | FK Dealership |
| vin | String @db.VarChar(17) | |
| sourceType | Enum VehicleAppraisalSourceType | TRADE_IN \| AUCTION \| MARKETPLACE \| STREET |
| vehicleId | String? @db.Uuid | Set when converted to inventory |
| appraisedByUserId | String? @db.Uuid | FK Profile |
| acquisitionCostCents | BigInt @default(0) | |
| reconEstimateCents | BigInt @default(0) | |
| transportEstimateCents | BigInt @default(0) | |
| feesEstimateCents | BigInt @default(0) | |
| expectedRetailCents | BigInt @default(0) | |
| expectedWholesaleCents | BigInt @default(0) | |
| expectedTradeInCents | BigInt @default(0) | |
| expectedProfitCents | BigInt @default(0) | |
| status | Enum VehicleAppraisalStatus | DRAFT \| APPROVED \| REJECTED \| PURCHASED \| CONVERTED |
| notes | String? @db.Text | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])`, `@@index([vehicleId])`.

### 1.2 InventorySourceLead

Acquisition pipeline lead (seller, asking price, stage).

| Field | Type | Notes |
|-------|------|--------|
| id | String @id @db.Uuid | |
| dealershipId | String @db.Uuid | FK Dealership |
| vin | String @db.VarChar(17) | |
| sourceType | Enum InventorySourceLeadSourceType | AUCTION \| TRADE_IN \| MARKETPLACE \| STREET |
| sellerName | String? @db.VarChar(256) | |
| sellerPhone | String? @db.VarChar(64) | |
| sellerEmail | String? @db.VarChar(256) | |
| askingPriceCents | BigInt? | |
| negotiatedPriceCents | BigInt? | |
| status | Enum InventorySourceLeadStatus | NEW \| CONTACTED \| NEGOTIATING \| WON \| LOST |
| appraisalId | String? @db.Uuid | FK VehicleAppraisal (optional) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, status])`, `@@index([dealershipId, createdAt])`, `@@index([appraisalId])`.

### 1.3 AuctionListingCache

Cached auction listing from provider (search results / single lot).

| Field | Type | Notes |
|-------|------|--------|
| id | String @id @db.Uuid | |
| dealershipId | String @db.Uuid | FK Dealership |
| provider | Enum AuctionProvider | COPART \| IAAI \| MANHEIM \| ACV \| MOCK |
| auctionLotId | String @db.VarChar(128) | Provider’s lot id |
| vin | String? @db.VarChar(17) | |
| year | Int? | |
| make | String? @db.VarChar(128) | |
| model | String? @db.VarChar(128) | |
| mileage | Int? | |
| currentBidCents | BigInt? | |
| buyNowCents | BigInt? | |
| auctionEndAt | DateTime? | |
| location | String? @db.VarChar(256) | |
| rawJson | Json? | Provider payload snapshot |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, provider, auctionLotId])`, `@@index([dealershipId, vin])`.

### 1.4 VehicleValuation (market snapshot)

Single latest market valuation snapshot per vehicle from the valuation engine. (Existing `VehicleValuation` in schema is used for historical book-value snapshots; this spec introduces a **market snapshot** model. Implementation may use a new model name e.g. `VehicleMarketValuation` to avoid breaking existing APIs.)

| Field | Type | Notes |
|-------|------|--------|
| id | String @id @db.Uuid | |
| dealershipId | String @db.Uuid | FK Dealership |
| vehicleId | String @db.Uuid | FK Vehicle, unique per vehicle for “latest” snapshot |
| marketAverageCents | Int | |
| marketLowestCents | Int | |
| marketHighestCents | Int | |
| recommendedRetailCents | Int | |
| recommendedWholesaleCents | Int | |
| priceToMarketPercent | Float? | e.g. 98.5 = 98.5% of market |
| marketDaysSupply | Int? | |
| createdAt | DateTime | snapshot time |
| updatedAt | DateTime | |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@unique([dealershipId, vehicleId])` for “one snapshot per vehicle” or allow multiple with “latest” by createdAt.

### 1.5 PricingRule

Auto-pricing rule (age-based, market-based, clearance).

| Field | Type | Notes |
|-------|------|--------|
| id | String @id @db.Uuid | |
| dealershipId | String @db.Uuid | FK Dealership |
| name | String @db.VarChar(256) | |
| ruleType | Enum PricingRuleType | AGE_BASED \| MARKET_BASED \| CLEARANCE |
| daysInStock | Int? | For AGE_BASED |
| adjustmentPercent | Float? | e.g. -2.5 for 2.5% reduction |
| adjustmentCents | Int? | Fixed adjustment in cents |
| enabled | Boolean @default(true) | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, enabled])`.

### 1.6 VehicleListing

Marketing distribution: vehicle listed on a platform.

| Field | Type | Notes |
|-------|------|--------|
| id | String @id @db.Uuid | |
| dealershipId | String @db.Uuid | FK Dealership |
| vehicleId | String @db.Uuid | FK Vehicle |
| platform | Enum VehicleListingPlatform | WEBSITE \| AUTOTRADER \| CARS \| CARFAX \| FACEBOOK |
| status | Enum VehicleListingStatus | DRAFT \| PUBLISHED \| FAILED \| UNPUBLISHED |
| externalListingId | String? @db.VarChar(256) | Platform’s id |
| lastSyncedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([dealershipId, platform, status])`, `@@unique([dealershipId, vehicleId, platform])`.

---

## 2. Enums

- **VehicleAppraisalSourceType:** TRADE_IN, AUCTION, MARKETPLACE, STREET  
- **VehicleAppraisalStatus:** DRAFT, APPROVED, REJECTED, PURCHASED, CONVERTED  
- **InventorySourceLeadSourceType:** AUCTION, TRADE_IN, MARKETPLACE, STREET  
- **InventorySourceLeadStatus:** NEW, CONTACTED, NEGOTIATING, WON, LOST  
- **AuctionProvider:** COPART, IAAI, MANHEIM, ACV, MOCK  
- **PricingRuleType:** AGE_BASED, MARKET_BASED, CLEARANCE  
- **VehicleListingPlatform:** WEBSITE, AUTOTRADER, CARS, CARFAX, FACEBOOK  
- **VehicleListingStatus:** DRAFT, PUBLISHED, FAILED, UNPUBLISHED  

---

## 3. API Routes

Pattern: `getAuthContext` → `guardPermission` → validate → service → `jsonResponse`. All scoped by `ctx.dealershipId`. Error shape: `{ error: { code, message, details } }`.

### 3.1 Appraisals

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/inventory/appraisals | inventory.appraisals.read | List appraisals (paginated, filters) |
| POST | /api/inventory/appraisals | inventory.appraisals.write | Create appraisal |
| GET | /api/inventory/appraisals/[id] | inventory.appraisals.read | Get one |
| PATCH | /api/inventory/appraisals/[id] | inventory.appraisals.write | Update (DRAFT only) |
| POST | /api/inventory/appraisals/[id]/approve | inventory.appraisals.write | Set status APPROVED |
| POST | /api/inventory/appraisals/[id]/reject | inventory.appraisals.write | Set status REJECTED |
| POST | /api/inventory/appraisals/[id]/convert | inventory.appraisals.write | Convert to Vehicle, link appraisal, audit |

### 3.2 Acquisition

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/inventory/acquisition | inventory.acquisition.read | List leads (paginated, by status) |
| POST | /api/inventory/acquisition | inventory.acquisition.write | Create lead |
| PATCH | /api/inventory/acquisition/[id] | inventory.acquisition.write | Update lead |
| POST | /api/inventory/acquisition/[id]/move-stage | inventory.acquisition.write | Move status (NEW→CONTACTED→…) |

### 3.3 Auctions

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/inventory/auctions/search | inventory.auctions.read | Search (query params: provider, vin, make, model, etc.); MOCK provider only; cache in AuctionListingCache |
| GET | /api/inventory/auctions/[id] | inventory.auctions.read | Get one cached listing by id |
| POST | /api/inventory/auctions/[id]/appraise | inventory.appraisals.write | Create VehicleAppraisal from auction listing |

### 3.4 Valuation

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/inventory/[id]/valuation | inventory.read | Get latest market valuation for vehicle |
| POST | /api/inventory/[id]/valuation/recalculate | inventory.pricing.write | Recalculate and persist snapshot |

### 3.5 Pricing

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/inventory/pricing-rules | inventory.pricing.read | List pricing rules |
| POST | /api/inventory/pricing-rules | inventory.pricing.write | Create rule |
| PATCH | /api/inventory/pricing-rules/[id] | inventory.pricing.write | Update rule |
| POST | /api/inventory/[id]/pricing/preview | inventory.pricing.read | Preview price adjustment (rules applied) |
| POST | /api/inventory/[id]/pricing/apply | inventory.pricing.write | Apply adjustment to vehicle sale price; audit |

### 3.6 Listings

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/inventory/[id]/listings | inventory.publish.read | List VehicleListing for vehicle |
| POST | /api/inventory/[id]/publish | inventory.publish.write | Publish to platform(s); validate readiness |
| POST | /api/inventory/[id]/unpublish | inventory.publish.write | Unpublish listing(s) |

**Publish readiness:** price present, vehicle identity (VIN/stock), photo presence if required, vehicle status allowed for listing.

---

## 4. RBAC

Add permissions (seed and role templates as needed):

| Permission | Description |
|------------|-------------|
| inventory.appraisals.read | View appraisals |
| inventory.appraisals.write | Create/update/approve/reject/convert appraisals |
| inventory.acquisition.read | View acquisition pipeline |
| inventory.acquisition.write | Create/update leads, move stages |
| inventory.auctions.read | Search and view auction listings |
| inventory.pricing.read | View pricing rules and preview |
| inventory.pricing.write | Create/update rules, recalc valuation, apply pricing |
| inventory.publish.read | View listing status per vehicle |
| inventory.publish.write | Publish/unpublish |

Existing `inventory.read` / `inventory.write` remain for core vehicle CRUD. New routes must not bypass these; use the granular permissions above for new endpoints.

---

## 5. UI Pages (server-first)

- **/inventory/appraisals** — List appraisals (table: VIN, Source, Status, Expected Retail, Expected Profit, Created). Actions: create, approve, reject, convert to inventory.  
- **/inventory/acquisition** — Pipeline board: columns NEW, CONTACTED, NEGOTIATING, WON, LOST. Cards: VIN, source, asking price, seller, linked appraisal.  
- **/inventory/auctions** — Search form + results list (VIN, vehicle, bid, buy now, end time, location). Action: Create appraisal.  

### 5.1 Vehicle detail enhancements

- **Valuation card:** recommendedRetail, recommendedWholesale, market range, price-to-market %, recalculate button.  
- **Pricing automation card:** current price, rule preview, apply adjustment.  
- **Marketing distribution card:** platform, status, publish/unpublish.  

---

## 6. Business Rules (summary)

- **Conversion (appraisal → inventory):** Create Vehicle, set appraisal.vehicleId, audit log. Only APPROVED appraisals; rejected cannot be converted.  
- **Valuation engine:** Use book values, price-to-market, vehicle age, dealer margin assumptions; store snapshot (one per vehicle or latest by createdAt).  
- **Pricing:** Apply rules (age-based first); never negative prices; preview before apply; audit on apply.  
- **Publish:** Enforce readiness (price, identity, photos if required, status).  
- **Auctions:** MOCK provider only; cache in AuctionListingCache; no injection of bad data.  
- **Tenant isolation:** All queries by `ctx.dealershipId`; cross-tenant id → 404.  
- **Money:** All amounts in cents (BigInt/Int); API strings for cents; UI via `lib/money`.  

---

## 7. Implementation Notes

- **VehicleValuation:** Existing table holds historical book-value snapshots (source, valueCents, capturedAt). The “market snapshot” from the valuation engine can be implemented as a new model (e.g. `VehicleMarketValuation`) with the fields above to avoid breaking existing valuation APIs.  
- **Dealership relation:** Every new model has `dealershipId` and relation to `Dealership`; indexes as listed.  
- **Soft delete:** Not required for appraisals/leads/auction cache/rules/listings unless product requests it; can be added later.  
