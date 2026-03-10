# Dead Code Audit Summary

Generated: 2026-03-10T19:52:22.429Z

## dealer
- tsconfig: `apps/dealer/tsconfig.json`
- total findings: **2170**
- actionable findings: **1017**

Top actionable entries:
- `apps/dealer/instrumentation.ts:6 - register`
- `apps/dealer/components/auth-guard.tsx:55 - RequirePermission`
- `apps/dealer/components/toast.tsx:9 - ToastType`
- `apps/dealer/components/toast.tsx:9 - ToastItem`
- `apps/dealer/components/toast.tsx:10 - ToastProvider`
- `apps/dealer/lib/env.ts:58 - assertEnv`
- `apps/dealer/lib/events.ts:5 - emit`
- `apps/dealer/lib/events.ts:20 - register`
- `apps/dealer/lib/integration-test-data.ts:36 - createIsolatedDealFixture`
- `apps/dealer/components/app-shell/index.tsx:13 - AppShell`
- `apps/dealer/components/dashboard-v3/CrmPromoCard.tsx:6 - CrmPromoCard`
- `apps/dealer/components/dashboard-v3/InventoryAlertsCard.tsx:23 - InventoryAlertsCard`
- `apps/dealer/components/dashboard-v3/QuickActionsCard.tsx:27 - QuickActionsCard`
- `apps/dealer/components/dashboard-v3/RecommendedActionsCard.tsx:82 - RecommendedActionsCard`
- `apps/dealer/components/dashboard-v3/RefreshIcon.tsx:3 - RefreshIcon`
- `apps/dealer/components/dashboard-v3/WidgetRowLink.tsx:16 - WidgetRowLink`
- `apps/dealer/components/journey-bar/index.ts:1 - SegmentedJourneyBar`
- `apps/dealer/components/journey-bar/index.ts:2 - SegmentedJourneyBarProps`
- `apps/dealer/components/journey-bar/index.ts:3 - JourneyBarStage`
- `apps/dealer/components/journey-bar/index.ts:3 - JourneyBarSignals`
- `apps/dealer/components/journey-bar/index.ts:3 - SegmentState`
- `apps/dealer/components/journey-bar/index.ts:4 - getNextBestActionLabel`
- `apps/dealer/components/journey-bar/index.ts:4 - NEXT_BEST_ACTION_LABELS`
- `apps/dealer/components/layout/Sidebar.tsx:4 - Sidebar`
- `apps/dealer/components/layout/Topbar.tsx:4 - Topbar`
- `apps/dealer/components/ui/app-card.tsx:17 - AppCard`
- `apps/dealer/components/ui/app-card.tsx:29 - AppCardContent`
- `apps/dealer/components/ui/app-card.tsx:42 - AppCardHeader`
- `apps/dealer/components/ui/app-card.tsx:54 - AppCardTitle`
- `apps/dealer/components/ui/app-card.tsx:69 - AppCardFooter`

## platform
- tsconfig: `apps/platform/tsconfig.json`
- total findings: **141**
- actionable findings: **5**

Top actionable entries:
- `apps/platform/instrumentation.ts:4 - register`
- `apps/platform/lib/env.ts:70 - assertEnv`
- `apps/platform/lib/db/dealerships.ts:4 - getDealershipById`
- `apps/platform/lib/db/dealerships.ts:41 - updateDealershipStatus`
- `apps/platform/lib/db/subscriptions.ts:34 - getSubscriptionByDealershipId`

## worker
- tsconfig: `apps/worker/tsconfig.json`
- total findings: **372**
- actionable findings: **111**

Top actionable entries:
- `apps/dealer/lib/auth.ts:47 - requireUser`
- `apps/dealer/lib/auth.ts:59 - requireUserFromRequest`
- `apps/dealer/lib/redact.ts:75 - redactHeaders`
- `apps/dealer/lib/redact.ts:91 - redactQuery`
- `apps/dealer/lib/tenant-status.ts:60 - getDealershipLifecycleStatus`
- `apps/dealer/lib/db/date-utils.ts:13 - daysBetween`
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
