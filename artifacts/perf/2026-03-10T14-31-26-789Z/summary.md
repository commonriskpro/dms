# Performance Run Summary
- Run ID: `2026-03-10T14-31-26-789Z`
- Started: 2026-03-10T14:31:26.789Z
- Finished: 2026-03-10T14:31:45.383Z
- Duration: 18594ms
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
| reports | passed | 0 | 2901 | salesSummary p95=0.85ms | `reports.log` |
| inventory | passed | 0 | 5131 | inventory total p95=507.35ms | `inventory.log` |
| dashboard | passed | 0 | 5521 | dashboard p95=0.85ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1707 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 2007 | latency avg=329.75ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 1218 | latency avg=138.25ms errors=0 | `platform-bridge.log` |
## Failures
- none
## Skipped
- none
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.