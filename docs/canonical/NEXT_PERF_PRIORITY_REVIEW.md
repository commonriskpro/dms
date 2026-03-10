# Next Performance Priority Review

Date: March 10, 2026  
Source runs:
- Full suite (bridges skipped): `artifacts/perf/2026-03-10T13-44-32-697Z/summary.json`
- Full suite (bridges measured with reachable dealer target): `artifacts/perf/2026-03-10T13-47-10-947Z/summary.json`

## Measurement Basis
- Command used: `npm run perf:all -- --seed medium`
- Bridge reachability condition for measured run: dealer app reachable at `http://localhost:3000` during run.
- Scope compared: reports, inventory, dashboard, worker bridge, platform bridge.

## Current Hotspot Comparison (Latest Valid Measured Run)

| Area | Key Metric | Latest Value | Notes |
|---|---:|---:|---|
| Worker bridge | latency avg | `749.5ms` | `min=642ms`, `max=1576ms`, `errorCount=0` |
| Dashboard | refreshJobs p95 | `766.8ms` | Async refresh burst path; read p95 remains low |
| Inventory | total p95 | `320.3ms` | List/read path still heavier than reports/dashboard reads |
| Platform bridge | latency avg | `137.42ms` | `min=128ms`, `max=209ms`, `errorCount=0` |
| Dashboard reads | dashboardReads p95 | `39ms` | Stable and low |
| Reports | salesSummary p95 | `38ms` | Stable and low |

## Is Inventory Still the Top Optimization Priority?
No.

Inventory remains a meaningful hotspot (`p95=320.3ms`) but is no longer the highest valid measured latency path in this run. Worker bridge latency and dashboard refresh-job latency are currently higher.

## Highest Valid Measured Hotspot Now
`worker-bridge` is the highest measured hotspot in the latest run:
- `avg=749.5ms`
- `max=1576ms`
- no runtime errors (`errorCount=0`)

## Biggest Remaining Measurement Gap
Bridge metrics are now measurable, but still incomplete for optimization-quality decisions:
1. Bridge scenarios report `min/avg/max` only (no `p95`/distribution bins).
2. Measurements were taken against local `next dev` dealer server (`http://localhost:3000`), which can include dev-server overhead and does not represent production-mode routing/runtime behavior.
3. Worker bridge does not yet include clear per-segment timing breakdown (network vs dealer internal handler vs DB time) in the scenario output.

## Recommendation: Next Optimization Sprint Target
Target `worker bridge` latency first, with a measurement-first bridge deep-dive:
1. Add richer bridge metrics (`p50/p95`, tail percentiles, and per-hop timing if available).
2. Re-run bridge scenario in production-like mode (built server process, not only `next dev`) to validate hotspot persistence.
3. Optimize dealer internal analytics job endpoint path only after segmented timing confirms the dominant cost.

Secondary target after worker bridge:
- Dashboard refresh-job burst latency (`refreshJobs p95=766.8ms`) if bridge improvements do not materially reduce end-to-end async path times.

## Conservative Priority Decision
- Inventory optimization can pause for now at current stage.
- Next sprint should focus on worker/dealer bridge latency characterization and targeted reduction.
- Revisit inventory only if bridge/dashboard refresh work materially lowers end-to-end latency and inventory becomes top again in the next full measured run.
