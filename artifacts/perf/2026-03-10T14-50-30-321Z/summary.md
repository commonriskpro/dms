# Performance Run Summary
- Run ID: `2026-03-10T14-50-30-321Z`
- Started: 2026-03-10T14:50:30.321Z
- Finished: 2026-03-10T14:50:51.516Z
- Duration: 21195ms
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
| reports | passed | 0 | 2051 | salesSummary p95=0.45ms | `reports.log` |
| inventory | passed | 0 | 5821 | inventory total p95=316.2ms | `inventory.log` |
| dashboard | passed | 0 | 4651 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 2290 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 3896 | latency avg=264.67ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 2376 | latency avg=123.33ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.