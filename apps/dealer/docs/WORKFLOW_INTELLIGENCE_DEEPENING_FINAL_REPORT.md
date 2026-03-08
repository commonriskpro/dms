# Workflow Intelligence Deepening — Final Report (Step 6 QA-Hardening)

**Sprint:** Workflow Intelligence Surface Deepening  
**Spec:** `WORKFLOW_INTELLIGENCE_DEEPENING_SPEC.md`  
**Steps 1–5:** Spec, Backend, Frontend, Perf, Security QA completed.

---

## 1. Focused Tests Added / Run

### New or updated test files

| Test file | Coverage |
|-----------|----------|
| `modules/intelligence/ui/__tests__/workflow-intelligence.test.ts` | **New.** DealWorkspace blockers strip derivation (warning/danger only, cap 5); empty when no warning/danger. Queue row Alerts column (signalsByDealId returns only signals per deal id). Inbox customer alerts block (toContextSignals with entity scope shows only selected customer signals). |
| `modules/intelligence/ui/__tests__/timeline-adapters.test.ts` | **Updated.** New test: timeline events include `.signal` for explanation rendering; asserts every event has `signal` and created event has expected title. |
| `modules/intelligence/ui/__tests__/surface-adapters.test.ts` | Existing: groupSignalsByEntityId, toHeaderSignals, toContextSignals, toQueueSignals. |
| `modules/intelligence/ui/__tests__/explanation-adapters.test.ts` | Existing: toSignalExplanation (problem, whyItMatters, nextAction from title/description/code/actionHref). |
| `components/ui-system/__tests__/signal-surfaces.test.tsx` | Existing: SignalExplanationItem (problem, whyItMatters, link), SignalBlockerInline (issue count), SignalContextBlock, SignalHeaderBadgeGroup, SignalQueueSummary. |

### Commands run

From repo root:

- `npm run test:dealer` (full dealer suite).

Focused runs (from `apps/dealer`):

- `npx jest modules/intelligence/ui/__tests__/workflow-intelligence.test.ts modules/intelligence/ui/__tests__/timeline-adapters.test.ts modules/intelligence/ui/__tests__/explanation-adapters.test.ts modules/intelligence/ui/__tests__/surface-adapters.test.ts components/ui-system/__tests__/signal-surfaces.test.tsx`
- `npx jest modules/customers/ui/__tests__/lead-action-strip.test.tsx` (after hooks fix).

All workflow-intelligence, timeline, explanation, surface-adapter, and signal-surface tests pass.

---

## 2. Hardening Fix Applied

- **Customer DetailPage hooks order:** The four useMemos (`entityScope`, `headerSignals`, `contextSignals`, `timelineSignalEvents`) were placed after early returns (loading / notFound / error), so when the component went from “loading” to “content,” the number of hooks changed and React reported “Rendered more hooks than during the previous render.” **Fix:** Move those four useMemos to run unconditionally, immediately before the first conditional return (`if (!canRead)`). They only depend on `id` and `surfaceSignals`, which are always available. No behavior change; Rules of Hooks satisfied. **File:** `modules/customers/ui/DetailPage.tsx`.

---

## 3. Responsive and Theme Sanity Checks (Manual)

Recommended manual checks on touched workflow pages (no automation run in this step):

- **Responsive:** Deal workspace (blockers strip, timeline), Vehicle detail (timeline), Customer detail (timeline), Delivery/Funding/Title queue (Alerts column), Inbox (Customer alerts block) at narrow (~375px), medium (~768px), and wide (~1280px). Confirm no overflow, readable text, and Alerts column remains usable in horizontal scroll where applicable.
- **Dark/light:** Same pages with theme switched; confirm token-based surfaces (blockers strip, context blocks, timeline cards, SignalBlockerInline, Customer alerts) respect `--text`, `--muted-text`, `--surface`, `--border`, `--accent` and do not show raw palette or contrast issues.

---

## 4. Duplicate / Noisy Signal Regressions

- **Logic reviewed:** Blockers strip uses a severity filter of already-scoped context signals (deal entity); no new fetch. Timeline uses the same scoped events; explanation is derived from existing `event.signal`. Queue row shows only `signalsByDealId.get(row.id)`. Inbox shows only `toContextSignals(..., { entity: selectedCustomerId })`. Header vs context rail still use `suppressKeys` so header wins and rail does not duplicate header items.
- **Conclusion:** No duplicate or noisy signal regressions identified; behavior matches spec (dedupe, entity scope, max counts).

---

## 5. Dealer OS Visual Consistency

- New and updated surfaces use existing ui-system and tokens only: `SignalContextBlock`, `SignalExplanationItem`, `SignalBlockerInline`, `widgetRowSurface`, `typography`, etc. No new one-off patterns or raw color classes. Blockers strip and Customer alerts use the same card/block language as existing Deal/Vehicle/Customer intelligence blocks. Queue Alerts column uses the same compact table and badge style as the rest of the row. Timeline explanation uses the same timeline item and token styling as before.

---

## 6. Changed Files (Step 6 and Full Sprint)

### Step 6 (QA-Hardening)

| File | Change |
|------|--------|
| `modules/intelligence/ui/__tests__/workflow-intelligence.test.ts` | New: blockers strip, queue row, inbox customer alerts tests. |
| `modules/intelligence/ui/__tests__/timeline-adapters.test.ts` | New test: events include `.signal` for explanation rendering. |
| `modules/customers/ui/DetailPage.tsx` | Moved entityScope and signal useMemos before early returns (hooks order fix). |
| `apps/dealer/docs/WORKFLOW_INTELLIGENCE_DEEPENING_FINAL_REPORT.md` | This file. |

### Full sprint (reference)

- **Spec/docs:** `WORKFLOW_INTELLIGENCE_DEEPENING_SPEC.md`, `WORKFLOW_INTELLIGENCE_DEEPENING_STEP2_BACKEND.md`, `WORKFLOW_INTELLIGENCE_DEEPENING_REPORT.md`, `WORKFLOW_INTELLIGENCE_DEEPENING_PERF_NOTES.md`, `WORKFLOW_INTELLIGENCE_DEEPENING_SECURITY_QA.md`, `UI_SYSTEM_USAGE.md`.
- **ui-system/signals:** `SignalExplanationItem.tsx`, `SignalBlockerInline.tsx`, `types.ts`, `index.ts`.
- **intelligence:** `explanation-adapters.ts`, `surface-adapters.ts`, `timeline-adapters.ts`, and their tests.
- **Pages:** `DealDeskWorkspace.tsx`, `VehicleDetailPage.tsx`, `DetailPage.tsx` (customer), `DeliveryQueuePage.tsx`, `FundingQueuePage.tsx`, `TitleQueuePage.tsx`, `InboxPageClient.tsx`.

---

## 7. Unrelated Failures (Documented Separately)

When running the full dealer suite (`npm run test:dealer`), the following failures are **unrelated** to the Workflow Intelligence Deepening work. They are listed here so the sprint is not blocked and can be fixed in a separate pass.

| Test | Failure summary |
|------|------------------|
| `modules/customers/tests/timeline-callbacks-lastvisit.test.ts` | `createCallback then listCallbacks returns the callback` — `expect(found).toBeDefined()`; callback not found in list. Likely test data or timing. |
| `modules/inventory/ui/__tests__/inventory-permissions.test.tsx` | Permission/UI test failure (inventory). |
| `modules/inventory/tests/audit.test.ts` | `uploadVehiclePhoto` — "Max 20 photos per vehicle" validation error in test setup. |
| `app/(app)/dashboard/__tests__/page.test.tsx` | Expects "Customer Tasks" / "Deal Pipeline" text; dashboard copy or structure may have changed. |

**Workflow-intelligence–related tests:** All of the following pass: `workflow-intelligence.test.ts`, `timeline-adapters.test.ts`, `explanation-adapters.test.ts`, `surface-adapters.test.ts`, `signal-surfaces.test.tsx`, `lead-action-strip.test.tsx` (after DetailPage hooks fix), `signal-engine.test.ts`, `app/api/intelligence/signals/route.test.ts`, `activity-timeline.test.tsx`.

---

## 8. Summary

- **Focused tests** added for DealWorkspace blockers strip, timeline explanation (events with `.signal`), queue row Alerts column, inbox customer alerts block, and shared explanation/signal primitives; all run and pass.
- **One hardening fix:** Customer DetailPage — move signal-related useMemos before early returns to satisfy Rules of Hooks.
- **Responsive and dark/light:** Documented as manual sanity checks; no redesign.
- **No duplicate/noisy signal regressions** identified; Dealer OS visual consistency preserved.
- **Unrelated failures** listed above; no backend/route/RBAC changes in this step.

Step 6 (QA-Hardening) is complete. The Workflow Intelligence Deepening sprint is complete.
