# Workflow Intelligence Deepening — Implementation Report

**Sprint:** Workflow Intelligence Surface Deepening  
**Spec:** `WORKFLOW_INTELLIGENCE_DEEPENING_SPEC.md`  
**Step 2 (Backend):** `WORKFLOW_INTELLIGENCE_DEEPENING_STEP2_BACKEND.md` (no API/schema changes; `groupSignalsByEntityId` adapter added)

## Summary

Intelligence is now deepened into active workflows: deal workspace, vehicle/customer detail, queue rows, inbox, and timelines. All changes are adapter-first, use existing signal payloads, and stay within the existing ui-system and token system.

## Implemented

### Slice B — Shared workflow signal primitives

- **`modules/intelligence/ui/explanation-adapters.ts`** — `toSignalExplanation(item)` returns `{ problem, whyItMatters, nextAction }` from `title`, `description`, `actionLabel`, `actionHref`, and code fallbacks. UI-only; no backend fields.
- **`components/ui-system/signals/SignalExplanationItem.tsx`** — Renders explanation shape (problem, why it matters, next action link) with token-only styling.
- **`components/ui-system/signals/SignalBlockerInline.tsx`** — Compact severity + count for section or queue row.
- **`SignalSurfaceItem`** — Added optional `actionLabel`; **`toSurfaceItems`** in surface-adapters maps `actionLabel` from API.
- **`timeline-adapters.ts`** — `TimelineSignalEvent` now includes optional `signal` so the UI can derive explanations.
- Exported from `ui-system/signals/index.ts` and `ui-system/index.ts`.

### Slice C — DealWorkspace intelligence deepening

- **Blockers strip** — When deal has warning/danger signals, a compact "Blockers" block (max 3) appears below the header, above the grid.
- **Context rail** — Existing "Deal intelligence" block unchanged.
- **Timeline** — Intelligence timeline uses `SignalExplanationItem` with `toSignalExplanation(event.signal)` when `event.signal` is present.

### Slice D — Vehicle detail intelligence deepening

- **Timeline** — Intelligence timeline uses `SignalExplanationItem` + `toSignalExplanation(event.signal)` when present. Header and "Vehicle intelligence" rail unchanged.

### Slice E — Customer detail intelligence deepening

- **Timeline** — Intelligence timeline uses `SignalExplanationItem` + `toSignalExplanation(event.signal)` when present. Header and "Customer intelligence" rail unchanged.

### Slice G — Queue row-level blocker intelligence

- **DeliveryQueuePage, FundingQueuePage, TitleQueuePage** — Full signal list stored (`allQueueSignals`), summary still from `toQueueSignals(..., { maxVisible: 4 })`. **Alerts** column added; each row shows `SignalBlockerInline` when `groupSignalsByEntityId(allQueueSignals, data.map(r => r.id)).get(row.id)` has items. Adapter-side only; no API change.

### Slice F — Inbox / opportunities intelligence

- **InboxPageClient** — When a conversation (customer) is selected, CRM signals are fetched once; `toContextSignals` with `entity: { entityType: "Customer", entityId: selectedCustomerId }` yields customer-scoped list. A compact "Customer alerts" block (max 3) is shown above the message timeline. Opportunities table/detail left unchanged (optional per spec).

### Slice H — Timeline-level signal explanations

- Implemented as part of Slices C, D, E: timeline events carry `signal`; the UI renders `SignalExplanationItem` with `toSignalExplanation(event.signal)` so each entry shows problem, why it matters, and next action where available.

### Slice I — Adapters / data plumbing

- **explanation-adapters.ts** — Code-based fallbacks for `whyItMatters` and `nextAction` for known codes.
- **surface-adapters** — `groupSignalsByEntityId` (from Step 2), `actionLabel` in `toSurfaceItems`.
- **timeline-adapters** — `signal` attached to created/resolved events. No new API or backend explanation fields.

## Files touched

| Area | Files |
|------|--------|
| ui-system/signals | `SignalExplanationItem.tsx` (new), `SignalBlockerInline.tsx` (new), `types.ts` (actionLabel), `index.ts` (exports) |
| intelligence/ui | `explanation-adapters.ts` (new), `surface-adapters.ts` (actionLabel, groupSignalsByEntityId from Step 2), `timeline-adapters.ts` (signal on events) |
| Deal | `DealDeskWorkspace.tsx` (blockers strip, timeline explanation) |
| Vehicle | `VehicleDetailPage.tsx` (timeline explanation) |
| Customer | `DetailPage.tsx` (timeline explanation) |
| Queues | `DeliveryQueuePage.tsx`, `FundingQueuePage.tsx`, `TitleQueuePage.tsx` (allQueueSignals, signalsByDealId, Alerts column, SignalBlockerInline) |
| Inbox | `InboxPageClient.tsx` (inboxSignals, customerContextSignals, Customer alerts block) |
| Docs | `UI_SYSTEM_USAGE.md` (Workflow intelligence deepening section), `WORKFLOW_INTELLIGENCE_DEEPENING_REPORT.md` (this file) |

## Tests

- **surface-adapters** (`modules/intelligence/ui/__tests__/surface-adapters.test.ts`): Existing tests plus `groupSignalsByEntityId` (grouping and optional entity id filter).
- **explanation-adapters** (`modules/intelligence/ui/__tests__/explanation-adapters.test.ts`): `toSignalExplanation` — problem from title, whyItMatters from description or code, nextAction from actionHref/actionLabel or code fallback.
- **signal-surfaces** (`components/ui-system/__tests__/signal-surfaces.test.tsx`): `SignalExplanationItem` (problem, whyItMatters, next action link) and `SignalBlockerInline` (issue count).

## Constraints respected

- No route renames, no RBAC/tenant changes, no modal impact.
- No full-width alert banners; compact blocker strips and context blocks only.
- Token-only styling; no raw color classes in feature pages.
- Adapter-first; explanation and row-level grouping use existing API payloads.
- No backend explanation fields; no API entity filters added in this step.

## Optional / not done

- **Opportunities** — Table/detail signal badge or context block not implemented (spec allowed optional).
- **Section-level cues** — Deal funding/title/delivery section badges and vehicle recon/pricing section cues not added to avoid deep layout changes; can be added later if needed.
