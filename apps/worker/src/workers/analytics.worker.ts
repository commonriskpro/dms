import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_ANALYTICS, type AnalyticsJobData } from "../queues";
import { redisConnection } from "../redis";

type AnalyticsWorkerResult = {
  dealershipId: string;
  type: string;
  invalidatedPrefixes: string[];
  signalRuns: Record<string, unknown>;
  skippedReason?: string | null;
};

export async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<AnalyticsWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, type, context } = job.data;

  console.log(
    `[analytics] start job=${job.id} dealership=${dealershipId} type=${type} attempt=${job.attemptsMade + 1}`
  );

  const result = await postDealerInternalJob<AnalyticsWorkerResult>("/api/internal/jobs/analytics", {
    dealershipId,
    type,
    context,
  });

  console.log(
    `[analytics] done job=${job.id} type=${type} skipped=${result.skippedReason ?? "none"} invalidations=${result.invalidatedPrefixes.length} durationMs=${Date.now() - startedAt}`
  );

  return result;
}

export function createAnalyticsWorker(): Worker {
  const worker = new Worker<AnalyticsJobData>(QUEUE_ANALYTICS, processAnalyticsJob, {
    connection: redisConnection,
    concurrency: 10,
  });

  worker.on("completed", (job) => {
    console.log(`[analytics] completed job=${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[analytics] failed job=${job?.id} attempt=${job?.attemptsMade ?? 0} error=${error.message}`
    );
  });

  return worker;
}
