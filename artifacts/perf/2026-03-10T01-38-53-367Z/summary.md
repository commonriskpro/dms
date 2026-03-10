# Performance Run Summary
- Run ID: `2026-03-10T01-38-53-367Z`
- Started: 2026-03-10T01:38:53.367Z
- Finished: 2026-03-10T01:39:36.370Z
- Duration: 43003ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `f6350d102b773c6ef693835c60a6da038b0beb9f`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- dashboard: reported errorCount=1
## Seed Step
- Status: **PASSED** (exit 0, 8708ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 3718 | salesSummary p95=32.45ms | `reports.log` |
| inventory | passed | 0 | 14583 | inventory total p95=911.5ms | `inventory.log` |
| dashboard | passed | 0 | 4405 | dashboard p95=0ms errors=1 | `dashboard.log` |
| worker-burst | passed | 0 | 10255 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 622 | latency avg=0ms errors=12 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 600 | latency avg=0ms errors=12 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.