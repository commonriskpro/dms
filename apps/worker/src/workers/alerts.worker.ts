import { Worker, Job } from "bullmq";
import { redisConnection } from "../redis";
import { QUEUE_ALERTS, type AlertJobData } from "../queues";

async function processAlert(job: Job<AlertJobData>): Promise<void> {
  const { dealershipId, ruleId, triggeredAt } = job.data;
  const start = Date.now();

  console.log(
    `[alerts] Processing job ${job.id}: ruleId=${ruleId} dealership=${dealershipId} triggeredAt=${triggeredAt}`
  );

  try {
    await evaluateAlertRule(dealershipId, ruleId, triggeredAt);

    const duration = Date.now() - start;
    console.log(`[alerts] Completed job ${job.id} in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[alerts] Failed job ${job.id} after ${duration}ms:`, err);
    throw err;
  }
}

async function evaluateAlertRule(
  dealershipId: string,
  ruleId: string,
  _triggeredAt: string
): Promise<void> {
  // Placeholder: in production, load rule, check thresholds, send notifications
  console.log(`[alerts] Evaluating rule ${ruleId} for dealership ${dealershipId}`);
}

export function createAlertsWorker(): Worker {
  const worker = new Worker<AlertJobData>(QUEUE_ALERTS, processAlert, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[alerts] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[alerts] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
