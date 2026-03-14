# Manager Workspace Alignment

Dashboard V3 is the intentional home for **owners and managers**, not the generic home for everyone. This doc captures the UX target and section map. No backend or route rearchitecture.

## UX target (under one minute)

A manager should understand:

1. **Business health** — Are we on track? (ops score, gross movement, pipeline)
2. **Risk / bottlenecks** — What is blocked or at risk? (title, delivery, funding, finance notices, inventory, deal pressure)
3. **What changed today** — Recent material changes (deals, inventory, customer activity)
4. **Where intervention is needed** — Clear queues and actions (agenda, exceptions with links)

## Workspace organization

Content is grouped into four conceptual areas:

| Area | Purpose | Examples |
|------|---------|----------|
| **Revenue / performance** | Monitor profit and pipeline | Gross profit, open pipeline, deal stage counts, BHPH |
| **Pipeline health** | Deal flow and desk pressure | Pending deals, submitted, contracts to review, funding issues |
| **Inventory health** | Stock and recon | Inventory count, cars in recon, acquisition context |
| **Operational risk / queues** | Blockers and where to act | Title/delivery/funding queues, finance notices, inventory alerts, exception rails |

## Monitor vs act

- **Monitor**: Health score, metrics, material changes feed, floorplan. Informational; no immediate action required.
- **Act**: Exception rails (escalations), owner agenda, manager actions. Each item has a clear link to the right place (deals, CRM, inventory, lenders).

Section eyebrows and titles distinguish "Monitor" vs "Where to intervene" (act).

## Preset roles

- **Manager (GM)**: Default. Health → risk → what changed → where to intervene. Optimized for owners/GMs.
- **Sales**: Lead flow, demand, appointments, rep attention. For sales managers.
- **Ops**: Blockers, desk throughput, queue clearance. For desk/operations managers.

## Visual hierarchy

1. **Manager summary** (GM preset): Compact strip — health score, blocker count, material changes count, #1 intervention — so the first screenful answers "Am I needed?"
2. **Health at a glance**: Ops score, gross delta, open pipeline, key metrics.
3. **Risk & bottlenecks**: Exception rail(s) with severity and links.
4. **What changed today**: Material changes feed.
5. **Where to intervene**: Owner agenda / manager actions with clear CTAs.

## Terminology (shared language)

- **Needs intervention** — Exception rail title (blockers, risk queues).
- **Manager actions** — Owner agenda / top queues with links to act.
- **Health / Risk / Act** — Section framing in GM preset.

## Out of scope

- No major backend changes; reuse `getDashboardV3Data` and existing APIs.
- No turning the dashboard into the sales rep home; it stays manager-oriented.
- Server-first loading and permission patterns unchanged.
- Current dashboard V3 structure and presets preserved; only framing, labels, and section grouping are refined.
