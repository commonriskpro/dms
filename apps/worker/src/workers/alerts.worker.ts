import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_ALERTS, type AlertJobData } from "../queues";
import { redisConnection } from "../redis";
import { logWorkerSuccess } from "./logging";
import { executeAlertsDirect, type AlertWorkerResult } from "./alerts.direct";

function alertsExecutionMode(): "direct" | "bridge" {
  return process.env.WORKER_ALERTS_EXECUTION_MODE === "bridge"
    ? "bridge"
    : "direct";
}

export async function processAlertJob(job: Job<AlertJobData>): Promise<AlertWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, ruleId, triggeredAt } = job.data;
  const mode = alertsExecutionMode();

  logWorkerSuccess(
    `[alerts] start job=${job.id} dealership=${dealershipId} ruleId=${ruleId} mode=${mode} attempt=${job.attemptsMade + 1}`
  );

  const result =
    mode === "direct"
      ? await executeAlertsDirect(job.data)
      : await postDealerInternalJob<AlertWorkerResult>("/api/internal/jobs/alerts", {
          dealershipId,
          ruleId,
          triggeredAt,
        });

  logWorkerSuccess(
    `[alerts] done job=${job.id} mode=${mode} skipped=${result.skippedReason ?? "none"} durationMs=${Date.now() - startedAt}`
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
