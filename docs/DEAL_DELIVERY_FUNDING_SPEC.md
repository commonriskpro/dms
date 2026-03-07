# Deal Delivery & Funding Pipeline — Spec

## 1. Architecture overview

The DMS deal lifecycle ends at **CONTRACTED**. This spec adds the final stage: **delivery** and **funding**.

- **Delivery**: After contract, the deal moves to “ready for delivery” and then “delivered” (vehicle handed off, delivery date recorded).
- **Funding**: Deal-level funding tracks lender payouts. A deal can have a **DealFunding** record (optionally linked to a **LenderApplication**). Status flows: NONE → PENDING → APPROVED → FUNDED (or FAILED).

**Layers**: API routes → deals service (delivery.ts, funding.ts) → deals db + DealFunding table. All queries scoped by `ctx.dealershipId`. Cross-tenant access returns NOT_FOUND.

**Integration**: Existing **Deal** (status CONTRACTED), **LenderApplication** (finance-core), **FinanceSubmission** (lender-integration) remain. Delivery and funding are additive: new fields on Deal, new DealFunding table.

---

## 2. Data model

### Deal (extended)

| Field            | Type            | Notes |
|------------------|-----------------|-------|
| `deliveryStatus` | DeliveryStatus? | Null = not in delivery workflow |
| `deliveredAt`    | DateTime?       | Set when marked DELIVERED |

### Enums

**DeliveryStatus**

- `READY_FOR_DELIVERY`
- `DELIVERED`
- `CANCELLED`

**DealFundingStatus**

- `NONE`
- `PENDING`
- `APPROVED`
- `FUNDED`
- `FAILED`

### DealFunding (new table)

| Field                | Type             | Notes |
|----------------------|------------------|-------|
| id                   | UUID             | PK |
| dealershipId         | UUID             | FK Dealership, tenant scope |
| dealId               | UUID             | FK Deal |
| lenderApplicationId  | UUID?            | FK LenderApplication (optional) |
| fundingStatus        | DealFundingStatus| default PENDING |
| fundingAmountCents   | BigInt           | |
| fundingDate          | DateTime?        | |
| notes                | String?          | |
| createdAt            | DateTime         | |
| updatedAt            | DateTime         | |

Indexes: `dealershipId`, `dealershipId + dealId`, `dealershipId + fundingStatus`, `dealershipId + createdAt`.

---

## 3. API endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST   | /api/deals/[id]/delivery/ready   | deals.write              | Mark deal ready for delivery |
| POST   | /api/deals/[id]/delivery/complete| deals.write              | Mark deal delivered |
| POST   | /api/deals/[id]/funding          | finance.submissions.write| Create funding record |
| PATCH  | /api/deals/[id]/funding/status   | finance.submissions.write| Update funding status / mark funded |

All routes: `getAuthContext` → `guardPermission` → validate → service → `jsonResponse`. Queries scoped by `ctx.dealershipId`.

---

## 4. Service layer plan

### modules/deals/service/delivery.ts

- **markDealReadyForDelivery(dealershipId, userId, dealId, meta)**  
  - Require deal status CONTRACTED, `deliveryStatus` null or CANCELLED.  
  - Set `deliveryStatus = READY_FOR_DELIVERY`.  
  - Audit `deal.delivery_ready`.

- **markDealDelivered(dealershipId, userId, dealId, deliveredAt?, meta)**  
  - Require `deliveryStatus === READY_FOR_DELIVERY`.  
  - Set `deliveryStatus = DELIVERED`, `deliveredAt = deliveredAt ?? now()`.  
  - Audit `deal.delivered`.

### modules/deals/service/funding.ts

- **createFundingRecord(dealershipId, userId, dealId, input, meta)**  
  - Input: lenderApplicationId?, fundingAmountCents, notes?.  
  - Deal must exist and be tenant-scoped. Create DealFunding (status PENDING).  
  - Audit `deal.funding_created`.

- **updateFundingStatus(dealershipId, userId, dealId, fundingId, input, meta)**  
  - Input: fundingStatus, fundingAmountCents?, fundingDate?, notes?.  
  - Validate enum and date format. Update DealFunding.  
  - If fundingStatus === FUNDED, set fundingDate if not provided.  
  - Audit `deal.funded` when status becomes FUNDED.

- **markDealFunded(dealershipId, userId, dealId, fundingId, fundingDate?, meta)**  
  - Convenience: set DealFunding status to FUNDED and fundingDate.

---

## 5. UI plan

### Deal detail — new tab “Delivery & Funding”

- **DeliveryStatusCard**: delivery state, delivery date, “Mark ready” / “Mark delivered” (guarded by deals.write).
- **FundingStatusCard**: lender (from LenderApplication if linked), funding status, amount, date; “Create funding” / “Mark funded” (guarded by finance.submissions.write).
- **StipulationChecklist**: link to existing stipulations (LenderStipulation / FinanceStipulation) for the deal’s applications.

### Delivery queue — /deals/delivery

- Page listing deals with `deliveryStatus = READY_FOR_DELIVERY`.
- Columns: customer, vehicle, contract date, delivery status, salesperson.
- Server-first; pagination (parsePagination); loading / empty / error states.

### Funding queue — /deals/funding

- Page listing deals with funding in PENDING (or similar) or deals CONTRACTED with DealFunding status PENDING.
- Columns: customer, vehicle, lender, funding status, amount, contract date.
- Server-first; pagination; loading / empty / error states.

All UI: shadcn/ui only; CSS vars for colors; no MUI/Chakra.

---

## 6. RBAC matrix

| Action              | Permission                |
|---------------------|---------------------------|
| Delivery (ready/delivered) | deals.write        |
| Create/update funding      | finance.submissions.write |
| View delivery/funding (deal detail) | deals.read or finance.submissions.read |

---

## 7. Audit events

| Event                 | When |
|-----------------------|------|
| deal.delivery_ready   | markDealReadyForDelivery |
| deal.delivered        | markDealDelivered |
| deal.funding_created | createFundingRecord |
| deal.funded           | updateFundingStatus → FUNDED (or markDealFunded) |

Metadata: dealId, deliveryStatus/deliveredAt or fundingId/fundingStatus; no PII.

---

## 8. Acceptance criteria

- [ ] Deal with status CONTRACTED can be marked “ready for delivery” and then “delivered” with optional date.
- [ ] DealFunding record can be created for a deal (optional lenderApplicationId); status can be updated to PENDING/APPROVED/FUNDED/FAILED; FUNDED sets fundingDate.
- [ ] All API routes enforce RBAC and tenant isolation; cross-tenant returns 404.
- [ ] Audit events emitted for delivery and funding actions.
- [ ] Deal detail shows “Delivery & Funding” tab with DeliveryStatusCard, FundingStatusCard, StipulationChecklist.
- [ ] /deals/delivery and /deals/funding queue pages exist with correct columns and pagination.
- [ ] No N+1 on queue list endpoints; pagination default 25, max 100.
