# Performance Run Summary
- Run ID: `2026-03-10T19-18-44-910Z`
- Started: 2026-03-10T19:18:44.910Z
- Finished: 2026-03-10T19:18:50.392Z
- Duration: 5482ms
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
- Status: **PASSED** (exit 0, 1057ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 562 | salesSummary p95=0ms | `reports.log` |
| inventory | passed | 0 | 798 | inventory total p95=9.45ms | `inventory.log` |
| dashboard | passed | 0 | 646 | dashboard p95=0.45ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1137 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 629 | latency avg=6.67ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 552 | latency avg=5.42ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.