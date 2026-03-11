# Dashboard Widget Inventory Matrix

Status: current shared dashboard mapping for GM, Sales, and Ops presets.

| Shared dashboard zone | Widget / content | Current source | Status | Notes |
| --- | --- | --- | --- | --- |
| Preset framework | Preset switcher (`GM`, `Sales`, `Ops`) | query param + client preset metadata | Code-backed but presentation reshaped | One dashboard route, three role-weighted views. Explicit query params win. |
| Preset framework | Saved preset default | `localStorage` keyed by dealership + user | Code-backed but client-only | When the route has no explicit preset query, the dashboard restores the saved user preset for that dealership. |
| Preset framework | One-time walkthrough visibility | `localStorage` keyed by dealership | Code-backed but client-only | Guidance can be hidden and restored without backend state. |
| Hero KPI rail | Inventory KPI | `metrics.inventory*` | Code-backed and reusable now | Existing metric card reused. |
| Hero KPI rail | Active Deals KPI | `metrics.deals*` | Code-backed and reusable now | Existing metric card reused. |
| Hero KPI rail | New Leads KPI | `metrics.leads*` | Code-backed and reusable now | Existing metric card reused. |
| Hero KPI rail | Gross Profit KPI | `metrics.grossProfit*` | Code-backed and reusable now | Uses realized contracted-deal gross from the live dashboard payload. |
| Hero KPI rail | Ops Score | `metrics.opsTrend` + derived unresolved blockers | Code-backed but presentation reshaped | Score is derived in UI from existing blocker sources. |
| Executive summary | Health lens | inventory warnings/dangers, finance notices, deal warnings/dangers | Code-backed but presentation reshaped | New synthesis layer only. |
| Executive summary | Profit / risk lens | `metrics.grossProfitDelta7dCents` | Code-backed but presentation reshaped | Uses day-over-day movement in realized contracted-deal gross. |
| Executive summary | Front / back gross split | `metrics.frontGrossProfit*`, `metrics.backGrossProfit*` | Code-backed but presentation reshaped | GM summary now shows realized front-end and back-end gross separately. |
| Executive summary | Blockers lens | derived unresolved count | Code-backed but presentation reshaped | No new API. |
| Executive summary | Attention-next lens | `customerTasks`, `dealPipeline`, `appointments` | Code-backed but presentation reshaped | Top queue derived client-side. |
| Executive exceptions | Finance alerts | `financeNotices` | Code-backed and reusable now | Reframed as high-priority exceptions. |
| Executive exceptions | Inventory blockers | `inventoryAlerts` | Code-backed and reusable now | Existing signal rows. |
| Executive exceptions | Severe deal blockers | `dealPipeline` rows with warning/danger | Code-backed but presentation reshaped | Existing rows, new prioritization. |
| Ops queue depth | Title / funding / delivery queue counts and age | `opsQueues` | Code-backed and reusable now | Counts come from the existing contracted title, delivery, and funding queue definitions. Oldest-item age now drives stronger ops escalation semantics. |
| Revenue + pipeline | Stage pills | `dealStageCounts` | Code-backed and reusable now | New presentation. |
| Revenue + pipeline | Revenue queue list | `dealPipeline` | Code-backed and reusable now | Existing data. |
| Customer demand | Appointments | `appointments` | Code-backed and reusable now | Existing data. |
| Customer demand | Follow-up pressure | `customerTasks` | Code-backed and reusable now | Existing data. |
| Sales manager view | Top closer / top gross rep / avg gross per deal | `salesManager` | Code-backed and reusable now | Backed by the existing salesperson performance service over the last 30 days. |
| Sales manager view | Stale leads / overdue follow-ups / appointments set today | `salesManager` | Code-backed and reusable now | Stale-lead stats come from existing stale-lead logic; overdue follow-ups come from open past-due customer tasks; appointment and callback activity come from existing team-activity counts. |
| Inventory command | Inventory workbench | existing dashboard inventory workbench card | Code-backed and reusable now | Existing interactive card preserved. |
| Inventory command | Inventory signal list | `inventoryAlerts` | Code-backed and reusable now | Existing signal list preserved. |
| Inventory command | Acquisition insights | existing acquisition signal fetch | Code-backed but async-fed | Existing client-side signal fetch retained. |
| Capital | Floorplan and lending | `floorplan` | Code-backed and reusable now | Existing card preserved. |
| Accountability rail | Owner agenda | `customerTasks`, `appointments`, `dealPipeline` | Code-backed but presentation reshaped | Combined prioritization layer. |
| Accountability rail | Material changes feed | `materialChanges` | Code-backed and reusable now | Merges recent deal history, inventory updates, and customer activity into one dealer-scoped rail with severity, relative age, and actor attribution where available. |
| Revenue intelligence | Deeper profitability splits | none | Deferred | Current contract exposes realized gross, but not richer front/back split views or longer-window profitability analysis. |
| Sales leaderboards | Rep-by-rep ranking | none | Deferred | Should not be implied until code-backed. |

## Summary Buckets
### Code-backed and reusable now
- KPI rail core counts and trends
- realized gross profit split
- sales manager rep-performance summary
- sales coaching pressure summary
- inventory alerts
- deal pipeline
- deal stage counts
- appointments
- customer tasks
- finance notices
- floorplan
- inventory workbench
- dedicated title / funding / delivery queue depth
- recent material changes

### Code-backed but presentation reshaped
- preset switching
- dealership-scoped walkthrough state
- per-user preset persistence
- ops score
- blocker count
- top attention queue
- executive exceptions composition
- owner agenda

### Deferred / not yet available
- deeper profitability splits and trend windows
- appointment conversion and rep intervention scoring
- server-backed or policy-managed dashboard preset defaults
