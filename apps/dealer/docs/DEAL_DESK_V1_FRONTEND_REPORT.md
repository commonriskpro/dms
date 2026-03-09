# Deal Desk V1 — Frontend Report

## Summary

Deal Desk UI: server-first page at `/deals/[id]` loading `getDealDeskData` and rendering a 3-column workspace plus lower tabs (Activity, Audit, Documents placeholder).

## Implemented

### Page

- **Route:** `/deals/[id]`
- **File:** `app/(app)/deals/[id]/page.tsx`
- Server component: calls `getDealDeskData(dealershipId, id)` in RSC; passes result to `<DealDeskWorkspace id={id} initialData={deskData} />`. On invalid id or no permission or NOT_FOUND, renders a simple “Deal not found or no access” message with link to `/deals`.

### Client workspace

- **File:** `modules/deals/ui/desk/DealDeskWorkspace.tsx`
- Layout: 3-column grid (responsive: 1 col small, 3 col large). Left: customer, trade, notes. Center: vehicle, selling price, fees, backend products, gross summary. Right: finance terms (down payment, term, APR, amount financed, payment estimate), Save button, stage actions in header.
- State: desk data (deal, activity, audit); local edit state for sale price, doc fee, down payment, term, APR. Saving: `POST /api/deals/[id]/desk` with current values; stage change: `PATCH /api/deals/[id]/status`. Totals come from server after save; payment estimate uses `paymentEstimate()` from deal-math (client-safe).
- Lower tabs: Activity (DealHistory), Audit trail (AuditLog), Documents (placeholder “coming soon”).

### Components (shadcn Card + tokens only)

- **DealHeader** — Back link, deal/stock label, status badge, stage transition buttons (valid only).
- **CustomerCard** — Customer name, link to profile; co-buyer placeholder.
- **VehicleCard** — Year/make/model, stock #, VIN, link to vehicle.
- **TradeCard** — Single trade: description, allowance, payoff, equity (allowance − payoff).
- **FeesCard** — Doc fee, list of DealFee (label, amount, taxable), total fees.
- **ProductsCard** — DealFinance.products list, products total, backend gross.
- **FinanceTermsCard** — Down payment, term, APR (editable when not locked); amount financed and payment estimate (from deal-math).
- **DealTotalsCard** — Selling price, tax, total due, front gross, backend gross, total gross.
- **ActivityPanel** — DealHistory entries (fromStatus → toStatus, date).
- **AuditPanel** — AuditLog entries (action, date).

All use semantic tokens: `var(--surface)`, `var(--border)`, `var(--text)`, `var(--muted-text)`, `var(--ring)`. No Tailwind palette colors.

### Types

- **types.ts:** Added `DealAuditEntry`, `DealDeskData` (deal, activity, activityTotal, audit, auditTotal).

## Files added

- `modules/deals/ui/desk/DealHeader.tsx`
- `modules/deals/ui/desk/CustomerCard.tsx`
- `modules/deals/ui/desk/VehicleCard.tsx`
- `modules/deals/ui/desk/TradeCard.tsx`
- `modules/deals/ui/desk/FeesCard.tsx`
- `modules/deals/ui/desk/ProductsCard.tsx`
- `modules/deals/ui/desk/FinanceTermsCard.tsx`
- `modules/deals/ui/desk/DealTotalsCard.tsx`
- `modules/deals/ui/desk/ActivityPanel.tsx`
- `modules/deals/ui/desk/AuditPanel.tsx`
- `modules/deals/ui/desk/DealDeskWorkspace.tsx`

## Files modified

- `app/(app)/deals/[id]/page.tsx` — Uses `getDealDeskData` and `DealDeskWorkspace`.
- `modules/deals/ui/types.ts` — Added `DealAuditEntry`, `DealDeskData`.

## Requirements met

- Server-first load; no initial client fetch for desk payload.
- Customer and vehicle visible; finance terms editable (when not CONTRACTED).
- Totals and payment estimate from server + deal-math; saving persists via POST desk.
- Stage buttons in header; only valid transitions.
- Activity and Audit panels from desk data.
- Responsive grid; keyboard-friendly inputs (inputs use standard HTML).
