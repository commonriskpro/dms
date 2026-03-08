# Customer + Deal Workflow Flow Refinement — Performance Pass (Step 5)

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md`  
**Scope:** Audit customer/deal page render cost, rerender churn from new blocker/next-action/context surfaces, timeline/context weight, and fetch churn introduced by workflow refinements.

---

## 1. Summary

| Area | Finding |
|------|--------|
| Customer page render cost | New components (NextActionZone, ActiveOpportunityDealCard) are lightweight; NextActionZone uses useMemo for derived state; ActiveOpportunityDealCard defers to two small parallel fetches. No blocking on initial paint. |
| Deal page render cost | DealProgressStrip and DealNextActionLine use memoized inputs and small useMemo; no new heavy work. Blockers strip is a styled wrapper around existing SignalContextBlock. |
| Rerender churn | No new context or global state. One minor note: customer page passes `initialCallbacks?.data ?? []` to NextActionZone, which creates a new array reference on every parent rerender; NextActionZone’s useMemo recomputes. Cost is O(n) on small lists; acceptable. Optional: memoize callbacks in parent to avoid redundant recomputation. |
| Timeline/context | No changes to timeline or context rail logic; same ActivityTimeline, SignalContextBlock, and adapters. Remains lightweight. |
| Fetch churn | Customer page: two new client fetches (deals, opportunities) in ActiveOpportunityDealCard, once per mount and when customerId/permissions change. No polling; mounted guard prevents setState after unmount. Deal page: no new fetches. |

**Verdict:** No performance issues requiring code changes. Optional micro-optimization noted below.

---

## 2. Customer Page

### 2.1 Render cost after top-of-page refinements

- **NextActionZone:** Renders below JourneyBar. It receives `contextSignals`, `callbacks`, `customerId`, `canReadCrm`. It uses two `useMemo` hooks to compute `primary` and `riskLine` from those props. Work is one `.find()` on signals and one `.filter()` + `.sort()` on callbacks (small arrays, typically &lt; 25). No DOM-heavy work; output is a short strip with one or two lines and links. Does not block initial paint because it is rendered with the same tree as the rest of the page; no synchronous data load.
- **ActiveOpportunityDealCard:** Renders inside CustomerDetailContent (main column). It shows a Skeleton until its fetches complete. Fetches run in `useEffect` after mount; they do not block the first paint. The card is one of several in the stack; other cards (Overview, Timeline, Callbacks) render with existing data. So top-of-page refinements do not add blocking render work.

### 2.2 Rerender churn

- **NextActionZone** depends on `contextSignals`, `callbacks`, `customerId`, `canReadCrm`. `contextSignals` is memoized in DetailPage with `[surfaceSignals, entityScope, headerSignals]`; it is stable until signals or id change. `callbacks` is passed as `initialCallbacks?.data ?? []`. When `initialCallbacks` is defined, `initialCallbacks.data` is the same array reference until the page is refetched (e.g. after a mutation); but the expression `?? []` is evaluated every render, and when `initialCallbacks` is undefined we pass a new `[]` every time. So on parent rerenders we can pass a new array reference, causing NextActionZone’s `useMemo` for `primary` to run again. The computation is cheap (small arrays). No cascading rerenders; no new context or state that would force other trees to rerender.
- **ActiveOpportunityDealCard** has local state (`deal`, `opportunity`). When the fetches resolve, only this card’s state updates and only this card (and its subtree) rerenders. Parent and siblings are not forced to rerender by the new workflow components.

**Optional micro-optimization:** In DetailPage, memoize the callbacks array, e.g. `const callbacksForZone = React.useMemo(() => initialCallbacks?.data ?? [], [initialCallbacks?.data]);` and pass `callbacksForZone` to NextActionZone. This keeps the same reference when `initialCallbacks` has not been replaced, reducing unnecessary useMemo recomputation. Not required for acceptable performance.

### 2.3 Fetch churn

- **ActiveOpportunityDealCard** runs two `useEffect` hooks:
  - Deals: `GET /api/deals?customerId=&limit=1&sortBy=createdAt&sortOrder=desc`. Runs when `[customerId, canReadDeals]` change. If `canReadDeals` is false, no fetch.
  - Opportunities: `GET /api/crm/opportunities?customerId=&limit=1&sortBy=updatedAt&sortOrder=desc`. Runs when `[customerId, canReadCrm]` change. If `canReadCrm` is false, no fetch.
- Each effect runs once per relevant dependency change (e.g. navigating to a different customer). No polling, no refetch on every parent rerender. Both effects use a `mounted` guard so `setState` is not called after unmount. No duplicate or overlapping fetches for the same customer.
- Customer page already had one signals fetch (`fetchDomainSignals`) in DetailPage; no additional page-level fetches were added. The only new network calls are these two in the card.

**Conclusion:** Two small, parallel, one-shot fetches per customer view when the user has both permissions. No extra fetch churn beyond that.

---

## 3. Deal Page

### 3.1 Render cost after refinements

- **Blockers strip:** Same content as before (SignalContextBlock “Blockers” with `blockerSignals`); only the wrapper div was added for styling. `blockerSignals` is already memoized in DealDeskWorkspace from `contextSignals`. No new heavy computation.
- **DealProgressStrip:** Receives `deal`, `dealId`, `blockerSignals`. Uses three `useMemo` calls to compute funding/title/delivery state (each is a small filter/check on deal and signals). Renders a single row of labels and two links. Lightweight.
- **DealNextActionLine:** Reads `blockerSignals[0]` and optionally renders one line. No useMemo; cost is trivial. No new fetches.

### 3.2 Rerender churn

- DealDeskWorkspace already memoizes `headerSignals`, `contextSignals`, `blockerSignals`, `timelineSignalEvents`. The new components receive `deal`, `dealId`, and `blockerSignals`. When `desk.deal` or signals change (e.g. after save or signal refetch), those memoized values update and the new components rerender once. No new context or state that would cause broader rerender storms.

### 3.3 Fetch churn

- No new `useEffect` or API calls were added to the deal page. Deal data still comes from initial server load (`getDealDeskData`); signals still come from the existing `fetchSignalsByDomains` effect. Progression strip and next-action line use that existing data only.

**Conclusion:** Deal page refinements add no extra fetch churn; render cost of the new strips is minimal.

---

## 4. Timeline and Context

- Timeline and context rail logic were **not changed**. The same `ActivityTimeline`, `SignalContextBlock`, `toTimelineSignalEvents`, and `toContextSignals` are used with the same limits (e.g. max 8 timeline events, max 5 context signals). No new timeline or context components; no new adapters or heavier computation in this sprint.
- **Conclusion:** Timeline and context remain as before; no additional weight from this refinement.

---

## 5. Recommendations

1. **No required changes.** Current implementation is acceptable from a performance standpoint.
2. **Optional:** Memoize the callbacks array passed to NextActionZone in the customer DetailPage (see §2.2) to avoid redundant useMemo runs on parent rerenders when callbacks data is unchanged.
3. **Ongoing:** If the customer page later adds more client fetches or large lists above the fold, consider lazy-loading or deferring the ActiveOpportunityDealCard fetches (e.g. after first paint); not needed for the current two-request, limit=1 pattern.
