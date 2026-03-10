# Performance Run Summary
- Run ID: `2026-03-10T19-05-20-126Z`
- Started: 2026-03-10T19:05:20.126Z
- Finished: 2026-03-10T19:05:26.453Z
- Duration: 6327ms
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
- Status: **PASSED** (exit 0, 1030ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 529 | salesSummary p95=0.45ms | `reports.log` |
| inventory | failed | 1 | 611 | No structured metrics parsed | `inventory.log` |
| dashboard | passed | 0 | 615 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1115 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 1787 | latency avg=15.25ms errors=0 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 542 | latency avg=6.83ms errors=0 | `platform-bridge.log` |
## Failures
- inventory: exit 1
## Skipped
- none
## Next Actions
1. Inspect the failing scenario log files listed above.
2. Re-run a focused scenario command with the same args from this run.
3. Compare with previous successful run artifacts before changing code.