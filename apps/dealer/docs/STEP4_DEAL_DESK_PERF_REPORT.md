# Step 4 — Deal Desk V1 Performance Report

## Server-first loading

- **Page:** Single RSC data load via `getDealDeskData(dealershipId, dealId)`.
- **Data fetched:** One deal (with customer, vehicle, fees, trades, dealFinance.products), one DealHistory list (limit 50), one AuditLog list (limit 50, entity=Deal, entityId=dealId). All in parallel after deal fetch: `Promise.all([listDealHistory, listAuditLogs])`.
- **No duplicate serializers:** Reuses `toDealDetail(deal)` from existing serialize module; activity and audit mapped to plain objects with ISO dates.
- **Client:** No initial fetch on mount; workspace receives `initialData` and renders immediately. No loading spinner for first paint for desk data.

## Bundle and runtime

- **Deal-math on client:** `FinanceTermsCard` imports `paymentEstimate` from `deal-math`; `deal-math` imports from `calculations` and `finance-shell/calculations` (pure math, no Prisma). Acceptable for client bundle.
- **Desk components:** Card-based UI; no heavy charts or large lists on first paint. Activity and Audit panels render bounded lists (50 items each).

## Recommendations

- If audit or activity lists grow, consider pagination or “Load more” (currently capped at 50).
- Keep POST desk payload minimal (only changed fields) if adding partial updates later to reduce payload size.

## Summary

Deal Desk V1 uses a single server round-trip for full desk data, parallel history + audit, and no client fetch for initial load. Performance is adequate for V1; pagination can be added later if needed.
