# Performance Run Summary
- Run ID: `2026-03-10T14-19-48-291Z`
- Started: 2026-03-10T14:19:48.291Z
- Finished: 2026-03-10T14:20:29.436Z
- Duration: 41145ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `6cf3a09ac9d802d9f3c66bffd871887dbcc309cf`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- worker-burst: crmFailedEnqueueCount=40
## Seed Step
- Status: **PASSED** (exit 0, 10938ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 3846 | salesSummary p95=34ms | `reports.log` |
| inventory | passed | 0 | 7319 | inventory total p95=312ms | `inventory.log` |
| dashboard | passed | 0 | 5600 | dashboard p95=33ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 6327 | crmFailedEnqueueCount=40 | `worker-burst.log` |
| worker-bridge | passed | 0 | 4444 | latency avg=313.92ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 2563 | latency avg=160.33ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.