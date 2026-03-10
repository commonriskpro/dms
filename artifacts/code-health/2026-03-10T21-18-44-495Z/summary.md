# Dead Code Audit Summary

Generated: 2026-03-10T21:18:54.948Z

## dealer
- tsconfig: `apps/dealer/tsconfig.json`
- total findings: **18**
- actionable findings: **16**

Top actionable entries:
- `/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-morph/dist/ts-morph.js:18643`
- `throw new common.errors.FileNotFoundError(this.fileSystemWrapper.getStandardizedAbsolutePath(filePath));`
- `^`
- `at DirectoryCoordinator.addSourceFileAtPath (/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-morph/dist/ts-morph.js:18643:19)`
- `at Project.addSourceFileAtPath (/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-morph/dist/ts-morph.js:20088:51)`
- `at /Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-morph/dist/ts-morph.js:20098:64`
- `at Array.map (<anonymous>)`
- `at Project._addSourceFilesForTsConfigResolver (/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-morph/dist/ts-morph.js:20098:50)`
- `at new Project (/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-morph/dist/ts-morph.js:19986:18)`
- `at Object.initialize (/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-prune/lib/initializer.js:6:19)`
- `at Object.run (/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-prune/lib/runner.js:18:33)`
- `at Object.<anonymous> (/Users/saturno/.npm/_npx/1532855dfcb86dac/node_modules/ts-prune/lib/index.js:10:28)`
- `at Module._compile (node:internal/modules/cjs/loader:1812:14) {`
- `code: 'ENOENT'`
- `}`
- `Node.js v24.14.0`

## platform
- tsconfig: `apps/platform/tsconfig.json`
- total findings: **145**
- actionable findings: **5**

Top actionable entries:
- `apps/platform/instrumentation.ts:4 - register`
- `apps/platform/lib/env.ts:70 - assertEnv`
- `apps/platform/lib/db/dealerships.ts:4 - getDealershipById`
- `apps/platform/lib/db/dealerships.ts:41 - updateDealershipStatus`
- `apps/platform/lib/db/subscriptions.ts:34 - getSubscriptionByDealershipId`

## worker
- tsconfig: `apps/worker/tsconfig.json`
- total findings: **370**
- actionable findings: **109**

Top actionable entries:
- `apps/dealer/lib/auth.ts:47 - requireUser`
- `apps/dealer/lib/auth.ts:59 - requireUserFromRequest`
- `apps/dealer/lib/redact.ts:75 - redactHeaders`
- `apps/dealer/lib/redact.ts:91 - redactQuery`
- `apps/dealer/lib/tenant-status.ts:60 - getDealershipLifecycleStatus`
- `apps/dealer/modules/crm-pipeline-automation/db/dealer-job-run.ts:55 - listDealerJobRuns`
- `apps/dealer/modules/inventory/service/alerts.ts:62 - listAlerts`
- `apps/dealer/modules/inventory/service/alerts.ts:125 - dismissAlert`
- `apps/dealer/modules/inventory/service/alerts.ts:163 - undoDismissal`
- `apps/dealer/modules/inventory/service/bulk.ts:158 - previewBulkImport`
- `apps/dealer/modules/inventory/service/bulk.ts:215 - applyBulkImport`
- `apps/dealer/modules/inventory/service/bulk.ts:382 - getBulkImportJob`
- `apps/dealer/modules/inventory/service/bulk.ts:428 - bulkUpdateVehicles`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:15 - ledgerTotalsToCostBreakdown`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:32 - getCostTotals`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:45 - listCostEntries`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:51 - listCostEntriesByVendor`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:60 - getCostEntry`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:144 - listCostDocuments`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:182 - getCostDocument`
- `apps/dealer/modules/inventory/service/cost-ledger.ts:212 - getAcquisitionSummary`
- `apps/dealer/modules/inventory/service/dashboard.ts:74 - getAlertCounts`
- `apps/dealer/modules/inventory/service/dashboard.ts:75 - AlertCounts`
- `apps/dealer/modules/inventory/service/inventory-intelligence-dashboard.ts:429 - getInventoryIntelligenceDashboard`
- `apps/dealer/modules/inventory/service/inventory-intelligence-dashboard.ts:578 - clearDashboardAggregateCacheForTesting`
- `apps/dealer/modules/inventory/service/inventory-page.ts:473 - getInventoryPageOverview`
- `apps/dealer/modules/inventory/service/valuation-engine.ts:13 - getVehicleValuation`
- `apps/dealer/modules/inventory/service/valuation-engine.ts:57 - recalculateVehicleValuation`
- `apps/dealer/modules/inventory/service/vehicle.ts:35 - projectedGrossCents`
- `apps/dealer/modules/inventory/service/vehicle.ts:54 - calculateVehicleCost`
