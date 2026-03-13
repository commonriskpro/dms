# Deal Sales Flow Execution Plan

## Goal
Turn the sell-vehicle rewrite into an implementation-ready plan using the current dealer codebase.

This plan assumes:
- one shared `Deal` model remains the transactional spine
- no immediate schema rewrite is required to launch the UI flow change
- cash and finance deals diverge in the UI, not in separate core entities

---

## Current File Map

### Deal entry and workspace
- [CreateDealPage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/CreateDealPage.tsx)
- [page.tsx](/Users/saturno/Downloads/dms/apps/dealer/app/(app)/deals/new/page.tsx)
- [page.tsx](/Users/saturno/Downloads/dms/apps/dealer/app/(app)/@modal/(.)deals/new/page.tsx)
- [DealDeskWorkspace.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealDeskWorkspace.tsx)
- [page.tsx](/Users/saturno/Downloads/dms/apps/dealer/app/(app)/deals/[id]/page.tsx)

### Shared deal desk cards
- [DealHeader.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealHeader.tsx)
- [DealTotalsCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealTotalsCard.tsx)
- [FeesCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/FeesCard.tsx)
- [TradeCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/TradeCard.tsx)
- [CustomerCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/CustomerCard.tsx)
- [VehicleCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/VehicleCard.tsx)
- [FinanceTermsCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/FinanceTermsCard.tsx)
- [ProductsCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/ProductsCard.tsx)

### Downstream operational tabs
- [DealFinanceTab.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/finance-shell/ui/DealFinanceTab.tsx)
- [DealDeliveryFundingTab.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/DealDeliveryFundingTab.tsx)
- [DealTitleDmvTab.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/DealTitleDmvTab.tsx)

### Current progression / signals
- [DealProgressStrip.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealProgressStrip.tsx)
- [DealNextActionLine.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealNextActionLine.tsx)

### Queues
- [DeliveryQueuePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/DeliveryQueuePage.tsx)
- [FundingQueuePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/FundingQueuePage.tsx)
- [TitleQueuePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/TitleQueuePage.tsx)

### Deal APIs
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/desk/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/finance/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/delivery/ready/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/delivery/complete/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/funding/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/funding/status/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/title/start/route.ts)
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/[id]/title/status/route.ts)

---

## Core Rewrite Decision

The workflow should branch by `payment mode` as early as possible.

The existing backend already has the field:
- `DealFinance.financingMode`

So the UI should use this as the source of truth for:
- progress strip
- visible sections
- next action guidance
- queue routing relevance

No separate `CashDeal` or `FinanceDeal` entity is needed.

---

## Target UI Structure

### New Deal
Purpose:
- bind customer + vehicle
- choose payment mode
- create the initial deal shell

Target layout:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Create deal                                                   close         │
│ Customer + vehicle + deal type                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Left: customer + vehicle selection      Right: payment mode                  │
│                                                                              │
│ Customer                                                               Cash  │
│ Vehicle                                                                Fin.  │
│                                                                          │   │
│ Compact summary                                                         │   │
├──────────────────────────────────────────────────────────────────────────────┤
│ cancel                                             create deal               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Payment mode must be chosen here, not buried later in finance.

### Deal Workspace
Purpose:
- shared deal shell
- shared desk math
- mode-aware execution steps
- shared closeout

Target shell:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Deal workspace                                              close / actions │
│ Customer | Vehicle | Mode | Current posture                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ progress strip (mode-aware)                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ left: active step workspace              right: blockers / next action       │
│                                                                              │
│ shared desk section                                                         │
│ mode-specific execution section                                             │
│ shared closeout section                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Mode-Aware Progression

### Cash
```text
Customer -> Vehicle -> Desk -> Payment -> Delivery -> Title -> Closed
```

### Finance
```text
Customer -> Vehicle -> Desk -> Finance -> Approval -> Delivery -> Funding -> Title -> Closed
```

### Required change
[DealProgressStrip.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealProgressStrip.tsx) currently treats:
- funding
- title
- delivery

as universal. That needs to change.

New behavior:
- derive `mode` from `dealFinance.financingMode`
- if `mode = CASH`
  - hide `Funding`
  - show `Payment`
- if `mode = FINANCE`
  - show `Finance`, `Approval`, `Funding`

---

## File-by-File Execution

## Phase 1: Branch Early in New Deal

### 1. CreateDealPage
File:
- [CreateDealPage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/CreateDealPage.tsx)

Changes:
- add explicit `Payment mode` control
- options:
  - `Cash`
  - `Finance`
- make it visually primary in the create surface
- keep create screen focused on:
  - customer
  - vehicle
  - payment mode

Behavior:
- on create, persist the selected mode into the finance/deal initialization path

### 2. Deals create APIs / schema
Files:
- [route.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/route.ts)
- [schemas.ts](/Users/saturno/Downloads/dms/apps/dealer/app/api/deals/schemas.ts)

Changes:
- ensure create payload accepts the deal mode cleanly
- initialize shared deal and finance shell consistently

Expected backend behavior:
- cash deal still gets a finance shell record if needed for consistency, but marked with `financingMode = CASH`
- finance deal gets `financingMode = FINANCE`

---

## Phase 2: Reframe the Deal Workspace

### 3. DealDeskWorkspace
File:
- [DealDeskWorkspace.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealDeskWorkspace.tsx)

Changes:
- split the page into three conceptual zones:
  - shared deal start
  - mode-specific execution
  - shared closeout
- keep blocker and next-action rail persistent
- make the active mode visually obvious in the header

New section order:
1. shared summary/header
2. progress strip
3. shared desk section
4. mode-specific section
5. shared closeout section

### 4. DealHeader
File:
- [DealHeader.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealHeader.tsx)

Changes:
- show:
  - customer
  - vehicle
  - payment mode
  - deal status
  - current execution stage

This header should make it obvious whether the user is in:
- a cash deal
- a finance deal

### 5. DealProgressStrip
File:
- [DealProgressStrip.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealProgressStrip.tsx)

Changes:
- replace the current universal `Funding / Title / Delivery` strip
- create mode-aware progression states
- compute:
  - cash path states
  - finance path states

Do not show irrelevant steps for the wrong deal type.

---

## Phase 3: Shared Desk vs Execution Branch

### 6. Shared desk cards
Files:
- [DealTotalsCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealTotalsCard.tsx)
- [FeesCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/FeesCard.tsx)
- [TradeCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/TradeCard.tsx)
- [CustomerCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/CustomerCard.tsx)
- [VehicleCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/VehicleCard.tsx)

Changes:
- keep these in the shared desk section
- make them mode-neutral
- avoid mixing lender/funding detail into them

### 7. Finance-only cards
Files:
- [FinanceTermsCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/FinanceTermsCard.tsx)
- [ProductsCard.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/ProductsCard.tsx)
- [DealFinanceTab.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/finance-shell/ui/DealFinanceTab.tsx)

Changes:
- for finance deals:
  - visible as the primary execution section
- for cash deals:
  - hidden
  - or collapsed behind a `Not required for cash` explanation if needed for audit clarity

This is one of the biggest coherence fixes.

### 8. Cash execution section
Primary host:
- [DealDeskWorkspace.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealDeskWorkspace.tsx)

Changes:
- add a cash-only execution surface after shared desk math
- responsibilities:
  - payment received / deposit confirmation
  - contract complete
  - ready for delivery

This can start as a compact card group using existing status data instead of a new backend model.

---

## Phase 4: Shared Closeout, Mode-Aware Downstream

### 9. Delivery / Funding section split
File:
- [DealDeliveryFundingTab.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/DealDeliveryFundingTab.tsx)

Changes:
- split the logic visually:
  - delivery is shared
  - funding is finance-only

Cash behavior:
- render delivery section
- hide or demote funding section

Finance behavior:
- render both delivery and funding
- funding remains required and visible

### 10. Title / DMV section
File:
- [DealTitleDmvTab.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/DealTitleDmvTab.tsx)

Changes:
- keep title shared
- add mode-aware guidance:
  - cash: title follows delivery
  - finance: title follows funding

This is mostly a messaging and progression fix, not a data-model rewrite.

---

## Phase 5: Queue Deep-Link Coherence

### 11. Queue row routing
Files:
- [DeliveryQueuePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/DeliveryQueuePage.tsx)
- [FundingQueuePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/FundingQueuePage.tsx)
- [TitleQueuePage.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/TitleQueuePage.tsx)

Changes:
- clicking a queue row should open the canonical deal workspace with a focused section:
  - delivery -> `/deals/[id]?focus=delivery`
  - funding -> `/deals/[id]?focus=funding`
  - title -> `/deals/[id]?focus=title`

### 12. Deal workspace focus handling
File:
- [page.tsx](/Users/saturno/Downloads/dms/apps/dealer/app/(app)/deals/[id]/page.tsx)
- [DealDeskWorkspace.tsx](/Users/saturno/Downloads/dms/apps/dealer/modules/deals/ui/desk/DealDeskWorkspace.tsx)

Changes:
- accept `focus` query param
- scroll/select the correct section
- use this for queue handoff continuity

---

## API / Data Impact

### No required schema rewrite for first pass
The first pass can be done with current data:
- `Deal`
- `DealFinance.financingMode`
- `DealFunding`
- `DealTitle`
- `deliveryStatus`

### Optional later additions
Only add these if the UI needs stronger explicitness later:
- payment milestone fields for cash deals
- explicit approval/stipulation summary status on `Deal`
- denormalized deal workflow stage field for easier UI derivation

These are not required to start the rewrite.

---

## Visual UI Mock

### New Deal
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Create deal                                                      [close]     │
│ Start the sale by pairing a buyer, a vehicle, and the deal type.            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Customer                                Vehicle                              │
│ [ Select customer              ]        [ Select vehicle              ]       │
│                                                                              │
│ Deal mode                                                                    │
│ [ Cash ]   [ Finance ]                                                       │
│                                                                              │
│ Summary                                                                      │
│ John Smith • 2020 Camry • Finance                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ cancel                                             create deal               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Deal Workspace: Cash
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Deal workspace                                            Mode: Cash         │
│ John Smith • 2020 Camry • Contracted                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Customer] [Vehicle] [Desk] [Payment] [Delivery] [Title] [Closed]           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Shared desk                                                                 │
│ Sale price • fees • tax • trade • down payment                              │
│                                                                              │
│ Cash execution                                                              │
│ Payment received • contract complete • ready for delivery                    │
│                                                                              │
│ Shared closeout                                                             │
│ Delivery                                                                    │
│ Title / DMV                                                                 │
│                                                                              │
│ Rail: next action • blockers • activity                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Deal Workspace: Finance
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Deal workspace                                            Mode: Finance      │
│ John Smith • 2020 Camry • Approval pending                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Customer] [Vehicle] [Desk] [Finance] [Approval] [Delivery] [Funding] [Title]│
├──────────────────────────────────────────────────────────────────────────────┤
│ Shared desk                                                                 │
│ Sale price • fees • tax • trade • down payment                              │
│                                                                              │
│ Finance execution                                                           │
│ Terms • products • lender • submissions • stipulations                      │
│                                                                              │
│ Shared closeout                                                             │
│ Delivery                                                                    │
│ Funding                                                                     │
│ Title / DMV                                                                 │
│                                                                              │
│ Rail: next action • blockers • lender posture                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Suggested Build Order

### Slice 1
- `CreateDealPage`
- deal create schema/route
- `DealHeader`
- `DealProgressStrip`

### Slice 2
- `DealDeskWorkspace`
- shared desk vs mode-specific section split
- hide finance surfaces for cash deals

### Slice 3
- `DealDeliveryFundingTab`
- `DealTitleDmvTab`
- focus-query deep links from queues

### Slice 4
- queue page polish and continuity
- progress-strip refinement
- optional status denormalization only if needed

---

## Success Criteria

- users can identify deal type immediately
- cash deals no longer feel forced through finance operations
- finance deals no longer bury approval/funding behind generic sections
- delivery and title feel like shared closeout stages
- queue pages re-enter the same canonical deal workspace with the right section focused
