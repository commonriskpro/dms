# Performance Run Summary
- Run ID: `2026-03-10T20-46-55-118Z`
- Started: 2026-03-10T20:46:55.118Z
- Finished: 2026-03-10T20:46:59.776Z
- Duration: 4658ms
- Overall status: **FAILED**
- Git branch: `master`
- Git commit: `f48e2495f7004388ec5cafb6484747441ba19565`
- Seed tier: `none`
- Dealership slug: `demo`
- Resolved dealership id: `n/a`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Skipped (`--seed none`)
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | failed | 1 | 511 | No structured metrics parsed | `reports.log` |
| inventory | passed | 0 | 1210 | inventory total p95=11.35ms | `inventory.log` |
| dashboard | passed | 0 | 798 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1370 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | skipped | 0 | 0 | No structured metrics parsed | `worker-bridge.log` |
| platform-bridge | skipped | 0 | 614 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `platform-bridge.log` |
## Failures
- reports: exit 1
## Skipped
- worker-bridge: No dealership id available. Provide --dealership-id or ensure reports scenario returns dealershipId.
- platform-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
## Next Actions
1. Inspect the failing scenario log files listed above.
2. Re-run a focused scenario command with the same args from this run.
3. Compare with previous successful run artifacts before changing code.