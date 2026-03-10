# Performance Run Summary
- Run ID: `2026-03-10T01-16-25-736Z`
- Started: 2026-03-10T01:16:25.736Z
- Finished: 2026-03-10T01:16:36.564Z
- Duration: 10828ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `f6350d102b773c6ef693835c60a6da038b0beb9f`
- Seed tier: `none`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Seed Step
- Skipped (`--seed none`)
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 1357 | salesSummary p95=0ms | `reports.log` |
| inventory | passed | 0 | 1515 | inventory total p95=0ms | `inventory.log` |
| dashboard | passed | 0 | 4248 | dashboard p95=0ms errors=1 | `dashboard.log` |
| worker-burst | passed | 0 | 2552 | crmFailedEnqueueCount=150 | `worker-burst.log` |
| worker-bridge | passed | 0 | 519 | latency avg=0ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 514 | latency avg=0ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.