# Dead Code Audit Summary

Generated: 2026-03-10T21:29:02.743Z

## dealer
- tsconfig: `apps/dealer/tsconfig.json`
- total findings: **2070**
- actionable findings: **919**

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
- `apps/dealer/lib/api/validate.ts:4 - validateQuery`
- `apps/dealer/lib/api/validate.ts:8 - validateBody`
- `apps/dealer/lib/api/validate.ts:12 - validateParams`
- `apps/dealer/lib/constants/crm-stages.ts:33 - getStageColorVariant`
- `apps/dealer/lib/constants/crm-stages.ts:19 - CRM_TERMINAL_STAGES`
- `apps/dealer/lib/constants/permissions.ts:239 - ROLE_TEMPLATE_KEYS`
- `apps/dealer/lib/types/me.ts:13 - meDealershipsResponseSchema`
- `apps/dealer/lib/types/me.ts:28 - meCurrentDealershipGetResponseSchema`
- `apps/dealer/lib/types/me.ts:39 - meCurrentDealershipPostResponseSchema`
- `apps/dealer/lib/ui/icons.ts:28 - Eye`
- `apps/dealer/lib/ui/toast.ts:21 - toastSuccess`
- `apps/dealer/lib/ui/toast.ts:25 - toastError`
- `apps/dealer/lib/ui/toast.ts:29 - toastInfo`
- `apps/dealer/lib/ui/toast.ts:33 - toastWarning`
- `apps/dealer/lib/ui/tokens.ts:20 - spacing`
- `apps/dealer/lib/ui/tokens.ts:31 - radius`
- `apps/dealer/lib/ui/tokens.ts:39 - shadow`
- `apps/dealer/lib/ui/tokens.ts:126 - dashboardGrid`
- `apps/dealer/lib/ui/tokens.ts:149 - metricAccentBarClasses`
- `apps/dealer/lib/ui/tokens.ts:159 - sevBadgeClasses`
- `apps/dealer/modules/finance-core/schemas-deal-documents.ts:20 - createDealDocumentBodySchema`

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
