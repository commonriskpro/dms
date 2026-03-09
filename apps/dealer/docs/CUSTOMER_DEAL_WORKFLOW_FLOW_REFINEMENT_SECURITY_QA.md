# Customer + Deal Workflow Flow Refinement — Security QA

**Sprint:** Customer + Deal Workflow Flow Refinement  
**Spec:** `CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md`  
**Scope:** Review touched customer/deal workflow surfaces for permission drift, signal/context leakage, summary exposure, action-link exposure, and notes/tasks/messages visibility.

---

## 1. Summary

| Check | Result |
|-------|--------|
| Permission/visibility drift | **OK:** New surfaces use existing permissions; no new data beyond what APIs already return for the current entity. |
| Signal/context leakage | **OK:** contextSignals and blockerSignals remain entity-scoped (Customer id / Deal id from route); no cross-entity or cross-tenant display. |
| Wrong customer/deal summary exposure | **OK:** Active deal/opportunity and progression strip use the page’s customerId/dealId only; APIs are tenant-scoped. |
| Context rail overexposure | **OK:** Rail still shows same Customer intelligence / Deal intelligence blocks; no new rail content or PII. |
| Unintended action-link exposure | **OK:** actionHref/actionLabel come from server (signal engine); NextActionZone and DealNextActionLine only render them. No user input in links. |
| Notes/tasks/messages visibility | **OK:** No new notes/tasks/messages surfaces; callbacks in NextActionZone are the same list already loaded for this customer with customers.read. |

**Verdict:** No security issues found. No code changes required.

---

## 2. Permission and Visibility

### Customer page

- **NextActionZone** receives `contextSignals` and `callbacks` from the parent. Those come from:
  - **contextSignals:** `fetchDomainSignals({ domain: "crm" })` and `toContextSignals(..., { entity: { entityType: "Customer", entityId: id } })`. The signals API is tenant-scoped and domain-gated (crm); entity filter restricts to the current customer. No new permission; same data already used by Customer intelligence block.
  - **callbacks:** `initialCallbacks?.data` from the customer detail route. The route uses `getSessionContextOrNull()` and `hasRead` (customers.read); callbacks are loaded via `callbacksService.listCallbacks(dealershipId, id, ...)`. So callbacks are only for the customer the user is viewing and only when they have customers.read. No new visibility.
- **canReadCrm:** When false, NextActionZone does not show “Open conversation” and uses `href="#"` for the callback CTA, so inbox is not exposed to users without crm.read.
- **ActiveOpportunityDealCard** fetches only when `canReadDeals` or `canReadCrm` is true. It calls:
  - `GET /api/deals?customerId=&limit=1`: protected by `guardPermission(ctx, "deals.read")`; list is scoped by `ctx.dealershipId` and optional `customerId` filter. Returns only deals for the current tenant.
  - `GET /api/crm/opportunities?customerId=&limit=1`: protected by `guardPermission(ctx, "crm.read")`; list is scoped by dealership and optional `customerId`. Returns only opportunities for the current tenant.
- **customerId** in both components is the page’s `id` (route param), i.e. the customer being viewed. It is not taken from client input (e.g. form or query). The same id is used for the customer detail load; there is no new path that could show another customer’s deal/opportunity.

Conclusion: **No permission or visibility drift.** New UI only shows data the user is already allowed to see for the current customer.

### Deal page

- **DealProgressStrip** and **DealNextActionLine** receive `deal`, `dealId`, and `blockerSignals` from DealDeskWorkspace. These are the same deal and signals already loaded for the current deal page (`id` from route). Deal data is from `getDealDeskData(dealershipId, dealId)`; signals are from `fetchSignalsByDomains` and filtered by `entityScope = { entityType: "Deal", entityId: id }`. No new data source or cross-deal exposure.
- **Blockers strip** is a restyle of the existing SignalContextBlock “Blockers”; same `blockerSignals` (warning/danger subset of contextSignals). No new permissions or entity scope.

Conclusion: **No permission or visibility drift on the deal page.**

---

## 3. Signal and Context Leakage

- **Customer:** contextSignals are filtered by `entityType: "Customer"` and `entityId: id` (page customer). NextActionZone and the existing Customer intelligence block both consume this same list. We do not pass signals for other customers or other entities. Risk line in NextActionZone is the first warning/danger from that same list.
- **Deal:** blockerSignals are derived from contextSignals scoped to `entityType: "Deal"`, `entityId: id`. DealProgressStrip and DealNextActionLine only use these and the current deal. No cross-deal or cross-tenant signals.

Conclusion: **No signal or context leakage.** All signals remain entity- and tenant-scoped.

---

## 4. Wrong Customer/Deal Summary Exposure

- **ActiveOpportunityDealCard** shows at most one deal and one opportunity. Both are fetched with the **page’s** `customerId`. The APIs enforce tenant (dealershipId from session) and return only that dealership’s deals/opportunities; the `customerId` query restricts to that customer. So we never show another customer’s deal as “active” for this page, and we cannot show another tenant’s data.
- **DealProgressStrip** labels (Funding / Title / Delivery) are derived from the **current** deal’s `dealFundings`, `dealTitle`, `deliveryStatus` and from blockerSignals for that deal. Links are to `/deals/${dealId}` (same deal) and `/queues/title`. No summary for a different deal is shown.

Conclusion: **No wrong customer or deal summary exposure.**

---

## 5. Context Rail Overexposure

- Customer page rail still contains: Customer intelligence (SignalContextBlock), NextActionsCard, TasksCard, TagsStatusCard, Intelligence timeline. No new block was added; no new PII or notes/tasks/messages were added to the rail. Active deal/opportunity is in the **main** column, not the rail, and shows only link + label + status (no sensitive fields).
- Deal page rail is unchanged (Deal intelligence, Finance terms, Save, Timeline). Progression strip and next-action line are in the **main** area below blockers, not in the rail.

Conclusion: **No context rail overexposure.**

---

## 6. Action-Link Exposure

- **NextActionZone** primary and risk links come from:
  - **Signals:** `actionHref` and `actionLabel` are from the signal engine (backend). They are set in code to paths such as `/customers`, `/crm/opportunities`, `/deals`, `/queues/title`, etc. They are not built from user input or from unsanitized data. External links (http) are only used when the server provided such an href.
  - **Callback:** When the primary is “Callback due…”, href is either `/crm/inbox?customerId=${encodeURIComponent(customerId)}` (when canReadCrm) or `#`. customerId is the page’s customer id (route param). No open redirect or injection.
- **DealNextActionLine** shows the first blocker’s `actionLabel` and `actionHref` from the same server-controlled signal set. No user input in links.
- **DealProgressStrip** links are fixed: `/deals/${dealId}` (current deal) and `/queues/title`. dealId is the page’s deal. Safe.
- **ActiveOpportunityDealCard** links are `/deals/${primary.id}` and `/crm/opportunities/${primary.id}` where `primary` is the deal or opportunity returned by the tenant-scoped APIs. Ids are server-returned; no client-supplied ids in the path.

Conclusion: **No unintended action-link exposure.** All links are either server-defined (signals) or built from current page entity ids and tenant-scoped API responses.

---

## 7. Notes / Tasks / Messages Visibility

- No new surfaces that display notes, tasks, or message content were added. The **next-action** zone uses:
  - **Callbacks:** Only “Callback due &lt;date&gt;” (or “today”) and a link. No callback reason or other detail is shown in the zone. Full callback list remains in CallbacksCard with existing permission (customers.read and callbacks loaded for this customer).
- Tasks and notes are still only in TasksCard and TimelineCard / Add Note as before. Intelligence timeline still shows only signal lifecycle events (existing behavior).

Conclusion: **No new notes/tasks/messages visibility issues.**

---

## 8. Recommendations

- **Ongoing:** Keep signal `actionHref`/`actionLabel` server-only (no user or client input when creating/updating signals). Existing signal engine already does this.
- **Ongoing:** When adding new workflow links that include ids (e.g. deal id, opportunity id), continue to use ids that come from tenant-scoped API responses or route params for the current page, not from arbitrary client input.

No changes required for this sprint.
