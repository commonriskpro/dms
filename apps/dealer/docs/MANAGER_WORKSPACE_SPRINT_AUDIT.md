# Manager Workspace Sprint — Audit & Deliverables

**Sprint:** Manager Workspace Subtitle + CTA Alignment  
**Branch:** ui-remix  
**Scope:** UX framing, copy, section narrative, CTA alignment. No backend or dashboard architecture changes.

---

## STEP 1 — MANAGER WORKSPACE AUDIT

### Current Manager Workspace Map

| Layer | Location | Content |
|-------|----------|--------|
| **Route** | `app/(app)/dashboard/page.tsx` | Server component: session check, `getDashboardV3Data`, layout merge, renders `DashboardExecutiveClient` |
| **Layout** | `app/(app)/dashboard/layout.tsx` | Passthrough (no chrome) |
| **Client** | `components/dashboard-v3/DashboardExecutiveClient.tsx` | Full V3 UI: presets (GM / Sales / Ops), KPI strip, summary strip, section cards, widgets |
| **Preset meta** | `components/dashboard-v3/dashboardExecutivePresets.ts` | GM: eyebrow "Manager workspace", title "Manager workspace", description (health, risk, bottlenecks, intervene) |
| **V3 data** | `modules/dashboard/service/getDashboardV3Data.ts` | metrics, customerTasks, inventoryAlerts, dealPipeline, dealStageCounts, opsQueues, materialChanges, salesManager, floorplan, appointments, financeNotices |
| **Widget registry** | `modules/dashboard/config/widget-registry.ts` | Widget ids, titles, descriptions, zones (topRow, main), permissions |
| **Logic** | `components/dashboard-v3/dashboardExecutiveLogic.ts` | buildExecutiveSignals, buildAgendaItems, buildOpsSignals, buildSalesSignals |

**GM preset flow (current):**
1. **Page header:** Preset title "Manager workspace", description, badge "Owner / GM view", preset toggles (GM / Sales / Ops).
2. **KPI strip:** Inventory, Active Deals, New Leads, Gross Profit, Ops Score (and optional Open Pipeline, Demand Pressure on large breakpoints).
3. **At a glance:** ManagerSummaryStrip — Health score, Blockers, Recent changes, Top action (link).
4. **Row 1:** ExecutiveSummaryCard ("Health, risk, and attention" — Monitor) | ExecutiveExceptionsCard ("Needs intervention" — Act) | OwnerAgendaCard ("Where to intervene" — Act, ultrawide only).
5. **Row 2:** PipelineOverviewCard ("Revenue and pipeline") | DemandPanel ("Customer demand").
6. **Shared bottom row:** FloorplanLendingCard | MaterialChangesCard ("Recent material changes") | OwnerAgendaCard again (non-ultrawide).

**Current titles/subtitles (GM-relevant):**
- Page: "Manager workspace" / "Business health, risk, bottlenecks, and where to intervene—in under a minute..."
- Summary strip: Health score, Blockers, Recent changes, Top action.
- ExecutiveSummaryCard: "Health, risk, and attention" / "Monitor business health and revenue flow; see what needs your intervention."
- ExecutiveExceptionsCard: "Needs intervention" / "Blockers and risk queues that need manager attention. Act on these before they pile up."
- OwnerAgendaCard: "Where to intervene" / "Manager actions: top queues that need your attention today. Click to act."
- PipelineOverviewCard: "Revenue and pipeline" / "Keep the desk moving..."
- DemandPanel: "Customer demand" / "Balance appointment flow..."
- MaterialChangesCard: "Recent material changes" / "Latest dealer-wide changes..."

**CTAs / intervention paths:**
- ManagerSummaryStrip "Top action" → links to first agenda item href.
- Exception items (Needs intervention) → Link to signal.href (e.g. /deals/title, /deals/funding, /inventory, /lenders).
- Pipeline rows → row.href ?? "/deals".
- Customer demand tasks → row.href ?? "/customers".
- OwnerAgendaCard items → item.href.
- Material changes → item.href per change.
- MetricCard components → href prop (e.g. /inventory, /deals, /crm/opportunities).

### A–E Audit

**A. Orientation**  
- **Finding:** Nav label is "Manager" (href /dashboard). Page title is "Manager workspace" with "Owner / GM view" badge. Description already states health, risk, bottlenecks, intervene.  
- **Gap:** Subtitle could be tighter and more explicitly "owner/GM home" and "not the sales rep home."

**B. Hierarchy**  
- **Finding:** KPI strip has no explicit "Business health" grouping label. "At a glance" is good. First content row mixes "Monitor" (health card) and "Act" (exceptions + agenda).  
- **Gap:** "What changed" (material changes) lives in the shared bottom row; for the 60-second goal it would help to surface "What changed" earlier or label the bottom band clearly as "What changed" so the narrative reads: health → risk → what changed → intervene.

**C. Actionability**  
- **Finding:** Exception rail and agenda cards have clear "click to act" links. Pipeline and demand rows link to /deals and /customers.  
- **Gap:** Some widgets (e.g. ExecutiveSummaryCard) are monitor-only with no primary CTA; "Top action" in summary strip is the main bridge. Adding a single "Review queues" or "Open [first intervention]" in the exceptions card header could reinforce action.

**D. Signal quality**  
- **Finding:** Severity (danger/warning) used on executive signals and deal pipeline rows. Blockers count in summary strip and Ops Score.  
- **Gap:** "Recent changes" count in summary strip is good; the Material changes card is lower on the page. Empty states are clear.

**E. Narrative**  
- **Finding:** Section guidance (when shown) uses Monitor / Act / Revenue / Demand eyebrows.  
- **Gap:** Copy could be more consistently "manager cockpit" and "intervention" language; a few labels are generic ("Customer demand", "Revenue and pipeline"). Standardizing to "monitor / risk / action" and "what changed" would align with the 60-second goal.

### Top UX Weaknesses

1. **Subtitle and frame:** Page could state more plainly that this is the owner/GM home for business health and intervention (not a generic stats page).
2. **"What changed" position and label:** Material changes sit in the shared bottom row; the narrative "what changed today" is not as prominent as "health" and "needs intervention."
3. **Section taxonomy:** Monitor vs Risk vs Action is present in section guidance but not consistently reflected in widget titles/subtitles and in the order of the GM story.
4. **CTA density:** Exception and agenda cards are actionable; the main "Health, risk, and attention" card has no primary button—relying on summary strip "Top action" and card copy. One clear "Review" or "Open queue" CTA on the exceptions card would sharpen intervention path.
5. **Microcopy consistency:** Some empty states and labels could be more executive/operational and aligned (e.g. "No interventions needed" is good; "Deal pipeline is currently quiet" could stay; helper text in widgets could consistently signal "why a manager should care").

### Highest-Value Improvements for This Sprint

1. **Strengthen page title/subtitle** so the workspace unambiguously frames as manager/owner home for health, exceptions, and intervention (concise, enterprise tone).
2. **Clarify section taxonomy** in copy: Monitor (health), Risk (blockers/queues), What changed (material changes), Act (where to intervene). Apply to GM section intros and widget subtitles where it fits.
3. **Elevate "What changed"** in the narrative: keep Material changes in current layout but add a clear "What changed" eyebrow/section label and optional one-line intro so the band reads as the "what changed today" section.
4. **Add one clear CTA** on the "Needs intervention" card (e.g. "Review all" → first queue or /deals/title when relevant) so intervention path is obvious without flooding the page.
5. **Standardize microcopy** across manager workspace: summary strip, widget titles/subtitles, empty states, and no-access messages so they feel executive and consistent.

---

## FILES TO CHANGE (planned)

| File | Changes |
|------|--------|
| `apps/dealer/components/dashboard-v3/dashboardExecutivePresets.ts` | GM (and optionally Sales/Ops) preset title/description tightening |
| `apps/dealer/components/dashboard-v3/DashboardExecutiveClient.tsx` | ManagerSummaryStrip labels, ExecutiveSummaryCard/ExceptionRail/OwnerAgendaCard/PipelineOverviewCard/DemandPanel/MaterialChangesCard titles and subtitles; SectionIntro eyebrows and details for GM; one CTA on exceptions card; empty states and no-access copy |
| `apps/dealer/modules/dashboard/config/widget-registry.ts` | Optional: widget titles/descriptions for manager context (if we touch registry at all; otherwise leave as-is to avoid layout/customize side effects) |

---

## CHANGES APPLIED

1. **dashboardExecutivePresets.ts**
   - GM description: now "Owner and GM home for business health, exceptions, and intervention. See how the store is doing, what's at risk, what changed, and where to act—in under a minute."
   - Sales and Ops descriptions tightened (demand-first / blocker-first, one line each).

2. **DashboardExecutiveClient.tsx**
   - **ManagerSummaryStrip:** "Health score" → "Business health"; "Blockers" → "At risk" (helper "Need intervention"); "Recent changes" → "What changed" (helper "Recent activity"); "Top action" → "Next action".
   - **ExecutiveSummaryCard:** Subtitle "Use the intervention queues below to act."; first-read copy "Health and blockers here. Use … to act."
   - **ExceptionRail:** New optional `primaryActionHref` / `primaryActionLabel`; when signals exist, show "Review first queue" link to first queue. Subtitle "Click a row to review or clear the queue."
   - **ExecutiveExceptionsCard:** Passes `primaryActionHref={firstHref}` and `primaryActionLabel="Review first queue"` to ExceptionRail.
   - **PipelineOverviewCard:** Subtitle "Deal stage pressure and downstream blockers. Review or move deals as needed." Empty state "Deal pipeline is quiet" / "Check back or open Deals for detail."
   - **DemandPanel:** Subtitle "Appointments and follow-up queues. Intervene where leads or tasks are stalling."
   - **OwnerAgendaCard:** Subtitle "Top queues needing your attention today. Click a row to open the queue."
   - **MaterialChangesCard:** Title "Recent material changes" → "What changed"; subtitle "Recent deal, inventory, and customer activity. Monitor only; act on the intervention queues above." Empty "No recent changes" / "Deal, inventory, and customer activity are currently quiet."
   - **GM section intros (when showSectionGuidance):** "Monitor" section title "Health, risk, and attention" → "Business health"; detail "First read before acting on queues to the right." "Act" → "Risk · Act" for Needs intervention; detail "Click a row to review or clear title, delivery, funding, or inventory." "Revenue" → "Risk", title "Pipeline pressure" → "Pipeline and demand"; "Demand" → "Risk", detail "Appointments and follow-up queues. Intervene where leads or tasks are stalling." "Where to intervene" detail "Top queues needing your attention today. Click a row to open the queue."
   - **Shared "What changed" section intro:** Eyebrow "Monitor · What changed today" → "What changed"; title "Material changes across the dealership" → "Recent activity"; detail "Deal, inventory, and customer changes. Monitor only; act on the intervention queues above."

3. **Tests**
   - **dashboard-snapshots.test.tsx:** Snapshot updated for new copy and "Review first queue" CTA.
   - **dashboard-v3-render.test.tsx:** "Recent material changes" assertion → "What changed" with `getAllByText(...).length).toBeGreaterThan(0)`.

4. **Widget registry**
   - No changes (descriptions left as-is to avoid layout/customize side effects).

---

## TESTS / COMMANDS RUN

- `npx jest --testPathPatterns "dashboard/__tests__"` (apps/dealer): **4 suites, 22 tests passed.**
- `npx jest components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx -u`: **snapshot updated, 3 tests passed.**
- Lint: no new errors on touched files.

---

## FINAL MANAGER WORKSPACE SUMMARY (post-sprint)

- **Orientation:** Manager workspace is the dashboard route. Page title "Manager workspace" with description: owner/GM home for business health, exceptions, and intervention; how the store is doing, what's at risk, what changed, where to act—in under a minute.
- **Hierarchy:** (1) Business health — KPI strip + "At a glance" summary (Business health %, At risk, What changed, Next action). (2) Monitor — Health, risk, and attention card. (3) Risk · Act — Needs intervention card with "Review first queue" CTA when there are signals. (4) Risk — Pipeline and demand row (Revenue and pipeline, Customer flow). (5) What changed — Recent activity / Material changes card. (6) Act — Where to intervene (agenda card).
- **Actionability:** "Review first queue" CTA on Needs intervention when signals exist (links to first queue). All exception and agenda rows remain links to the correct routes. Pipeline and demand rows link to /deals and /customers. Copy consistently says "Click a row to review/open the queue."
- **Copy:** Enterprise, concise, monitor + intervene framing. Section taxonomy: Monitor, Risk · Act, Risk, What changed, Act. Empty states and helper text aligned (e.g. "No recent changes", "Deal pipeline is quiet", "Need intervention").
