# Performance Run Summary
- Run ID: `2026-03-10T01-47-37-594Z`
- Started: 2026-03-10T01:47:37.594Z
- Finished: 2026-03-10T01:48:25.757Z
- Duration: 48163ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `f6350d102b773c6ef693835c60a6da038b0beb9f`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Status: **PASSED** (exit 0, 8895ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 4882 | salesSummary p95=55.45ms | `reports.log` |
| inventory | passed | 0 | 17173 | inventory total p95=1070.65ms | `inventory.log` |
| dashboard | passed | 0 | 6094 | dashboard p95=56ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 9898 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | skipped | 0 | 577 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `worker-bridge.log` |
| platform-bridge | skipped | 0 | 525 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `platform-bridge.log` |
## Failures
- none
## Skipped
- worker-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
- platform-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.