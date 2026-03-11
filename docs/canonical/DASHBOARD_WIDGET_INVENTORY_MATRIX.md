# Dashboard Widget Inventory Matrix

Status: current shared dashboard mapping for GM, Sales, and Ops presets.

| Shared dashboard zone | Widget / content | Current source | Status | Notes |
| --- | --- | --- | --- | --- |
| Preset framework | Preset switcher (`GM`, `Sales`, `Ops`) | query param + client preset metadata | Code-backed but presentation reshaped | One dashboard route, three role-weighted views. |
| Preset framework | One-time walkthrough visibility | `localStorage` keyed by dealership | Code-backed but client-only | Guidance can be hidden and restored without backend state. |
| Hero KPI rail | Inventory KPI | `metrics.inventory*` | Code-backed and reusable now | Existing metric card reused. |
| Hero KPI rail | Active Deals KPI | `metrics.deals*` | Code-backed and reusable now | Existing metric card reused. |
| Hero KPI rail | New Leads KPI | `metrics.leads*` | Code-backed and reusable now | Existing metric card reused. |
| Hero KPI rail | Gross Profit KPI | `metrics.grossProfit*` | Code-backed and reusable now | Uses realized contracted-deal gross from the live dashboard payload. |
| Hero KPI rail | Ops Score | `metrics.opsTrend` + derived unresolved blockers | Code-backed but presentation reshaped | Score is derived in UI from existing blocker sources. |
| Executive summary | Health lens | inventory warnings/dangers, finance notices, deal warnings/dangers | Code-backed but presentation reshaped | New synthesis layer only. |
| Executive summary | Profit / risk lens | `metrics.grossProfitDelta7dCents` | Code-backed but presentation reshaped | Uses day-over-day movement in realized contracted-deal gross. |
| Executive summary | Blockers lens | derived unresolved count | Code-backed but presentation reshaped | No new API. |
| Executive summary | Attention-next lens | `customerTasks`, `dealPipeline`, `appointments` | Code-backed but presentation reshaped | Top queue derived client-side. |
| Executive exceptions | Finance alerts | `financeNotices` | Code-backed and reusable now | Reframed as high-priority exceptions. |
| Executive exceptions | Inventory blockers | `inventoryAlerts` | Code-backed and reusable now | Existing signal rows. |
| Executive exceptions | Severe deal blockers | `dealPipeline` rows with warning/danger | Code-backed but presentation reshaped | Existing rows, new prioritization. |
| Ops queue depth | Title / funding / delivery queue counts | `opsQueues` | Code-backed and reusable now | Counts now come directly from the existing contracted title, delivery, and funding queue definitions. |
| Revenue + pipeline | Stage pills | `dealStageCounts` | Code-backed and reusable now | New presentation. |
| Revenue + pipeline | Revenue queue list | `dealPipeline` | Code-backed and reusable now | Existing data. |
| Customer demand | Appointments | `appointments` | Code-backed and reusable now | Existing data. |
| Customer demand | Follow-up pressure | `customerTasks` | Code-backed and reusable now | Existing data. |
| Inventory command | Inventory workbench | existing dashboard inventory workbench card | Code-backed and reusable now | Existing interactive card preserved. |
| Inventory command | Inventory signal list | `inventoryAlerts` | Code-backed and reusable now | Existing signal list preserved. |
| Inventory command | Acquisition insights | existing acquisition signal fetch | Code-backed but async-fed | Existing client-side signal fetch retained. |
| Capital | Floorplan and lending | `floorplan` | Code-backed and reusable now | Existing card preserved. |
| Accountability rail | Owner agenda | `customerTasks`, `appointments`, `dealPipeline` | Code-backed but presentation reshaped | Combined prioritization layer. |
| Accountability rail | Material changes feed | `materialChanges` | Code-backed and reusable now | Merges recent deal history, inventory updates, and customer activity into one dealer-scoped rail. |
| Revenue intelligence | Deeper profitability splits | none | Deferred | Current contract exposes realized gross, but not richer front/back split views or longer-window profitability analysis. |
| Sales leaderboards | Rep-by-rep ranking | none | Deferred | Should not be implied until code-backed. |

## Summary Buckets
### Code-backed and reusable now
- KPI rail core counts and trends
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
- ops score
- blocker count
- top attention queue
- executive exceptions composition
- owner agenda

### Deferred / not yet available
- deeper profitability splits and trend windows
- salesperson scorecards
- role-specific persisted default dashboard presets
