import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_ALERTS, type AlertJobData } from "../queues";
import { redisConnection } from "../redis";
import { logWorkerSuccess } from "./logging";

type AlertWorkerResult = {
  dealershipId: string;
  type: string;
  invalidatedPrefixes: string[];
  signalRuns: Record<string, unknown>;
  skippedReason?: string | null;
};

export async function processAlertJob(job: Job<AlertJobData>): Promise<AlertWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, ruleId, triggeredAt } = job.data;

  logWorkerSuccess(
    `[alerts] start job=${job.id} dealership=${dealershipId} ruleId=${ruleId} attempt=${job.attemptsMade + 1}`
  );

  const result = await postDealerInternalJob<AlertWorkerResult>("/api/internal/jobs/alerts", {
    dealershipId,
    ruleId,
    triggeredAt,
  });

  logWorkerSuccess(
    `[alerts] done job=${job.id} skipped=${result.skippedReason ?? "none"} durationMs=${Date.now() - startedAt}`
  );

  return result;
}

export function createAlertsWorker(): Worker {
  const worker = new Worker<AlertJobData>(QUEUE_ALERTS, processAlertJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[alerts] failed job=${job?.id} attempt=${job?.attemptsMade ?? 0} error=${error.message}`
    );
  });

  return worker;
}
