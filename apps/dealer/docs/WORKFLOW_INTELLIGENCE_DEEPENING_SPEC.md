# Workflow Intelligence Surface Deepening Spec

**Version:** v1  
**Status:** Authoritative for this sprint  
**Scope:** Deepen intelligence into active workflow pages (deal, vehicle, customer, inbox, opportunities, queues, timelines). No signal-engine rewrite. Adapter-first, presentation + targeted integration only.

---

## 0) Current State Snapshot

Already implemented (from Intelligence Surface Expansion and prior work):

- **Signal engine & API:** `modules/intelligence/service/signal-engine.ts`, `GET /api/intelligence/signals`, `POST|GET /api/intelligence/jobs/run`; tenant-scoped, domain permissions.
- **Shared signal primitives:** `SignalCard`, `SignalList`, `SignalSeverityBadge`, `SignalSummaryPanel`, `SignalContextBlock`, `SignalInlineList`, `SignalHeaderBadgeGroup`, `SignalQueueSummary` under `components/ui-system/signals`.
- **Adapters:** `surface-adapters.ts` (`toHeaderSignals`, `toContextSignals`, `toQueueSignals`, `fetchSignalsByDomains`, `filterSignalsForEntity`, sort/dedupe); `timeline-adapters.ts` (`toTimelineSignalEvents` — created/resolved only).
- **Integrations:** Deal detail (DealDeskWorkspace: header badges + context block), Vehicle detail (VehicleDetailPage: header + context “Vehicle intelligence”), Customer detail (DetailPage: header + context “Customer intelligence”); Delivery/Funding/Title/Jobs queue pages use `SignalQueueSummary` (max 4). Timeline shows “Signal created/resolved: {title}” with optional description.

**Gap this spec addresses:** Intelligence is present but not yet *deepened* into workflow-native forms: no explicit “blockers” strip, no standardized “problem / why it matters / next action” explanation format, no row-level blocker context on queues, no next-action emphasis in headers/rails, and timeline entries are minimal (title + detail only). This spec defines how to deepen without redesigning pages or the engine.

**Data and API policy (hard constraints):**

- **Adapter-side filtering first.** Do not add API or query filters (e.g. `entityType`, `entityId`, `entityIds`) unless row-level queue blockers or inbox/opportunity context cannot be implemented efficiently with existing signal payloads. Prefer fetching domain signals at current limits and filtering in adapters by `entityType`/`entityId` (existing `filterSignalsForEntity`).
- **Explanation in UI only.** Explanation text (problem / why it matters / next action) must be derived in UI adapters from existing `title`, `description`, `actionLabel`, `actionHref` plus optional code-based fallback. Do not add backend explanation fields or new API response fields for explanation.

---

## 1) Exact Workflow Surfaces in Scope

### A. DealWorkspace

- **Top-level blockers area (new):** A compact strip or summary block near the top of the workspace (below header, above main columns) that surfaces **active deal-level blockers only** (e.g. funding delayed, title issue, missing docs). Max 3–5 items; severity-first; each with optional next-action link. Use existing `SignalContextBlock` or a thin variant; do not add a new layout row that breaks current composition.
- **Section-level signal placement:** Where funding/title/delivery sections already exist, allow **section-level** signal hints (e.g. “1 funding issue”) that link to the same signals as the top blockers. No duplicate text; prefer one source of truth (top blockers) and section badges that reflect counts or link to same list.
- **Funding / title / delivery warning areas:** If the current deal has signals with codes like `deals.funding_delay`, `operations.title_backlog`, etc., show them in the existing context rail “Deal intelligence” block; optionally add small inline cues next to the relevant section titles (e.g. “Funding” + badge “1”).
- **Suggested next actions:** Surface via existing `actionLabel` / `actionHref` on signals. No new CTA type; use existing link/button pattern from `SignalContextBlock` / `SignalCard`.
- **Signal-aware context rail:** Already present (“Deal intelligence”). Deepening = ensure items show description and action when available; optionally add a short "why it matters" line **derived in the UI adapter** from existing `description` (or code fallback)—no backend explanation fields.

### B. VehicleHeader / Vehicle detail

- **Compact signal summary at header:** Already present (SignalHeaderBadgeGroup, max 3). Deepening = ensure titles/descriptions are workflow-relevant (aging, recon, missing photos, price-to-market).
- **Signal-aware detail blocks:** No new blocks. Where recon, pricing, media, or aging sections exist, allow a **small inline signal cue** (badge or single line) that links to the same signals as the header/rail. Avoid duplicating long text.
- **Recon / pricing / photo / aging warnings:** Sourced from existing inventory (and acquisition) domain signals; display in header + context rail; optional one-line hint in the relevant section (e.g. “Recon” section shows “1 recon delay” with link to signal).
- **Workbench-style action cues:** Use existing `actionLabel` / `actionHref` from signals. No new UI pattern; keep buttons/links consistent with ui-system.

### C. Customer detail

- **Lead / contact / follow-up warnings:** CRM domain signals; already shown in header + “Customer intelligence” context block. Deepening = ensure uncontacted leads, overdue tasks, missed appointments are clearly phrased and have actions where applicable.
- **Stale opportunity / overdue task context:** Same; ensure signal titles/descriptions and action links point to the right place (e.g. opportunity list, task list).
- **Header / context / timeline integration:** No new regions. Improve content of existing header badges and context block; add timeline explanation entries (see §1 F).

### D. Inbox / opportunities

- **Conversation-level risk context:** If a conversation or customer has related CRM/deal signals, show a **compact signal block** in the inbox layout (e.g. sidebar or top of conversation) with max 3–5 items. Reuse `SignalContextBlock` or `SignalSummaryPanel`; use **adapter-side** filtering by `entityType`/`entityId` from existing signal payloads (fetch domains once, filter in adapter). Add API entity filters only if this proves inefficient.
- **Opportunity-level signals:** On opportunities list or card, allow a **small badge or count** (e.g. “2 signals”) that links to a drawer or detail with signal list. On opportunity detail, show context block with opportunity-scoped signals. Same rule: adapter-side filter from existing payloads first.
- **Recommended action hints:** Only where `actionLabel`/`actionHref` exist and are safe. No speculative CTAs.

### E. Queue row-level blockers and context

- **Row-level blocker chips:** For delivery/funding/title (and optionally CRM jobs), allow **per-row** signal indicators when the row’s entity (deal id) has active signals. Display as a small severity chip or icon (e.g. warning icon + tooltip “1 funding issue”) in one column or an actions column. **Data:** Prefer fetching queue-domain signals once at page level (existing API) and filtering in adapters by `entityId` per row. Add API entity/entityIds filters only if adapter-side filtering is proven insufficient (e.g. payload size or performance).
- **Row-level signal count or inline summary:** Prefer one compact chip per row (e.g. “1” or “!”) with tooltip or popover listing signal titles and link to deal. Avoid long text in the cell.
- **Hover / preview / context:** If a row already has a hover or preview panel, add a one-line signal summary there. Do not add new hover behavior that conflicts with existing row click/navigation.

### F. Timeline-level signal explanations

- **Signal created / resolved entries:** Already produced by `toTimelineSignalEvents`. Deepening = improve the **explanation** shown for each entry.
- **Standard explanation format (see §3):** Each timeline item should answer: (1) what is wrong / what happened, (2) why it matters, (3) what to do next (if appropriate). Today timeline only shows “Signal created: {title}” and optional description. Add a structured **explanation** object or derived text: problem (title), whyItMatters (from description or fixed copy per code), nextAction (from actionLabel/actionHref or fixed copy per code).
- **“Why this matters” and “what to do next”:** Implement via a small **timeline explanation adapter** that maps `code` (and optionally severity) to short “why it matters” and “what to do” strings when description/actionLabel are not sufficient. Prefer using existing `description` and `actionLabel` when present; fallback to code-based copy for known codes.
- **No spam:** Only create/resolved lifecycle events; no repeated unchanged refreshes; max visible timeline signal events (e.g. 8) already enforced in `toTimelineSignalEvents`.

---

## 2) Surface Rules by Domain/Entity

| Surface | Domain(s) | Entity scope | Max | Severity | Dedupe |
|--------|-----------|--------------|-----|----------|--------|
| Deal header | deals, operations | Deal + entityId | 3 | all | one per code+entity |
| Deal context rail | deals, operations | Deal + entityId | 5 | all | suppress keys already in header |
| Deal top blockers | deals, operations | Deal + entityId | 3–5 | warning, danger preferred | same as context |
| Vehicle header | inventory, acquisition | Vehicle + entityId | 3 | all | one per code+entity |
| Vehicle context rail | inventory, acquisition | Vehicle + entityId | 5 | all | suppress keys in header |
| Customer header | crm | Customer + entityId | 3 | all | one per code+entity |
| Customer context rail | crm | Customer + entityId | 5 | all | suppress keys in header |
| Inbox/conv block | crm, deals | Customer or conversation scope | 3–5 | all | one per code+entity |
| Opportunities list/card | crm | Opportunity/Customer | 1–2 badge or count | all | — |
| Opportunity detail rail | crm | Opportunity + entityId | 5 | all | — |
| Queue summary | per queue domain | — | 4 | all | existing toQueueSignals |
| Queue row | deals, operations (or crm for jobs) | Deal id per row | 1 chip or 1 line | warning, danger preferred | one per row (aggregate) |
| Timeline (all) | any | same as page entity | 8 | all | create/resolved only |

- **Allowed signal types:** All severities (info, success, warning, danger). For “blockers” or “top issues” strips, prefer warning and danger; info/success can appear in context rail and timeline.
- **Dedupe:** Same `(dealershipId, domain, code, entityType, entityId)` active signal must not appear twice in the same visible surface; across header vs rail use suppressKeys so header wins.

---

## 3) Signal Explanation Contract

Standard format for workflow surfaces (timeline and any “explanation” UI):

- **problem:** Short label (signal title). Required.
- **whyItMatters:** One sentence. From signal `description` when present and non-empty; otherwise from a code-based lookup (e.g. `inventory.aged_90d` → “Vehicles over 90 days reduce turn and margin.”).
- **nextAction:** Optional. From signal `actionLabel` + `actionHref` when present; otherwise from code-based lookup (e.g. “View aging report” → `/inventory/aging`). When no action, omit or show “No action required.”

Example for timeline:

- **problem:** Funding delayed by 4 days  
- **whyItMatters:** Slows cash collection and can affect floor plan.  
- **nextAction:** Review funding status (link to deal funding section or `/deals/[id]` with hash.)

Implementation: Add an **explanation adapter in UI only** (e.g. `toSignalExplanation(signal): { problem, whyItMatters, nextAction }`) that uses existing `title`, `description`, `actionLabel`, `actionHref`, and a small code-to-copy map for fallbacks. Do not add backend explanation fields or new API response fields. Shared component `SignalExplanationItem` can render these three lines with token-only styling.

---

## 4) Next-Action Surface Contract

- **Show CTA link when:** Signal has `actionHref` (and optionally `actionLabel`). Same as today.
- **Deep-link action:** Use existing link component; preserve permission and tenant (links are to same app routes).
- **Passive warning only:** When signal has no `actionHref`, show title + description only; no fake button.
- **No action:** Do not show “What to do next” when there is no action and no code-based default.

---

## 5) File Plan

### New (only if needed for deepening)

- `apps/dealer/components/ui-system/signals/WorkflowSignalBlock.tsx` — Optional. Compact “blockers” strip (list of signals with title + optional action). Use when top-level blockers strip is not just a `SignalContextBlock` with a different title.
- `apps/dealer/components/ui-system/signals/SignalExplanationItem.tsx` — Timeline (and optional rail) item that shows problem / whyItMatters / nextAction.
- `apps/dealer/components/ui-system/signals/SignalBlockerInline.tsx` — Optional. Single-line or chip for section-level or row-level “1 issue” style cue.
- `apps/dealer/modules/intelligence/ui/explanation-adapters.ts` — Optional. `toSignalExplanation(signal)`, code-based fallback copy for known codes.

### Existing to update

- `apps/dealer/components/ui-system/signals/index.ts` — Export new primitives if added.
- `apps/dealer/modules/intelligence/ui/timeline-adapters.ts` — Extend to return or accept explanation shape (problem, whyItMatters, nextAction) per event; or keep events as-is and have the timeline component call an explanation helper per event.
- `apps/dealer/modules/deals/ui/desk/DealDeskWorkspace.tsx` — Add top blockers strip (or emphasize existing context block); optional section-level badges.
- `apps/dealer/modules/inventory/ui/VehicleDetailPage.tsx` — Optional section-level signal cues; ensure header/rail copy is workflow-ready.
- `apps/dealer/modules/customers/ui/DetailPage.tsx` — Ensure header/rail and timeline use explanation format where helpful.
- `apps/dealer/app/(app)/crm/inbox/InboxPageClient.tsx` — Optional signal block for conversation/customer scope.
- `apps/dealer/modules/crm-pipeline-automation/ui/OpportunitiesTablePage.tsx` or opportunity detail — Optional signal context or badge.
- `apps/dealer/modules/deals/ui/DeliveryQueuePage.tsx`, `FundingQueuePage.tsx`, `TitleQueuePage.tsx` — Row-level signal chip or count; use adapter-side filtering from page-level signal fetch (existing payloads). Add API entity filters only if this approach is proven inefficient.

### Backend (only if adapter-side approach is insufficient)

- **No API/entity filters by default.** Row-level queue blockers and inbox/opportunity context must be implemented first using existing signal payloads and adapter-side filtering (`filterSignalsForEntity`, per-row filter by `entityId`). Add optional `entityType`/`entityId`/`entityIds` query params to `GET /api/intelligence/signals` only if adapter-side filtering cannot be done efficiently (e.g. payload size or performance).
- **No backend explanation fields.** Explanation (problem / why it matters / next action) is derived only in UI adapters from existing `title`, `description`, `actionLabel`, `actionHref` and code fallback. No new schema or API response fields for explanation.

---

## 6) Slice Plan with Acceptance Criteria

### SLICE A — Workflow intelligence spec

- **Deliverable:** This document.
- **Acceptance:** Surfaces, rules, explanation contract, next-action contract, file plan, and risks defined. No app code.

### SLICE B — Shared workflow signal primitives

- Add only the primitives that are clearly needed and not duplicative of existing ones (e.g. `SignalExplanationItem` for timeline; optional `WorkflowSignalBlock` if different from `SignalContextBlock`; optional `SignalBlockerInline` for row/section).
- **Acceptance:** New components under `ui-system/signals`, typed props, token-only, no fetch. Exported from index.

### SLICE C — DealWorkspace intelligence deepening

- Top-level blockers strip or emphasized deal intelligence block; section-level hints where appropriate.
- **Acceptance:** Deal page shows active blockers clearly; funding/title/delivery context visible; no layout break; existing deal structure preserved.

### SLICE D — Vehicle detail intelligence deepening

- Header/rail already present; add optional section-level cues and ensure copy is workflow-ready.
- **Acceptance:** Vehicle page shows recon/pricing/photo/aging-relevant signals without clutter; no vehicle logic rewrite.

### SLICE E — Customer detail intelligence deepening

- Header/rail and timeline; ensure CRM signals (follow-up, stale, missed) are clear and actionable.
- **Acceptance:** Customer page shows lead/follow-up/task-relevant signals; no CRM logic rewrite.

### SLICE F — Inbox / opportunities intelligence deepening

- Inbox: optional signal block for conversation/customer scope. Opportunities: optional badge or context block.
- **Acceptance:** Inbox/opportunities show risk context where safe; no redesign of inbox or opportunity flow.

### SLICE G — Queue row-level blocker intelligence

- Row-level chip or count for delivery/funding/title (and optionally jobs); data from existing signals filtered by deal id per row or batch.
- **Acceptance:** Rows can show at most one compact indicator; no row overload; queue behavior unchanged.

### SLICE H — Timeline-level signal explanations

- Timeline entries use problem / whyItMatters / nextAction format; adapter or component builds this from signal + code fallbacks.
- **Acceptance:** Timeline shows “why it matters” and “what to do next” where applicable; no spam; same ActivityTimeline/TimelineItem family.

### SLICE I — Adapters and data plumbing

- Explanation adapter; optional entity filter on API or client-side filtering for row-level; fetch integration for new surfaces.
- **Acceptance:** Adapter-first; no business logic in shared components; tenant and domain constraints preserved.

### SLICE J — Tests and hardening

- Focused tests for new primitives and key integrations; docs update.
- **Acceptance:** Targeted tests added/updated; WORKFLOW_INTELLIGENCE_DEEPENING_REPORT.md created; unrelated failures documented separately.

---

## 7) Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Signal noise | Enforce max counts; severity-first; no duplicate same signal across header vs rail (suppressKeys); timeline create/resolved only. |
| Header/workspace overcrowding | Top blockers strip compact (3–5); section badges are counts/links only; no long text in header. |
| Duplicate signals across surfaces | Dedupe by code+entityId; suppress in rail what is in header; one source of truth for “blockers” list. |
| Queue row clutter | One chip or one line per row; tooltip/popover for detail; avoid long text in cell. |
| Timeline spam | Only lifecycle create/resolved; max 8; no repeated unchanged refresh events. |
| Permission leakage | All fetches via existing tenant-scoped API; domain permission map unchanged; entity filter only narrows by entityId. |
| Client fetch regressions | Prefer existing page data flow; add minimal client fetch only where needed; no fetch inside dumb shared components. |
| Deep workflow rewrite | Adapter-first; only add UI that consumes existing signals; no change to deal/customer/vehicle business logic. |

---

## 8) References

- `apps/dealer/docs/INTELLIGENCE_SIGNAL_ENGINE_SPEC.md`
- `apps/dealer/docs/INTELLIGENCE_LAYER_ARCHITECTURE.md`
- `apps/dealer/docs/DASHBOARD_SIGNAL_MAP.md`
- `apps/dealer/docs/INTELLIGENCE_SURFACE_EXPANSION_SPEC.md`
- `apps/dealer/docs/INTELLIGENCE_SURFACE_EXPANSION_REPORT.md`
- `apps/dealer/docs/UI_SYSTEM_ARCHITECTURE_V1.md`
- `apps/dealer/docs/UI_COMPONENT_LIBRARY_SPEC.md`
- `apps/dealer/docs/UI_SYSTEM_USAGE.md`
- `apps/dealer/docs/DEALER_OS_PRODUCT_VISION.md`
- `apps/dealer/docs/DASHBOARD_VFINAL_FINAL_REPORT.md`
- `apps/dealer/docs/SECONDARY_PAGE_VISUAL_PARITY_SPEC.md`
