# Title & DMV Workflow — Spec

## 1. Architecture overview

The DMS supports the full deal lifecycle through delivery and funding. This spec adds **title processing** and **DMV compliance** for sold vehicles after funding.

- **DealTitle**: One record per deal (1:1). Tracks title status, title number, lienholder, DMV send/receive dates, lien release.
- **DealDmvChecklistItem**: Many per deal. Post-sale compliance checklist (buyer docs, odometer, insurance, title application, registration, lien release, etc.).

**Layers**: API → deals service (title.ts, dmv.ts) → deals db (title.ts, dmv.ts). All queries scoped by `ctx.dealershipId`. Cross-tenant → NOT_FOUND.

**Integration**: Deal (CONTRACTED, optional deliveryStatus/deliveredAt), DealFunding, DealDocument remain. Title and DMV are additive.

---

## 2. Data model

### DealTitle (new, 1:1 with Deal)

| Field             | Type     | Notes |
|-------------------|----------|-------|
| id                | UUID     | PK |
| dealId            | UUID     | FK Deal, unique |
| dealershipId      | UUID     | FK Dealership |
| titleStatus       | TitleStatus | default NOT_STARTED |
| titleNumber       | String?  | |
| lienholderName    | String?  | |
| lienReleasedAt    | DateTime? | |
| sentToDmvAt       | DateTime? | |
| receivedFromDmvAt | DateTime? | |
| notes             | String?  | |
| createdAt         | DateTime | |
| updatedAt         | DateTime | |

**TitleStatus enum**: NOT_STARTED, TITLE_PENDING, TITLE_SENT, TITLE_RECEIVED, TITLE_COMPLETED, ISSUE_HOLD.

Indexes: dealershipId, (dealershipId, titleStatus), (dealershipId, createdAt).

### DealDmvChecklistItem (new)

| Field        | Type     | Notes |
|--------------|----------|-------|
| id           | UUID     | PK |
| dealId       | UUID     | FK Deal |
| dealershipId | UUID     | FK Dealership |
| label        | String   | e.g. "Buyer docs complete" |
| completed    | Boolean  | default false |
| completedAt  | DateTime? | |
| createdAt    | DateTime | |

Indexes: dealershipId, (dealershipId, dealId).

Example labels: Buyer docs complete, Odometer disclosure signed, Insurance verified, Title application sent, Registration submitted, Lien release received.

---

## 3. API endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST   | /api/deals/[id]/title/start     | deals.write | Start title process (create DealTitle NOT_STARTED → TITLE_PENDING) |
| PATCH  | /api/deals/[id]/title/status    | deals.write | Update title status and optional fields |
| GET    | /api/deals/[id]/title           | deals.read  | Get title record for deal |
| GET    | /api/deals/title                | deals.read  | Title queue (deals where titleStatus != TITLE_COMPLETED), paginated |
| GET    | /api/deals/[id]/dmv-checklist   | deals.read  | List checklist items for deal |
| POST   | /api/deals/[id]/dmv-checklist   | deals.write | Create checklist item(s) or seed default set |
| PATCH  | /api/deals/dmv-checklist/[itemId] | deals.write | Toggle item completed / update |

All scoped by ctx.dealershipId.

---

## 4. Service layer plan

### modules/deals/service/title.ts

- **startTitleProcess(dealershipId, userId, dealId, meta)** — Ensure deal exists and is tenant-scoped. Create DealTitle with titleStatus TITLE_PENDING. Audit deal.title_started.
- **markTitleSent(dealershipId, userId, dealId, sentToDmvAt?, meta)** — Require DealTitle; set titleStatus TITLE_SENT, sentToDmvAt. Audit deal.title_sent.
- **markTitleReceived(dealershipId, userId, dealId, receivedFromDmvAt?, meta)** — Set titleStatus TITLE_RECEIVED, receivedFromDmvAt. Audit deal.title_received.
- **completeTitle(dealershipId, userId, dealId, meta)** — Set titleStatus TITLE_COMPLETED. Audit deal.title_completed.
- **placeTitleOnHold(dealershipId, userId, dealId, notes?, meta)** — Set titleStatus ISSUE_HOLD, notes. Audit deal.title_issue_hold.
- **updateTitleStatus(dealershipId, userId, dealId, payload, meta)** — Generic PATCH: status + optional titleNumber, lienholderName, lienReleasedAt, sentToDmvAt, receivedFromDmvAt, notes.

### modules/deals/service/dmv.ts

- **createChecklistItemsForDeal(dealershipId, userId, dealId, labels?, meta)** — Create default or custom checklist items. If labels omitted, use default set.
- **toggleChecklistItem(dealershipId, userId, itemId, completed, meta)** — Toggle item; set completedAt when completed.
- **getChecklistForDeal(dealershipId, dealId)** — List items for deal.

### modules/deals/db/title.ts

- createDealTitleRecord, getDealTitle, updateDealTitleStatus, listTitleQueue (paginated).

### modules/deals/db/dmv.ts

- listChecklistItems, createChecklistItem, toggleChecklistItem (get by id + dealershipId).

---

## 5. UI plan

### Deal detail — tab "Title & DMV"

- **TitleStatusCard**: title status, title number, lienholder, sent to DMV date, received from DMV date. Buttons: Start title process, Mark sent to DMV, Mark title received, Complete title, Place on hold.
- **LienReleaseCard**: lienholder name, lien released at (from DealTitle).
- **DmvChecklistCard**: Checklist with toggles; display required post-sale items.

### Title queue — /deals/title

- Page listing deals where DealTitle exists and titleStatus != TITLE_COMPLETED (or no DealTitle but deal CONTRACTED/delivered). Columns: customer, vehicle, deal date, title status, days since delivery, assigned user (— if not implemented). Pagination default 25.

Server-first where possible; shadcn/ui; loading / empty / error states.

---

## 6. RBAC matrix

| Action           | Permission  |
|------------------|-------------|
| Title start/update | deals.write |
| Checklist create/toggle | deals.write |
| Title queue / GET title / GET checklist | deals.read |

---

## 7. Audit events

| Event                | When |
|----------------------|------|
| deal.title_started   | startTitleProcess |
| deal.title_sent      | markTitleSent |
| deal.title_received  | markTitleReceived |
| deal.title_completed | completeTitle |
| deal.title_issue_hold| placeTitleOnHold |

Metadata: dealId, titleStatus; no PII.

---

## 8. Acceptance criteria

- [ ] Deal can have one DealTitle; start title process creates it with TITLE_PENDING.
- [ ] Title status can transition: TITLE_PENDING → TITLE_SENT → TITLE_RECEIVED → TITLE_COMPLETED; or ISSUE_HOLD.
- [ ] DMV checklist items can be created for a deal and toggled (completed/completedAt).
- [ ] GET /api/deals/title returns paginated queue (titleStatus != TITLE_COMPLETED).
- [ ] All routes enforce RBAC and tenant isolation.
- [ ] Deal detail has "Title & DMV" tab with TitleStatusCard, DmvChecklistCard, LienReleaseCard.
- [ ] /deals/title page exists with required columns and pagination.
- [ ] No N+1; indexes on dealershipId and titleStatus.
