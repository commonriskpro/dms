# Performance Run Summary
- Run ID: `2026-03-10T14-29-05-171Z`
- Started: 2026-03-10T14:29:05.171Z
- Finished: 2026-03-10T14:29:20.887Z
- Duration: 15716ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `6cf3a09ac9d802d9f3c66bffd871887dbcc309cf`
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
| reports | passed | 0 | 2442 | salesSummary p95=704ms | `reports.log` |
| inventory | passed | 0 | 4396 | inventory total p95=2499.5ms | `inventory.log` |
| dashboard | passed | 0 | 4665 | dashboard p95=1156.2ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1698 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 1386 | latency avg=343ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 988 | latency avg=152.5ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.