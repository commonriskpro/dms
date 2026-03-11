# Customer + Deal Workflow Flow Refinement — Step 3 (Frontend) Report

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md`  
**Scope:** SLICE B (customer workflow), SLICE C (deal workflow). SLICE D/E: no new shared components; timeline/context already use existing explanation adapters.

---

## 1. Summary

- **Customer page:** Next-action zone added below JourneyBar; one primary CTA (signal with action, earliest callback due, or Open conversation) plus optional risk line. Active deal/opportunity card replaces placeholder DealsSummaryCard; single primary item from existing GET /api/deals and GET /api/crm/opportunities (limit=1). Left column order: Overview → Active deal or opportunity → Timeline → Callbacks.
- **Deal page (DealDeskWorkspace):** Blockers strip styled as priority (border/background); funding/title/delivery progression strip and next-action line added below blockers, derived from existing deal payload and signals. No new backend or persistent state.
- **Shared patterns:** No new shared component extracted; NextActionZone (customer) and DealNextActionLine (deal) follow same compact “Next: [action]” pattern and existing tokens.
- **Timeline/context:** Existing toSignalExplanation and SignalExplanationItem remain in use; no code changes for Slice E.

---

## 2. Changed Files

### Customer workflow (SLICE B)

| File | Change |
|------|--------|
| `modules/customers/ui/components/NextActionZone.tsx` | **New.** Compact next-action zone: primary from first context signal with action, or earliest scheduled callback, or Open conversation; optional risk line from first warning/danger signal. |
| `modules/customers/ui/components/ActiveOpportunityDealCard.tsx` | **New.** Fetches GET /api/deals?customerId=&limit=1 and GET /api/crm/opportunities?customerId=&limit=1; shows one primary (deal preferred, then OPEN opportunity). Respects canReadDeals / canReadCrm. |
| `modules/customers/ui/CustomerDetailContent.tsx` | Replaced DealsSummaryCard with ActiveOpportunityDealCard; reordered left column to Overview → ActiveOpportunityDealCard → Timeline → Callbacks. Added canReadDeals, canReadCrm props. |
| `modules/customers/ui/DetailPage.tsx` | Insert NextActionZone between JourneyBar and CustomerDetailContent; pass contextSignals, initialCallbacks.data, id, canReadCrm; pass canReadDeals, canReadCrm to CustomerDetailContent. |
| `app/(app)/@modal/(.)customers/profile/[id]/CustomerDetailModalClient.tsx` | Pass canReadDeals, canReadCrm to CustomerDetailContent so ActiveOpportunityDealCard works in modal. |

### Deal workflow (SLICE C)

| File | Change |
|------|--------|
| `modules/deals/ui/desk/DealProgressStrip.tsx` | **New.** Funding | Title | Delivery state derived from deal (dealFundings, dealTitle, deliveryStatus) and blockerSignals (code includes funding/title/delivery). Links to deal tab and title queue. |
| `modules/deals/ui/desk/DealNextActionLine.tsx` | **New.** “Next: [action]” from first blocker’s actionLabel/actionHref, or “No blocking actions.” |
| `modules/deals/ui/desk/DealDeskWorkspace.tsx` | Blockers strip wrapped in priority styling (border-[var(--warning)]/50, bg-[var(--warning-surface)]/30); add DealProgressStrip and DealNextActionLine below blockers. |

### Unchanged / not added

- **DealsSummaryCard** (`modules/customers/ui/components/DealsSummaryCard.tsx`): File remains; no longer used in CustomerDetailContent. Can be removed in a later cleanup if desired.
- **Deal modal (DealDetailPage):** Blocker strip not added to modal; spec allowed deferral.
- **SLICE D:** No shared NextActionStrip component; both pages use compact, token-consistent patterns.
- **SLICE E:** Timeline already uses toSignalExplanation and SignalExplanationItem; no changes.

---

## 3. Data and Permissions

- **Active deal/opportunity:** Existing reads only. Deals: GET /api/deals?customerId=&limit=1&sortBy=createdAt&sortOrder=desc; client treats first non-CANCELED as primary. Opportunities: GET /api/crm/opportunities?customerId=&limit=1&sortBy=updatedAt&sortOrder=desc; first OPEN as primary. One primary item only; no new collection or mini-index.
- **Progression (deal):** Derived from desk.deal (deliveryStatus, deliveredAt, dealFundings, dealTitle) and blockerSignals (codes containing funding, title, delivery). No new API or persistent state.
- **Permissions:** NextActionZone uses existing contextSignals and callbacks (already permission-scoped). ActiveOpportunityDealCard checks canReadDeals and canReadCrm; modal and page pass these from hasPermission("deals.read") and hasPermission("crm.read").

---

## 4. Tests

- **Customer UI:** `modules/customers/ui/__tests__/customers-ui.test.tsx`, `modules/customers/ui/__tests__/lead-action-strip.test.tsx` — both pass.
- **Full dealer suite:** Not fully re-run in this step; customer-related tests passed. Any unrelated failures are outside this refinement scope.

---

## 5. Design Lock

- No page architecture rewrite; no new tabs or routes.
- Existing ui-system and tokens only; no giant banners.
- Workflow clarity over decoration; compact and operational.
