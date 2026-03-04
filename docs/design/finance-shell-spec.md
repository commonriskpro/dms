# Finance-Shell Module — Full SPEC (Step 1/4)

**Module:** finance-shell (finance “shell” on top of Deals)  
**Scope:** Cash vs Finance toggle; term/APR/payment calculations; backend products (GAP, VSC, etc.); amount financed, total of payments, finance charge; reserve tracking (internal); finance status workflow (pre-lender). **No lender integrations:** no credit pull, lender submission, approvals API, bureau/OFAC. Internal deal finance structure only.

References: AGENT_SPEC.md, DONE.md, MODULES.md, DMS Non-Negotiables, Coding Standards, core-platform-spec.md, deals-spec.md.

---

## 1) Prisma Models (Prisma-Ready + Indexes)

### 1.1 Table Summary

| Table | Tenant-scoped? | Soft delete? | Audit (CUD / critical) |
|-------|----------------|--------------|-------------------------|
| DealFinance | Yes | Yes (deletedAt) | Yes |
| DealFinanceProduct | Yes | Yes (deletedAt) | Yes (product add/update/delete) |

**Soft delete:** Use `deletedAt` (and optionally `deletedBy`) on both. Default lists exclude soft-deleted rows. Retain for audit and reporting.

**Money rule:** All monetary columns **BIGINT** (cents). APR as **Int** basis points (e.g. 12.99% = 1299). No Float/Decimal.

**Cash down decision:** DealFinance stores `cashDownCents`. Single source for “cash down” in finance context. On create, default from `Deal.downPaymentCents`. Used in amountFinancedCents = baseAmountCents + financedProductsCents - cashDownCents. Deal.downPaymentCents remains the deal-level down payment (used in deal.totalDueCents); finance shell can mirror or override via cashDownCents for finance-specific display and calculations.

---

### 1.2 DealFinance

- **Purpose:** 1:1 with Deal. Financing mode (CASH | FINANCE), term/APR/payment, totals, status workflow, optional reserve (internal).
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `dealId` — String, UUID, FK → Deal, required, **unique** (one finance record per deal)
  - `financingMode` — Enum: `CASH` | `FINANCE`
  - **Money (all BigInt cents):** `cashDownCents`, `amountFinancedCents`, `monthlyPaymentCents`, `totalOfPaymentsCents`, `financeChargeCents`, `productsTotalCents`, `backendGrossCents`
  - **Optional:** `reserveCents` — BigInt? (internal only; no lender submission)
  - **Finance terms:** `termMonths` — Int? (null when CASH), `aprBps` — Int? (null when CASH)
  - `firstPaymentDate` — DateTime?
  - `lenderName` — String? (display only; no lender API)
  - `notes` — String?, @db.Text
  - `status` — Enum: `DRAFT` | `STRUCTURED` | `PRESENTED` | `ACCEPTED` | `CONTRACTED` | `CANCELED`
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime?
  - `deletedBy` — String?, UUID, FK → Profile (optional)
- **Relations:** Dealership, Deal, Profile (deletedBy), DealFinanceProduct[].
- **Indexes:**
  - `@@unique([dealId])` — 1:1 with Deal (one DealFinance per deal)
  - `@@index([dealershipId])` — tenant scoping
  - `@@index([dealershipId, status])` — filter by status
  - `@@index([dealershipId, createdAt])` — list by newest
- **Audit:** DealFinance is critical. Audit: finance.created, finance.updated, finance.status_changed, finance.locked (when deal/contracts lock). Sensitive read: finance detail view (audit optional per policy).

```prisma
enum FinancingMode {
  CASH
  FINANCE
}

enum DealFinanceStatus {
  DRAFT
  STRUCTURED
  PRESENTED
  ACCEPTED
  CONTRACTED
  CANCELED
}

model DealFinance {
  id                     String            @id @default(uuid()) @db.Uuid
  dealershipId            String            @map("dealership_id") @db.Uuid
  dealId                  String            @unique @map("deal_id") @db.Uuid
  financingMode           FinancingMode     @map("financing_mode")
  termMonths              Int?              @map("term_months")
  aprBps                  Int?              @map("apr_bps")
  cashDownCents           BigInt            @map("cash_down_cents")
  amountFinancedCents     BigInt            @map("amount_financed_cents")
  monthlyPaymentCents     BigInt            @map("monthly_payment_cents")
  totalOfPaymentsCents    BigInt            @map("total_of_payments_cents")
  financeChargeCents      BigInt            @map("finance_charge_cents")
  productsTotalCents      BigInt            @map("products_total_cents")
  backendGrossCents       BigInt            @map("backend_gross_cents")
  reserveCents            BigInt?          @map("reserve_cents")
  status                  DealFinanceStatus @default(DRAFT)
  firstPaymentDate        DateTime?         @map("first_payment_date") @db.Date
  lenderName              String?           @map("lender_name")
  notes                   String?           @db.Text
  createdAt               DateTime          @default(now()) @map("created_at")
  updatedAt               DateTime          @updatedAt @map("updated_at")
  deletedAt               DateTime?         @map("deleted_at")
  deletedBy               String?           @map("deleted_by") @db.Uuid

  dealership              Dealership        @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  deal                    Deal              @relation(fields: [dealId], references: [id], onDelete: Cascade)
  deletedByProfile         Profile?          @relation("DealFinanceDeletedBy", fields: [deletedBy], references: [id])
  products                 DealFinanceProduct[]

  @@index([dealershipId])
  @@index([dealershipId, status])
  @@index([dealershipId, createdAt])
}
```

---

### 1.3 DealFinanceProduct

- **Purpose:** Backend products 1:N on DealFinance. Types: GAP, VSC, MAINTENANCE, TIRE_WHEEL, OTHER. Price/cost; includedInAmountFinanced drives amount financed.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `dealFinanceId` — String, UUID, FK → DealFinance
  - `productType` — Enum: `GAP` | `VSC` | `MAINTENANCE` | `TIRE_WHEEL` | `OTHER`
  - `name` — String (e.g. "GAP Waiver", "5yr/60k VSC")
  - `priceCents` — BigInt
  - `costCents` — BigInt? (optional; used for backend gross)
  - `taxable` — Boolean, default false (optional; for future tax integration)
  - `includedInAmountFinanced` — Boolean (include price in amountFinanced sum)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime?
  - `deletedBy` — String?, UUID (optional)
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, dealFinanceId])` — list products by deal finance
- **Audit:** Child; audit via finance.product_added, finance.product_updated, finance.product_deleted.

```prisma
enum DealFinanceProductType {
  GAP
  VSC
  MAINTENANCE
  TIRE_WHEEL
  OTHER
}

model DealFinanceProduct {
  id                       String                 @id @default(uuid()) @db.Uuid
  dealershipId              String                 @map("dealership_id") @db.Uuid
  dealFinanceId              String                 @map("deal_finance_id") @db.Uuid
  productType                DealFinanceProductType @map("product_type")
  name                       String
  priceCents                 BigInt                 @map("price_cents")
  costCents                  BigInt?                @map("cost_cents")
  taxable                    Boolean                @default(false)
  includedInAmountFinanced   Boolean                @map("included_in_amount_financed")
  createdAt                  DateTime               @default(now()) @map("created_at")
  updatedAt                  DateTime               @updatedAt @map("updated_at")
  deletedAt                  DateTime?              @map("deleted_at")
  deletedBy                  String?                @map("deleted_by") @db.Uuid

  dealership                 Dealership             @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  dealFinance                DealFinance            @relation(fields: [dealFinanceId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([dealershipId, dealFinanceId])
}
```

---

### 1.4 Relations to Add on Existing Models

- **Deal:** `dealFinance` — DealFinance? (optional 1:1)
- **Dealership:** `dealFinances` — DealFinance[]
- **Profile:** `dealFinancesDeletedBy` — DealFinance[] @relation("DealFinanceDeletedBy")

---

## 2) Calculation Rules (Explicit + Deterministic)

### 2.1 Principal Base and Amount Financed

- **Base amount (deal):** `baseAmountCents = deal.totalDueCents`. (Deal.totalDueCents = salePriceCents + taxCents + totalFeesCents - downPaymentCents per deals-spec.)
- **Cash down:** Use `DealFinance.cashDownCents`. On finance create, default from `Deal.downPaymentCents`; thereafter independent. No double-count: amountFinanced uses only DealFinance.cashDownCents for the finance equation.
- **Financed products total:** `financedProductsCents = sum(DealFinanceProduct.priceCents)` where `includedInAmountFinanced = true` and `deletedAt` null.
- **FINANCE mode:**
  - `amountFinancedCents = max(0, baseAmountCents + financedProductsCents - cashDownCents)`.
  - All monetary totals (monthlyPaymentCents, totalOfPaymentsCents, financeChargeCents, productsTotalCents, backendGrossCents) computed per below and stored.
- **CASH mode:**
  - `monthlyPaymentCents = 0`, `amountFinancedCents = 0`, `termMonths`/`aprBps` null or 0 as consistent (no payment math). Products may exist; `includedInAmountFinanced` does not affect amountFinancedCents (stays 0).

### 2.2 APR / Payment Formula (BigInt-Safe)

- **Formula:** `payment = P * r / (1 - (1+r)^(-n))` where P = amountFinancedCents, r = monthly rate (aprBps / 120000), n = termMonths.
- **BigInt-safe approach:** Use integer scaling. Example: work in “micro-cents” or fixed scaling factor (e.g. 10^12) so all intermediate values are integers. Algorithm outline:
  1. Scale P to scaled principal (e.g. P * 10^6).
  2. Monthly rate in scaled form: r_scaled = (aprBps * 10^6) / 120000 (integer division order chosen to avoid float).
  3. Compute (1+r)^(-n) using iterative integer exponentiation and division, then payment in scaled form; divide back to cents.
  4. Round monthly payment to cents: **HALF_UP** (deterministic). Example: round(x) = floor(x + 500) / 1000 when working in thousandths of cents, then to cents.
- **Deterministic rounding:** Define HALF_UP explicitly: if fractional part ≥ 0.5 (in cent units), round up; else round down. Implement with integer math (e.g. remainder check).
- **Totals:**
  - `totalOfPaymentsCents = monthlyPaymentCents * termMonths` (exact; payment already rounded to cents).
  - `financeChargeCents = totalOfPaymentsCents - amountFinancedCents`.

### 2.3 Product Totals (Stored on DealFinance)

- **productsTotalCents** = sum of `DealFinanceProduct.priceCents` where `includedInAmountFinanced = true` and `deletedAt` null.
- **backendGrossCents** = sum of `(priceCents - costCents)` over products where `costCents` is not null and `deletedAt` null; if costCents null, that product contributes 0 to backend gross. Store result on DealFinance; recompute on product add/update/delete (until CONTRACTED).

---

## 3) Finance Status Workflow

- **Allowed transitions:**
  - DRAFT → STRUCTURED → PRESENTED → ACCEPTED → CONTRACTED
  - Any status (except CONTRACTED) → CANCELED
  - CONTRACTED → CANCELED only if business rules allow (document in business rules; spec allows it as optional transition).
- **Deal.CONTRACTED and Finance:**
  - When `Deal.status = CONTRACTED`, the finance shell is **locked**: all finance.write mutations (PUT finance, PATCH status, product add/update/delete) return **CONFLICT** except status → CANCELED if allowed.
  - When Deal transitions to CONTRACTED, set `DealFinance.status = CONTRACTED` if a DealFinance row exists (sync). Thereafter only status → CANCELED is allowed on finance if business permits.

---

## 4) RBAC Matrix + Tenant Scoping

### 4.1 Permissions

- **finance.read** — Get finance, get products list, read-only access to deal finance tab.
- **finance.write** — Create/update finance, PATCH status, add/update/delete products.

| Route / action | Permission |
|----------------|------------|
| GET /api/deals/[id]/finance | finance.read |
| PUT /api/deals/[id]/finance | finance.write |
| PATCH /api/deals/[id]/finance/status | finance.write |
| GET /api/deals/[id]/finance/products | finance.read |
| POST /api/deals/[id]/finance/products | finance.write |
| PATCH /api/deals/[id]/finance/products/[productId] | finance.write |
| DELETE /api/deals/[id]/finance/products/[productId] | finance.write |

- **Least privilege:** No admin bypass; both read and write are explicit.
- **Tenant scoping:** `dealershipId` from auth (active dealership). Every list/get/update/delete scoped by dealership. Cross-tenant resource IDs return **NOT_FOUND**.

---

## 5) API Contract List (No Code)

Standard error shape: `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, INTERNAL.

**Money in API:** All money in **cents**; request body accepts number or string (parsed to BigInt). **Responses** return money as **string** (e.g. `"12345"`). APR in BPS (integer). Pagination: list products `limit` (default 25, max 100), `offset` (0-based). Response: `{ data: T }` or `{ data: T[], meta: { total, limit, offset } }`.

**Dealership scoping:** `dealershipId` from auth. Cross-tenant deal/product IDs return 404 NOT_FOUND.

---

### 5.1 GET /api/deals/[id]/finance

- **Purpose:** Get finance shell for deal (or 404 if none).
- **Permission:** finance.read
- **Audit:** Optional sensitive read (finance detail); document if audit required.

**Params (Zod):** `dealIdParamSchema` — `id` (z.string().uuid()).

**Response:** 200 `{ data: DealFinance }` with money/apr as strings; or 404 if no DealFinance for that deal or wrong tenant.

---

### 5.2 PUT /api/deals/[id]/finance

- **Purpose:** Create or full replace finance shell. Recompute amountFinancedCents, monthlyPaymentCents, totalOfPaymentsCents, financeChargeCents, productsTotalCents, backendGrossCents from current deal and products. If Deal.status = CONTRACTED, reject with CONFLICT.
- **Permission:** finance.write
- **Audit:** finance.created (if created), finance.updated (if updated).

**Params:** `id` — deal UUID.

**Body (Zod):** `putFinanceBodySchema` — `financingMode` (CASH | FINANCE, required), `termMonths?` (number, 1–84 when FINANCE), `aprBps?` (number, 0–9999 when FINANCE), `cashDownCents?` (number or string, default from Deal.downPaymentCents on create), `firstPaymentDate?` (ISO date string), `lenderName?` (string), `notes?` (string), `reserveCents?` (number or string, optional). Server recomputes and stores all totals.

**Response:** 200 or 201, `{ data: DealFinance }`. Money/apr as string. 404 if deal not found or wrong tenant. CONFLICT if deal status = CONTRACTED.

---

### 5.3 PATCH /api/deals/[id]/finance/status

- **Purpose:** Transition finance status (validate allowed transitions). If Deal.status = CONTRACTED, only CONTRACTED → CANCELED allowed (if allowed by business rules); otherwise CONFLICT.
- **Permission:** finance.write
- **Audit:** finance.status_changed

**Params:** `id` — deal UUID.

**Body (Zod):** `patchFinanceStatusBodySchema` — `status` (DealFinanceStatus enum, required). Server validates transition; reject with VALIDATION_ERROR or CONFLICT if invalid.

**Response:** `{ data: DealFinance }`. 404 if deal/finance not found or wrong tenant.

---

### 5.4 GET /api/deals/[id]/finance/products

- **Purpose:** List backend products for deal’s finance (paginated). Exclude soft-deleted.
- **Permission:** finance.read
- **Audit:** No

**Params:** `id` — deal UUID. Resolve DealFinance by dealId (same tenant); if no DealFinance, return 404 or empty list (spec: return 404 if no finance shell).

**Query (Zod):** `listProductsQuerySchema` — `limit` (number, default 25, max 100), `offset` (number, min 0).

**Response:** `{ data: DealFinanceProduct[], meta: { total, limit, offset } }`. priceCents/costCents as string. 404 if no DealFinance for deal or wrong tenant.

---

### 5.5 POST /api/deals/[id]/finance/products

- **Purpose:** Add backend product. Recompute DealFinance.productsTotalCents and backendGrossCents (and amountFinancedCents, payment totals if FINANCE). If Deal.status = CONTRACTED, CONFLICT.
- **Permission:** finance.write
- **Audit:** finance.product_added

**Params:** `id` — deal UUID.

**Body (Zod):** `createFinanceProductBodySchema` — `productType` (enum GAP | VSC | MAINTENANCE | TIRE_WHEEL | OTHER, required), `name` (string, required), `priceCents` (number or string, required), `costCents?` (number or string), `taxable?` (boolean, default false), `includedInAmountFinanced` (boolean, required).

**Response:** 201, `{ data: DealFinanceProduct }`. 404 if deal/finance not found or wrong tenant. CONFLICT if deal CONTRACTED.

---

### 5.6 PATCH /api/deals/[id]/finance/products/[productId]

- **Purpose:** Update product. Recompute DealFinance totals. If Deal.status = CONTRACTED, CONFLICT.
- **Permission:** finance.write
- **Audit:** finance.product_updated

**Params:** `id` (deal UUID), `productId` (UUID).

**Body (Zod):** `updateFinanceProductBodySchema` — `productType?`, `name?`, `priceCents?`, `costCents?`, `taxable?`, `includedInAmountFinanced?` (all optional).

**Response:** `{ data: DealFinanceProduct }`. 404 if not found or wrong tenant. CONFLICT if deal CONTRACTED.

---

### 5.7 DELETE /api/deals/[id]/finance/products/[productId]

- **Purpose:** Soft delete product. Recompute DealFinance totals. If Deal.status = CONTRACTED, CONFLICT.
- **Permission:** finance.write
- **Audit:** finance.product_deleted

**Params:** `id`, `productId`.

**Response:** 204. 404 if not found or wrong tenant. CONFLICT if deal CONTRACTED.

---

## 6) Audit Events

- **finance.created** — DealFinance created; metadata: dealId, dealFinanceId, dealershipId; no PII.
- **finance.updated** — DealFinance updated; metadata: dealId, dealFinanceId, changedFields (field names only, no PII).
- **finance.status_changed** — Status transition; metadata: dealId, dealFinanceId, fromStatus, toStatus.
- **finance.product_added** — Product added; metadata: dealId, dealFinanceId, productId, productType.
- **finance.product_updated** — Product updated; metadata: dealId, dealFinanceId, productId, changedFields.
- **finance.product_deleted** — Product soft-deleted; metadata: dealId, dealFinanceId, productId.
- **finance.locked** — Emitted when deal/contracts lock (e.g. Deal → CONTRACTED); metadata: dealId, dealFinanceId. Optional; can be inferred from status_changed.

---

## 7) UI Screen Map

- **Deal detail “Finance” tab**
  - **Cash/Finance toggle** — Switch financingMode; when CASH, clear/zero payment fields and show only products (optional) and backend gross.
  - **Terms:** Term (months), APR (BPS → display as %), cash down (cents → dollars), first payment date, lender name (text), notes.
  - **Totals (FINANCE):** Monthly payment, amount financed, finance charge, total of payments (all cents → dollars). Read-only summary from server.
  - **Products table:** Columns — type, name, price (dollars), cost (dollars, optional), taxable, included in amount financed; add/edit/delete rows. Pagination if needed (limit/offset).
  - **Status badge** — Current DealFinanceStatus; **transitions** — dropdown or buttons for allowed next status(es); confirm for PRESENTED → ACCEPTED and ACCEPTED → CONTRACTED.
  - **Lock banner** — When Deal.status = CONTRACTED, show banner “Finance locked”; disable edits and product mutations; only status → CANCELED allowed if configured.
  - **Reserve:** Optional internal-only field (reserveCents → dollars); hide or restrict by role if needed.

---

## 8) Invariants & Immutability

- **Deal.status = CONTRACTED:**
  - All finance.write mutations (PUT finance, PATCH status except CONTRACTED→CANCELED, product add/update/delete) return **CONFLICT**.
  - DealFinance.status is set to CONTRACTED when Deal becomes CONTRACTED; thereafter only transition to CANCELED is allowed (if business rules permit).
- **CASH mode:** monthlyPaymentCents = 0, amountFinancedCents = 0; termMonths/aprBps null or 0; products may exist but includedInAmountFinanced does not change amountFinanced (remains 0).
- **Money:** All stored as BIGINT cents; API returns cents as string; UI displays dollars, sends cents to API. APR stored as BPS integer; payment rounding HALF_UP to cent; deterministic.

---

## 9) Module Boundary

- **Owns:** DealFinance, DealFinanceProduct. Under `/modules/finance-shell/{db,service,ui,tests}` (or `/modules/finance/` per MODULES.md; spec name is finance-shell). Route handlers under `/app/api/deals/[id]/finance/**` call finance-shell service only.
- **Depends on:** core-platform (Dealership, Profile, RBAC, audit); deals (Deal). Finance reads deal.totalDueCents and deal.downPaymentCents via service or shared read; no direct DB access to Deal from finance-shell db layer—use deals service or Prisma relation scoped by dealership.
- **Shared:** Permission keys `finance.read`, `finance.write` (seed in core-platform).
- **Events:** Emit finance.created, finance.updated, finance.status_changed, finance.product_*; consume deal.status_changed to sync/lock when Deal → CONTRACTED.

---

## 10) Events Emitted / Consumed

**Emitted:**
- `finance.created` — payload: { dealId, dealFinanceId, dealershipId }.
- `finance.updated` — payload: { dealId, dealFinanceId, changedFields }.
- `finance.status_changed` — payload: { dealId, dealFinanceId, fromStatus, toStatus }.
- `finance.product_added` — payload: { dealId, dealFinanceId, productId }.
- `finance.product_updated` — payload: { dealId, dealFinanceId, productId, changedFields }.
- `finance.product_deleted` — payload: { dealId, dealFinanceId, productId }.
- `finance.locked` — payload: { dealId, dealFinanceId } (when Deal → CONTRACTED).

**Consumed:**
- `deal.status_changed` — When toStatus = CONTRACTED, set DealFinance.status = CONTRACTED for that deal (if DealFinance exists) and treat finance as locked.

---

## Backend Checklist

- [ ] Prisma: Add FinancingMode, DealFinanceStatus, DealFinanceProductType enums; DealFinance and DealFinanceProduct models; all money BigInt (cents), aprBps Int; indexes and FKs; add relations on Deal, Dealership, Profile.
- [ ] Migration: Create and apply; verify unique dealId on DealFinance and indexes.
- [ ] DB layer: `/modules/finance-shell/db` — CRUD for DealFinance (by dealId, scoped by dealershipId), DealFinanceProduct; all queries scoped by dealershipId; soft delete where applicable.
- [ ] Service layer: Calculation helpers (BigInt-safe payment formula, HALF_UP rounding); recompute amountFinancedCents, monthlyPaymentCents, totalOfPaymentsCents, financeChargeCents, productsTotalCents, backendGrossCents on create/update and on product add/update/delete; enforce Deal.status = CONTRACTED → reject mutations with CONFLICT (except status → CANCELED); enforce finance status transitions; emit events; write audit (finance.created, finance.updated, finance.status_changed, finance.product_*).
- [ ] API routes: GET/PUT /api/deals/[id]/finance; PATCH /api/deals/[id]/finance/status; GET/POST/PATCH/DELETE /api/deals/[id]/finance/products/[productId]. Zod for params, query, body; requirePermission(finance.read | finance.write); dealershipId from auth; return money/apr as string.
- [ ] Pagination: GET products limit (default 25, max 100), offset; return meta.total.
- [ ] Cross-tenant: NOT_FOUND for any resource belonging to another dealership.
- [ ] Tests: Tenant isolation (Dealer A cannot read/update Dealer B finance); RBAC (insufficient permission → FORBIDDEN); deterministic payment math (known test vectors: P, aprBps, n → monthlyPaymentCents, totalOfPaymentsCents, financeChargeCents); immutability after Deal CONTRACTED (mutations return CONFLICT); status transitions (valid/invalid); product inclusion (includedInAmountFinanced true/false affects amountFinanced and totals); audit entries for create/update/status/product_*.

---

## Frontend Checklist

- [ ] Deal detail Finance tab: Cash/Finance toggle; term, APR, cash down, first payment date, lender name, notes; display monthly payment, amount financed, finance charge, total of payments (all from server, cents → dollars).
- [ ] Products table: list (paginated), add/edit/delete; productType, name, price, cost, taxable, includedInAmountFinanced; validation and error states.
- [ ] Finance status badge and allowed transitions (dropdown or buttons); confirmation for critical transitions.
- [ ] Lock banner when Deal.status = CONTRACTED; disable all finance edits and product mutations; show only status → CANCELED if allowed.
- [ ] Loading, empty, error states; accessibility (labels, keyboard, focus); shared components and design system.
- [ ] Manual smoke: create deal → open Finance tab → set FINANCE, term/APR/cash down → add products (included/not included) → verify totals; set CASH → verify zeros; transition status; contract deal → verify lock and CONFLICT on edit.
