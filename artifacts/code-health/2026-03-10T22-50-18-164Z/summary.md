# Dead Code Audit Summary

Generated: 2026-03-10T22:50:34.765Z

## dealer
- tsconfig: `apps/dealer/tsconfig.json`
- total findings: **1548**
- actionable findings: **246**

Top actionable entries:
- `apps/dealer/instrumentation.ts:6 - register`
- `apps/dealer/lib/env.ts:58 - assertEnv`
- `apps/dealer/lib/events.ts:5 - emit`
- `apps/dealer/lib/events.ts:20 - register`
- `apps/dealer/components/app-shell/index.tsx:13 - AppShell`
- `apps/dealer/components/journey-bar/index.ts:1 - SegmentedJourneyBar`
- `apps/dealer/components/journey-bar/index.ts:2 - JourneyBarStage`
- `apps/dealer/components/journey-bar/index.ts:2 - JourneyBarSignals`
- `apps/dealer/lib/api/pagination.ts:14 - PaginationMeta`
- `apps/dealer/lib/types/me.ts:4 - meCurrentDealershipPayloadSchema`
- `apps/dealer/lib/ui/toast.ts:21 - toastSuccess`
- `apps/dealer/lib/ui/toast.ts:25 - toastError`
- `apps/dealer/lib/ui/toast.ts:29 - toastInfo`
- `apps/dealer/lib/ui/toast.ts:33 - toastWarning`
- `apps/dealer/lib/ui/tokens.ts:20 - spacing`
- `apps/dealer/lib/ui/tokens.ts:31 - radius`
- `apps/dealer/lib/ui/tokens.ts:39 - shadow`
- `apps/dealer/modules/finance-core/schemas-deal-documents.ts:20 - createDealDocumentBodySchema`
- `apps/dealer/modules/lender-integration/schemas.ts:41 - dealIdParamSchema`
- `apps/dealer/app/api/crm/schemas.ts:116 - customerIdParamSchema`
- `apps/dealer/app/api/inventory/schemas.ts:262 - costDocumentCreateBodySchema`
- `apps/dealer/app/api/search/schemas.ts:21 - SearchQuery`
- `apps/dealer/components/ui-system/entities/index.ts:1 - EntityHeader`
- `apps/dealer/components/ui-system/entities/index.ts:2 - CustomerHeader`
- `apps/dealer/components/ui-system/entities/index.ts:3 - VehicleHeader`
- `apps/dealer/components/ui-system/entities/index.ts:4 - DealWorkspace`
- `apps/dealer/components/ui-system/feedback/index.ts:11 - EmptyStatePanel`
- `apps/dealer/components/ui-system/feedback/index.ts:10 - ErrorStatePanel`
- `apps/dealer/components/ui-system/feedback/index.ts:4 - LoadingSkeletonSet`
- `apps/dealer/components/ui-system/layout/index.ts:11 - PageShell`

## platform
- tsconfig: `apps/platform/tsconfig.json`
- total findings: **142**
- actionable findings: **2**

Top actionable entries:
- `apps/platform/instrumentation.ts:4 - register`
- `apps/platform/lib/env.ts:70 - assertEnv`

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
