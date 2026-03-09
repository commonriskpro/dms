import { Worker, Job } from "bullmq";
import { redisConnection } from "../redis";
import { QUEUE_ANALYTICS, type AnalyticsJobData } from "../queues";

async function processAnalytics(job: Job<AnalyticsJobData>): Promise<void> {
  const { dealershipId, type, context } = job.data;
  const start = Date.now();

  console.log(
    `[analytics] Processing job ${job.id}: type=${type} dealership=${dealershipId}`
  );

  try {
    switch (type) {
      case "inventory_dashboard":
        await recomputeInventoryDashboard(dealershipId, context);
        break;
      case "vin_stats":
        await updateVinStats(dealershipId, context);
        break;
      case "sales_metrics":
        await updateSalesMetrics(dealershipId, context);
        break;
      case "customer_stats":
        await updateCustomerStats(dealershipId, context);
        break;
      case "alert_check":
        await runAlertCheck(dealershipId, context);
        break;
      default:
        console.warn(`[analytics] Unknown job type "${type}" — skipping`);
    }

    const duration = Date.now() - start;
    console.log(`[analytics] Completed job ${job.id} (${type}) in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[analytics] Failed job ${job.id} after ${duration}ms:`, err);
    throw err;
  }
}

async function recomputeInventoryDashboard(
  dealershipId: string,
  _context?: Record<string, unknown>
): Promise<void> {
  console.log(`[analytics] Recomputing inventory dashboard for dealership ${dealershipId}`);
}

async function updateVinStats(
  dealershipId: string,
  _context?: Record<string, unknown>
): Promise<void> {
  console.log(`[analytics] Updating VIN stats for dealership ${dealershipId}`);
}

async function updateSalesMetrics(
  dealershipId: string,
  _context?: Record<string, unknown>
): Promise<void> {
  console.log(`[analytics] Updating sales metrics for dealership ${dealershipId}`);
}

async function updateCustomerStats(
  dealershipId: string,
  _context?: Record<string, unknown>
): Promise<void> {
  console.log(`[analytics] Updating customer stats for dealership ${dealershipId}`);
}

async function runAlertCheck(
  dealershipId: string,
  _context?: Record<string, unknown>
): Promise<void> {
  console.log(`[analytics] Running alert check for dealership ${dealershipId}`);
}

export function createAnalyticsWorker(): Worker {
  const worker = new Worker<AnalyticsJobData>(QUEUE_ANALYTICS, processAnalytics, {
    connection: redisConnection,
    concurrency: 10,
  });

  worker.on("completed", (job) => {
    console.log(`[analytics] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[analytics] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
