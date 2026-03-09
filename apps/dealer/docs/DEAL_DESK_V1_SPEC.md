# Deal Desk V1 — Specification

**Document path:** `apps/dealer/docs/DEAL_DESK_V1_SPEC.md`  
**Goal:** Production-grade Deal Desk workspace for structuring vehicle deals (customer, vehicle, trade, fees, backend products, finance terms, totals, payment estimate, stage actions, activity/audit).

**Out of scope V1:** Lender integrations, doc generation, e-signature, credit bureau, complex lender decisioning, contract printing, external APIs.

---

## 1. Deal Desk objective

The Deal Desk is the **unified deal structuring interface** where a salesperson:

- **Customer** — View/edit customer and co-buyer; link to CRM/customer profile.
- **Vehicle** — View vehicle summary and selling price (deal’s sale price).
- **Trade-in** — Add/edit trade(s): description, allowance, payoff; equity = allowance − payoff (may be negative).
- **Pricing** — Selling price, doc fee, custom fees (DealFee); taxable base and tax; subtotal/total due.
- **Fees** — Doc fee on Deal; list of DealFee (label, amountCents, taxable).
- **Backend products** — DealFinanceProduct (GAP, VSC, etc.); included in amount financed or not; backend gross.
- **Finance terms** — Down payment (cash down), term months, APR; amount financed; payment estimate.
- **Totals** — Front gross (sale − cost − fees); tax; total due; amount financed; backend gross; combined gross.
- **Payment estimate** — Deterministic monthly payment from amount financed, APR, term.
- **Stage progression** — Deal status transitions (DRAFT → STRUCTURED → APPROVED → CONTRACTED; CANCELED).
- **Activity / audit** — DealHistory (status changes) and AuditLog entries for the deal.

All values in **cents** (BigInt); server-first load; RBAC `deals.read` / `deals.write`; tenant isolation by `dealershipId`.

---

## 2. Page route

- **Primary route:** `/deals/[id]`
- **Server-first:** Page is a Server Component; it loads desk data in RSC and passes it to a client workspace component. No fetch-on-mount for initial payload.
- **Existing:** `app/(app)/deals/[id]/page.tsx` already loads deal via `getDeal` and passes `toDealDetail(deal)` to `DealDetailPage`. For Deal Desk V1 we either enhance that page to render the new workspace or add a dedicated desk view (same route, different layout). Spec: **same route** `/deals/[id]`; introduce a unified loader `getDealDeskData` and a new client `DealDeskWorkspace` that can replace or sit alongside the current detail content so the primary experience is the desk.

---

## 3. Layout architecture

**Three-column workspace + lower tabs.**

### Left column

- **Customer summary** — Name, contact summary; link to customer profile.
- **Co-buyer** — Placeholder or optional co-buyer (no new model in V1; can show “Add co-buyer” disabled or omit).
- **Trade-in** — List of DealTrade; add/edit; allowance, payoff, equity.
- **Notes** — Deal.notes (multiline).

### Center column

- **Vehicle summary** — Year, make, model, stock #, VIN (from deal.vehicle).
- **Selling price** — Deal.salePriceCents (editable when not CONTRACTED).
- **Fees** — Doc fee (Deal.docFeeCents); list of DealFee with label, amount, taxable.
- **Backend products** — DealFinance.products (DealFinanceProduct); name, price, included in amount financed.
- **Gross summary** — Front gross, backend gross, total gross (front + backend).

### Right column

- **Down payment** — Deal.downPaymentCents or DealFinance.cashDownCents (single source: Deal for front; finance block for amount financed when present).
- **Term** — DealFinance.termMonths.
- **APR** — DealFinance.aprBps (basis points).
- **Amount financed** — Computed: totalDue − cashDown + products included; or from DealFinance.amountFinancedCents when finance block exists.
- **Payment estimate** — From paymentEstimate(amountFinanced, aprBps, termMonths); display only when term and APR present.
- **Lender / funding status** — Placeholder or DealFinance.lenderName, status (V1: display only).
- **Deal actions** — Stage transition buttons (e.g. “Mark Structured”, “Approve”, “Contract”); valid transitions only.

### Lower tabs

- **Activity** — DealHistory (status changes) in reverse chronological order.
- **Audit trail** — AuditLog entries for entity = Deal and entityId = dealId (and optionally DealFee, DealTrade, DealFinance for same deal in metadata or entityId).
- **Documents** — Placeholder (e.g. “Documents — coming soon”).

Layout must be **responsive**: three columns on large screens; stack or two-column on medium; single column on small. Use CSS grid and semantic tokens only.

---

## 4. Server data loader

**Unified loader:** `getDealDeskData(dealershipId, dealId)`

**Must load (all scoped by dealershipId):**

| Data | Source | Notes |
|------|--------|------|
| Deal | dealDb.getDealById (with customer, vehicle, fees, trades, dealFinance.products) | Already exists |
| Customer | Via deal.customer | Included in getDealById |
| Vehicle | Via deal.vehicle | Included in getDealById |
| Trade(s) | deal.trades | Included |
| Fees | deal.fees | Included |
| Products | deal.dealFinance?.products | Included |
| Activity | DealHistory list (dealId) | historyDb.listDealHistory |
| Audit events | AuditLog list (entity=Deal, entityId=dealId) | audit.listAuditLogs with filters |

**Return:** A single serialized **desk model** (e.g. `DealDeskData`) suitable for the page and client workspace: deal (with customer, vehicle, fees, trades, dealFinance with products), history (activity), audit (list of audit entries). Money as string (cents); dates as ISO string. Reuse existing serializers where possible (e.g. toDealDetail, serializeDeal).

**Location:** `modules/deals/service/deal-desk.ts` — `getDealDeskData(dealershipId, dealId)`.

---

## 5. Data model reuse

**Reuse existing models; no new tables for V1.**

| Model | Use |
|-------|-----|
| Deal | Core; salePriceCents, purchasePriceCents, taxRateBps, taxCents, docFeeCents, downPaymentCents, totalFeesCents, totalDueCents, frontGrossCents, status, notes. |
| Customer | deal.customer (id, name). |
| Vehicle | deal.vehicle (id, vin, year, make, model, stockNumber). |
| DealFee | deal.fees; label, amountCents, taxable. |
| DealTrade | deal.trades; vehicleDescription, allowanceCents, payoffCents; equity = allowance − payoff. |
| DealFinance | deal.dealFinance; termMonths, aprBps, cashDownCents, amountFinancedCents, monthlyPaymentCents, productsTotalCents, backendGrossCents. |
| DealFinanceProduct | deal.dealFinance.products; productType, name, priceCents, includedInAmountFinanced. |
| DealHistory | Status change history; fromStatus, toStatus, changedBy, createdAt. |
| AuditLog | entity, entityId, action, actorUserId, createdAt, metadata (read-only list). |

**Minimal new fields:** None required for V1. If desk needs a “desk-specific” total (e.g. totalBalance = totalDueCents), it is computed in the service, not stored.

---

## 6. Desk math engine

**Canonical calculation service:** `calculateDealTotals` (existing) + optional desk-level wrapper; **payment estimate:** `paymentEstimate(amountFinancedCents, aprBps, termMonths)`.

**Existing:** `modules/deals/service/calculations.ts` — `computeDealTotals` (salePrice, purchasePrice, docFee, downPayment, taxRateBps, customFeesCents, taxableCustomFeesCents) → totalFeesCents, taxableBaseCents, taxCents, totalDueCents, frontGrossCents.  
**Reuse:** This for front totals.  
**New module:** `modules/deals/service/deal-math.ts` (or equivalent) to:

- **calculateDealTotals** — Re-export or wrap existing `computeDealTotals` so desk and API use one formula. Inputs: vehiclePriceCents (sale), purchasePriceCents, docFeeCents, downPaymentCents, taxRateBps, customFeesCents, taxableCustomFeesCents. Outputs: totalFeesCents, taxCents, totalDueCents, frontGrossCents. Optionally accept trade and backend products to output: **totalBalance** (e.g. totalDue − tradeEquity), **amountFinanced** (totalBalance − cashDown + productsIncluded), **grossProfit** (frontGross + backendGross). Definition of “totalBalance” and “amountFinanced” for the desk:  
  - totalDueCents already exists.  
  - Trade equity: sum of (allowanceCents − payoffCents) per trade (can be negative). **Balance after trade** = totalDueCents − tradeEquity (customer owes less if positive equity).  
  - amountFinanced = balanceAfterTrade − cashDownCents + productsIncludedCents (only products with includedInAmountFinanced); floor at 0.  
  - grossProfit = frontGrossCents + (DealFinance.backendGrossCents ?? 0).

- **paymentEstimate(amountFinancedCents, aprBps, termMonths)** — Returns estimated monthly payment in cents. Use standard amortization: when APR > 0, monthly payment = P * r(1+r)^n / ((1+r)^n − 1) with r = APR/12, n = termMonths; when APR = 0, payment = ceil(amountFinanced / termMonths). **Reuse** `computeMonthlyPaymentCents` from `modules/finance-shell/service/calculations.ts` so one formula everywhere; deal-math can re-export or wrap it.

**Requirements:** All inputs/outputs in cents (BigInt); deterministic; handle negative equity (trade), zero tax, zero APR; Jest tests for edge cases.

---

## 7. Payment estimate

**Formula:** Use existing `computeMonthlyPaymentCents(principalCents, aprBps, termMonths)` from finance-shell:

- **Inputs:** amountFinancedCents (principal), aprBps (basis points), termMonths.
- **Output:** estimatedMonthlyPaymentCents (BigInt).
- **Zero APR:** payment = principal / termMonths (rounded HALF_UP to cents).
- **Deterministic:** Same inputs → same output.

Desk displays this as “Payment estimate” when term and APR are set.

---

## 8. Stage workflow

**Stages:** Use existing **DealStatus** (DRAFT, STRUCTURED, APPROVED, CONTRACTED, CANCELED). Not CRM pipeline stages (New, Contacted, …); that mapping can be a later enhancement.

**Valid transitions:** From `deal-transitions.ts`:  
DRAFT → STRUCTURED | CANCELED  
STRUCTURED → APPROVED | CANCELED  
APPROVED → CONTRACTED | CANCELED  
CONTRACTED → CANCELED  
CANCELED → (none)

**Deal desk:** Stage change buttons in header or right column; only show target statuses allowed from current status. On submit, call existing **PATCH /api/deals/[id]/status** (or equivalent) with `{ status: DealStatus }`; backend enforces `isAllowedTransition(from, to)` and writes DealHistory + audit.

---

## 9. Acceptance criteria

- [ ] **Server-first:** Deal desk page loads with `getDealDeskData` in RSC; no initial client fetch for deal payload.
- [ ] **Customer/vehicle:** Customer name and vehicle summary (year, make, model, stock #) visible.
- [ ] **Editing finance terms:** User can edit selling price, doc fee, down payment, fees, trade(s), term, APR (when not CONTRACTED); UI triggers desk update (optimistic or on save).
- [ ] **Recalculated totals:** Subtotal, tax, total due, front gross (and when finance block exists: amount financed, backend gross, payment estimate) recalc from current inputs.
- [ ] **Payment estimate:** Displayed when term and APR present; formula matches finance-shell (deterministic).
- [ ] **Persist desk updates:** Saving (e.g. “Save” or auto-save) calls mutation endpoint (e.g. POST /api/deals/[id]/desk or existing PATCH deal + fee/trade/finance endpoints); changes persisted and audited.
- [ ] **Stage changes:** User can transition deal status via buttons; only valid transitions allowed; DealHistory and audit updated.
- [ ] **Activity panel:** DealHistory (status changes) listed in reverse chronological order.
- [ ] **Audit panel:** AuditLog entries for the deal listed (entity=Deal, entityId=dealId).
- [ ] **RBAC:** deals.read required to load; deals.write required to mutate.
- [ ] **Tenant isolation:** All data scoped by dealershipId from auth.

---

## 10. File plan (implementation)

### Step 2 — Backend

| Action | File(s) |
|--------|--------|
| Add | `modules/deals/service/deal-desk.ts` — getDealDeskData |
| Add | `modules/deals/service/deal-math.ts` — calculateDealTotals (wrap/reuse), paymentEstimate (reuse finance-shell computeMonthlyPaymentCents) |
| Add | POST /api/deals/[id]/desk — validate body; update deal/fees/trade/finance as needed; recompute totals; audit |
| Use | PATCH /api/deals/[id]/status (existing) for stage transitions |
| Add | Jest tests: deal-math (edge cases), deal-desk loader, desk API validation, stage transitions |

### Step 3 — Frontend

| Action | File(s) |
|--------|--------|
| Update | `app/(app)/deals/[id]/page.tsx` — call getDealDeskData; pass to DealDeskWorkspace |
| Add | `modules/deals/ui/DealDeskWorkspace.tsx` — 3-column layout, state, save |
| Add | Cards: DealHeader, CustomerCard, VehicleCard, TradeCard, FeesCard, ProductsCard, FinanceTermsCard, DealTotalsCard, ActivityPanel, AuditPanel |
| Use | shadcn Card, tokens only; responsive grid |

### Step 4 — Security & QA

| Action | File(s) |
|--------|--------|
| Add | DEAL_DESK_V1_BACKEND_REPORT.md, DEAL_DESK_V1_FRONTEND_REPORT.md |
| Add | STEP4_DEAL_DESK_SECURITY_REPORT.md, STEP4_DEAL_DESK_SMOKE_REPORT.md, STEP4_DEAL_DESK_PERF_REPORT.md |

---

*End of spec. Implementation follows Steps 2–4.*
