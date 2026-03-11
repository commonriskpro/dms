# DMS Code Optimization Batch 20 Report

Date: 2026-03-10
Batch: Large delete-safe symbol pruning (26 dead exports/functions)

## Scope
- Removed 26 symbols verified as unreferenced across `apps/**` and `packages/**` (excluding docs/artifacts).
- Kept scope non-behavioral: no route contract changes, no RBAC/tenant logic changes, no async workflow changes.
- No test files deleted.

## Removed symbols (26)
1. `getSequenceStepById` (`apps/dealer/modules/crm-pipeline-automation/db/sequence-step.ts`)
2. `getStage` (`apps/dealer/modules/crm-pipeline-automation/service/stage.ts`)
3. `listRecentMessageActivities` (`apps/dealer/modules/customers/db/activity.ts`)
4. `countConversations` (`apps/dealer/modules/customers/db/activity.ts`)
5. `getNote` (`apps/dealer/modules/customers/service/note.ts`)
6. `getTask` (`apps/dealer/modules/customers/service/task.ts`)
7. `SaveLayoutBody` (`apps/dealer/modules/dashboard/schemas/dashboard-layout.ts`)
8. `approveApplication` (`apps/dealer/modules/dealer-application/service/application.ts`)
9. `rejectApplication` (`apps/dealer/modules/dealer-application/service/application.ts`)
10. `markActivationSent` (`apps/dealer/modules/dealer-application/service/application.ts`)
11. `createChecklistItem` (`apps/dealer/modules/deals/db/dmv.ts`)
12. `UpdateDealDeskInput` (`apps/dealer/modules/deals/service/deal-desk.ts`)
13. `countOutstandingStipulationsByLenderApplicationId` (`apps/dealer/modules/finance-core/db/lender-application.ts`)
14. `searchAuctionListingCache` (`apps/dealer/modules/inventory/db/auction-cache.ts`)
15. `getFloorplanByVehicleId` (`apps/dealer/modules/inventory/db/floorplan.ts`)
16. `getPricingRuleById` (`apps/dealer/modules/inventory/db/pricing-rule.ts`)
17. `listLineItems` (`apps/dealer/modules/inventory/db/recon.ts`)
18. `getPrimaryVehiclePhoto` (`apps/dealer/modules/inventory/db/vehicle-photo.ts`)
19. `clearPrimaryForVehicle` (`apps/dealer/modules/inventory/db/vehicle-photo.ts`)
20. `ValuationsListResponse` (`apps/dealer/modules/inventory/ui/types.ts`)
21. `FloorplanGetResponse` (`apps/dealer/modules/inventory/ui/types.ts`)
22. `getApplicantById` (`apps/dealer/modules/lender-integration/db/applicant.ts`)
23. `listApplicantsByApplicationId` (`apps/dealer/modules/lender-integration/db/applicant.ts`)
24. `createApplicant` (`apps/dealer/modules/lender-integration/db/applicant.ts`)
25. `updateApplicant` (`apps/dealer/modules/lender-integration/db/applicant.ts`)
26. `getStipulation` (`apps/dealer/modules/lender-integration/service/stipulation.ts`)

## Indirect usage checks
- Import graph check: each removed symbol was searched with `rg` across `apps/**` and `packages/**`; no external references found.
- Re-export check: no barrel-only reference path remained for these symbols.
- Dynamic/config checks: no registry/config-map or route-convention references found for removed symbol names.
- Framework-owned paths: no Next.js route files were removed/renamed.

## Validation (single gate after full batch)
1. `npm run test:dealer -- lib/bigint.test.ts lib/api/query.test.ts lib/api/list-response.test.ts modules/inventory/tests/acquisition-serialize.test.ts modules/inventory/tests/serialize-shared.test.ts` ✅
2. `npm run build:dealer` ✅
3. `npm run build:platform` ✅
4. `npm run audit:dead-code` ✅

Latest artifact:
- `artifacts/code-health/2026-03-10T23-47-49-006Z`

Dead-code summary delta from previous gate:
- dealer actionable: `136 -> 114`
- platform actionable: `2 -> 2`
- worker actionable: `107 -> 105`
