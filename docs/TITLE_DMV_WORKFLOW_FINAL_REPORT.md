# Title & DMV Workflow — Final Report

## 1. Repo inspection summary

- **modules/deals**: Deal lifecycle (DRAFT → CONTRACTED → CANCELED), delivery (deliveryStatus, deliveredAt), funding (DealFunding), deal db/service/history/fees/trades. No title or DMV entities.
- **modules/documents**: Deal document storage; no title-specific handling.
- **modules/finance-core**: LenderApplication, LenderStipulation, DealDocument, CreditApplication, compliance. No title/DMV.
- **modules/customers**: Customer CRUD, activity, timeline. No direct title integration.
- **modules/accounting**: Accounting core; no title integration.
- **Deal model**: Has status, deliveryStatus, deliveredAt, dealFundings; no DealTitle or DealDmvChecklistItem. GET deal includes customer, vehicle, dealFinance, dealFundings.

Conclusion: Title and DMV are net-new under deals (new models, db, service, API, UI).

---

## 2. STEP 1 — Spec

- **Created**: `docs/TITLE_DMV_WORKFLOW_SPEC.md`
- **Contents**: Architecture overview, data model (DealTitle 1:1 with Deal; DealDmvChecklistItem many per deal; TitleStatus enum), API endpoints, service layer plan, UI plan, RBAC matrix, audit events, acceptance criteria.

---

## 3. STEP 2 — Backend

### Schema (Prisma)

- **Enum**: `TitleStatus` (NOT_STARTED, TITLE_PENDING, TITLE_SENT, TITLE_RECEIVED, TITLE_COMPLETED, ISSUE_HOLD).
- **DealTitle**: id, dealershipId, dealId (unique), titleStatus, titleNumber?, lienholderName?, lienReleasedAt?, sentToDmvAt?, receivedFromDmvAt?, notes?, createdAt, updatedAt. Indexes: dealershipId, (dealershipId, titleStatus), (dealershipId, createdAt).
- **DealDmvChecklistItem**: id, dealershipId, dealId, label, completed (default false), completedAt?, createdAt. Indexes: dealershipId, (dealershipId, dealId).
- **Deal**: relation `dealTitle DealTitle?`, `dealDmvChecklistItems DealDmvChecklistItem[]`.
- **Dealership**: relations `dealTitles`, `dealDmvChecklistItems`.
- **Migration**: `prisma/migrations/20260308100000_title_dmv_workflow/migration.sql`.

### DB layer

- **modules/deals/db/title.ts**: createDealTitleRecord, getDealTitle, updateDealTitleStatus (partial update), listTitleQueue (deals with dealTitle and titleStatus != TITLE_COMPLETED; paginated).
- **modules/deals/db/dmv.ts**: listChecklistItems, createChecklistItem, createChecklistItems (bulk), getChecklistItemById, toggleChecklistItem.
- **modules/deals/db/index.ts**: Export title, dmv.

### Service layer

- **modules/deals/service/title.ts**: startTitleProcess (create DealTitle TITLE_PENDING, audit deal.title_started), markTitleSent, markTitleReceived, completeTitle, placeTitleOnHold, updateTitleStatus (generic PATCH), getDealTitle, listTitleQueue. Audit: deal.title_started, deal.title_sent, deal.title_received, deal.title_completed, deal.title_issue_hold.
- **modules/deals/service/dmv.ts**: createChecklistItemsForDeal (default or custom labels), toggleChecklistItem, getChecklistForDeal. Default labels: Buyer docs complete, Odometer disclosure signed, Insurance verified, Title application sent, Registration submitted, Lien release received.
- **modules/deals/service/index.ts**: Export title, dmv.

### API routes

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST   | /api/deals/[id]/title/start       | deals.write | Start title process |
| PATCH  | /api/deals/[id]/title/status       | deals.write | Update title status/fields |
| GET    | /api/deals/[id]/title              | deals.read  | Get title for deal |
| GET    | /api/deals/title                   | deals.read  | Title queue (paginated) |
| GET    | /api/deals/[id]/dmv-checklist     | deals.read  | List checklist items |
| POST   | /api/deals/[id]/dmv-checklist     | deals.write | Create checklist (default or custom) |
| PATCH  | /api/deals/dmv-checklist/[itemId]  | deals.write | Toggle item completed |

All routes: getAuthContext → guardPermission → validate (Zod) → service → jsonResponse. Queries scoped by ctx.dealershipId.

### Serialization and deal detail

- **getDealById**: Include dealTitle, dealDmvChecklistItems.
- **serializeDeal**: Optional dealTitle (all fields ISO dates / strings), dealDmvChecklistItems (id, dealId, label, completed, completedAt, createdAt).
- **types.ts**: DealDetail extended with dealTitle, dealDmvChecklistItems.

---

## 4. STEP 3 — Frontend

### Deal detail — tab "Title & DMV"

- **Component**: `modules/deals/ui/DealTitleDmvTab.tsx`.
- **TitleStatusCard**: Title status, title number, lienholder, sent to DMV, received from DMV. Buttons: Start title process, Mark sent to DMV, Mark title received, Complete title, Place on hold.
- **LienReleaseCard**: Lienholder name, lien released at (from DealTitle).
- **DmvChecklistCard**: Checklist with checkboxes; "Create checklist" seeds default items; toggle calls PATCH dmv-checklist/[itemId].
- **Title queue**: Link to /deals/title.
- **DetailPage**: New tab "Title & DMV" and TabsContent with DealTitleDmvTab (deal, dealId, onDealUpdated, canWrite).

### Title queue page

- **Route**: `/deals/title` → `app/(app)/deals/title/page.tsx` → `TitleQueuePage`.
- **Data**: GET /api/deals/title (paginated, limit 25).
- **Columns**: Customer, Vehicle, Deal date, Title status, Days since delivery, Assigned user (—), View.
- **UI**: PageShell, PageHeader, DMSCard, Table, Skeleton (loading), EmptyState, ErrorState, Pagination.

---

## 5. STEP 4 — Security & QA

### Tenant isolation

- All title and DMV reads/writes use dealershipId from auth context. No client-supplied dealership_id. getDealById, getDealTitle, getChecklistItemById, listTitleQueue are scoped by dealershipId. Cross-tenant id returns NOT_FOUND.

### RBAC

- Title start/update and checklist create/toggle: guardPermission(ctx, "deals.write").
- Title queue and GET title / GET checklist: guardPermission(ctx, "deals.read").

### State transitions

- startTitleProcess: deal must exist; no existing DealTitle (else CONFLICT).
- markTitleSent / markTitleReceived / completeTitle / placeTitleOnHold: DealTitle must exist.
- createChecklistItemsForDeal: deal must exist; no existing items for deal (else CONFLICT).
- toggleChecklistItem: item must exist and belong to dealership.

### Audit events

- deal.title_started, deal.title_sent, deal.title_received, deal.title_completed, deal.title_issue_hold with metadata (dealId, titleStatus). No PII.

### Tests added

- **modules/deals/tests/title-dmv.test.ts** (Jest, mocks only):
  - Title: NOT_FOUND when deal missing; create TITLE_PENDING and audit; CONFLICT when title exists; markTitleSent/completeTitle update and audit.
  - DMV: NOT_FOUND when deal missing; default labels when none provided; NOT_FOUND when item missing; toggleChecklistItem updates completed/completedAt.
- **Commands**: `npx jest modules/deals/tests/title-dmv.test.ts` — 9 tests passed.

---

## 6. Performance

- **No N+1**: listTitleQueue uses single findMany with include (customer, vehicle, dealTitle). Checklist list is single findMany by dealId.
- **Pagination**: listTitleQueue takes limit/offset; API uses parsePagination (default 25, max 100).
- **Indexes**: DealTitle(dealershipId), (dealershipId, titleStatus), (dealershipId, createdAt); DealDmvChecklistItem(dealershipId), (dealershipId, dealId).

---

## 7. Known risks and follow-up

- **Migration**: Apply `20260308100000_title_dmv_workflow` before using title/DMV in production or running integration tests that touch Deal/DealTitle/DealDmvChecklistItem.
- **Assigned user**: Title queue shows "—" for Assigned user; no assignment model yet. Can add dealTitle.assignedToUserId later.
- **Title number / lienholder**: Editable only via PATCH /api/deals/[id]/title/status. UI could add inline edit or a small form for these fields.
- **Invalid state transitions**: Service does not enforce a strict state machine (e.g. TITLE_SENT → TITLE_PENDING). Can add transition rules if needed.

---

## Files created/updated

**Created**

- `docs/TITLE_DMV_WORKFLOW_SPEC.md`
- `docs/TITLE_DMV_WORKFLOW_FINAL_REPORT.md`
- `apps/dealer/prisma/migrations/20260308100000_title_dmv_workflow/migration.sql`
- `apps/dealer/modules/deals/db/title.ts`
- `apps/dealer/modules/deals/db/dmv.ts`
- `apps/dealer/modules/deals/service/title.ts`
- `apps/dealer/modules/deals/service/dmv.ts`
- `apps/dealer/modules/deals/tests/title-dmv.test.ts`
- `apps/dealer/modules/deals/ui/DealTitleDmvTab.tsx`
- `apps/dealer/modules/deals/ui/TitleQueuePage.tsx`
- `apps/dealer/app/api/deals/[id]/title/route.ts`
- `apps/dealer/app/api/deals/[id]/title/start/route.ts`
- `apps/dealer/app/api/deals/[id]/title/status/route.ts`
- `apps/dealer/app/api/deals/title/route.ts`
- `apps/dealer/app/api/deals/[id]/dmv-checklist/route.ts`
- `apps/dealer/app/api/deals/dmv-checklist/[itemId]/route.ts`
- `apps/dealer/app/(app)/deals/title/page.tsx`

**Updated**

- `apps/dealer/prisma/schema.prisma` (TitleStatus enum, DealTitle, DealDmvChecklistItem, Deal relations, Dealership relations)
- `apps/dealer/modules/deals/db/deal.ts` (getDealById include dealTitle, dealDmvChecklistItems)
- `apps/dealer/modules/deals/db/index.ts` (export title, dmv)
- `apps/dealer/modules/deals/service/index.ts` (export title, dmv)
- `apps/dealer/app/api/deals/schemas.ts` (updateDealTitleStatusBodySchema, createDmvChecklistBodySchema, toggleDmvChecklistItemBodySchema)
- `apps/dealer/app/api/deals/serialize.ts` (dealTitle, dealDmvChecklistItems in serializeDeal)
- `apps/dealer/modules/deals/ui/types.ts` (DealDetail dealTitle, dealDmvChecklistItems)
- `apps/dealer/modules/deals/ui/DetailPage.tsx` (tab "Title & DMV", DealTitleDmvTab)
