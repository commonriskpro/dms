# Performance Run Summary
- Run ID: `2026-03-10T15-01-44-281Z`
- Started: 2026-03-10T15:01:44.281Z
- Finished: 2026-03-10T15:02:04.300Z
- Duration: 20019ms
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
| reports | passed | 0 | 2273 | salesSummary p95=0.45ms | `reports.log` |
| inventory | passed | 0 | 5947 | inventory total p95=324.9ms | `inventory.log` |
| dashboard | passed | 0 | 4793 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 2134 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 2547 | latency avg=153.08ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 2209 | latency avg=127.83ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.