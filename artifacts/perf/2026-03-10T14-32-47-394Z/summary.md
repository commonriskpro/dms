# Performance Run Summary
- Run ID: `2026-03-10T14-32-47-394Z`
- Started: 2026-03-10T14:32:47.394Z
- Finished: 2026-03-10T14:33:22.038Z
- Duration: 34644ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `db8e66994daf0eb3518fc6935cdd6c0e88ffc2bd`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Status: **PASSED** (exit 0, 12287ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 2378 | salesSummary p95=0.45ms | `reports.log` |
| inventory | passed | 0 | 6068 | inventory total p95=361.3ms | `inventory.log` |
| dashboard | passed | 0 | 4748 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 2257 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 4459 | latency avg=316.92ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 2336 | latency avg=131.5ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.