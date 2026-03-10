# Performance Run Summary
- Run ID: `2026-03-10T14-49-24-570Z`
- Started: 2026-03-10T14:49:24.570Z
- Finished: 2026-03-10T14:49:54.496Z
- Duration: 29926ms
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
- Status: **PASSED** (exit 0, 11799ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 2303 | salesSummary p95=0ms | `reports.log` |
| inventory | passed | 0 | 7101 | inventory total p95=313.95ms | `inventory.log` |
| dashboard | passed | 0 | 5345 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 2154 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | skipped | 0 | 595 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `worker-bridge.log` |
| platform-bridge | skipped | 0 | 523 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `platform-bridge.log` |
## Failures
- none
## Skipped
- worker-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
- platform-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.