# Step 4 — Deal Desk V1.1 Security Report

## Security checklist

- **Tenant isolation in full-desk save:** `saveFullDealDesk` is called with `dealershipId` from auth context. Deal is loaded by `dealershipId` and `dealId`; NOT_FOUND if wrong tenant. All fee/trade/finance/product operations inside the transaction use the same `dealershipId`; no cross-tenant mutation.
- **Fees/products/trade cannot mutate another dealership:** Fee and product ids in the payload are only applied to the current deal (loaded and checked by `dealershipId` + `dealId`). Trade is upserted/removed only for that deal. No API to target a different deal or dealership.
- **Validation:** Full-desk schema enforces: uuid for ids, non-negative cents, max lengths (notes 5000, label 200, etc.), max array lengths (50 fees, 30 products), taxRateBps 0–10000, termMonths 1–84. Invalid payload → 400.
- **Audit:** After a successful full-desk save, `auditLog` is called with action `deal.updated`, entity `Deal`, entityId `dealId`, metadata `{ dealId, source: "desk.full_save" }`. Existing deal/fee/finance audit patterns are preserved where applicable.
- **Integration tests in Node:** Deal-desk integration tests use `/** @jest-environment node */` so Prisma runs in Node; no browser client resolution in that file.
- **No sensitive info in responses/errors:** API returns serialized deal (toDealDetail); validation errors return standard validation shape. No stack traces or internal ids beyond what the client needs.

## Correctness (security-related)

- CONTRACTED deals reject desk save (status check before transaction).
- Stage flow (PATCH status) unchanged and still validated by existing transitions.
