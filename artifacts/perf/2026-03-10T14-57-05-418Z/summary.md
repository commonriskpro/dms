# Performance Run Summary
- Run ID: `2026-03-10T14-57-05-418Z`
- Started: 2026-03-10T14:57:05.418Z
- Finished: 2026-03-10T14:57:31.416Z
- Duration: 25998ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `db8e66994daf0eb3518fc6935cdd6c0e88ffc2bd`
- Seed tier: `none`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Skipped (`--seed none`)
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 2940 | salesSummary p95=0ms | `reports.log` |
| inventory | passed | 0 | 7990 | inventory total p95=314.35ms | `inventory.log` |
| dashboard | passed | 0 | 4869 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 2177 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 5411 | latency avg=388.5ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 2494 | latency avg=147ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.