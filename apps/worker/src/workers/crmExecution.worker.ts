import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_CRM_EXECUTION, type CrmExecutionJobData } from "../queues";
import { redisConnection } from "../redis";
import { logWorkerSuccess } from "./logging";

type CrmExecutionWorkerResult = {
  processed: number;
  failed: number;
  deadLetter: number;
};

export async function processCrmExecutionJob(job: Job<CrmExecutionJobData>): Promise<CrmExecutionWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, source } = job.data;

  logWorkerSuccess(
    `[crmExecution] start job=${job.id} dealership=${dealershipId} source=${source ?? "unknown"} attempt=${job.attemptsMade + 1}`
  );

  const result = await postDealerInternalJob<CrmExecutionWorkerResult>("/api/internal/jobs/crm", job.data);

  logWorkerSuccess(
    `[crmExecution] done job=${job.id} processed=${result.processed} failed=${result.failed} deadLetter=${result.deadLetter} durationMs=${Date.now() - startedAt}`
  );

  return result;
}

export function createCrmExecutionWorker(): Worker {
  const worker = new Worker<CrmExecutionJobData>(QUEUE_CRM_EXECUTION, processCrmExecutionJob, {
    connection: redisConnection,
    concurrency: 2,
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[crmExecution] failed job=${job?.id} attempt=${job?.attemptsMade ?? 0} error=${error.message}`
    );
  });

  return worker;
}
