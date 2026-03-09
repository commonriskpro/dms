# Step 4 — Deal Desk V1 Security Report

## Checklist

### Tenant isolation

- **getDealDeskData:** Uses `dealershipId` from caller; `dealDb.getDealById(dealershipId, dealId)` and `historyDb.listDealHistory(dealershipId, dealId)` are scoped; `auditService.listAuditLogs(dealershipId, …)` is scoped. Deal not found for wrong tenant → NOT_FOUND.
- **POST /api/deals/[id]/desk:** Auth context supplies `ctx.dealershipId`; `updateDealDesk(dealershipId, …)` calls `dealService.updateDeal` and `financeService.putFinance`, both of which load the deal by `dealershipId` and `dealId` and throw NOT_FOUND if missing or wrong tenant.
- **PATCH /api/deals/[id]/status:** Existing route; deal service enforces tenant on get/update.
- **Verdict:** Tenant isolation verified for desk loader and desk/status APIs.

### Stage transitions

- **Backend:** `deal-transitions.ts` defines `ALLOWED_TRANSITIONS`; `updateDealStatus` uses `isAllowedTransition(from, to)`. Invalid transition throws.
- **Frontend:** DealHeader shows only `ALLOWED_NEXT[deal.status]` as buttons; user cannot submit an invalid status from the desk UI.
- **Verdict:** Stage transitions validated server-side; UI only offers valid targets.

### Math engine safety

- **deal-math.ts:** Pure functions; inputs in cents (BigInt). No user-controlled eval or dynamic code. `paymentEstimate` and `calculateDealTotals` use existing calculations/finance-shell logic with fixed formulas. Zero/negative term, zero principal, negative APR guarded (return 0 or safe value).
- **Verdict:** Math engine is safe; no injection or unsafe numeric handling.

### Audit logging

- **Deal updates:** Existing `dealService.updateDeal` logs `deal.updated` with entity Deal, entityId dealId.
- **Finance updates:** Existing `financeService.putFinance` logs `finance.created` / `finance.updated` with entity DealFinance.
- **Desk API:** Does not add new audit events; relies on the above. Stage changes already logged via `updateDealStatus` (DealHistory + audit).
- **Verdict:** Audit logging preserved; no new bypass paths.

### Input validation

- **POST /api/deals/[id]/desk:** Body validated with `updateDealDeskBodySchema` (Zod): centsSchema for money (non-negative BigInt), taxRateBps 0–10000, notes max length, termMonths 1–84, etc. Invalid body → 400.
- **PATCH /api/deals/[id]/status:** Existing `updateDealStatusBodySchema` (status enum). Invalid status → 400.
- **Verdict:** Input validation in place for desk and status endpoints.

## Summary

Security hardening: tenant isolation, stage validation, math safety, audit logging, and input validation are in place for Deal Desk V1.
