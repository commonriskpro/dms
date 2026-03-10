# Performance Simulation Report Template

Use this template to record repeatable benchmark runs from the simulation toolkit.

## 1. Run Metadata
- Date:
- Operator:
- Branch/commit:
- Environment: local / staging
- Dataset tier: small / medium / large
- Seeder command:
- Scenario commands executed:

## 2. Environment Snapshot
- Node version:
- Database: local Postgres / hosted Postgres
- Redis available: yes/no
- Dealer app URL:
- Worker app URL (if relevant):
- Platform app URL (if relevant):
- Profiling flags:
  - `REPORTS_PERF_PROFILE`:
  - `INVENTORY_OVERVIEW_PROFILE`:
  - `WORKER_INTERNAL_API_PROFILE`:
  - `PLATFORM_DEALER_BRIDGE_PROFILE`:

## 3. Scenario Results

### Reports
- Command:
- Iterations/warmup:
- Key outputs:
  - Sales summary latency:
  - Finance penetration latency:
  - Sales by user latency:
- Notes:

### Inventory
- Command:
- Iterations/warmup/pageSize:
- Key outputs:
  - Total latency:
  - Row count distribution:
  - If enabled, in-service profiling notes (`coreQueriesMs/enrichmentMs/totalMs`):
- Notes:

### Dashboard + Refresh
- Command:
- Iterations/mutation bursts:
- Key outputs:
  - Dashboard read latency:
  - Refresh job latency:
  - Post-refresh read latency:
  - Invalidated prefix summary:
- Notes:

### Worker Burst
- Command:
- Burst parameters:
- Key outputs:
  - Analytics enqueue latency:
  - Alerts enqueue latency:
  - CRM enqueue latency:
  - CRM enqueue failures:
  - Dealer job run delta (if measured):
- Notes:

### Worker Bridge
- Command:
- Key outputs:
  - Latency summary:
  - Error count/sample:
- Notes:

### Platform Bridge
- Command:
- Mode:
- Key outputs:
  - Latency summary:
  - Error count/sample:
- Notes:

## 4. Baseline vs Current Comparison
- Baseline reference (date/commit/tier):
- Current reference (date/commit/tier):
- Notable deltas:
  - Reports:
  - Inventory:
  - Dashboard:
  - Worker burst:
  - Bridge overhead:

## 5. Bottleneck Hypotheses
- Hypothesis 1:
  - Evidence:
  - Confidence: low/medium/high
- Hypothesis 2:
  - Evidence:
  - Confidence: low/medium/high

## 6. Recommended Next Actions
1. 
2. 
3. 

## 7. Raw Output Attachments
- Path(s) to saved JSON/stdout outputs:
- Any additional logs or traces:

## Optional JSON Summary Block
```json
{
  "runMeta": {
    "date": "",
    "commit": "",
    "environment": "local",
    "datasetTier": "medium"
  },
  "results": {
    "reports": {},
    "inventory": {},
    "dashboard": {},
    "workerBurst": {},
    "workerBridge": {},
    "platformBridge": {}
  },
  "regressions": [],
  "actions": []
}
```

