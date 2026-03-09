# Deal Desk V1.1 — Frontend Report

## Summary

Frontend updated to support the unified full-desk save: workspace holds draft state for fees, trade, and products; single Save sends the full payload; cards support add/edit/remove where not locked.

## A. DealDeskWorkspace state alignment

- **State:** Workspace holds `feesDraft` (array of `{ id?, label, amountCents, taxable }`), `tradeDraft` (single trade object or null), `productsDraft` (array of `{ id?, productType, name, priceCents, includedInAmountFinanced }`), and `notesDraft`. All initialized from `desk.deal` and re-synced when `desk.deal` changes (e.g. after save or when `updatedAt`/id changes).
- **Save:** Single “Save deal” builds a full-desk body: deal fields (salePriceCents, docFeeCents, downPaymentCents, notes), finance (termMonths, aprBps, cashDownCents), `fees` (array), `trade` (object or null), `products` (array). POST `/api/deals/[id]/desk` with that body. On success, state is updated from the response (deal, drafts, and form fields).
- **No fetch-on-mount:** Initial data remains server-provided via `initialData`; no client fetch for the initial desk payload.

## B. Section editing support

- **FeesCard:** Accepts optional `feesDraft`, `onFeesChange`, `disabled`. When editable: list of fee rows with label input, amount input (dollars), taxable checkbox, and Remove; “Add fee” button. Values stored in workspace state and sent on Save.
- **TradeCard:** Accepts optional `tradeDraft`, `onTradeChange`, `disabled`. When editable: single trade form (vehicle description, allowance, payoff) or “Add trade-in” when no trade; “Remove trade” when trade present. Draft stored in workspace and sent on Save.
- **ProductsCard:** Accepts optional `productsDraft`, `onProductsChange`, `disabled`. When editable: list of product rows with type (Select), name, price, “Financed” checkbox, Remove; “Add product” button. Draft stored in workspace and sent on Save.
- **Notes:** Editable textarea in the left column; value in `notesDraft`, saved with full-desk payload.
- **FinanceTermsCard / DealTotalsCard:** Unchanged; still receive deal and local finance fields; totals reflect server data after save.

## C. Save UX

- One “Save deal” button; disabled while `saving` is true.
- Success toast “Deal updated”; error toast with API error message.
- After success, local state (drafts and form fields) is replaced from the response so the UI reflects persisted data and no stale partial state remains.
- No auto-save on blur for fees/trade/products (only notes and selling price had onBlur save previously); user clicks Save to persist. (Notes and selling price still trigger save on blur for quick updates.)

## D. Frontend tests

- No new frontend unit tests were added in this sprint. Manual verification: full-desk payload is built from draft state and submitted; backend tests cover save/reload consistency.

## E. Files modified

- `modules/deals/ui/desk/DealDeskWorkspace.tsx` — Draft state (fees, trade, products, notes); full-desk body in `saveDesk`; pass drafts and callbacks to cards; notes textarea.
- `modules/deals/ui/desk/FeesCard.tsx` — Optional `feesDraft`, `onFeesChange`, `disabled`; add/edit/remove fee rows when editable.
- `modules/deals/ui/desk/TradeCard.tsx` — Optional `tradeDraft`, `onTradeChange`, `disabled`; add/edit/remove single trade when editable.
- `modules/deals/ui/desk/ProductsCard.tsx` — Optional `productsDraft`, `onProductsChange`, `disabled`; add/edit/remove product rows when editable.

## Requirements met

- Full-desk payload is built and submitted on Save.
- Fees, trade, and products are editable (add/edit/remove) when not locked; state is persisted on Save.
- Single Save action; saving disabled during request; success/error toasts; state refreshed from response.
- Layout and tokens unchanged; no redesign.
