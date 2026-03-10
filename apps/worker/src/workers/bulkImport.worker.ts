import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_BULK_IMPORT, type BulkImportJobData } from "../queues";
import { redisConnection } from "../redis";
import { logWorkerSuccess } from "./logging";

type BulkImportWorkerResult = {
  jobId: string;
  status: "COMPLETED" | "FAILED";
  processedRows: number;
  errorCount: number;
};

export async function processBulkImportJob(job: Job<BulkImportJobData>): Promise<BulkImportWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, importId, rowCount, rows } = job.data;

  logWorkerSuccess(
    `[bulkImport] start job=${job.id} dealership=${dealershipId} importId=${importId} rows=${rowCount} attempt=${job.attemptsMade + 1}`
  );

  await job.updateProgress(0);

  const result = await postDealerInternalJob<BulkImportWorkerResult>("/api/internal/jobs/bulk-import", {
    dealershipId,
    importId,
    requestedByUserId: job.data.requestedByUserId,
    rowCount,
    rows,
  });

  await job.updateProgress(100);
  logWorkerSuccess(
    `[bulkImport] done job=${job.id} status=${result.status} processed=${result.processedRows} errors=${result.errorCount} durationMs=${Date.now() - startedAt}`
  );

  return result;
}

export function createBulkImportWorker(): Worker {
  const worker = new Worker<BulkImportJobData>(QUEUE_BULK_IMPORT, processBulkImportJob, {
    connection: redisConnection,
    concurrency: 2,
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[bulkImport] failed job=${job?.id} attempt=${job?.attemptsMade ?? 0} error=${error.message}`
    );
  });

  return worker;
}
