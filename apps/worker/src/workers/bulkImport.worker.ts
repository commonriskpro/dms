import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_BULK_IMPORT, type BulkImportJobData } from "../queues";
import { redisConnection } from "../redis";
import { logWorkerSuccess } from "./logging";
import {
  executeBulkImportDirect,
  type BulkImportWorkerResult,
} from "./bulkImport.direct";

function bulkImportExecutionMode(): "direct" | "bridge" {
  return process.env.WORKER_BULKIMPORT_EXECUTION_MODE === "bridge"
    ? "bridge"
    : "direct";
}

export async function processBulkImportJob(job: Job<BulkImportJobData>): Promise<BulkImportWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, importId, rowCount, rows } = job.data;
  const mode = bulkImportExecutionMode();

  logWorkerSuccess(
    `[bulkImport] start job=${job.id} dealership=${dealershipId} importId=${importId} rows=${rowCount} mode=${mode} attempt=${job.attemptsMade + 1}`
  );

  await job.updateProgress(0);

  const result =
    mode === "direct"
      ? await executeBulkImportDirect(job.data)
      : await postDealerInternalJob<BulkImportWorkerResult>("/api/internal/jobs/bulk-import", {
          dealershipId,
          importId,
          requestedByUserId: job.data.requestedByUserId,
          rowCount,
          rows,
        });

  await job.updateProgress(100);
  logWorkerSuccess(
    `[bulkImport] done job=${job.id} mode=${mode} status=${result.status} processed=${result.processedRows} errors=${result.errorCount} durationMs=${Date.now() - startedAt}`
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
