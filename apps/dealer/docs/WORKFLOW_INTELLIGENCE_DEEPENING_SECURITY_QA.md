# Workflow Intelligence Deepening — Security QA

**Sprint:** Workflow Intelligence Surface Deepening  
**Spec:** `WORKFLOW_INTELLIGENCE_DEEPENING_SPEC.md`  
**Scope:** Review only the new workflow intelligence surfaces. No redesign; no backend/route/RBAC changes unless a real exposure is found.

---

## 1. Summary

| Check | Result |
|-------|--------|
| Entity/domain scoping | Verified: all surfaces scope by current page entity or row entity. |
| Cross-tenant signal leakage | None: signals API and all data sources are tenant-scoped by session. |
| Permission leakage | None: signal API enforces domain permissions; pages are behind existing route/UI gating. |
| Wrong-row / wrong-entity blocker rendering | None: queue rows key by row.id; detail pages key by route entity id. |
| Inbox alerts scope | Verified: only the selected customer’s signals (entity filter). |
| Explanation text exposure | Verified: content is backend-defined; UI does not inject or reveal hidden data. |
| Next-action links / CTAs | Verified: same-app routes; destination routes enforce auth/permission. |
| New surface bypassing UI gating | None: no new routes or bypass; surfaces are additive on already-gated pages. |

**Verdict:** No security bugs found. No code changes applied.

---

## 2. Data Source and Tenant Isolation

- **Signals API** (`GET /api/intelligence/signals`): Uses `getAuthContext(request)` and `listSignalsForDealership(ctx.dealershipId, ...)`. All returned signals are for the authenticated user’s dealership. No client-supplied `dealershipId`; tenant is from session only.
- **Signal engine** (`listSignalsForDealership`): Calls `requireTenantActiveForRead(dealershipId)` and `signalsDb.listSignals({ dealershipId, ... })`. DB queries are scoped by that `dealershipId`.
- **Domain permissions**: `guardDomainPermission(ctx, query.domain)` ensures the user has at least one of the allowed permissions for the requested domain (e.g. `deals.read` for deals/operations). So a user cannot fetch CRM signals without CRM/customers read.

Conclusion: **No cross-tenant signal leakage.** All signal data is for the current tenant and permitted domains.

---

## 3. DealWorkspace Blockers Strip

- **Entity scope:** `entityScope = { entityType: "Deal", entityId: id }` where `id` is the deal id from the route (page props). `headerSignals` and `contextSignals` are produced by `toHeaderSignals` / `toContextSignals` with `entity: entityScope`. `blockerSignals` is a severity filter of `contextSignals`. So only signals for the current deal are shown.
- **Page access:** The deal workspace is rendered when the user is on a deal detail page. That page and its data (e.g. `/api/deals/[id]/desk`) are already protected by `guardPermission(ctx, "deals.read")` / `deals.write` and `ctx.dealershipId`. The same deal `id` is used for entity scoping.
- **No new bypass:** The blockers strip is additive UI on an already-gated deal page. It does not expose deals the user could not already open.

Conclusion: **Correct entity scoping; no permission or tenant leakage.**

---

## 4. Deal / Vehicle / Customer Timeline Explanations

- **Deal timeline:** Uses `toTimelineSignalEvents(surfaceSignals, { entity: entityScope })` with `entityScope = { entityType: "Deal", entityId: id }`. Only events for the current deal are shown. Explanation is derived from `event.signal` (same signal already scoped to this deal).
- **Vehicle timeline:** Same pattern with `entityScope = { entityType: "Vehicle", entityId: vehicleId }` (from route). Vehicle page and vehicle API are tenant- and permission-gated.
- **Customer timeline:** Same with `entityScope = { entityType: "Customer", entityId: id }` (from route). Customer page and customer API are tenant- and permission-gated.

Conclusion: **Timeline explanations are scoped to the entity of the current page; no wrong-entity display.**

---

## 5. Queue Row Alerts Column

- **Queue data source:** Rows come from tenant-scoped queue APIs: `/api/deals/funding`, `/api/deals/delivery`, `/api/deals/title`. Each uses `getAuthContext`, `guardPermission(ctx, "deals.read")`, and `ctx.dealershipId` for the list. So `data[].id` are deal ids belonging to the current tenant.
- **Signals source:** `fetchSignalsByDomains(["deals", "operations"])` (or equivalent) returns only signals for the current tenant (see §2).
- **Grouping:** `signalsByDealId = groupSignalsByEntityId(allQueueSignals, data.map((r) => r.id))`. Only signals whose `entityId` is in the current page’s deal id list are kept. Per row we render alerts for `signalsByDealId.get(row.id)`.
- **Wrong-row risk:** Each row shows only signals where `signal.entityId === row.id`. No use of row index or other row data to key signals. So we do not show another deal’s signals on a row.

Conclusion: **Correct row–entity binding; no wrong-row or cross-tenant blocker rendering.**

---

## 6. Inbox Customer Alerts Block

- **Conversation list:** `selectedCustomerId` comes from the inbox conversation list, which is loaded from `/api/crm/inbox/conversations`. That API is tenant-scoped (only conversations for the current dealership). So we only ever have customer ids from the current tenant.
- **Signals fetch:** `fetchSignalsByDomains(["crm"], { limit: 30 })` is subject to signals API domain permission (crm/customers read) and tenant isolation. No client-supplied entity in the request; we get a tenant-scoped CRM signal set.
- **Scoping:** `customerContextSignals = toContextSignals(inboxSignals, { entity: { entityType: "Customer", entityId: selectedCustomerId } })`. `filterSignalsForEntity` keeps only items whose `entityType`/`entityId` match the selected customer. So we only show signals for the selected customer.

Conclusion: **Inbox alerts show only the selected customer’s relevant signals; no other customer’s data.**

---

## 7. Shared Explanation Adapters and Primitives

- **toSignalExplanation:** Takes a `SignalSurfaceItem` (title, description, code, actionLabel, actionHref). Uses these plus static code-based fallbacks (`CODE_WHY_IT_MATTERS`, `CODE_NEXT_ACTION`). It does not read from any other store, URL, or user input. So it does not introduce new data or expose hidden data; it only reformats what the backend put on the signal.
- **SignalExplanationItem / SignalBlockerInline:** Presentational. They render the props they receive (explanation shape or items). No data fetching or permission logic. No bypass of gating.

**Explanation text and hidden data:** The text the user sees (problem, whyItMatters, nextAction label) comes from (a) signal fields set by the backend when the signal was created, or (b) fixed strings keyed by signal code. The UI does not add PII or other sensitive data. Per project rules, signal/audit content must not include SSN, DOB, income, etc.; that is a backend/signal-engine responsibility. The new UI does not increase exposure.

Conclusion: **Explanation text does not expose hidden data; adapters/primitives do not introduce new data or bypass gating.**

---

## 8. Next-Action Links and CTAs

- **Source of links:** Either `item.actionHref` / `item.actionLabel` from the signal (backend-set) or the static `CODE_NEXT_ACTION[item.code]` fallbacks in the explanation adapter.
- **Fallback hrefs:** All fallbacks are same-app relative paths: `#funding`, `#delivery`, `#recon`, `#photos`, `#tasks`, `/queues/title`, `/inventory`. No external URLs or raw cross-tenant ids.
- **Backend-set actionHref:** When the signal engine sets `actionHref` (e.g. `/deals/{id}`), that id is for a deal (or other entity) created in the same tenant. The link leads to a normal app route. That route runs `getAuthContext` and `guardPermission` (or equivalent). So the user does not gain access to a resource they could not already access; they are just deep-linked to a page that will enforce permission and tenant checks again.

Conclusion: **Next-action links and CTAs respect existing permissions and routes; no new bypass.**

---

## 9. UI Gating and New Surfaces

- **Deal workspace:** Rendered only when the user is on a deal detail page. That page is behind app routing and deal API permissions. The blockers strip does not create a new entry point or skip any check.
- **Vehicle/Customer detail:** Same: timeline and explanations are on pages that are already protected. No new route or gate bypass.
- **Queue pages:** Already require `deals.read` (and are behind app routing). The Alerts column is an extra column on the same table; it does not expose data the user could not already see (they already see the same deals; we only attach signal counts/severity to those deals).
- **Inbox:** Rendered in the CRM inbox, which is behind CRM/customers access. The customer alerts block only appears when a conversation is selected and uses that customer’s id for filtering. No new route or permission bypass.

Conclusion: **No new surface bypasses current UI gating.**

---

## 10. Optional Hardening (Not Required)

- **Backend/signal engine:** Ensure signal `title`, `description`, `actionLabel`, and `actionHref` are never populated with PII or cross-tenant identifiers. This is already required by project rules; the new UI does not change that.
- **Code fallbacks:** The static maps in `explanation-adapters.ts` contain only generic, non-sensitive copy and same-app paths. No change needed.

---

## 11. Conclusion

All reviewed workflow intelligence surfaces use tenant-scoped and permission-checked data, scope correctly by entity (page or row), and do not introduce new routes or permission bypasses. Explanation text and next-action links are either backend-defined or fixed strings and do not expose hidden data. **No security bugs found; no code changes made.**
