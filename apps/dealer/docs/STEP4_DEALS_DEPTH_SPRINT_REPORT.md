# Step 4 — Deals Depth Sprint — Security & QA Report

**Date:** 2025-03-05  
**Scope:** Deal Detail Modal (Option B), lifecycle, trade-in, finance, F&I products, calculations, audit, immutability, rate limits

---

## 1. Summary

- **Deal detail**: Server-first load in modal and direct URL; GET deal includes fees, trades, dealFinance with products in one query (no N+1). Serializer `toDealDetail` used for RSC → client.
- **Lifecycle**: DealStatus transitions validated via `isAllowedTransition`; CONTRACTED → only CANCELED; invalid transition → 400.
- **Trade-in**: CRUD with equityCents (allowance − payoff) in response; audit on add/update/delete; CONTRACTED → 409 on add/update/delete.
- **Finance**: GET/PUT with deals.read/finance.read and deals.write/finance.write; CONTRACTED → 409 on PUT.
- **F&I products**: List/create/update/delete with finance.read/finance.write; CONTRACTED → 409 on mutations.
- **Calculations**: `computeDealTotals` / `computeTaxCents` used when deal/fees change; totals persisted on Deal; unit tests for formulas.
- **Immutability**: When status = CONTRACTED, structural edits (price, fees, trades, finance, products) → 409; notes-only PATCH and CONTRACTED → CANCELED allowed.
- **Audit**: Deal update, status change, fee/trade/finance/product mutations logged with entity, action, dealershipId, userId.
- **Rate limits**: Mutation routes (status, fees, trade, finance, products) use `deals_mutation` (60/min per user+dealership); 429 when exceeded.

---

## 2. Tenant Isolation

- **dealershipId**: From auth context only (`getAuthContext`). Never from client body or path (path has dealId, not dealershipId).
- **Cross-tenant**: All get/list/update/delete scoped by `dealershipId`. Access with another dealership’s deal/trade/product id returns **404 NOT_FOUND** (no existence leak).
- **Tests**: `modules/deals/tests/tenant-isolation.test.ts` — wrong dealership for deal, fees, trade, finance, products → NOT_FOUND. Run with `TEST_DATABASE_URL` set for integration run.

---

## 3. RBAC

| Route / Action | Permission | Verified |
|----------------|------------|----------|
| GET /api/deals, GET /api/deals/[id], GET fees, GET trade, GET history | deals.read | guardPermission before logic |
| PATCH deal, PATCH status, POST/PATCH/DELETE fees, POST/PATCH/DELETE trade | deals.write | Yes |
| GET /api/deals/[id]/finance, GET finance/products | finance.read | Yes |
| PUT finance, POST/PATCH/DELETE finance/products | finance.write | Yes |

- **Tests**: `modules/deals/tests/rbac.test.ts` — requirePermission(deals.read), requirePermission(deals.write), requirePermission(finance.read), requirePermission(finance.write). Run with DB for full coverage.

---

## 4. Validation (Zod at edge)

- **Params**: dealId, feeId, tradeId, productId — UUID. Invalid UUID → 400 or 404 as appropriate.
- **Body**: updateDealBodySchema (optional fields; negative cents rejected), updateDealStatusBodySchema (toStatus enum), create/update fee (label, amountCents ≥ 0, taxable), create/update trade (vehicleDescription, allowanceCents ≥ 0, payoffCents ≥ 0), putFinanceBodySchema (termMonths 1–84, aprBps ≥ 0, cents ≥ 0), create/update product (productType, name, priceCents ≥ 0, taxable, includedInAmountFinanced).
- **Tests**: `modules/deals/tests/validation.test.ts` — schema parse/refuse for invalid UUID, negative cents, out-of-range termMonths/aprBps, invalid status.

---

## 5. Audit

- **Logged**: Deal create/update/delete; deal status change (DealHistory + audit); DealFee add/update/delete; DealTrade add/update/delete; DealFinance create/update/delete; DealFinanceProduct add/update/delete. Payload includes entity, action, dealershipId, userId, and relevant fields (e.g. fromStatus/toStatus).
- **Tests**: `modules/deals/tests/audit.test.ts` — deal update, fee update/delete, trade add/update/delete, finance create/update, product add/update/delete. Run with DB.

---

## 6. Rate Limiting

- **Type**: `deals_mutation` — 60 per minute per user+dealership (key: `deals:${dealershipId}:${userId}`).
- **Applied on**: PATCH /api/deals/[id], PATCH /api/deals/[id]/status, POST/PATCH/DELETE fees, POST/PATCH/DELETE trade, PUT /api/deals/[id]/finance, POST/PATCH/DELETE finance/products.
- **Response**: 429 with `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }`.
- **Tests**: `lib/api/rate-limit.test.ts` — after 60 increments, checkRateLimit returns false for deals_mutation.

---

## 7. Immutability (CONTRACTED)

- **Locked**: When deal.status === CONTRACTED, reject with **409 CONFLICT**: PATCH deal (except notes-only), fee add/update/delete, trade add/update/delete, PUT finance, F&I product add/update/delete. Invalid status transition (e.g. CONTRACTED → APPROVED) → 400.
- **Allowed**: PATCH deal with only `notes`; PATCH status from CONTRACTED to CANCELED.
- **Tests**: `modules/deals/tests/immutability-and-one-deal.test.ts` — CONTRACTED deal: structural PATCH → CONFLICT; notes-only PATCH → 200; addTrade, deleteTrade, putFinance, addProduct → CONFLICT. Run with DB.

---

## 8. Performance

- **Deal detail load**: Single Prisma query in `getDealById` with bounded `include`: customer (id, name), vehicle (id, vin, year, make, model, stockNumber), fees, trades, dealFinance (with products, deletedAt null). No N+1.
- **List endpoints**: Deals list, deal history, fees (inline or list), trade list, finance products list — all paginated (limit/offset) with max limit enforced in Zod.
- **Indexes**: Existing indexes on Deal (dealershipId, status, createdAt, customerId, vehicleId), DealFee/DealTrade/DealHistory (dealershipId, dealId), DealFinance/DealFinanceProduct (dealershipId, dealId/dealFinanceId). No new indexes added this sprint.

---

## 9. Tests and Commands

**Run from repo root:**

```bash
npm -w apps/dealer run test -- modules/deals/tests --passWithNoTests
npm -w apps/dealer run test -- lib/api/rate-limit.test
npm -w apps/dealer run build
```

**Results (without TEST_DATABASE_URL):**

- `validation.test.ts`, `calculations.test.ts`, `deal-transitions.test.ts`, `lib/api/rate-limit.test.ts`: **passed** (40 passed, 44 skipped when integration suites skip).
- Integration suites (tenant-isolation, rbac, audit, immutability-and-one-deal) **skip** unless `TEST_DATABASE_URL` is set and `SKIP_INTEGRATION_TESTS` is not `1`.

**Test files added/updated in Step 4:**

- `modules/deals/tests/tenant-isolation.test.ts` — trade/finance/product cross-tenant NOT_FOUND.
- `modules/deals/tests/rbac.test.ts` — finance.read / finance.write requirePermission.
- `modules/deals/tests/validation.test.ts` — **new** — Zod schema validation for deal, fee, trade, finance, product.
- `modules/deals/tests/immutability-and-one-deal.test.ts` — **new** — CONTRACTED structural edits → 409; notes-only → 200.
- `modules/deals/tests/audit.test.ts` — fee/trade/finance/product audit entries.
- `lib/api/rate-limit.test.ts` — deals_mutation 60/min.

---

## 10. Files Touched (Sprint)

**Spec**

- `apps/dealer/docs/DEALS_DEPTH_SPRINT_SPEC.md` (Step 1)

**Backend (Step 2)**

- `modules/deals/db/deal.ts`, `modules/deals/db/trade.ts`
- `modules/deals/service/deal.ts`, `modules/finance-shell/service/index.ts`
- `app/api/deals/[id]/route.ts`, `[id]/status/route.ts`, `[id]/fees/route.ts`, `[id]/fees/[feeId]/route.ts`, `[id]/trade/route.ts`, `[id]/trade/[tradeId]/route.ts`, `[id]/finance/route.ts`, `[id]/finance/products/route.ts`, `[id]/finance/products/[productId]/route.ts`
- `app/api/deals/schemas.ts`, `app/api/deals/serialize.ts`
- `lib/api/rate-limit.ts`
- `modules/deals/tests/calculations.test.ts`

**Frontend (Step 3)**

- `app/(app)/deals/[id]/page.tsx` — server-first initialData
- `app/(app)/@modal/(.)deals/[id]/page.tsx`, `DealDetailModalClient.tsx`
- `app/(app)/@modal/(.)customers/profile/[id]/CustomerDetailModalClient.tsx`, `app/(app)/@modal/(.)inventory/vehicle/[id]/VehicleDetailModalClient.tsx` — ModalShell error pattern (omit children)
- `components/modal/ModalShell.tsx` — doc comment
- `modules/deals/ui/types.ts`, `modules/deals/ui/DetailPage.tsx`

**Security/QA (Step 4)**

- `modules/deals/tests/tenant-isolation.test.ts`, `rbac.test.ts`, `audit.test.ts`
- `modules/deals/tests/validation.test.ts`, `immutability-and-one-deal.test.ts` (new)
- `lib/api/rate-limit.test.ts`

---

## 11. QA Checklist — Deals Depth Sprint

### Tenant isolation & RBAC

- [x] All routes scoped by dealership_id from auth
- [x] Permission enforced on every route (deals.read/write, finance.read/write)
- [x] Tests: tenant isolation (404 cross-tenant) + RBAC (requirePermission)

### Regression

- [x] Calculations unit tests; deal transition unit tests
- [x] Integration tests for tenant/RBAC/audit/immutability (run with TEST_DATABASE_URL)

### PII

- [x] No PII in logs; money/ids only in audit payload
- [x] No SSN/DOB/income in API (per DMS rules)

### Pagination

- [x] List endpoints: deals, history, trade list, finance products — limit/offset, max limit in Zod

### Rate limiting

- [x] Deal mutation routes rate limited (deals_mutation 60/min)
- [x] Test: rate-limit abstraction returns false after 60

### Immutability

- [x] CONTRACTED → structural edits 409; notes-only and CONTRACTED → CANCELED allowed
- [x] Tests: immutability-and-one-deal.test.ts

---

## 12. Follow-ups

- Run full integration suite with `TEST_DATABASE_URL` and no `SKIP_INTEGRATION_TESTS` to confirm tenant-isolation, rbac, audit, immutability tests pass against a real DB.
- Optional: Add API-level test (e.g. supertest or fetch) for 429 on deal mutation overflow in a single test run (may require rate-limit reset or mock per test).
- Optional: Document `finance.read` / `finance.write` in platform/seed if not already assigned to roles per spec matrix.
