# Dashboard Role Extension Note

Status: implemented as live presets on the shared dashboard route, with further role-specific data depth still pending.

## Principle
The GM redesign has now become the shared dashboard framework. Sales Manager and Ops / Desk do not fork into unrelated dashboards. They reuse the same shell, hero rail language, exception handling, and accountability patterns while changing widget priority and section weight.

Implemented route behavior:
- GM: `/dashboard`
- Sales: `/dashboard?preset=sales`
- Ops / Desk: `/dashboard?preset=ops`

## GM / Owner
Primary questions:
- Are we healthy today?
- Where is profit or risk moving?
- What is blocked right now?
- What needs executive attention next?

Highest-priority zones:
- KPI rail
- executive summary
- executive exceptions
- revenue and pipeline
- inventory command view
- owner agenda

## Sales Manager preset
Implementation state:
- implemented on the shared dashboard route
- live weighting now favors leads, appointments, follow-up pressure, active deals, and open pipeline

Primary questions:
- Is lead flow healthy?
- Which reps or stages are slipping?
- Where do follow-ups or appointments need intervention?
- What demand should be pushed into active deals today?

Priority changes relative to GM:
- increase weight of leads, appointments, messaging, and follow-up queues
- move customer demand higher than finance / capital widgets
- keep pipeline visible but bias toward early-to-mid funnel conversion
- de-emphasize floorplan and ops score
- replace owner agenda with rep accountability / coaching agenda when that data is code-backed

Implemented top zones:
- KPI rail: leads, appointments, active deals, conversion proxy, response-time proxy (future)
- demand command center
- rep pipeline health
- follow-up accountability
- messaging / appointment board

Current blocker:
- rep-level ranking and coaching metrics are not first-class dashboard payload fields yet

## Ops / Desk preset
Implementation state:
- implemented on the shared dashboard route
- live weighting now favors blocker clearance, finance notices, inventory readiness, desk throughput, and queue clearance
- title, delivery, and funding queue depth are now first-class dashboard payload fields via `opsQueues`

Primary questions:
- What is blocked in recon, title, delivery, and funding?
- Which inventory units or deals are at risk of stalling?
- What requires same-day desk intervention?
- Where is workflow debt accumulating?

Priority changes relative to GM:
- move executive exceptions to the top
- promote inventory blockers, finance notices, title/funding pressure, and delivery queues
- keep pipeline visible but bias toward contracted, funded, and blocked transitions
- de-emphasize pure lead volume
- keep floorplan and capital visible if the desk role owns those decisions

Implemented top zones:
- blocker rail
- inventory recon / readiness
- title and funding queue
- deal completion / delivery flow
- operational accountability

Current blocker:
- finance notices still only cover lender-side pressure; richer operational event history and per-queue aging are still not first-class dashboard payload fields

## Shared-framework guidance
These role variants should share:
- shell and dashboard visual language
- KPI card primitives
- executive / manager summary lens pattern
- exception list pattern
- accountability rail pattern
- same RBAC and tenant-scoped data sources

These role variants should differ by:
- zone ordering
- widget weighting
- which derived summary lenses are shown first
- which queues are promoted into exceptions vs lower-priority context blocks

## Still not implemented
These remain future work even though the presets themselves are live:
- persisted per-user or per-role saved dashboard preset defaults
- dedicated rep ranking / coaching metrics
- deeper profitability measures, such as front/back gross splits and richer executive trend windows
- deeper event semantics for the material-changes feed, such as actor-rich audit context, queue aging, and domain-specific deduplication

## What not to do
- do not create separate backend contracts for each role before proving the common framework
- do not silently imply unsupported data fields just to make a role preset look complete
- do not split into separate visual systems for GM, Sales, and Ops
