# Deals Module

## Purpose and scope

- Deal CRUD; link to Customer (required) and Vehicle (required).
- One trade-in per deal (design allows multiple later); fees (doc fee + custom fees); down payment.
- Tax calculation (BPS, HALF_UP); front gross (DealerCenter-style); status workflow.
- All monetary values **BIGINT cents** in DB; API requests accept cents; API responses return money as **string**.
- No lender API in this scope.

## Routes

| Method | Path | Permission | Audit |
|--------|------|------------|--------|
| GET | /api/deals | deals.read | No |
| POST | /api/deals | deals.write | deal.created |
| GET | /api/deals/[id] | deals.read | No |
| PATCH | /api/deals/[id] | deals.write | deal.updated |
| DELETE | /api/deals/[id] | deals.write | deal.deleted |
| GET | /api/deals/[id]/fees | deals.read | No |
| POST | /api/deals/[id]/fees | deals.write | deal.fee_added |
| PATCH | /api/deals/[id]/fees/[feeId] | deals.write | deal.fee_updated |
| DELETE | /api/deals/[id]/fees/[feeId] | deals.write | deal.fee_deleted |
| POST | /api/deals/[id]/trade | deals.write | deal.trade_added / deal.trade_updated |
| PATCH | /api/deals/[id]/trade/[tradeId] | deals.write | deal.trade_updated |
| PATCH | /api/deals/[id]/status | deals.write | deal.status_changed |
| GET | /api/deals/[id]/history | deals.read | No |

## Permissions

- **deals.read** — List deals, get deal, list fees, list trades, get deal history.
- **deals.write** — Create/update/delete deal; add/update/delete fees; add/update trade; change status.
- No admin bypass. `dealershipId` from auth; cross-tenant resource IDs return **404 NOT_FOUND**.

## Data model summary

- **Deal** — Tenant-scoped; customerId, vehicleId; all money BIGINT cents; status (DRAFT → STRUCTURED → APPROVED → CONTRACTED | CANCELED); soft delete (deletedAt, deletedBy).
- **DealFee** — Per-deal custom fees; label, amountCents, taxable (for tax base).
- **DealTrade** — One trade per deal (initial design); vehicleDescription, allowanceCents, payoffCents.
- **DealHistory** — Append-only status transitions (fromStatus, toStatus, changedBy).

Doc fee lives on **Deal** as `docFeeCents`. `totalFeesCents` = docFeeCents + sum(DealFee.amountCents).

## Calculation formulas

- **Taxable base (v1):** `taxableBaseCents = salePriceCents + sum(DealFee.amountCents where taxable)`  
  Trade does **not** affect taxable base.
- **Tax (HALF_UP):** `taxCents = (taxableBaseCents * taxRateBps + 5000) / 10000` (integer division).
- **Total fees:** `totalFeesCents = docFeeCents + sum(DealFee.amountCents)`.
- **Total due:** `totalDueCents = salePriceCents + taxCents + totalFeesCents - downPaymentCents`.
- **Front gross:** `frontGrossCents = salePriceCents - purchasePriceCents - totalFeesCents`.  
  Tax is **not** subtracted from gross.

All computed values (taxCents, totalFeesCents, totalDueCents, frontGrossCents) are stored on Deal and recomputed on every structural change until CONTRACTED.

## Immutability rules

- When **status = CONTRACTED**: no changes to salePriceCents, purchasePriceCents, taxRateBps, taxCents, docFeeCents, downPaymentCents, totalFeesCents, totalDueCents, frontGrossCents; no add/edit/delete of DealFee or DealTrade.
- **Only allowed change** when CONTRACTED: **status → CANCELED**.
- Any attempt to change financial fields or fees/trade when status is CONTRACTED returns **409 CONFLICT**.

## One active deal per vehicle

- At most one **active** deal per `(dealershipId, vehicleId)` where `deletedAt IS NULL` and `status <> 'CANCELED'`.
- Enforced by app-layer check and DB partial unique index. Creating a second active deal for the same vehicle returns **409 CONFLICT**.
- Cross-tenant vehicleId (vehicle belongs to another dealership) returns **404 NOT_FOUND**.

## Security guarantees

- **Tenant scoping:** Every route uses `dealership_id` from auth. Cross-tenant resource IDs (deal, fee, trade from another dealership) return **404 NOT_FOUND** for list, get, update, delete, fees, trade, history, status.
- **RBAC:** `deals.read` is required for GET list, GET detail, GET fees, GET history. `deals.write` is required for all POST/PATCH/DELETE (deal, fee, trade, status). No admin bypass.
- **One active deal per vehicle:** App returns **409 CONFLICT**; DB partial unique index `Deal_dealership_id_vehicle_id_active_key` enforces at most one non-CANCELED, non-deleted deal per (dealership_id, vehicle_id). After a deal is CANCELED, a new deal for the same vehicle is allowed.
- **CONTRACTED immutability:** When status is CONTRACTED, financial fields (salePrice, downPayment, taxRate, docFee, tax, totalFees, totalDue, frontGross) and fee/trade mutations are locked. Only status → CANCELED is allowed. Any attempt to change financial data or add/update/delete fee or trade returns **409 CONFLICT**.

## Money rules

- All persisted amounts are **BIGINT cents** in the database. No floating-point for money.
- API request/response use **string** cents (e.g. `"12345"` for $123.45).
- UI uses `lib/money.ts`: `parseDollarsToCents` for input (handles `$1,234.56`, `1234.5`, `.99`; empty/invalid rejected); `formatCents` for display; `percentToBps` / `bpsToPercent` for tax rate. No float math for persisted values.

## Events emitted

- **deal.created** — payload: dealId, dealershipId, customerId, vehicleId, status.
- **deal.updated** — payload: dealId, dealershipId, changedFields.
- **deal.status_changed** — payload: dealId, dealershipId, fromStatus, toStatus, changedBy.
- **deal.trade_added** — payload: dealId, tradeId, dealershipId.

## Manual API smoke checklist

1. **Auth:** Sign in; set active dealership; ensure role has `deals.read` and `deals.write`.
2. **List:** GET /api/deals?limit=25&offset=0 — expect `{ data, meta: { total, limit, offset } }`; money fields as string.
3. **Create:** POST /api/deals with body: customerId, vehicleId, salePriceCents, purchasePriceCents, taxRateBps (e.g. 700), optional docFeeCents, downPaymentCents, notes, fees[]. Expect 201; taxCents, totalDueCents, frontGrossCents computed and returned as string.
4. **One active deal:** Create another deal with the same vehicleId (same dealership) — expect 409 CONFLICT.
5. **Get:** GET /api/deals/[id] — expect deal with fees, trades; money as string.
6. **Update:** PATCH /api/deals/[id] with notes or salePriceCents — expect 200; totals recomputed.
7. **Status:** PATCH /api/deals/[id]/status with body `{ "status": "STRUCTURED" }` — expect 200; GET .../history — expect new row.
8. **CONTRACTED immutability:** Set deal status to CONTRACTED (PATCH status through workflow). Then PATCH /api/deals/[id] with salePriceCents — expect 409 CONFLICT. POST /api/deals/[id]/fees — expect 409 CONFLICT.
9. **CANCELED from CONTRACTED:** PATCH /api/deals/[id]/status with `{ "status": "CANCELED" }` — expect 200.
10. **Fees:** POST /api/deals/[id]/fees (label, amountCents, taxable); PATCH .../fees/[feeId]; DELETE .../fees/[feeId]. Expect totals on deal updated; money as string.
11. **Trade:** POST /api/deals/[id]/trade (vehicleDescription, allowanceCents, payoffCents); PATCH .../trade/[tradeId]. Expect 201 / 200.
12. **Tenant isolation:** Use a deal id from another dealership (or customer/vehicle from another dealership when creating) — expect 404 NOT_FOUND.
13. **RBAC:** As user without deals.read, GET /api/deals — expect 403. As user without deals.write, POST /api/deals — expect 403.
14. **Audit:** After create/update/delete/status change, GET /api/audit filtered by entity "Deal" — expect deal.created, deal.updated, deal.deleted, deal.status_changed, deal.fee_added, etc.

## Running integration tests

- Set **TEST_DATABASE_URL** to a test Postgres. Run `npm test`. Deals tests: tenant isolation, RBAC, money calculations (unit), immutability, one-active-deal (integration when DB available).
- To skip DB-backed tests: **SKIP_INTEGRATION_TESTS=1**.
