# Performance Run Summary
- Run ID: `2026-03-10T13-47-10-947Z`
- Started: 2026-03-10T13:47:10.947Z
- Finished: 2026-03-10T13:47:55.061Z
- Duration: 44114ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `f6350d102b773c6ef693835c60a6da038b0beb9f`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Status: **PASSED** (exit 0, 9069ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 4037 | salesSummary p95=38ms | `reports.log` |
| inventory | passed | 0 | 5887 | inventory total p95=320.3ms | `inventory.log` |
| dashboard | passed | 0 | 5574 | dashboard p95=39ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 6812 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 9857 | latency avg=749.5ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 2759 | latency avg=137.42ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.