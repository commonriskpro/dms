import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_ANALYTICS, type AnalyticsJobData, type AnalyticsWorkerResult } from "../queues";
import { redisConnection } from "../redis";
import { logWorkerSuccess } from "./logging";

export async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<AnalyticsWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, type, context } = job.data;

  logWorkerSuccess(
    `[analytics] start job=${job.id} dealership=${dealershipId} type=${type} attempt=${job.attemptsMade + 1}`
  );

  const result = await postDealerInternalJob<AnalyticsWorkerResult>("/api/internal/jobs/analytics", {
    dealershipId,
    type,
    context,
  });

  logWorkerSuccess(
    `[analytics] done job=${job.id} type=${type} skipped=${result.skippedReason ?? "none"} invalidations=${result.invalidatedPrefixes.length} durationMs=${Date.now() - startedAt}`
  );

  return result;
}

export function createAnalyticsWorker(): Worker {
  const worker = new Worker<AnalyticsJobData>(QUEUE_ANALYTICS, processAnalyticsJob, {
    connection: redisConnection,
    concurrency: 10,
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[analytics] failed job=${job?.id} attempt=${job?.attemptsMade ?? 0} error=${error.message}`
    );
  });

  return worker;
}
