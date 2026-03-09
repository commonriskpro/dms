import { Worker, Job } from "bullmq";
import { redisConnection } from "../redis";
import { QUEUE_VIN_DECODE, type VinDecodeJobData } from "../queues";

async function processVinDecode(job: Job<VinDecodeJobData>): Promise<void> {
  const { dealershipId, vehicleId, vin } = job.data;
  const start = Date.now();

  console.log(`[vinDecode] Processing job ${job.id}: vin=${vin} vehicle=${vehicleId} dealership=${dealershipId}`);

  try {
    // Post-processing: warm cache, update analytics metadata, etc.
    // The actual VIN decode happens synchronously in the route handler;
    // this worker handles async follow-up tasks.
    await warmVinCache(dealershipId, vehicleId, vin);

    const duration = Date.now() - start;
    console.log(`[vinDecode] Completed job ${job.id} in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[vinDecode] Failed job ${job.id} after ${duration}ms:`, err);
    throw err;
  }
}

async function warmVinCache(
  _dealershipId: string,
  _vehicleId: string,
  vin: string
): Promise<void> {
  // Placeholder: in production, call VIN provider and update VinDecodeCache table
  console.log(`[vinDecode] Cache warm-up for VIN: ${vin}`);
}

export function createVinDecodeWorker(): Worker {
  const worker = new Worker<VinDecodeJobData>(QUEUE_VIN_DECODE, processVinDecode, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[vinDecode] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[vinDecode] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
