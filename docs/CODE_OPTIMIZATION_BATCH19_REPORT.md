# DMS Code Optimization Batch 19 Report

Date: 2026-03-10
Batch: Dead service symbol pruning + legacy inventory/customers UI component cleanup

## Scope
- Removed additional unused service/db exports and dead types.
- Removed a large set of unreferenced legacy UI component files in customers/inventory modules.
- Preserved behavior and tenant/RBAC semantics.

## Files removed
- `apps/dealer/modules/dashboard/ui/types.ts`
- `apps/dealer/modules/customers/ui/components/ActivityCard.tsx`
- `apps/dealer/modules/inventory/ui/components/InventoryHealthCard.tsx`
- `apps/dealer/modules/inventory/ui/components/InventoryRightRail.tsx`
- `apps/dealer/modules/inventory/ui/components/InventorySummaryCards.tsx`
- `apps/dealer/modules/inventory/ui/components/InventoryTableCard.tsx`
- `apps/dealer/modules/inventory/ui/components/ReconStatusCard.tsx`
- `apps/dealer/modules/inventory/ui/components/TeamActivityCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleCostsPageHeader.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleFloorplanCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleIntelligenceCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleMarketingDistributionCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleOverviewCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehiclePricingAutomationCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleReconCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleValuationCard.tsx`
- `apps/dealer/modules/inventory/ui/components/VehicleValuationsCard.tsx`

## Files updated (dead-symbol removal)
- `apps/dealer/modules/finance-core/service/lender-application.ts`
  - removed `getOutstandingStipulationsCount`
- `apps/dealer/modules/inventory/service/cost-ledger.ts`
  - removed `getAcquisitionSummary`
- `apps/dealer/modules/inventory/service/recon-items.ts`
  - removed `completeReconItem`
- `apps/dealer/modules/deals/service/funding.ts`
  - removed `markDealFunded`
- `apps/dealer/modules/deals/service/title.ts`
  - removed `markTitleReceived`, `placeTitleOnHold`
- `apps/dealer/modules/deals/db/funding.ts`
  - removed `getDealFundingById`, `listDealFundingsByDealId`
- `apps/dealer/modules/deals/db/trade.ts`
  - removed `getTradeById`
- `apps/dealer/modules/deals/db/fee.ts`
  - removed `getFeeById`
- `apps/dealer/modules/inventory/service/pricing.ts`
  - removed `getPricingRule`
- `apps/dealer/modules/onboarding/service/onboarding.ts`
  - removed `getState`, `isOnboardingComplete`, `shouldShowOnboarding`
- `apps/dealer/app/api/admin/inventory/vehicle-photos/backfill/schemas.ts`
  - removed type export `BackfillBody`
- `apps/dealer/modules/crm-pipeline-automation/ui/__tests__/test-utils.tsx`
  - removed type export `MockSessionOptions`

## Indirect usage checks
- Verified no direct imports for removed UI files.
- Checked for path-based imports and symbol references with `rg`; none remained outside deleted files.
- Confirmed removed files were not Next.js route-convention files.
- No test files were deleted.

## Validation Run (single consolidated gate)
1. `npm run test:dealer -- lib/bigint.test.ts lib/api/query.test.ts lib/api/list-response.test.ts modules/inventory/tests/acquisition-serialize.test.ts modules/inventory/tests/serialize-shared.test.ts` ✅
2. `npm run build:dealer` ✅
3. `npm run build:platform` ✅
4. `npm run audit:dead-code` ✅
   - artifact: `artifacts/code-health/2026-03-10T23-38-09-727Z`
   - dealer actionable: `136` (down from `145`)
   - platform actionable: `2` (unchanged)
   - worker actionable: `107` (down from `108`)

## Notes
- This batch remains non-behavioral cleanup: no route contract changes, no RBAC changes, no tenant-scope logic changes.
