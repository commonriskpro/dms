# Performance Run Summary
- Run ID: `2026-03-10T21-06-29-580Z`
- Started: 2026-03-10T21:06:29.580Z
- Finished: 2026-03-10T21:06:35.928Z
- Duration: 6348ms
- Overall status: **PASSED**
- Git branch: `master`
- Git commit: `f48e2495f7004388ec5cafb6484747441ba19565`
- Seed tier: `none`
- Dealership slug: `demo`
- Resolved dealership id: `d1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Skipped (`--seed none`)
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 815 | salesSummary p95=0ms | `reports.log` |
| inventory | passed | 0 | 1430 | inventory total p95=12.45ms | `inventory.log` |
| dashboard | passed | 0 | 1109 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1492 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | skipped | 0 | 669 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `worker-bridge.log` |
| platform-bridge | skipped | 0 | 691 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `platform-bridge.log` |
## Failures
- none
## Skipped
- worker-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
- platform-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
## Next Actions
1. Compare this run's summary.json with the previous run for trend changes.
2. If p95/avg regressions appear, open focused optimization tasks by domain.