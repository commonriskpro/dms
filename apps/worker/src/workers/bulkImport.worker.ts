import { Worker, Job } from "bullmq";
import { redisConnection } from "../redis";
import { QUEUE_BULK_IMPORT, type BulkImportJobData } from "../queues";

async function processBulkImport(job: Job<BulkImportJobData>): Promise<void> {
  const { dealershipId, importId, rowCount, rows } = job.data;
  const start = Date.now();

  console.log(
    `[bulkImport] Processing job ${job.id}: importId=${importId} rows=${rowCount} dealership=${dealershipId}`
  );

  try {
    let processed = 0;
    const batchSize = 25;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await processBatch(dealershipId, importId, batch);
      processed += batch.length;

      // Report progress to BullMQ
      await job.updateProgress(Math.round((processed / rowCount) * 100));
    }

    const duration = Date.now() - start;
    console.log(
      `[bulkImport] Completed job ${job.id}: ${processed} rows in ${duration}ms`
    );
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[bulkImport] Failed job ${job.id} after ${duration}ms:`, err);
    throw err;
  }
}

async function processBatch(
  _dealershipId: string,
  _importId: string,
  batch: Record<string, unknown>[]
): Promise<void> {
  // Placeholder: in production, upsert vehicles via Prisma with tenant isolation
  console.log(`[bulkImport] Processing batch of ${batch.length} rows`);
}

export function createBulkImportWorker(): Worker {
  const worker = new Worker<BulkImportJobData>(QUEUE_BULK_IMPORT, processBulkImport, {
    connection: redisConnection,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[bulkImport] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[bulkImport] Job ${job?.id} failed:`, err.message);
  });

  worker.on("progress", (job, progress) => {
    console.log(`[bulkImport] Job ${job.id} progress: ${progress}%`);
  });

  return worker;
}
