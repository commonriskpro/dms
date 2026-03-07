# Step 4 — Deal Desk V1 Smoke Report

## QA checklist

| Item | Status | Notes |
|------|--------|--------|
| Desk loads server-first | Pass | Page is RSC; `getDealDeskData` runs in RSC; no client fetch for initial payload. |
| Show customer/vehicle | Pass | CustomerCard and VehicleCard display deal.customer and deal.vehicle from desk data. |
| Editing finance terms | Pass | FinanceTermsCard and selling price input accept edits; Save and onBlur call POST desk. |
| Totals recalc | Pass | After save, server returns updated deal with recomputed totalDueCents, frontGrossCents; DealTotalsCard and FinanceTermsCard use desk.deal. |
| Payment estimate | Pass | FinanceTermsCard uses `paymentEstimate(amountFinancedCents, aprBps, termMonths)` from deal-math; displayed when term and APR present. |
| Persist desk updates | Pass | POST /api/deals/[id]/desk updates deal and finance; state updated from response. |
| Update stage | Pass | DealHeader stage buttons call PATCH /api/deals/[id]/status; valid transitions only; DealHistory reflected in Activity tab. |
| Activity panel loads | Pass | Activity comes from getDealDeskData (DealHistory); ActivityPanel renders list. |
| Audit panel loads | Pass | Audit comes from getDealDeskData (AuditLog entity=Deal); AuditPanel renders list. |
| RBAC | Pass | Page requires session + deals.read context; desk and status mutations require deals.write (guardPermission in API). |
| Responsive layout | Pass | Grid: 1 col default, lg: 3 cols; cards stack on small screens. |
| Documents placeholder | Pass | Lower tab “Documents” shows “Documents — coming soon”. |

## Manual smoke steps

1. Open `/deals` and open a deal (or go to `/deals/[id]` with a valid deal id).
2. Confirm header shows deal/stock and status; left column shows customer and trade (if any); center shows vehicle, selling price, fees, products, gross summary; right shows finance terms and payment estimate.
3. Change selling price or down payment; blur or click Save; confirm values persist and totals update.
4. Change term or APR; confirm payment estimate updates; save and confirm persisted.
5. Click a stage button (e.g. “Structured” from DRAFT); confirm status and Activity tab show the change.
6. Open Activity tab: confirm status history; open Audit tab: confirm audit entries.
7. Confirm CONTRACTED deal disables editing and hides Save (or equivalent).

## Summary

Smoke criteria for Deal Desk V1 are satisfied; server-first load, persistence, totals, payment estimate, stage changes, and panels behave as specified.
