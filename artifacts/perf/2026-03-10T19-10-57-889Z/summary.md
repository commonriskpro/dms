# Performance Run Summary
- Run ID: `2026-03-10T19-10-57-889Z`
- Started: 2026-03-10T19:10:57.889Z
- Finished: 2026-03-10T19:11:03.345Z
- Duration: 5456ms
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
- Status: **PASSED** (exit 0, 1141ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | passed | 0 | 585 | salesSummary p95=0ms | `reports.log` |
| inventory | failed | 1 | 677 | No structured metrics parsed | `inventory.log` |
| dashboard | passed | 0 | 649 | dashboard p95=1ms errors=0 | `dashboard.log` |
| worker-burst | passed | 0 | 1179 | crmFailedEnqueueCount=0 | `worker-burst.log` |
| worker-bridge | passed | 0 | 648 | latency avg=7.25ms errors=0 | `worker-bridge.log` |
| platform-bridge | skipped | 0 | 479 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `platform-bridge.log` |
## Failures
- inventory: exit 1
## Skipped
- platform-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
## Next Actions
1. Inspect the failing scenario log files listed above.
2. Re-run a focused scenario command with the same args from this run.
3. Compare with previous successful run artifacts before changing code.