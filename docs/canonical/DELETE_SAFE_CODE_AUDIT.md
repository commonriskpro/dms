# Delete-Safe Code Audit

Date: March 10, 2026  
Scope: repository-wide delete-safety audit focused on dealer/module barrels and dead-code candidates.

## Objective
Apply the agreed checklist to identify code that is safe to delete in larger batches:
1. No imports (alias paths, barrels, dynamic imports).
2. Not referenced by registries/config maps/route conventions.
3. No required side effects on import.
4. Build + tests + perf gate pass after removal.
5. Dead-code audit confirms no regressions.

## Validation Gates (Current Baseline)
- `npm run build:dealer` ✅
- `npm run build:platform` ✅
- `npm run test:dealer` ✅ (`228/229` suites executed, `1` skipped)
- `npm run test:platform` ✅
- `npm run perf:all -- --seed none` ✅  
  Artifact: `artifacts/perf/2026-03-10T21-37-28-152Z`
- `npm run audit:dead-code` ✅  
  Artifact: `artifacts/code-health/2026-03-10T21-37-27-675Z`

## Method
- Started from latest actionable dead-code output.
- Verified importer counts for candidate files using:
  - alias import checks (`from "@/..."`)
  - module-local relative directory-import checks (`from "../db"`, `from "../service"`)
  - dynamic import/path-string scans.
- Excluded files with framework conventions or non-export side effects.
- Kept tests untouched in this audit.

## Delete-Safe Candidates (High Confidence)
The following files are export-only barrels with:
- alias importer count = `0`
- relative directory-import count = `0`
- no route/framework conventions
- no side-effect code

1. `apps/dealer/modules/accounting-core/db/index.ts`
2. `apps/dealer/modules/accounting-core/service/index.ts`
3. `apps/dealer/modules/core-platform/db/index.ts`
4. `apps/dealer/modules/core-platform/service/index.ts`
5. `apps/dealer/modules/crm-pipeline-automation/db/index.ts`
6. `apps/dealer/modules/crm-pipeline-automation/service/index.ts`
7. `apps/dealer/modules/customers/db/index.ts`
8. `apps/dealer/modules/customers/service/index.ts`
9. `apps/dealer/modules/dealer-application/db/index.ts`
10. `apps/dealer/modules/deals/db/index.ts`
11. `apps/dealer/modules/deals/service/index.ts`
12. `apps/dealer/modules/documents/db/index.ts`
13. `apps/dealer/modules/documents/service/index.ts`
14. `apps/dealer/modules/finance-core/db/index.ts`
15. `apps/dealer/modules/finance-core/service/index.ts`
16. `apps/dealer/modules/inventory/db/index.ts`
17. `apps/dealer/modules/inventory/service/index.ts`
18. `apps/dealer/modules/platform-admin/db/index.ts`
19. `apps/dealer/modules/platform-admin/service/index.ts`
20. `apps/dealer/modules/reporting-core/db/index.ts`
21. `apps/dealer/modules/reporting-core/service/index.ts`
22. `apps/dealer/modules/reports/db/index.ts`

## Not Delete-Safe Yet (Confirmed References)
These still have importers and must not be deleted in the same sweep:

1. `apps/dealer/modules/lender-integration/db/index.ts`  
Reason: referenced via module-local relative import in tests (`../db`).

2. `apps/dealer/modules/lender-integration/service/index.ts`  
Reason: referenced via module-local relative import in tests (`../service`).

3. `apps/dealer/modules/finance-shell/db/index.ts`  
Reason: referenced in runtime/service and tests.

4. `apps/dealer/modules/finance-shell/service/index.ts`  
Reason: referenced in API routes/tests.

5. `apps/dealer/modules/reports/service/index.ts`  
Reason: referenced in API routes and tests.

## Registry / Convention Check Notes
- No candidate file maps to Next.js app-router conventions (`page.tsx`, `layout.tsx`, `route.ts`, `instrumentation.ts`, etc.).
- No candidate file is referenced by known config/registry maps.
- Candidates are plain `index.ts` barrel exports only.

## Recommended Execution Plan
1. Delete only the 22 high-confidence files above in one batch.
2. Re-run full gate:
   - `npm run build:dealer`
   - `npm run build:platform`
   - `npm run test:dealer`
   - `npm run test:platform`
   - `npm run perf:all -- --seed none`
   - `npm run audit:dead-code`
3. If green, record delta in `docs/canonical/CODE_CLEANUP_PHASE3_REPORT.md`.

## Expected Impact
- Low behavioral risk (barrel-only removals).
- Meaningful dead-code reduction.
- Cleaner module boundaries (consumers already import concrete files).

---

## Execution Result (March 10, 2026)
Status: Executed exactly as planned.

### Gate outcomes after deletion batch
- `npm run build:dealer` ✅
- `npm run build:platform` ✅
- `npm run test:dealer` ✅
- `npm run test:platform` ✅
- `npm run perf:all -- --seed none` ✅  
  Artifact: `artifacts/perf/2026-03-10T21-51-16-402Z`
- `npm run audit:dead-code` ✅  
  Artifact: `artifacts/code-health/2026-03-10T21-51-16-001Z`

### Dead-code delta after execution
- Dealer actionable: `904 -> 246` (`-658`)
- Platform actionable: `2 -> 2` (`0`)
