# Deals Module — Full SPEC (Step 1/4)

**Module:** deals  
**Scope:** Deal CRUD; link to Customer (required) and Vehicle (required); one Trade-in initially (design extensible); fees (doc fee + custom fees); down payment; tax calculation; front-end gross; status workflow. No lender API. All monetary values BIGINT cents; tax rates in basis points (BPS); financial immutability once CONTRACTED.

References: AGENT_SPEC.md, DONE.md, MODULES.md, DMS Non-Negotiables, Coding Standards, core-platform-spec.md, customers-spec.md, inventory-spec.md.

---

## 1) Prisma Models (Prisma-Ready + Indexes)

### 1.1 Table Summary

| Table | Tenant-scoped? | Soft delete? | Audit (CUD / critical) |
|-------|----------------|--------------|-------------------------|
| Deal | Yes | Yes (deletedAt; document below) | Yes |
| DealFee | Yes | No | No (child; audit via deal.updated / deal.fee_added) |
| DealTrade | Yes | No | No (child; audit via deal.trade_added / deal.updated) |
| DealHistory | Yes | No | No (append-only status log) |

**Soft delete on Deal:** Use `deletedAt` (and optionally `deletedBy`). Default lists exclude soft-deleted deals (`deletedAt` null). Retain for audit and reporting. Document in API: DELETE sets `deletedAt`; no hard delete.

**Money rule:** All monetary columns are **BIGINT** (cents). No Float, no Decimal for money. Tax rate: **Int** basis points (e.g. 7.00% = 700).

---

### 1.2 Deal

- **Purpose:** Single deal record; tenant-scoped; links customer + vehicle; all money in cents; status workflow; financial snapshot at creation and recomputed on update until CONTRACTED.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `customerId` — String, UUID, FK → Customer, required
  - `vehicleId` — String, UUID, FK → Vehicle, required
  - **Money (all BIGINT cents):**
    - `salePriceCents` — Int (BigInt in DB; Prisma `Int` for 64-bit or `BigInt` per project)
    - `purchasePriceCents` — Int/BigInt (snapshot from vehicle at deal creation; conversion from Vehicle acquisition cost or agreed cost)
    - `taxRateBps` — Int (basis points; e.g. 700 = 7.00%)
    - `taxCents` — Int/BigInt (computed and stored)
    - `docFeeCents` — Int/BigInt (document fee)
    - `downPaymentCents` — Int/BigInt (default 0)
    - `totalFeesCents` — Int/BigInt (doc fee + sum of DealFee.amountCents; stored)
    - `totalDueCents` — Int/BigInt (computed and stored)
    - `frontGrossCents` — Int/BigInt (computed and stored)
  - `status` — Enum: `DRAFT` | `STRUCTURED` | `APPROVED` | `CONTRACTED` | `CANCELED`
  - `notes` — String?, @db.Text, optional
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime?
  - `deletedBy` — String?, UUID, FK → Profile (optional)
- **Relations:** Dealership, Customer, Vehicle, Profile (deletedBy), DealFee[], DealTrade[], DealHistory[].
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping
  - `@@index([dealershipId, status])` — filter list by status
  - `@@index([dealershipId, createdAt])` — list by newest; time-bounded
  - `@@index([dealershipId, customerId])` — list deals by customer
  - `@@index([dealershipId, vehicleId])` — list deals by vehicle
  - `@@index([dealershipId, deletedAt])` — exclude soft-deleted in default lists
- **Constraint (one active deal per vehicle):**  
  - At most one **active** deal per `(dealershipId, vehicleId)` where `deletedAt IS NULL` and `status != CANCELED`.  
  - Enforce with an app-layer check (return `CONFLICT`) and a Postgres partial unique index in migration SQL.

- **Audit:** Deal is critical. Audit: deal.created, deal.updated, deal.deleted, deal.status_changed. Sensitive read: optional audit on deal detail view (finance-related).

**Prisma (use `BigInt` if schema uses it; otherwise `Int` with `@db.BigInt` where needed):**

```prisma
enum DealStatus {
  DRAFT
  STRUCTURED
  APPROVED
  CONTRACTED
  CANCELED
}

model Deal {
  id                 String    @id @default(uuid()) @db.Uuid
  dealershipId       String    @map("dealership_id") @db.Uuid
  customerId         String    @map("customer_id") @db.Uuid
  vehicleId         String    @map("vehicle_id") @db.Uuid
  salePriceCents    BigInt    @map("sale_price_cents")
  purchasePriceCents BigInt   @map("purchase_price_cents")
  taxRateBps        Int       @map("tax_rate_bps")
  taxCents          BigInt    @map("tax_cents")
  docFeeCents       BigInt    @map("doc_fee_cents")
  downPaymentCents  BigInt    @map("down_payment_cents")
  totalFeesCents    BigInt    @map("total_fees_cents")
  totalDueCents     BigInt    @map("total_due_cents")
  frontGrossCents   BigInt    @map("front_gross_cents")
  status            DealStatus @default(DRAFT)
  notes             String?   @db.Text
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")
  deletedBy         String?   @map("deleted_by") @db.Uuid

  dealership        Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer          Customer   @relation(fields: [customerId], references: [id], onDelete: Restrict)
  vehicle           Vehicle    @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  deletedByProfile  Profile?   @relation("DealDeletedBy", fields: [deletedBy], references: [id])
  fees              DealFee[]
  trades            DealTrade[]
  history           DealHistory[]

  @@index([dealershipId])
  @@index([dealershipId, status])
  @@index([dealershipId, createdAt])
  @@index([dealershipId, customerId])
  @@index([dealershipId, vehicleId])
  @@index([dealershipId, deletedAt])
}
```

---

### 1.3 DealFee

- **Purpose:** Per-deal fee line items (doc fee is on Deal; custom fees here). Amount in cents; taxable flag for tax calculation.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `dealId` — String, UUID, FK → Deal
  - `label` — String (e.g. "Admin fee", "Title fee")
  - `amountCents` — BigInt (BIGINT in DB)
  - `taxable` — Boolean (include in taxable base for tax calculation)
  - `createdAt` — DateTime
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping
  - `@@index([dealershipId, dealId])` — list fees by deal
- **Note:** Doc fee is stored on Deal as `docFeeCents`; DealFee rows are additional custom fees. `totalFeesCents` on Deal = docFeeCents + sum(DealFee.amountCents) for that deal.

**Prisma:**

```prisma
model DealFee {
  id           String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  dealId       String   @map("deal_id") @db.Uuid
  label        String
  amountCents  BigInt   @map("amount_cents")
  taxable      Boolean  @default(false)
  createdAt    DateTime @default(now()) @map("created_at")

  dealership   Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  deal         Deal       @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([dealershipId, dealId])
}
```

---

### 1.4 DealTrade

- **Purpose:** One trade-in per deal initially (design allows multiple rows later). Description and allowance/payoff in cents.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `dealId` — String, UUID, FK → Deal
  - `vehicleDescription` — String (e.g. "2018 Honda Accord")
  - `allowanceCents` — BigInt (trade allowance)
  - `payoffCents` — BigInt (amount owed on trade; 0 if none)
  - `createdAt` — DateTime
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping
  - `@@index([dealershipId, dealId])` — list trades by deal
- **Net trade:** NetTradeCents = allowanceCents - payoffCents (computed in service; not stored on Deal in this scope for taxable base—see Financial Rules).

**Prisma:**

```prisma
model DealTrade {
  id                  String   @id @default(uuid()) @db.Uuid
  dealershipId        String   @map("dealership_id") @db.Uuid
  dealId              String   @map("deal_id") @db.Uuid
  vehicleDescription  String   @map("vehicle_description")
  allowanceCents      BigInt   @map("allowance_cents")
  payoffCents         BigInt   @map("payoff_cents")
  createdAt           DateTime @default(now()) @map("created_at")

  dealership   Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  deal         Deal       @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([dealershipId, dealId])
}
```

---

### 1.5 DealHistory (Optional)

- **Purpose:** Append-only log of status transitions for audit and UI.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `dealId` — String, UUID, FK → Deal
  - `fromStatus` — DealStatus? (null when first status set)
  - `toStatus` — DealStatus
  - `changedBy` — String?, UUID, FK → Profile
  - `createdAt` — DateTime
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping
  - `@@index([dealershipId, dealId, createdAt])` — timeline for deal
- **No** updatedAt; append-only.

**Prisma:**

```prisma
model DealHistory {
  id           String     @id @default(uuid()) @db.Uuid
  dealershipId String     @map("dealership_id") @db.Uuid
  dealId       String     @map("deal_id") @db.Uuid
  fromStatus   DealStatus? @map("from_status")
  toStatus     DealStatus  @map("to_status")
  changedBy    String?    @map("changed_by") @db.Uuid
  createdAt    DateTime   @default(now()) @map("created_at")

  dealership   Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  deal         Deal       @relation(fields: [dealId], references: [id], onDelete: Cascade)
  changedByProfile Profile? @relation(fields: [changedBy], references: [id], onDelete: SetNull)

  @@index([dealershipId])
  @@index([dealershipId, dealId, createdAt])
}
```

---

### 1.6 Relations to Add on Existing Models

- **Customer:** `deals` — Deal[]
- **Vehicle:** `deals` — Deal[]
- **Dealership:** `deals` — Deal[]; `dealFees` — DealFee[]; `dealTrades` — DealTrade[]; `dealHistories` — DealHistory[]
- **Profile:** `dealsDeletedBy` — Deal[] @relation("DealDeletedBy"); `dealHistoriesChangedBy` — DealHistory[] (if DealHistory exists)

---

### 1.7 Index Summary

| Index | Purpose |
|-------|--------|
| Deal: dealershipId | Every query scoped by tenant. |
| Deal: (dealershipId, status) | Filter list by status. |
| Deal: (dealershipId, createdAt) | List by newest; time-bounded. |
| Deal: (dealershipId, customerId) | List deals by customer. |
| Deal: (dealershipId, vehicleId) | List deals by vehicle. |
| Deal: (dealershipId, deletedAt) | Exclude soft-deleted in default lists. |
| DealFee / DealTrade: (dealershipId, dealId) | List fees/trades by deal; tenant scoping. |
| DealHistory: (dealershipId, dealId, createdAt) | Status timeline for deal. |

---

## 2) Financial Calculation Rules (Explicit)

- **All calculations:** Integer math only (cents and BPS). No float/decimal in calculations. Round HALF UP at cent precision where needed.
- **Tax:**  
  - Taxable base = salePriceCents + sum of (DealFee.amountCents where taxable = true).  
  - taxCents = floor((taxableBase * taxRateBps) / 10000) with HALF_UP rounding: use round((taxableBase * taxRateBps) / 10000) with integer rounding (e.g. (taxableBase * taxRateBps + 5000) / 10000) so that 0.5 rounds up.
- **Total due:**  
  - totalDueCents = salePriceCents + taxCents + totalFeesCents - downPaymentCents.  
  - totalFeesCents = docFeeCents + sum(DealFee.amountCents) for the deal (stored on Deal; recomputed on fee add/update/delete until CONTRACTED).
- **Front gross (DealerCenter-style):**  
  - frontGrossCents = salePriceCents - purchasePriceCents - totalFeesCents.  
  - **Tax is excluded from gross** (taxCents is pass-through; does not reduce front gross).  
  - In this spec, doc fee and all DealFee amounts are included in totalFeesCents and therefore reduce front gross. (Future enhancement: make doc fee and/or individual fees optionally “included in gross” via a dealership setting and per-fee flag.)
- **Trade:**  
  - NetTradeCents = allowanceCents - payoffCents (per DealTrade row).  
  - In this scope, trade does **not** reduce the taxable base: taxable base = salePriceCents + taxableFeesCents only.
- **Stored values:** taxCents, totalFeesCents, totalDueCents, frontGrossCents are computed at update/save time and stored on Deal. No dynamic recomputation on read (except for live preview in UI before save).

---

## 3) Status Workflow Rules

- **Allowed transitions:**
  - DRAFT → STRUCTURED → APPROVED → CONTRACTED
  - Any status (except CONTRACTED) → CANCELED

- **Vehicle exclusivity:**  
  - A vehicle may have only one active deal at a time (status != CANCELED and deletedAt is null).  
  - Creating a second active deal for the same vehicle must return `CONFLICT` and must not reveal cross-tenant existence (use NOT_FOUND for cross-tenant vehicleId).

- **CONTRACTED:**
  - Once status = CONTRACTED, all **financial fields** on Deal (and fee/trade child rows) are **locked**: no PATCH to salePriceCents, purchasePriceCents, taxRateBps, taxCents, docFeeCents, downPaymentCents, totalFeesCents, totalDueCents, frontGrossCents; no add/edit/delete of DealFee or DealTrade.
  - Only allowed change: status → CANCELED (if business rules allow canceling a contracted deal). Document in business rules whether CONTRACTED can transition to CANCELED.
- **Immutability:** Deals with status ≥ CONTRACTED are financially immutable. No exceptions.

---

## 4) RBAC Mapping

- **deals.read** — List deals, get deal, list fees, list trades, get deal history. All read routes require `deals.read`.
- **deals.write** — Create/update/delete deal; add/update/delete fees; add/update trade; change status. All write routes require `deals.write`.
- No admin bypass in this module.

| Route / action | Permission |
|----------------|------------|
| GET /api/deals | deals.read |
| POST /api/deals | deals.write |
| GET /api/deals/[id] | deals.read |
| PATCH /api/deals/[id] | deals.write |
| DELETE /api/deals/[id] | deals.write |
| GET /api/deals/[id]/fees | deals.read |
| POST /api/deals/[id]/fees | deals.write |
| PATCH /api/deals/[id]/fees/[feeId] | deals.write |
| DELETE /api/deals/[id]/fees/[feeId] | deals.write |
| POST /api/deals/[id]/trade | deals.write |
| PATCH /api/deals/[id]/trade/[tradeId] | deals.write (if supported) |
| PATCH /api/deals/[id]/status | deals.write |
| GET /api/deals/[id]/history (optional) | deals.read |

**Tenant scoping:** `dealershipId` is always from auth/session (active dealership). Never from client body or path. List/get/update/delete scoped by that dealership. Cross-tenant IDs return NOT_FOUND.

---

## 5) API Contract List

Standard error shape: `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, INTERNAL.

Pagination: `limit` (default 25, max 100), `offset` (0-based). List response: `{ data: T[], meta: { total, limit, offset } }`.

**Money in API:** UI must convert dollars → cents before calling the API. All money fields in request bodies are **cents** (prefer **string** to avoid JS precision; server parses/validates to BigInt). **Responses** return money as **string** (e.g. `"12345"` for 123.45 dollars represented as 12,345 cents).

**Dealership scoping:** `dealershipId` from auth. Cross-tenant resource IDs return 404 NOT_FOUND.

---

### 5.1 GET /api/deals

- **Purpose:** Paginated list with filters.
- **Permission:** deals.read
- **Audit:** No

**Query (Zod shape):**  
`listDealsQuerySchema` — `limit` (number, min 1, max 100, default 25), `offset` (number, min 0, default 0), `status?` (DealStatus enum), `customerId?` (UUID), `vehicleId?` (UUID), `sortBy?` (e.g. createdAt, frontGrossCents, status), `sortOrder?` (asc | desc, default desc for date).

**Response:** `{ data: DealListItem[], meta: { total, limit, offset } }`. DealListItem: id, customerId, vehicleId, status, salePriceCents (string), frontGrossCents (string), totalDueCents (string), createdAt; optional customer/vehicle summary. Exclude soft-deleted (deletedAt null).

---

### 5.2 POST /api/deals

- **Purpose:** Create deal. Snapshot vehicle purchase cost as purchasePriceCents; compute tax/totalDue/frontGross per financial rules.
- **Permission:** deals.write
- **Audit:** deal.created

**Body (Zod shape):**  
`createDealBodySchema` — `customerId` (UUID, required), `vehicleId` (UUID, required), `salePriceCents` (number or string cents; required), `purchasePriceCents` (number or string cents; required; or derived from vehicle at creation), `taxRateBps` (number, required, 0–10000), `docFeeCents` (number or string, default 0), `downPaymentCents` (number or string, default 0), `notes?` (string). Optional: `fees` array of { label, amountCents, taxable }. Server computes taxCents, totalFeesCents, totalDueCents, frontGrossCents and stores them.

**Response:** 201, `{ data: Deal }`. Money fields in response as string (cents). 404 if customer or vehicle not found or wrong tenant.

---

### 5.3 GET /api/deals/[id]

- **Purpose:** Single deal by id with fees and trades (and optional history).
- **Permission:** deals.read
- **Audit:** Optional sensitive read (deal detail; document if audit required)

**Params (Zod):** `dealIdParamSchema` — `id` (z.string().uuid()).

**Response:** `{ data: Deal }` with nested fees, trades; money fields as string. 404 if not found or wrong tenant.

---

### 5.4 PATCH /api/deals/[id]

- **Purpose:** Partial update of deal (structure only; no financial changes if status ≥ CONTRACTED).
- **Permission:** deals.write
- **Audit:** deal.updated

**Params:** `id` — UUID.

**Body (Zod):** `updateDealBodySchema` — optional: salePriceCents, taxRateBps, docFeeCents, downPaymentCents, notes. Recompute taxCents, totalFeesCents, totalDueCents, frontGrossCents on save. If status = CONTRACTED (or higher), reject with CONFLICT if body contains any financial field.

**Response:** `{ data: Deal }`. Money as string. 404 if not found or wrong tenant.

---

### 5.5 DELETE /api/deals/[id]

- **Purpose:** Soft delete (set deletedAt, deletedBy).
- **Permission:** deals.write
- **Audit:** deal.deleted

**Params:** `id` — UUID.

**Response:** 204 or 200. 404 if not found or wrong tenant. Idempotent if already deleted.

---

### 5.6 GET /api/deals/[id]/fees

- **Purpose:** List fees for deal (paginated if needed; typically small set, limit/offset optional).
- **Permission:** deals.read
- **Audit:** No

**Params:** `id` — deal UUID.

**Response:** `{ data: DealFee[] }`. amountCents as string. 404 if deal not found or wrong tenant.

---

### 5.7 POST /api/deals/[id]/fees

- **Purpose:** Add fee. Recompute totalFeesCents, taxCents, totalDueCents, frontGrossCents on Deal and persist.
- **Permission:** deals.write
- **Audit:** deal.fee_added (or deal.updated)

**Params:** `id` — deal UUID.

**Body (Zod):** `createDealFeeBodySchema` — `label` (string, required), `amountCents` (number or string, required), `taxable` (boolean, default false).

**Response:** 201, `{ data: DealFee }`. 404 if deal not found or wrong tenant. CONFLICT if deal status ≥ CONTRACTED.

---

### 5.8 PATCH /api/deals/[id]/fees/[feeId]

- **Purpose:** Update fee. Recompute Deal totals and persist.
- **Permission:** deals.write
- **Audit:** deal.updated

**Params:** `id` (deal UUID), `feeId` (UUID).

**Body (Zod):** `updateDealFeeBodySchema` — `label?`, `amountCents?`, `taxable?` (all optional).

**Response:** `{ data: DealFee }`. 404 if deal or fee not found or wrong tenant. CONFLICT if deal status ≥ CONTRACTED.

---

### 5.9 DELETE /api/deals/[id]/fees/[feeId]

- **Purpose:** Remove fee. Recompute Deal totals and persist.
- **Permission:** deals.write
- **Audit:** deal.updated

**Params:** `id`, `feeId`.

**Response:** 204. 404 if not found or wrong tenant. CONFLICT if deal status ≥ CONTRACTED.

---

### 5.10 POST /api/deals/[id]/trade

- **Purpose:** Add trade-in (one per deal initially; design allows multiple).
- **Permission:** deals.write
- **Audit:** deal.trade_added

**Params:** `id` — deal UUID.

**Body (Zod):** `createDealTradeBodySchema` — `vehicleDescription` (string, required), `allowanceCents` (number or string), `payoffCents` (number or string, default 0).

**Response:** 201, `{ data: DealTrade }`. 404 if deal not found or wrong tenant. CONFLICT if deal status ≥ CONTRACTED.

---

### 5.11 PATCH /api/deals/[id]/trade/[tradeId]

- **Purpose:** Update trade-in (if multiple trades supported).
- **Permission:** deals.write
- **Audit:** deal.updated

**Params:** `id` (deal UUID), `tradeId` (UUID).

**Body (Zod):** `updateDealTradeBodySchema` — `vehicleDescription?`, `allowanceCents?`, `payoffCents?` (optional).

**Response:** `{ data: DealTrade }`. 404 if not found or wrong tenant. CONFLICT if deal status ≥ CONTRACTED.

---

### 5.12 PATCH /api/deals/[id]/status

- **Purpose:** Transition status (validate workflow). Write DealHistory row on success.
- **Permission:** deals.write
- **Audit:** deal.status_changed

**Params:** `id` — deal UUID.

**Body (Zod):** `updateDealStatusBodySchema` — `status` (DealStatus enum, required). Server validates allowed transition; reject with VALIDATION_ERROR or CONFLICT if invalid.

**Response:** `{ data: Deal }`. 404 if not found or wrong tenant.

---

### 5.13 Cross-tenant behavior

- Any request with a resource ID (deal, customer, vehicle, fee, trade) that belongs to another dealership must return **404 NOT_FOUND** (do not leak existence).

---

## 6) UI Screen Map (For Later Steps)

- **Deals list**
  - Table: columns e.g. deal id or summary, customer, vehicle, status, sale price (display as dollars), front gross (dollars), total due (dollars), createdAt.
  - Filters: status; optional customerId, vehicleId.
  - Pagination: limit/offset with meta.
  - Status badge per row.
  - Loading, empty, error states.

- **Deal structure screen**
  - Sale price (dollars → cents on submit).
  - Purchase price snapshot (from vehicle at creation; display only or editable before CONTRACTED).
  - Fee editor: doc fee + list of custom fees (add/edit/delete); amounts in dollars; taxable checkbox per fee.
  - Trade section: vehicle description, allowance, payoff (dollars → cents).
  - Tax: display tax rate (BPS → %), tax amount (cents → string from API, show as dollars).
  - Down payment (dollars → cents).
  - **Live recalculation preview:** Client-side only (same formulas in cents); show total due, front gross, tax before save.
  - **Server recalculation on save:** On create/update, server computes and stores taxCents, totalFeesCents, totalDueCents, frontGrossCents.
  - Status workflow: dropdown with allowed next status(es); confirmation for APPROVED → CONTRACTED and for CANCELED.

---

## 7) Events

**Emitted by deals module:**

- `deal.created` — payload: `{ dealId, dealershipId, customerId, vehicleId, status }`. On deal create.
- `deal.updated` — payload: `{ dealId, dealershipId, changedFields? }`. On deal PATCH or fee/trade change that triggers totals recompute.
- `deal.status_changed` — payload: `{ dealId, dealershipId, fromStatus, toStatus, changedBy }`. On PATCH /api/deals/[id]/status.
- `deal.trade_added` — payload: `{ dealId, tradeId, dealershipId }`. On POST /api/deals/[id]/trade.
- `deal.fee_added` — payload: `{ dealId, feeId, dealershipId }`. On POST /api/deals/[id]/fees. (Optional: also emit on fee update/delete for consumers that care.)

**Consumed (cross-module):**

- None in this scope (no lender API). Future: finance module may subscribe to deal.created / deal.status_changed to create finance shell or update funding status.

---

## 8) Module Boundary

- **Owns:** Deal, DealFee, DealTrade, DealHistory. All under `/modules/deals/{db,service,ui,tests}`. Route handlers in `/app/api/deals/**` call deals service only.
- **Depends on:** core-platform (Dealership, Profile, RBAC, audit); customers (Customer); inventory (Vehicle). Deal references customerId and vehicleId; no direct DB access to other modules—use existing IDs and service if needed for validation (e.g. ensure customer/vehicle exist and belong to dealership).
- **Shared:** Permission keys `deals.read`, `deals.write` (defined in core-platform; seeded by platform).

---

## Backend implementation checklist

- [ ] Prisma: Add DealStatus enum; Deal, DealFee, DealTrade, DealHistory models; all money as BigInt (cents); taxRateBps Int; indexes and FKs; add relations on Dealership, Customer, Vehicle, Profile.
- [ ] Migration: Create and apply; verify indexes.
- [ ] DB layer: `/modules/deals/db` — CRUD for Deal (scoped by dealershipId), DealFee, DealTrade, DealHistory (insert for status); all queries scoped by dealershipId.
- [ ] Service layer: Financial calculation helpers (integer cents, BPS, HALF_UP); create/update deal with snapshot purchasePriceCents; recompute taxCents, totalFeesCents, totalDueCents, frontGrossCents on every structural change; enforce status workflow and CONTRACTED immutability; emit events; write audit (deal.created, deal.updated, deal.deleted, deal.status_changed, deal.trade_added, deal.fee_added).
- [ ] API routes: GET/POST /api/deals; GET/PATCH/DELETE /api/deals/[id]; GET/POST/PATCH/DELETE fees and trade; PATCH status. Zod for params, query, body; requirePermission(deals.read | deals.write); dealershipId from auth; return money as string in responses; convert dollars to cents on input where UI sends dollars.
- [ ] Reject PATCH to financial fields (and fee/trade mutations) when status ≥ CONTRACTED with CONFLICT.
- [ ] Pagination: list deals limit (default 25, max 100), offset; return meta.total.
- [ ] Cross-tenant: return NOT_FOUND for any resource belonging to another dealership.
- [ ] Tests: Tenant isolation; RBAC; audit entries for CUD and status change; financial formula and immutability when CONTRACTED.

---

## Frontend implementation checklist

- [ ] Deals list: table (customer, vehicle, status, gross, total due, etc.); filters (status); pagination; status badge; loading/empty/error.
- [ ] Deal structure screen: sale price, purchase snapshot, fee editor (doc + custom), trade section, tax display, down payment; client-side live preview (cents math); server recalculation on save; status dropdown with confirmation.
- [ ] Create deal: customer and vehicle required; money inputs in dollars, convert to cents on submit; validation (Zod) and error display.
- [ ] Shared components and design system; accessibility (labels, keyboard, focus).

---

## Explicit Money Compliance Confirmation

- **Storage:** All monetary values are stored as **BIGINT cents** in the database (Deal: salePriceCents, purchasePriceCents, taxCents, docFeeCents, downPaymentCents, totalFeesCents, totalDueCents, frontGrossCents; DealFee: amountCents; DealTrade: allowanceCents, payoffCents). **No Float or Decimal** is used for money.
- **Tax rate:** Stored as **integer basis points (BPS)** (e.g. 7.00% = 700) in `taxRateBps`.
- **API responses:** All money fields are returned as **string** (e.g. `"12345"` for 12345 cents), **not** as JavaScript number.
- **UI → API:** UI may send amounts in dollars; server converts to cents before persistence. Alternatively, API may accept cents as number/string and store as-is; response still returns money as string.
- **Calculations:** All calculations use **integer cents** (and BPS); no float/decimal in calculation path. Rounding: HALF_UP at cent precision where needed. Computed values (taxCents, totalDueCents, frontGrossCents, totalFeesCents) are **stored** on Deal at update time, not recomputed dynamically on read.
- **Financial immutability:** Once deal status is **CONTRACTED**, all financial fields and fee/trade structure are **locked**. No further changes to money or fee/trade rows; only status change to CANCELED is allowed if business rules permit. No exceptions.
