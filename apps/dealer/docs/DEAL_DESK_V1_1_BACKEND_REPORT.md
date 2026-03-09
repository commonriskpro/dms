# Deal Desk V1.1 — Backend Report

## Summary

Backend implementation for full-desk persistence: unified payload schema, transactional `saveFullDealDesk`, and integration-test environment fix.

## A. Unified desk payload schema

- **File:** `apps/dealer/app/api/deals/schemas.ts`
- **Schema:** `updateDealDeskBodySchema` extended with:
  - `fees`: optional array of `{ id?: uuid, label, amountCents, taxable }`, max 50 items
  - `trade`: optional `{ id?: uuid, vehicleDescription, allowanceCents, payoffCents? } | null`
  - `products`: optional array of `{ id?: uuid, productType, name, priceCents, costCents?, taxable?, includedInAmountFinanced }`, max 30 items
- All money via existing `centsSchema` (BigInt, non-negative). Validation strict; deterministic replace semantics per spec.

## B. Transactional full-desk save

- **File:** `modules/deals/service/deal-desk.ts`
- **Function:** `saveFullDealDesk(dealershipId, userId, dealId, input: FullDeskPayload, meta?)`
- **Behavior:**
  - Validates tenant and deal exists; rejects if deal status is CONTRACTED.
  - Single `prisma.$transaction` that:
    1. Patches deal (salePriceCents, taxRateBps, docFeeCents, downPaymentCents, notes; downPayment from cashDownCents when provided)
    2. If `fees` provided: replace all fees (delete not in payload, create new, update by id)
    3. Recompute deal totals from current fees and update deal (totalFeesCents, taxCents, totalDueCents, frontGrossCents)
    4. If `trade` provided: null → delete existing trade; object → upsert single trade
    5. Ensure DealFinance exists when finance terms or products provided; create with FINANCE if missing
    6. If `products` provided: soft-delete products not in list; create/update by id
    7. Recompute finance totals when finance terms or products changed; update DealFinance
  - After transaction: audit `deal.updated` with `source: "desk.full_save"`; return `toDealDetail(getDealById)`.
- **Route:** `POST /api/deals/[id]/desk` — parses body with `updateDealDeskBodySchema`, builds `FullDeskPayload`, calls `saveFullDealDesk`, returns `{ data: DealDetail }`.

## C. Loader alignment

- `getDealDeskData` unchanged; returns deal (with fees, trades, dealFinance.products) ordered by createdAt. Deterministic serialization via existing `toDealDetail`.

## D. Save/reload helpers

- No separate helpers; normalization and persistence live inside `saveFullDealDesk`. Reload is `getDealDeskData` after save.

## E. Integration-test environment fix

- **Fix:** Add `/** @jest-environment node */` at top of `modules/deals/tests/deal-desk.test.ts` so Jest runs that file in Node, avoiding Prisma browser build resolution.
- **Verification:** Running `npx jest modules/deals/tests/deal-desk.test.ts` from `apps/dealer` runs all 11 tests and passes (with `TEST_DATABASE_URL` set and no `SKIP_INTEGRATION_TESTS`).
- **Note:** Running the full dealer suite still loads other integration tests (e.g. customers, inventory) that also import Prisma; those files need the same docblock to run in Node when executed. This report documents the fix for the deals module; other modules can add `@jest-environment node` to their integration tests similarly.

## F. Backend tests

- **File:** `modules/deals/tests/deal-desk.test.ts`
- **Tests:**
  1. getDealDeskData returns deal, activity, audit; NOT_FOUND for wrong dealership / non-existent deal
  2. saveFullDealDesk: updates deal fields; updates finance (term/APR); replaces fees (array then reload); empty fees removes all; upserts trade then remove with null; full round-trip (sale, doc, notes, fees, trade, term, APR) and reload consistency; NOT_FOUND for wrong dealership; CONTRACTED deal rejects save
- All 11 tests pass when run in isolation with Node env.

## Files modified

- `apps/dealer/app/api/deals/schemas.ts` — full-desk payload (fees, trade, products)
- `apps/dealer/modules/deals/service/deal-desk.ts` — `saveFullDealDesk`, `FullDeskPayload`; `updateDealDesk` deprecated wrapper
- `apps/dealer/app/api/deals/[id]/desk/route.ts` — use `saveFullDealDesk` and pass fees/trade/products
- `apps/dealer/modules/deals/tests/deal-desk.test.ts` — `@jest-environment node`; save/reload, fees, trade, CONTRACTED tests

## Migrations

None.
