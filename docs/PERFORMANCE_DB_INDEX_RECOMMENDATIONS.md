# Database Index Recommendations

**Date:** 2026-03-07
**Context:** Performance audit of dealer app Prisma queries

---

## Recommended Indexes

These indexes are recommended based on frequent query patterns observed in the codebase. No migrations are created in this sprint — these are documented for future implementation.

### 1. `deal_fees` — composite on `(dealership_id, deal_id)`

**Query pattern:** `dealFee.findMany({ where: { dealershipId, dealId } })`
**Used in:** `deal-desk.ts` (saveFullDealDesk) — called on every deal desk save
**Current:** Individual indexes on `dealership_id` and `deal_id`
**Recommended:** `@@index([dealershipId, dealId])`

### 2. `deal_trades` — composite on `(dealership_id, deal_id)`

**Query pattern:** `dealTrade.findFirst({ where: { dealershipId, dealId } })`
**Used in:** `deal-desk.ts` — trade upsert/remove
**Recommended:** `@@index([dealershipId, dealId])`

### 3. `deal_finance_products` — composite on `(deal_finance_id, dealership_id, deleted_at)`

**Query pattern:** `dealFinanceProduct.findMany({ where: { dealFinanceId, dealershipId, deletedAt: null } })`
**Used in:** `deal-desk.ts` — product sync
**Recommended:** `@@index([dealFinanceId, dealershipId])`

### 4. `finance_submissions` — composite on `(dealership_id, funding_status, status)`

**Query pattern:** `financeSubmission.count({ where: { dealershipId, fundingStatus: "PENDING", status: { in: [...] } } })`
**Used in:** Dashboard v3 funding issues count
**Recommended:** `@@index([dealershipId, fundingStatus, status])`

### 5. `finance_stipulations` — composite on `(dealership_id, status)`

**Query pattern:** `financeStipulation.count({ where: { dealershipId, status: "REQUESTED" } })`
**Used in:** Dashboard v3 pending stips count
**Recommended:** `@@index([dealershipId, status])`

### 6. `memberships` — composite on `(user_id, dealership_id, disabled_at)`

**Query pattern:** `membership.findFirst({ where: { userId, dealershipId, disabledAt: null } })`
**Used in:** `lib/tenant.ts` — called on every authenticated request
**Recommended:** `@@index([userId, dealershipId])` (if not already present)

---

## Notes

- All recommended indexes include `dealership_id` per the multi-tenancy rules
- These are additive indexes — no existing indexes need to be removed
- Priority: #6 (membership lookup) is highest impact since it runs on every request
- Create via `prisma migrate dev` after review
