# Deal Delivery & Funding Pipeline — Final Report

## 1. Repo inspection summary

- **modules/deals**: Deal lifecycle (DRAFT → … → CONTRACTED → CANCELED), deal db/service, history, fees, trades. No delivery or funding workflow.
- **modules/finance-core**: LenderApplication, LenderStipulation, DealDocument, CreditApplication, compliance. LenderApplication is per-deal and suitable for linking to DealFunding.
- **modules/finance-shell**: DealFinance, CONTRACTED lock. Consumes `deal.status_changed`.
- **modules/lender-integration**: FinanceSubmission with `fundingStatus` (PENDING/FUNDED/CANCELED) and `fundedAt` — lender-level funding, not deal-level delivery/funding pipeline.
- **Deal model**: Had `status`, no `deliveryStatus` or `deliveredAt`. No `DealFunding` table.
- **API**: No `/api/deals/[id]/delivery/*` or `/api/deals/[id]/funding` routes.

---

## 2. STEP 1 — Spec

- **Created**: `docs/DEAL_DELIVERY_FUNDING_SPEC.md`
- **Contents**: Architecture overview, data model (Deal extended with deliveryStatus/deliveredAt; DealFunding table; enums DeliveryStatus, DealFundingStatus), API endpoints, service layer plan, UI plan, RBAC matrix, audit events, acceptance criteria.

---

## 3. STEP 2 — Backend

### Schema (Prisma)

- **Enums**: `DeliveryStatus` (READY_FOR_DELIVERY, DELIVERED, CANCELLED), `DealFundingStatus` (NONE, PENDING, APPROVED, FUNDED, FAILED).
- **Deal**: `deliveryStatus DeliveryStatus?`, `deliveredAt DateTime?`; index `(dealershipId, deliveryStatus)`.
- **DealFunding**: id, dealershipId, dealId, lenderApplicationId?, fundingStatus, fundingAmountCents, fundingDate?, notes, createdAt, updatedAt; FKs to Dealership, Deal, LenderApplication (optional). Indexes: dealershipId, (dealershipId, dealId), (dealershipId, fundingStatus), (dealershipId, createdAt).
- **Migration**: `prisma/migrations/20260308000000_deal_delivery_funding/migration.sql` (run with `npx prisma migrate deploy` or `prisma migrate dev` when DATABASE_URL is set).

### DB layer

- **modules/deals/db/deal.ts**: `updateDealDelivery()`, `listDealsForDeliveryQueue()`, `listDealsForFundingQueue()`.
- **modules/deals/db/funding.ts**: `createDealFunding()`, `getDealFundingById()`, `getDealFundingByDealAndId()`, `listDealFundingsByDealId()`, `updateDealFunding()`.
- **modules/deals/db/index.ts**: Export `funding`.

### Service layer

- **modules/deals/service/delivery.ts**: `markDealReadyForDelivery()`, `markDealDelivered()` — state checks, audit `deal.delivery_ready`, `deal.delivered`.
- **modules/deals/service/funding.ts**: `createFundingRecord()`, `updateFundingStatus()`, `markDealFunded()` — audit `deal.funding_created`, `deal.funded`.
- **modules/deals/service/deal.ts**: `listDeliveryQueue()`, `listFundingQueue()` (delegate to db).

### API routes

| Method | Path | Permission | Handler |
|--------|------|------------|---------|
| POST | /api/deals/[id]/delivery/ready | deals.write | deliveryService.markDealReadyForDelivery |
| POST | /api/deals/[id]/delivery/complete | deals.write | deliveryService.markDealDelivered |
| POST | /api/deals/[id]/funding | finance.submissions.write | fundingService.createFundingRecord |
| PATCH | /api/deals/[id]/funding/status | finance.submissions.write | fundingService.updateFundingStatus |
| GET | /api/deals/delivery | deals.read | dealService.listDeliveryQueue |
| GET | /api/deals/funding | deals.read | dealService.listFundingQueue |

- All routes: `getAuthContext` → `guardPermission` → validate (Zod) → service → `jsonResponse`. Queries scoped by `ctx.dealershipId`.
- **Schemas** (in `app/api/deals/schemas.ts`): `markDealDeliveredBodySchema`, `createDealFundingBodySchema`, `updateDealFundingStatusBodySchema`.

### Serialization

- **app/api/deals/serialize.ts**: `serializeDeal()` extended with `deliveryStatus`, `deliveredAt`, `dealFundings` (with `serializeDealFundingItem()`). `getDealById` include extended with `dealFundings` and `lenderApplication`.

---

## 4. STEP 3 — Frontend

### Deal detail — Delivery & Funding tab

- **Location**: `modules/deals/ui/DealDeliveryFundingTab.tsx`.
- **Components**: Delivery card (status, deliveredAt, “Mark ready for delivery” / “Mark delivered”), Funding card (list of funding records, status/amount/date, “Mark funded”, “Create funding” form with amount + notes), Stipulations card (link to Lenders/Credit), Queues card (links to Delivery queue and Funding queue).
- **DetailPage**: New tab trigger “Delivery & Funding” and `TabsContent` rendering `DealDeliveryFundingTab` with deal, onDealUpdated, canWriteDeals, canWriteFunding.

### Queue pages

- **/deals/delivery**: `app/(app)/deals/delivery/page.tsx` → `DeliveryQueuePage`. Columns: Customer, Vehicle, Contract date, Delivery status, Salesperson, View. Uses `GET /api/deals/delivery` with pagination (limit 25).
- **/deals/funding**: `app/(app)/deals/funding/page.tsx` → `FundingQueuePage`. Columns: Customer, Vehicle, Lender, Funding status, Amount, Contract date, View. Uses `GET /api/deals/funding` with pagination (limit 25).
- **UI**: PageShell, PageHeader, DMSCard, Table, loading (Skeleton), empty (EmptyState), error (ErrorState), Pagination. shadcn/ui only; CSS vars.

### Types

- **modules/deals/ui/types.ts**: `DeliveryStatus`, `DealFundingDetail`, `DealDetail` extended with `deliveryStatus?`, `deliveredAt?`, `dealFundings?`.

---

## 5. STEP 4 — Security & QA

### Tenant isolation

- All deal/funding reads and writes use `dealershipId` from auth context. No client-supplied `dealership_id`.
- Cross-tenant deal id returns NOT_FOUND from service (getDealById / getDealFundingByDealAndId).

### RBAC

- Delivery actions: `guardPermission(ctx, "deals.write")`.
- Funding create/update: `guardPermission(ctx, "finance.submissions.write")`.
- Queue lists: `guardPermission(ctx, "deals.read")`.

### State transition validation

- **Delivery**: Ready only when deal `status === CONTRACTED` and `deliveryStatus` is null or CANCELLED. Delivered only when `deliveryStatus === READY_FOR_DELIVERY`.
- **Funding**: Create only when deal exists and is tenant-scoped. Update/mark funded on existing DealFunding.

### Audit events

- `deal.delivery_ready`, `deal.delivered`, `deal.funding_created`, `deal.funded` with metadata (dealId, deliveryStatus/fundingStatus, etc.). No PII in metadata.

### Tests added

- **modules/deals/tests/delivery-funding.test.ts** (Jest, mocks only, no DB):
  - Delivery: CONTRACTED required for ready; READY_FOR_DELIVERY required for delivered; correct audit calls.
  - Funding: NOT_FOUND when deal missing; create creates PENDING and audits; update to FUNDED emits deal.funded audit.
- **Existing tenant-isolation.test.ts**: Uses Prisma against a real DB. After applying the new migration (`20260308000000_deal_delivery_funding`), re-run; the test’s `prisma.deal.upsert` create payload does not need to include the new optional fields (Prisma will omit or use NULL). If the migration has not been applied, that test will fail with “column delivery_status does not exist” until the migration is run.

### Commands run

- `npx prisma generate` — success.
- `npx prisma migrate dev --name deal_delivery_funding --create-only` — skipped (no DATABASE_URL in env); migration file created manually.
- `npx jest modules/deals/tests/delivery-funding.test.ts` — 7 tests passed.

---

## 6. Performance

- **No N+1**: Delivery queue uses a single `findMany` with customer/vehicle select. Funding queue uses a single `findMany` with customer, vehicle, and `dealFundings` include.
- **Pagination**: `listDealsForDeliveryQueue` and `listDealsForFundingQueue` take `limit` and `offset`; API uses `parsePagination` (default 25, max 100).
- **Indexes**: `Deal(dealershipId, deliveryStatus)`, `DealFunding(dealershipId, dealId)`, `DealFunding(dealershipId, fundingStatus)`, `DealFunding(dealershipId, createdAt)`.

---

## 7. Known risks and follow-up

- **Migration**: Apply `20260308000000_deal_delivery_funding` before running integration tests or using delivery/funding in production. Until then, `modules/deals/tests/tenant-isolation.test.ts` may fail with “column delivery_status does not exist.”
- **Salesperson**: Delivery queue shows “—” for Salesperson; Deal model has no salesperson/createdBy. Can be added later (e.g. deal.updatedBy or link to opportunity owner).
- **Stipulations**: Stipulation checklist on the tab is a pointer to Lenders/Credit tabs; full in-tab stipulation list could be added later.
- **LenderApplication link**: Create funding form does not yet offer a lender application picker; `lenderApplicationId` can be set via API. UI can be extended to select from deal’s lender applications when creating a funding record.

---

## Files created/updated

**Created**

- `docs/DEAL_DELIVERY_FUNDING_SPEC.md`
- `docs/DEAL_DELIVERY_FUNDING_FINAL_REPORT.md`
- `apps/dealer/prisma/migrations/20260308000000_deal_delivery_funding/migration.sql`
- `apps/dealer/modules/deals/db/funding.ts`
- `apps/dealer/modules/deals/service/delivery.ts`
- `apps/dealer/modules/deals/service/funding.ts`
- `apps/dealer/modules/deals/tests/delivery-funding.test.ts`
- `apps/dealer/modules/deals/ui/DealDeliveryFundingTab.tsx`
- `apps/dealer/modules/deals/ui/DeliveryQueuePage.tsx`
- `apps/dealer/modules/deals/ui/FundingQueuePage.tsx`
- `apps/dealer/app/api/deals/[id]/delivery/ready/route.ts`
- `apps/dealer/app/api/deals/[id]/delivery/complete/route.ts`
- `apps/dealer/app/api/deals/[id]/funding/route.ts`
- `apps/dealer/app/api/deals/[id]/funding/status/route.ts`
- `apps/dealer/app/api/deals/delivery/route.ts`
- `apps/dealer/app/api/deals/funding/route.ts`
- `apps/dealer/app/(app)/deals/delivery/page.tsx`
- `apps/dealer/app/(app)/deals/funding/page.tsx`

**Updated**

- `apps/dealer/prisma/schema.prisma` (DeliveryStatus, DealFundingStatus, Deal fields, DealFunding model, Dealership dealFundings, LenderApplication dealFundings)
- `apps/dealer/modules/deals/db/deal.ts` (updateDealDelivery, listDealsForDeliveryQueue, listDealsForFundingQueue, getDealById include dealFundings)
- `apps/dealer/modules/deals/db/index.ts` (export funding)
- `apps/dealer/modules/deals/service/deal.ts` (listDeliveryQueue, listFundingQueue)
- `apps/dealer/modules/deals/service/index.ts` (export delivery, funding)
- `apps/dealer/app/api/deals/schemas.ts` (delivery/funding schemas)
- `apps/dealer/app/api/deals/serialize.ts` (deliveryStatus, deliveredAt, dealFundings)
- `apps/dealer/modules/deals/ui/types.ts` (DeliveryStatus, DealFundingDetail, DealDetail extensions)
- `apps/dealer/modules/deals/ui/DetailPage.tsx` (Delivery & Funding tab and content)
