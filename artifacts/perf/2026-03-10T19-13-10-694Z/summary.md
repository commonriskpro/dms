# Performance Run Summary
- Run ID: `2026-03-10T19-13-10-694Z`
- Started: 2026-03-10T19:13:10.694Z
- Finished: 2026-03-10T19:13:16.043Z
- Duration: 5349ms
- Overall status: **FAILED**
- Git branch: `master`
- Git commit: `efb539fd2da24f245133d0edc01b169e2b3f883c`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `a1000000-0000-0000-0000-000000000001`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Status: **PASSED** (exit 0, 1071ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 537 | salesSummary p95=1ms | `reports.log` |
| inventory | failed | 1 | 716 | No structured metrics parsed | `inventory.log` |
| dashboard | passed | 0 | 628 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1115 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 619 | latency avg=9.83ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 561 | latency avg=6.67ms errors=0 | `platform-bridge.log` |
## Failures
- inventory: exit 1
## Skipped
- none
## Next Actions
1. Inspect the failing scenario log files listed above.
2. Re-run a focused scenario command with the same args from this run.
3. Compare with previous successful run artifacts before changing code.