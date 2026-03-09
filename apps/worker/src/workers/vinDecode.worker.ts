import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_VIN_DECODE, type VinDecodeJobData } from "../queues";
import { redisConnection } from "../redis";

type VinDecodeWorkerResult = {
  dealershipId: string;
  vehicleId: string;
  vin: string;
  cacheWarmed: boolean;
  attachedDecode: boolean;
  skippedReason?: string | null;
};

export async function processVinDecodeJob(job: Job<VinDecodeJobData>): Promise<VinDecodeWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, vehicleId, vin } = job.data;

  console.log(
    `[vinDecode] start job=${job.id} dealership=${dealershipId} vehicleId=${vehicleId} vin=${vin} attempt=${job.attemptsMade + 1}`
  );

  const result = await postDealerInternalJob<VinDecodeWorkerResult>("/api/internal/jobs/vin-decode", {
    dealershipId,
    vehicleId,
    vin,
  });

  console.log(
    `[vinDecode] done job=${job.id} cacheWarmed=${result.cacheWarmed} attached=${result.attachedDecode} skipped=${result.skippedReason ?? "none"} durationMs=${Date.now() - startedAt}`
  );

  return result;
}

export function createVinDecodeWorker(): Worker {
  const worker = new Worker<VinDecodeJobData>(QUEUE_VIN_DECODE, processVinDecodeJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[vinDecode] completed job=${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[vinDecode] failed job=${job?.id} attempt=${job?.attemptsMade ?? 0} error=${error.message}`
    );
  });

  return worker;
}
