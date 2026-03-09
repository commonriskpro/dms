# Deal Desk V1 — Backend Report

## Summary

Backend implementation for Deal Desk V1: unified loader, desk math, POST desk API, and reuse of existing stage (PATCH status) and RBAC.

## Implemented

### A. Deal desk loader

- **File:** `modules/deals/service/deal-desk.ts`
- **Function:** `getDealDeskData(dealershipId, dealId)`
- Loads: Deal (with customer, vehicle, fees, trades, dealFinance.products) via existing `dealDb.getDealById`, DealHistory via `historyDb.listDealHistory`, AuditLog via `auditService.listAuditLogs` with `entity=Deal`, `entityId=dealId`.
- Returns: `DealDeskData` (deal as DealDetail, activity, activityTotal, audit, auditTotal). All scoped by `dealershipId`; throws `ApiError("NOT_FOUND")` when deal missing or wrong tenant.

### B. Math engine

- **File:** `modules/deals/service/deal-math.ts`
- **Functions:**
  - `calculateDealTotals(input)` — wraps existing `computeDealTotals` from `calculations.ts` (vehiclePriceCents, fees, tax, totalDue, frontGross).
  - `tradeEquityCents`, `balanceAfterTradeCents`, `amountFinancedCents` — helpers for trade and amount financed.
  - `paymentEstimate(amountFinancedCents, aprBps, termMonths)` — reuses `computeMonthlyPaymentCents` from `finance-shell/service/calculations.ts` (deterministic, zero APR and edge cases handled).
- All values in cents (BigInt). Jest: `modules/deals/tests/deal-math.test.ts` (HALF_UP, zero tax, trade equity, balance, amount financed, payment estimate edge cases).

### C. Deal update API

- **Route:** `POST /api/deals/[id]/desk`
- **File:** `app/api/deals/[id]/desk/route.ts`
- **Schema:** `updateDealDeskBodySchema` in `app/api/deals/schemas.ts`: optional `salePriceCents`, `taxRateBps`, `docFeeCents`, `downPaymentCents`, `notes`, `cashDownCents`, `termMonths`, `aprBps`.
- Behavior: Validates input, enforces tenant via `updateDealDesk`, calls `dealService.updateDeal` for deal fields and `financeService.putFinance` for finance fields (term, APR, cash down). Syncs `deal.downPaymentCents` when `cashDownCents` is sent. Audit via existing deal/finance audit logging.
- **RBAC:** `guardPermission(ctx, "deals.write")`, rate limit `deals_mutation`.

### D. Stage transition

- **Existing:** `PATCH /api/deals/[id]/status` with `{ status: DealStatus }`.
- Valid transitions enforced in `deal-transitions.ts`: DRAFT → STRUCTURED | CANCELED; STRUCTURED → APPROVED | CANCELED; etc. No new endpoint added.

### E. RBAC

- `getDealDeskData`: used in RSC after session check; page requires `deals.read` (enforced by layout/guard where applicable).
- `POST /api/deals/[id]/desk`: `deals.write`.
- `PATCH /api/deals/[id]/status`: `deals.write`.

### F. Tests

- **deal-math.test.ts:** 25 tests (with calculations.test.ts), all passing. Covers calculateDealTotals, tradeEquityCents, balanceAfterTradeCents, amountFinancedCents, paymentEstimate (zero APR, zero term/principal, negative APR).
- **deal-desk.test.ts:** Integration tests for `getDealDeskData` (shape, NOT_FOUND for wrong tenant / bad id) and `updateDealDesk` (deal fields, finance fields). Skipped when `SKIP_INTEGRATION_TESTS=1` or no `TEST_DATABASE_URL`; may require Node Prisma env to run (project Jest/Prisma setup).

## Files added

- `modules/deals/service/deal-desk.ts`
- `modules/deals/service/deal-math.ts`
- `app/api/deals/[id]/desk/route.ts`
- `modules/deals/tests/deal-math.test.ts`
- `modules/deals/tests/deal-desk.test.ts`

## Files modified

- `app/api/deals/schemas.ts` — added `updateDealDeskBodySchema`.

## Migrations

None. Reuses existing Deal, DealFee, DealTrade, DealHistory, DealFinance, DealFinanceProduct, AuditLog.
