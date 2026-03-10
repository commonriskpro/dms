# Performance Run Summary
- Run ID: `2026-03-10T19-21-16-244Z`
- Started: 2026-03-10T19:21:16.244Z
- Finished: 2026-03-10T19:21:27.006Z
- Duration: 10762ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `efb539fd2da24f245133d0edc01b169e2b3f883c`
- Seed tier: `none`
- Dealership slug: `demo`
- Resolved dealership id: `d1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Skipped (`--seed none`)
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 545 | salesSummary p95=1ms | `reports.log` |
| inventory | passed | 0 | 746 | inventory total p95=9.45ms | `inventory.log` |
| dashboard | passed | 0 | 642 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1142 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 5106 | latency avg=356.25ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 2475 | latency avg=151.25ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.