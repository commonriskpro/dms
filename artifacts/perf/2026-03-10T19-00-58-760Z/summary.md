# Performance Run Summary
- Run ID: `2026-03-10T19-00-58-760Z`
- Started: 2026-03-10T19:00:58.760Z
- Finished: 2026-03-10T19:01:04.276Z
- Duration: 5516ms
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
- Status: **PASSED** (exit 0, 1076ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 591 | salesSummary p95=0ms | `reports.log` |
| inventory | failed | 1 | 703 | No structured metrics parsed | `inventory.log` |
| dashboard | passed | 0 | 666 | dashboard p95=0.45ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1170 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 603 | latency avg=0ms errors=12 | `worker-bridge.log` |
| platform-bridge | passed | 0 | 602 | latency avg=0ms errors=12 | `platform-bridge.log` |
## Failures
- inventory: exit 1
## Skipped
- none
## Next Actions
1. Inspect the failing scenario log files listed above.
2. Re-run a focused scenario command with the same args from this run.
3. Compare with previous successful run artifacts before changing code.