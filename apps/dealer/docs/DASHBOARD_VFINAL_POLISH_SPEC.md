# Dashboard VFinal Polish Spec

## Scope

This document defines Step 1 (Architect) for the Dashboard VFinal Visual Polish sprint.

The dashboard composition is already correct and remains locked:

- Row 1: 5 KPI cards
- Row 2: `8/12` workbench + `4/12` deal pipeline
- Row 3: `5/12` inventory summary + `4/12` messaging/acquisition + `3/12` activity/tasks

This pass is visual-fidelity only. No backend changes, route changes, API changes, or composition changes.

Additional polish guardrails:

- Do not solve sparse/empty panels by increasing blank panel height alone.
- Prefer denser row/item treatment, stronger internal hierarchy, and compact intelligence-tile styling first.
- Do not introduce a new decorative visual language for KPI or pipeline cards.
- Refine the existing `ui-system` family so the dashboard remains native to Dealer OS.

Reference target:

- `assets/ChatGPT_Image_Mar_7__2026__10_46_49_PM-8a3412c0-69c8-4b59-990e-f6c871f8c6e5.png`

Authoritative style references:

- `apps/dealer/docs/DASHBOARD_VFINAL_IMPLEMENTATION_SPEC.md`
- `apps/dealer/docs/UI_VISUAL_SYSTEM_V1.md`
- `apps/dealer/docs/UI_COMPONENT_LIBRARY_SPEC.md`
- `apps/dealer/docs/UI_SYSTEM_USAGE.md`

---

## Current implementation audit (visual gaps only)

The implemented dashboard is structurally correct, but visual treatment is still below mock fidelity in density, hierarchy, and premium dark-mode finish.

### 1) KPI hero polish gaps

Observed gaps:

- KPI cards read as uniform utility cards, not high-priority hero metrics.
- Value block hierarchy is not strong enough versus title/delta.
- Internal spacing is too loose in some cards and too plain in others.
- Delta presentation is low-emphasis and does not create enough visual rhythm.
- Rightmost Health / Ops card exists semantically but does not feel distinct as a special KPI.
- Mini-trend feel is weak/inconsistent (where supported by primitive surface).

Close-the-gap direction:

- Tighten title/value/delta vertical rhythm and raise value dominance.
- Use tokenized internal surfaces and subtle depth cues for KPI interiors.
- Add consistent top-edge/inner accent treatment (token-based, no raw colors).
- Increase rightmost KPI distinction using a stronger hero treatment while preserving shared primitive family.

### 2) Main-left workbench polish gaps

Observed gaps:

- Quick Actions toolbar area feels generic, closer to a plain card than an operational workbench.
- Search/filter row lacks premium structure and strong toolbar hierarchy.
- Table rows feel visually flat; row separation and scanning rhythm are weak.
- Status chips are functional but not close enough to mock density/finish.
- Vertical packing leaves dead space and reduces workbench urgency.

Close-the-gap direction:

- Strengthen toolbar container treatment and grouping hierarchy.
- Improve row separators, hover/state emphasis, and compact density.
- Refine action buttons/chips with tokenized contrast and compact sizing parity.
- Increase content density without changing data semantics/actions.

### 3) Deal pipeline polish gaps

Observed gaps:

- Pipeline columns feel underpowered compared to the mock hero panel.
- Stage headers are too subtle and do not anchor the column structure strongly.
- Cards inside stages are sparse and leave too much unused area.
- Column-to-column contrast is low; panel does not read as a premium control board.

Close-the-gap direction:

- Increase stage-header presence and consistency.
- Strengthen column surface hierarchy (outer column vs inner deal card).
- Tighten card internals and typography alignment for denser scanability.
- Reduce empty vertical zones with compact-but-readable row density.

### 4) Lower-row polish gaps

Observed gaps:

- Inventory summary cluster can still read as four generic small cards instead of compact intelligence tiles.
- Messaging + Acquisition stack is functionally correct but spacing rhythm is too relaxed.
- Activity + Tasks stack feels placeholder-like in sections with sparse content.
- Lower row overall has avoidable dead space and inconsistent density.

Close-the-gap direction:

- Convert lower-left to stronger intelligence tile feel (chip/metric hierarchy).
- Tighten center/right stack list spacing and item framing.
- Normalize row-level compactness across messaging/activity/tasks/acquisition.
- Improve empty-state visual integration so panels feel intentional even when sparse.

### 5) Dark-theme fidelity gaps

Observed gaps:

- Page-to-card-to-inner-surface layering is present but not yet premium enough.
- Border contrast and surface separation are too subtle in key hero blocks.
- Chips/buttons need stronger dark-mode polish and consistency.
- Current finish reads "clean" but not "high-end enterprise dashboard."

Close-the-gap direction:

- Refine token-based contrast and layered surfaces (page, card, inner rows).
- Increase border legibility where needed using existing variables.
- Apply subtle shadow/inner-separation consistently via existing token helpers.
- Keep light mode stable; prioritize dark-mode fidelity.

### 6) Typography polish gaps

Observed gaps:

- KPI value hierarchy can be stronger.
- Secondary text in dense widgets sometimes appears too faint or too loose.
- Title/value/delta spacing is not uniformly tuned across card families.
- Some lower-row list rows need tighter line-height and better visual grouping.

Close-the-gap direction:

- Strengthen metric typography hierarchy and tabular alignment.
- Improve secondary copy contrast using approved muted token tiers only.
- Standardize internal spacing rhythm for headers, values, and metadata.
- Align list row text hierarchy to the mock's compact premium cadence.

---

## File plan (Step 2 implementation targets)

Primary files to update:

- `apps/dealer/components/dashboard-v3/MetricCard.tsx`
- `apps/dealer/components/dashboard-v3/DashboardExecutiveClient.tsx`
- `apps/dealer/components/dashboard-v3/InventoryWorkbenchCard.tsx`
- `apps/dealer/components/dashboard-v3/DealPipelineCard.tsx`
- `apps/dealer/components/dashboard-v3/InventorySummaryClusterCard.tsx`
- `apps/dealer/components/dashboard-v3/UpcomingAppointmentsCard.tsx`
- `apps/dealer/components/dashboard-v3/AcquisitionInsightsCard.tsx`
- `apps/dealer/components/dashboard-v3/ActivityFeedCard.tsx`
- `apps/dealer/components/dashboard-v3/CustomerTasksCard.tsx`
- `apps/dealer/components/dashboard-v3/WidgetCard.tsx` (only if needed for consistent widget header/padding rhythm)

Possible low-risk support file (only if necessary for token reuse):

- `apps/dealer/lib/ui/tokens.ts` (additive token composition only; no raw palette additions in feature components)

Tests/docs expected in later slices:

- `apps/dealer/app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx`
- `apps/dealer/components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx`
- `apps/dealer/docs/DASHBOARD_VFINAL_POLISH_REPORT.md`

---

## Slice plan and acceptance criteria

### SLICE A — visual gap audit/spec

Deliverables:

- This spec documenting remaining fidelity gaps and concrete close-the-gap plan.

Acceptance criteria:

- Gaps are explicit for KPI/workbench/pipeline/lower-row/dark-theme/typography.
- File plan is explicit and limited to visual-polish scope.
- No structural or backend changes proposed.

### SLICE B — KPI hero refinement

Implementation scope:

- Refine all five KPI cards (visual treatment only).
- Increase value hierarchy and internal density.
- Make rightmost Health / Ops card visibly more hero-like while staying in shared primitive family.

Acceptance criteria:

- KPI cards feel denser and more premium in dark mode.
- Title/value/delta rhythm is visibly stronger and consistent.
- Card heights stay compositionally aligned.
- KPI order and regions remain unchanged.

### SLICE C — workbench/table refinement

Implementation scope:

- Polish Quick Actions region, toolbar row, table row density, and status chip treatment.
- Preserve all current actions/data and permission behavior.

Acceptance criteria:

- Workbench reads as primary operational zone, not a generic widget.
- Toolbar feels structured and premium.
- Table rows/chips have stronger scan rhythm and reduced dead space.
- No business logic rewrites or behavior changes.

### SLICE D — deal pipeline hero refinement

Implementation scope:

- Strengthen stage headers, stage-column hierarchy, and compact-card treatment.
- Improve density and reduce sparse visual gaps.

Acceptance criteria:

- Pipeline panel has clear hero presence in row 2 right.
- Stage columns are visually distinct and easier to scan.
- Compact cards are richer and better aligned to mock language.
- No movement/recomposition of pipeline region.

### SLICE E — lower-row panel refinement

Implementation scope:

- Tighten and enrich inventory summary, messaging/acquisition, and activity/tasks blocks.
- Improve list/tile density and compact metric hierarchy.

Acceptance criteria:

- Lower-left reads as compact intelligence tile zone.
- Center/right stacks feel purposeful and dense, not placeholder-like.
- Dead space is materially reduced.
- No content reorder and no new block family.

### SLICE F — dark-theme fidelity pass

Implementation scope:

- Tune contrast layering, borders, shadow feel, chip/button treatment, and text hierarchy using existing tokens.

Acceptance criteria:

- Dark theme is visibly closer to locked mock.
- Card layering and inner surfaces are clearer and more premium.
- No raw hex classes added in feature pages.
- Light theme remains functional with same composition.

### SLICE G — tests/snapshots/docs/hardening

Implementation scope:

- Update focused render assertions only if needed.
- Intentionally update snapshots for visual changes.
- Document polish pass results.

Acceptance criteria:

- Dashboard render tests pass.
- Dashboard snapshots pass after intentional update.
- No composition regressions.
- `apps/dealer/docs/DASHBOARD_VFINAL_POLISH_REPORT.md` created with changed files/tests/unrelated failures section.

---

## Regression risks and mitigations

1. Visual polish accidentally changes composition.
   - Mitigation: no `grid-cols`/`col-span` structure changes in `DashboardExecutiveClient`.

2. Premium styling introduces heavy effects.
   - Mitigation: only tokenized shadows/surfaces; avoid heavy blur/filter animations.

3. Higher density harms readability on smaller breakpoints.
   - Mitigation: keep compact density mainly at xl; verify md/sm legibility and spacing.

4. Snapshot churn from broad cosmetic edits.
   - Mitigation: keep edits scoped to dashboard-v3 cards; update snapshots intentionally and document.

5. Dark-first tuning harms light mode.
   - Mitigation: rely on existing CSS variable system and avoid theme-specific structure branches.

---

## Definition of done for polish sprint

- Dashboard skeleton/composition remains unchanged.
- KPI row has stronger hierarchy and premium hero treatment.
- Workbench and pipeline look materially closer to the locked mock.
- Lower row feels denser and less empty while preserving semantics.
- Dark-mode fidelity is noticeably improved with token-only styling.
- Focused tests/snapshots updated and passing.
- Polish report and perf/security/final docs produced in subsequent steps.
