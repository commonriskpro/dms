# Worker Bridge Matrix

Date: March 10, 2026

| Job type | Queue | Current dealer endpoint | Underlying service/module | Bridge overhead sensitivity | Direct-exec feasibility | Migration risk | Recommendation |
|---|---|---|---|---|---|---|---|
| analytics | `analytics` | `/api/internal/jobs/analytics` | `modules/intelligence/service/async-jobs.ts::runAnalyticsJob` + `lib/internal-job-run.ts` | High (frequent, small payload) | Easy | Medium | Migrate first |
| alerts | `alerts` | `/api/internal/jobs/alerts` | `modules/intelligence/service/async-jobs.ts::runAlertJob` + `lib/internal-job-run.ts` | High (frequent, small payload) | Easy | Medium | Migrate second |
| vinDecode | `vinDecode` | `/api/internal/jobs/vin-decode` (rollback/compat) | `modules/inventory/service/vin-followup.ts::runVinFollowUpJob` + `lib/internal-job-run.ts` | Medium | High | Low-Medium | Migrated to direct execution (default); keep bridge only for rollback/measurement |
| bulkImport | `bulkImport` | `/api/internal/jobs/bulk-import` | `modules/inventory/service/bulk.ts::runBulkImportJob` + `lib/internal-job-run.ts` | Medium (payload heavy, but DB work dominant) | Medium | Medium-High | Keep bridged initially; reassess with profiling |
| crmExecution | `crmExecution` | `/api/internal/jobs/crm` | `modules/crm-pipeline-automation/service/job-worker.ts::runJobWorker` | Medium | Medium | High | Keep bridged for now |
