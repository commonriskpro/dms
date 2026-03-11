# Customer + Deal Workflow Flow Refinement — Spec

**Sprint:** Customer + Deal Workflow Flow Refinement  
**Step:** Architect (Step 1)  
**Goal:** Refine the workflow on Customer and Deal pages so they behave like guided operational workspaces instead of information dumps. No architecture rewrite; workflow clarity and stronger page flow only.

---

## 0. Current State Snapshot

### Customer page (`customers/[id]`)

- **Route:** `apps/dealer/app/(app)/customers/profile/[id]/page.tsx` → `CustomerDetailPage` (`modules/customers/ui/DetailPage.tsx`).
- **Layout:** `PageShell` → `CustomerHeader` → `JourneyBarWidget` or `RoadToSale` → `CustomerDetailContent`.
- **CustomerHeader:** Name, status badge, subtitle (created date), breadcrumbs, meta (primary phone, primary email), actions (SignalHeaderBadgeGroup + Edit/Delete).
- **CustomerDetailContent:** Two-column grid (main + 280px rail).
  - **Left (main):** CustomerOverviewCard → TimelineCard → CallbacksCard → DealsSummaryCard.
  - **Right (rail):** SignalContextBlock "Customer intelligence" → NextActionsCard → TasksCard → TagsStatusCard → ActivityTimeline "Intelligence timeline".
- **Signals:** `fetchDomainSignals({ domain: "crm" })`; header badges (max 3), context block (max 5, suppress header keys), timeline events (max 8).
- **Gaps:** No dedicated top-of-page next-action zone; next actions live only in rail. DealsSummaryCard is placeholder ("No deals yet."). No explicit "active opportunity" or "follow-up risk" surface. Timeline and callbacks are separate cards; relationship to "recent activity" is implicit. LeadActionStrip exists but is not rendered on the page.

### Deal page — primary (`deals/[id]`)

- **Route:** `apps/dealer/app/(app)/deals/[id]/page.tsx` → `DealDeskWorkspace` (`modules/deals/ui/desk/DealDeskWorkspace.tsx`).
- **Layout:** DealHeader → (optional) Blockers strip → 3-column grid.
- **DealHeader:** Breadcrumb, deal label (stock#/id), status badge, next-status buttons, SignalHeaderBadgeGroup (max 3).
- **Blockers:** `SignalContextBlock` "Blockers" with warning/danger signals only, max 3, below header when present.
- **Columns:** (1) CustomerCard, TradeCard, Notes. (2) VehicleCard, Selling price, FeesCard, ProductsCard, DealTotalsCard. (3) SignalContextBlock "Deal intelligence", FinanceTermsCard, Save, ActivityTimeline "Intelligence timeline".
- **Signals:** `fetchSignalsByDomains(["deals", "operations"])`; header, context, blockers (filtered from context), timeline.
- **Gaps:** No explicit "funding / title / delivery" progression strip; section order is by card placement, not a stated priority. Next-action cues come only from signal action links inside blocks. Rail has no dedicated "next action" area.

### Deal page — modal (tabbed)

- **Route:** `@modal/(.)deals/[id]` → `DealDetailPage` (`modules/deals/ui/DetailPage.tsx`).
- **Layout:** EntityHeader → locked banner (if CONTRACTED) → DealWorkspace(main = Tabs, rail = Totals card + DealProfitCard).
- **Tabs (order):** Overview, Fees, Trade, Status & History, Delivery & Funding, Title & DMV, Documents, Finance, Lenders, Credit, Compliance, Totals.
- **Gaps:** No blocker strip; no signals on this view. Section order is tab order; funding/title/delivery are separate tabs, not a single progression.

### Shared components

- **SignalContextBlock:** Title, subtitle "Prioritized by severity and recency", list (maxVisible), empty state. Used for "Customer intelligence", "Deal intelligence", "Blockers".
- **SignalBlockerInline:** Compact inline severity + count (e.g. "1 issue"). Used on DeliveryQueuePage, FundingQueuePage, TitleQueuePage per row.
- **NextActionsCard (customer):** Open Conversation, Call, Text, Send email, Schedule, Add task, Disposition. No prioritization or "recommended" next step.

---

## 1. Customer Workflow Goals

### What the customer page should answer immediately

1. **Who is this?** Name, status/stage, primary contact (phone/email).
2. **Where are they in the journey?** Stage (LEAD → QUALIFIED → NEGOTIATING → SOLD/INACTIVE); last activity.
3. **Is there an active opportunity or deal?** One clear link or summary (e.g. "Active deal — Vehicle X" or "No active deal").
4. **What is the follow-up risk?** Overdue tasks, missed callbacks, uncontacted lead too long, stale opportunity — surfaced as signals or a compact risk line.
5. **What should I do next?** One primary next action (or short list) visible near the top, not buried in the rail.

### What belongs where

| Zone | Contents |
|------|----------|
| **Header** | Name, status, primary contact, created/last activity, stage; signal badges (max 3); Edit/Delete. No long lists. |
| **Next-action / follow-up zone** | Compact strip or card directly below header (or immediately after JourneyBar): recommended next action(s)—e.g. "Callback due today", "Schedule appointment", "Open conversation"—with one primary CTA. Optionally 1–2 follow-up risks (overdue, stale) with link to task/callback/opportunity. |
| **Overview** | Identity, stage, lead source, phones/emails, last activity. Keep current CustomerOverviewCard purpose. |
| **Active opportunity / deal** | Single card or row: "Active deal" with link to deal (if customer has current deal) or "Active opportunity" link; or "No active opportunity" when none. Replace or extend placeholder DealsSummaryCard. |
| **Timeline** | Chronological activity: notes, calls, callbacks, appointments, messages. Keep TimelineCard; ensure it is clearly "activity" not mixed with intelligence-only events. |
| **Tasks / callbacks / messages** | Grouped so user can see "what’s due" and "what’s scheduled" without scanning multiple cards. Current: CallbacksCard + TasksCard in different places (main vs rail). Refinement: clearer grouping and order (e.g. callbacks + tasks together as "Follow-up" or keep callbacks on main, tasks on rail, but ensure order follows page flow rules below). |
| **Notes / files** | Notes in TimelineCard (add note) or separate Notes area if it exists; files only if in scope. Current: notes via TimelineCard and Add Note dialog. |
| **Context rail** | Customer intelligence (signals), Next actions (buttons), Tasks, Tags/Status. Intelligence timeline can stay in rail or move after main timeline for "signal lifecycle" clarity. |

### How active opportunity/deal should be surfaced

- **Preferred:** One card or row in the main column (e.g. after Overview or after next-action zone) titled "Active opportunity" or "Active deal" with: link to deal/opportunity, vehicle or opportunity name, status. If none: "No active opportunity" and optional CTA "Create opportunity" or "Link to deal" when applicable.
- **Data (strict):** Derive from **existing reads plus signals** first. Do not add new persistent workflow state for this sprint. If a helper/serializer addition is needed, return **one primary active item only** (best/current deal or opportunity), not a new collection. This sprint needs workflow clarity, not a new mini-index on the customer page.

### What "follow-up risk" looks like on the page

- **Signals:** Existing CRM-domain signals (e.g. overdue task, missed callback, uncontacted lead) already appear in header badges and "Customer intelligence" block. Keep them; ensure they are phrased as risks and have actions where applicable.
- **Top-of-page:** Next-action zone may include one line for "Risk: …" (e.g. "Overdue callback") with link to callback or task, when such a signal or callback/task data exists. Prefer deriving from existing signals or callback/task list; no new risk engine.

---

## 2. Deal Workflow Goals

### What the deal page should answer immediately

1. **What deal is this?** Customer name, vehicle (stock#), status.
2. **What is blocking progress?** Blockers strip (funding, title, docs, conditions) visible at top.
3. **What is the funding / title / delivery state?** Clear progression: e.g. Funding → Title → Delivery with completed vs incomplete (or link to queue).
4. **What should I do next?** One primary next action (e.g. "Submit funding", "Complete title packet", "Schedule delivery") near top or in a dedicated cue area.
5. **Where do I work?** Section priority is obvious: core structure first, then customer/vehicle/trade/products, then funding/title/delivery, then docs/finance.

### Where blockers belong

- **Primary deal page (DealDeskWorkspace):** Blockers in a **strip directly below the header**, before the main columns. Existing "Blockers" SignalContextBlock (warning/danger, max 3) satisfies this; refinement = ensure it is always in that position and visually part of the "attention hierarchy" (e.g. border/background so it reads as "blockers first").
- **Modal deal (DealDetailPage):** If the modal is used from queues or for quick review, add a **compact blocker strip** below EntityHeader when deal has warning/danger signals (same adapter as desk; optional for consistency). If modal is rarely used for workflow, blocker strip can be deferred.

### How funding / title / delivery progression should be shown

- **Option A (desk):** Add a single **progress strip** or **mini summary** below blockers: three segments or labels (Funding | Title | Delivery) with state (e.g. "Done" / "Pending" / "1 issue") and optional link to queue or tab. Data: **derive from existing deal fields + signals only** (e.g. signal codes funding_delay, title_backlog; deal status/fields). Do not add new persistent workflow state.
- **Option B (desk):** Keep current column layout; add **section-level cues** next to "FinanceTerms", "Title", "Delivery" (e.g. SignalBlockerInline or "1 funding issue" with link). Progression is implied by section order.
- **Spec choice:** Prefer Option A if the strip can be implemented with existing data (deal + signals); otherwise Option B. No new backend state or APIs for progression unless derivation is impossible.

### Primary next-action area

- **Placement:** Directly under blockers (or under progression strip if present). Compact line or card: "Next: [action]" with button/link (e.g. "Submit to lender", "Complete title packet"). Source: first blocker’s `actionLabel`/`actionHref`, or a simple rule (e.g. if funding not submitted → "Submit funding"; else if title incomplete → "Complete title"; else "Schedule delivery").
- **Fallback:** If no blockers, next action can be status advancement (e.g. "Move to Contracted") or "No blocking actions."

### How section priority is visually communicated

- **DealDeskWorkspace:** Order of content is the priority. Refinement: (1) Header, (2) Blockers strip, (3) Optional funding/title/delivery progression + next action, (4) Main grid: left = Customer, Trade, Notes; center = Vehicle, Selling price, Fees, Products, Totals; right = Deal intelligence, Finance terms, Save, Timeline. No re-architect; ensure blockers and optional progression are clearly "above the fold" and first.
- **DealDetailPage (modal):** Tab order is the priority. Recommended order (refinement): Overview (structure) → Customer → Vehicle → Trade → Products → Docs/Conditions → Funding → Title → Delivery → Timeline (Status & History) → Finance → Lenders → Credit → Compliance → Totals. Current tabs: Overview, Fees, Trade, Status & History, Delivery & Funding, Title & DMV, Documents, Finance, Lenders, Credit, Compliance, Totals. Refinement = reorder tabs to match the above flow where possible, or add a small "Deal progress" or "Next" hint at top (e.g. "Complete: Funding, Title pending") without changing tab structure. Prefer minimal tab reorder; if reorder is large, document as optional and do in a later slice.

---

## 3. Page Flow Rules

### A. Customer page — recommended high-level order

1. **Header** — CustomerHeader (name, status, meta, signal badges, actions).
2. **Next Actions / Signals** — Compact next-action zone (recommended next step + optional follow-up risk). Followed by JourneyBarWidget or RoadToSale (stage).
3. **Overview** — CustomerOverviewCard (identity, stage, contact, last activity).
4. **Active Opportunity / Deal** — Card or row: active deal/opportunity link or "No active opportunity".
5. **Timeline** — TimelineCard (notes, calls, callbacks, appointments, messages).
6. **Tasks / Callbacks / Messages** — Grouped: e.g. CallbacksCard then TasksCard on main, or keep TasksCard in rail with clear label "Tasks" so "what’s due" is findable. Current: Callbacks on main, Tasks on rail. Refinement: either move Tasks into main after Callbacks for grouping, or keep rail but ensure order in rail is Next Actions → Tasks → Tags → Intelligence timeline.
7. **Notes / Files** — Notes via TimelineCard + Add Note; no separate Notes card unless already present. Files out of scope unless already on page.

**Right rail (unchanged order):** Customer intelligence (SignalContextBlock) → Next actions (NextActionsCard) → Tasks (TasksCard) → Tags/Status (TagsStatusCard) → Intelligence timeline (ActivityTimeline). If next-action zone is added at top of page, rail NextActionsCard remains for all actions; top zone shows the "one thing to do next" only.

**Refinement path:** (1) Add next-action zone below header (or below JourneyBar). (2) Move or duplicate "Active opportunity/deal" from placeholder DealsSummaryCard to a real card/row and place after Overview. (3) Ensure left column order is Overview → Active opportunity → Timeline → Callbacks (and optionally Tasks on main for grouping). (4) No new routes or tabs.

### B. Deal page — recommended high-level order

**Primary (DealDeskWorkspace):**

1. **Header** — DealHeader (breadcrumb, deal label, status, next-status buttons, signal badges).
2. **Blockers / Signals** — Blockers strip (warning/danger, max 3–5). Optional: funding/title/delivery progression strip and "Next: [action]" line.
3. **Deal Summary** — Core structure: customer, vehicle, trade, selling price, fees, products, totals (current 3-column layout).
4. **Customer** — CustomerCard (already in column 1).
5. **Vehicle** — VehicleCard (already in column 2).
6. **Trade** — TradeCard (column 1).
7. **Products** — ProductsCard (column 2).
8. **Docs / Conditions** — Not currently on desk; if needed, link to modal Documents tab or keep out of scope.
9. **Funding** — No dedicated desk card; link to Delivery & Funding queue or tab. Progression strip (if added) covers "Funding" state.
10. **Title** — Same; progression strip or link to Title queue/tab.
11. **Delivery** — Same; progression strip or link to Delivery queue/tab.
12. **Timeline** — ActivityTimeline "Intelligence timeline" (already in column 3).

**Modal (DealDetailPage):** Header → (optional blocker strip) → Tabs. Tab order refinement: place Delivery & Funding, Title & DMV, and Status & History in an order that suggests flow (e.g. Status first for "where is the deal", then Delivery & Funding, Title & DMV, then Documents, Finance, etc.). Exact reorder is optional; prefer consistency with desk (blockers + next action) if modal gets a blocker strip.

**Refinement path:** (1) Keep blockers strip below header; ensure styling is "priority" (e.g. subtle border/background). (2) Add optional funding/title/delivery progression strip and next-action line using existing deal + signals. (3) No change to 3-column grid structure; only add one strip and optional progression. (4) Modal: add blocker strip when signals exist; tab reorder only if low-effort.

---

## 4. Shared Patterns

### Blocker strip rules

- **When:** Surfaces warning/danger signals only; max 3–5 items.
- **Where:** Directly below page header (customer or deal). One strip per page; no duplicate "blockers" elsewhere (section-level cues can reference same signals with inline badge/link).
- **Component:** Use existing `SignalContextBlock` with title "Blockers" (or "Blockers & risks" on customer). Same adapter as today: filter context signals by severity warning/danger.
- **Style:** Compact; use existing card/panel tokens (e.g. `border-[var(--border)]`, `bg-[var(--surface)]` or `bg-[var(--warning-surface)]` when any danger). No giant banners; one or two lines per item with optional action link.

### Next-action card / ribbon rules

- **Customer:** Next-action **zone** at top = one primary recommendation (e.g. "Callback due today — [View]") + optional second line. Source: earliest due callback/task or top CRM signal with action. NextActionsCard in rail = full set of action buttons (unchanged).
- **Deal:** Next-action **line** below blockers = single "Next: [action]" with link/button. Source: first blocker’s action or simple rule (funding → title → delivery).
- **Shared:** Use existing buttons/links (e.g. `Button`, `Link`); no new design language. Compact single line or two lines; avoid long text.

### When to use context rail vs inline section callout

- **Context rail:** General "intelligence" or "signals" for the entity (Customer intelligence, Deal intelligence). Max 5 items; suppress keys already in header. Use for "what’s going on" that isn’t necessarily the single next action.
- **Inline section callout:** When a **section** (e.g. Funding, Title, Recon) has signals, show a small inline cue (e.g. SignalBlockerInline or "1 issue" with link) next to that section title. Avoid duplicating full signal text; link to same signal or to the top blockers strip.
- **Rule:** One source of truth for full signal text (header or context block or blockers strip); section callouts are hints that link back.

### Timeline explanation / noise rules

- **Explanation:** Timeline entries (especially signal lifecycle) should answer: what happened, why it matters, what to do next (if any). Use existing `toSignalExplanation` and code-based fallbacks per WORKFLOW_INTELLIGENCE_DEEPENING_SPEC; no new backend explanation fields.
- **Noise:** Only create/resolved (and optionally updated) events for signals; no duplicate entries for same signal; max visible (e.g. 8) enforced. Customer timeline: prefer human activity (notes, calls, callbacks, appointments, messages) as primary; intelligence timeline can be separate (rail) or a subsection so it doesn’t dominate.
- **Action relevance:** Prefer showing `actionLabel`/`actionHref` on timeline items when present; omit "what to do next" when no action.

---

## 5. Scope Boundaries

- **No deep domain rewrite:** Customer and deal data models, APIs, and permissions stay as-is. Only layout, order, and surface refinement.
- **No tab explosion:** No new top-level tabs on customer or deal; no nested tab restructure.
- **No burying key actions:** Next action and blockers must be near top; not at bottom of rail or behind tabs.
- **No giant alert walls:** Blockers and next-action zones are compact (few lines); no full-page alert panels.
- **No dashboard redesign, onboarding, cost-ledger, signal engine rewrite, route restructuring, or full tab/page architecture rewrite.**

---

## 6. Backend / Helper Needs

- **Prefer existing:** Serializers, signals, adapters, and APIs already used by customer and deal pages. No new routes or renames. **Do not add new persistent workflow state** for this sprint.
- **Customer "active opportunity/deal":** Derive from **existing reads + signals** first (e.g. existing deal list by customerId, opportunity by customerId). If a helper/serializer is truly required, return **one primary active item only** (best/current deal or opportunity), not a new collection. No mini-index on the customer page.
- **Deal funding/title/delivery state:** Derive from existing deal fields + signal codes in adapters/UI only. No new backend state for progression.
- **No:** New domains, new signal types, new persistent workflow state, auth/RBAC/tenant changes, or broad serializer churn.

---

## 6b. Step 2 (Backend) outcome — no backend changes

**Conclusion: no backend or serializer changes required.** All workflow refinement can use existing reads and UI/adapter derivation.

- **Active deal (customer page):** Use existing **GET /api/deals?customerId=&limit=1&sortBy=createdAt&sortOrder=desc**. Optionally filter out `status=CANCELED` in the request (add to filters if supported) or in the client; take the first item as the single primary active deal. No new endpoint; no new field on customer response.
- **Active opportunity (customer page):** Use existing **GET /api/crm/opportunities?customerId=&limit=1&sortBy=updatedAt&sortOrder=desc**. Take the first item as the single primary active opportunity. No new endpoint; no new field on customer response.
- **Primary choice (deal vs opportunity):** Resolve in the UI: e.g. show active deal if present, else show active opportunity; or show both as one line each with a single “primary” (e.g. deal first). No backend “primary” field.
- **Funding / title / delivery progression (deal page):** Derive in the UI from (1) existing deal payload (`deliveryStatus`, `deliveredAt`, deal funding sub-resources if loaded, deal title/status routes if already used) and (2) existing signal codes (e.g. `deals.funding_delay`, `operations.title_backlog`) from the current signals API. No new persistent workflow state; no new serializer fields for progression.

---

## 7. Slice Plan with Acceptance Criteria

### SLICE A — Workflow refinement spec

- **Deliverable:** This spec (CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md) approved.
- **Acceptance:** Spec defines customer workflow goals, deal workflow goals, page flow rules, shared patterns, scope boundaries, backend/helper needs, slice plan, and risks. No app code.

### SLICE B — Customer workflow refinement

- **Scope:** Customer detail page only. Refine header summary, add/strengthen next-action zone, surface active opportunity/deal, improve grouping of timeline/tasks/callbacks, tighten top-of-page information hierarchy.
- **Tasks:** (1) Add next-action zone below header (or below JourneyBar) with one primary recommendation + optional risk line. (2) Replace or extend DealsSummaryCard with "Active opportunity/deal" card/row (wire to data if backend allows). (3) Reorder left column to: Overview → Active opportunity → Timeline → Callbacks; keep rail order. (4) Ensure header stays compact (no extra meta lines unless needed). (5) Optional: move TasksCard to main for "Tasks / Callbacks" grouping, or keep in rail with clear order.
- **Acceptance:** Customer page answers "who, stage, active deal/opportunity, risk, next action" at a glance. Next-action zone visible without scrolling. No new routes or tabs. Current data and permissions preserved.

### SLICE C — Deal workflow refinement

- **Scope:** Deal desk (DealDeskWorkspace) and optionally modal (DealDetailPage). Refine deal header/blocker area, section priority, funding/title/delivery progression, next-action cues.
- **Tasks:** (1) Keep blockers strip below header; ensure it is visually prioritized (styling). (2) Add optional funding/title/delivery progression strip and "Next: [action]" line using existing deal + signals. (3) Optionally add blocker strip to DealDetailPage (modal) when deal has signals. (4) No change to 3-column grid or tab content; only strips and order/clarity.
- **Acceptance:** Deal page shows blockers first, then optional progression and next action. Section order matches spec. No new tabs or routes. DealDeskWorkspace and modal (if touched) remain consistent.

### SLICE D — Shared action / blocker pattern refinement

- **Scope:** Only if the same pattern is needed on both customer and deal (e.g. next-action ribbon, blocker strip styling). Compact, ui-system-native.
- **Tasks:** (1) If next-action zone (customer) and next-action line (deal) share markup, extract a small reusable block (e.g. NextActionStrip or use existing components with shared props). (2) If blocker strip styling is shared, use tokens/layout only; no new design language. (3) Ensure SignalContextBlock and SignalBlockerInline usage is consistent (blockers = warning/danger; inline = count + link).
- **Acceptance:** Shared patterns are compact and consistent; no new visual system. Optional slice if Slice B/C can be done with existing components only.

### SLICE E — Timeline / context refinement

- **Scope:** Timeline explanation usefulness, context rail prioritization, noise reduction, action relevance on customer and deal.
- **Tasks:** (1) Ensure timeline signal entries use explanation format (problem / why it matters / next action) per existing adapters (toSignalExplanation, code fallbacks). (2) Reduce noise: no duplicate timeline events; cap visible; prefer activity over signal spam. (3) Context rail: keep "Customer intelligence" / "Deal intelligence" titles; ensure items are severity-ordered and action links visible. (4) Optional: move "Intelligence timeline" below main timeline on customer for "activity first" order.
- **Acceptance:** Timeline entries are actionable and understandable; context rail is prioritized; no extra fetch or churn.

### SLICE F — Tests / docs / hardening

- **Scope:** Focused tests for touched customer/deal workflow surfaces; docs and final reports (security, perf, final).
- **Tasks:** (1) Tests for new or changed components (next-action zone, active opportunity card, blocker strip, progression strip). (2) Responsive and dark/light sanity where touched. (3) Create CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_REPORT.md, SECURITY_QA.md, PERF_NOTES.md, FINAL_REPORT.md per AUTO TEAM steps.
- **Acceptance:** Tests pass; reports completed; no unrelated failures introduced.

---

## 8. Risks

| Risk | Mitigation |
|------|-------------|
| **Overcrowded header** | Keep header to name, status, meta (1–2 lines), badges (max 3), actions. Next-action and blockers live **below** header. |
| **Duplicated signals** | Use suppressKeys so header and context rail don’t repeat same signal; section callouts are inline hints with link to same source. |
| **Too many top-of-page panels** | One next-action zone (customer), one blockers strip (deal), optional one progression strip (deal). No extra cards above main content. |
| **Losing information hierarchy** | Follow page flow rules strictly: header → next/blockers → overview/summary → detail → timeline/tasks. |
| **Customer/deal page inconsistency** | Shared blocker/next-action pattern (Slice D); same token and component usage. |
| **Permission leakage** | All new surfaces use same permission checks as existing (customers.read/write, deals.read/write, crm.read, etc.). No new context exposed without guardPermission. |
| **Shallow cosmetic polish** | Acceptance criteria require "answers at a glance" and "next action visible"; not just visual tweaks. |

---

**Design lock:** Do not redesign the product. Do not turn these pages into dashboards. Do not bury critical actions. Make customer and deal pages feel like guided workspaces: clear, prioritized, operational, and trustworthy.
