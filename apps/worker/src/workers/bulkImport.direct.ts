import { runTrackedInternalJob } from "../../../dealer/lib/internal-job-run";
import { runBulkImportJob } from "../../../dealer/modules/inventory/service/bulk";
import type { BulkImportJobData } from "../queues";

export type BulkImportWorkerResult = {
  jobId: string;
  status: "COMPLETED" | "FAILED";
  processedRows: number;
  errorCount: number;
};

/**
 * Direct shared-service execution path for bulk import jobs.
 * Mirrors dealer internal route semantics:
 * - runTrackedInternalJob wrapper
 * - same summary derivation for processed/failed
 * - same runBulkImportJob business logic execution
 */
export async function executeBulkImportDirect(
  data: BulkImportJobData
): Promise<BulkImportWorkerResult> {
  const result = await runTrackedInternalJob(data.dealershipId, async () => {
    const bulkResult = await runBulkImportJob(
      data.dealershipId,
      data.importId,
      data.requestedByUserId,
      data.rows
    );
    return {
      data: bulkResult,
      summary: {
        processed: bulkResult.processedRows,
        failed: bulkResult.errorCount,
      },
    };
  });

  return result.data;
}
