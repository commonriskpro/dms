# Performance Run Summary
- Run ID: `2026-03-10T19-17-41-739Z`
- Started: 2026-03-10T19:17:41.739Z
- Finished: 2026-03-10T19:17:47.743Z
- Duration: 6004ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `efb539fd2da24f245133d0edc01b169e2b3f883c`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `d1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Status: **PASSED** (exit 0, 1137ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 660 | salesSummary p95=0.45ms | `reports.log` |
| inventory | passed | 0 | 828 | inventory total p95=8.45ms | `inventory.log` |
| dashboard | passed | 0 | 730 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1290 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 674 | latency avg=8.67ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 585 | latency avg=6.92ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.