# Performance Run Summary
- Run ID: `2026-03-10T18-48-56-694Z`
- Started: 2026-03-10T18:48:56.694Z
- Finished: 2026-03-10T18:49:00.153Z
- Duration: 3459ms
- Overall status: **FAILED**
- Git branch: `master`
- Git commit: `efb539fd2da24f245133d0edc01b169e2b3f883c`
- Seed tier: `medium`
- Dealership slug: `demo`
- Resolved dealership id: `n/a`
## Preflight Warnings
- none
## Scenario Warnings
- none
## Seed Step
- Status: **FAILED** (exit 1, 493ms)
- Log: `seed.log`
## Scenario Results
| Scenario | Status | Exit | Duration (ms) | Metrics | Log |
|---|---|---:|---:|---|---|
| reports | failed | 1 | 554 | No structured metrics parsed | `reports.log` |
| inventory | failed | 1 | 627 | No structured metrics parsed | `inventory.log` |
| dashboard | failed | 1 | 637 | No structured metrics parsed | `dashboard.log` |
| worker-burst | failed | 1 | 521 | No structured metrics parsed | `worker-burst.log` |
| worker-bridge | skipped | 0 | 0 | No structured metrics parsed | `worker-bridge.log` |
| platform-bridge | skipped | 0 | 519 | skipped: DEALER_INTERNAL_API_URL not reachable (fetch failed) | `platform-bridge.log` |
## Failures
- reports: exit 1
- inventory: exit 1
- dashboard: exit 1
- worker-burst: exit 1
## Skipped
- worker-bridge: No dealership id available. Provide --dealership-id or ensure reports scenario returns dealershipId.
- platform-bridge: DEALER_INTERNAL_API_URL not reachable (fetch failed)
## Next Actions
1. Inspect the failing scenario log files listed above.
2. Re-run a focused scenario command with the same args from this run.
3. Compare with previous successful run artifacts before changing code.