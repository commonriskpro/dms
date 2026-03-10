# Performance Run Summary
- Run ID: `2026-03-10T21-37-28-152Z`
- Started: 2026-03-10T21:37:28.152Z
- Finished: 2026-03-10T21:37:34.876Z
- Duration: 6724ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `f48e2495f7004388ec5cafb6484747441ba19565`
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
| reports | passed | 0 | 780 | salesSummary p95=0.45ms | `reports.log` |
| inventory | passed | 0 | 951 | inventory total p95=10ms | `inventory.log` |
| dashboard | passed | 0 | 821 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1674 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 1528 | latency avg=17ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 832 | latency avg=13.17ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.