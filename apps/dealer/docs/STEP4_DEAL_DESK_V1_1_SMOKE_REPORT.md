# Step 4 — Deal Desk V1.1 Smoke Report

## Correctness checklist

| Item | Status |
|------|--------|
| Full-desk save persists all sections | Pass — Transaction updates deal, fees, trade, finance, products; backend tests confirm. |
| Save/reload consistency | Pass — Tests assert that after save, getDealDeskData returns matching deal, fees, trade, finance. |
| Totals correct after save | Pass — Recompute runs inside transaction (deal totals from fees; finance totals from products). |
| Deleted fees/products/trade stay deleted | Pass — Replace semantics: fees/products not in payload removed; trade null removes trade. |
| Stage actions still work | Pass — PATCH status unchanged; test transitions to CONTRACTED and rejects desk save. |
| Empty states persist | Pass — fees: [], trade: null, products: [] tests. |
| Cents round-trip | Pass — Payload and reload use same cents values in tests. |

## Regression checklist

| Item | Status |
|------|--------|
| Existing Deal Desk V1 UI | Pass — Same route, layout, and cards; added draft state and full save. |
| Math tests | Pass — deal-math tests unchanged and passing. |
| Route POST desk | Pass — Accepts full payload; returns updated deal. |
| Integration tests (deal-desk) | Pass — 11 tests pass when run with Node env (npx jest modules/deals/tests/deal-desk.test.ts). |
| Design tokens | Pass — No new Tailwind palette classes; semantic tokens only. |

## Manual smoke (recommended)

1. Open a deal at `/deals/[id]`.
2. Edit selling price, add a fee, set trade (or remove), add a product; click Save. Reload page and confirm all values and totals match.
3. Remove fee, clear trade, remove product; Save. Reload and confirm empty states.
4. Transition deal to CONTRACTED via stage buttons; confirm desk save is rejected and UI reflects locked state.
