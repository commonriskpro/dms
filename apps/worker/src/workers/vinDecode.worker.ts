import { Job, Worker } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { QUEUE_VIN_DECODE, type VinDecodeJobData } from "../queues";
import { redisConnection } from "../redis";
import { logWorkerSuccess } from "./logging";
import {
  executeVinDecodeDirect,
  type VinDecodeWorkerResult,
} from "./vinDecode.direct";

function vinDecodeExecutionMode(): "direct" | "bridge" {
  return process.env.WORKER_VINDECODE_EXECUTION_MODE === "bridge"
    ? "bridge"
    : "direct";
}

export async function processVinDecodeJob(job: Job<VinDecodeJobData>): Promise<VinDecodeWorkerResult> {
  const startedAt = Date.now();
  const { dealershipId, vehicleId, vin } = job.data;
  const mode = vinDecodeExecutionMode();

  logWorkerSuccess(
    `[vinDecode] start job=${job.id} dealership=${dealershipId} vehicleId=${vehicleId} vin=${vin} mode=${mode} attempt=${job.attemptsMade + 1}`
  );

  const result =
    mode === "direct"
      ? await executeVinDecodeDirect(job.data)
      : await postDealerInternalJob<VinDecodeWorkerResult>("/api/internal/jobs/vin-decode", {
          dealershipId,
          vehicleId,
          vin,
        });

  logWorkerSuccess(
    `[vinDecode] done job=${job.id} mode=${mode} cacheWarmed=${result.cacheWarmed} attached=${result.attachedDecode} skipped=${result.skippedReason ?? "none"} durationMs=${Date.now() - startedAt}`
  );

  return result;
}

export function createVinDecodeWorker(): Worker {
  const worker = new Worker<VinDecodeJobData>(QUEUE_VIN_DECODE, processVinDecodeJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[vinDecode] failed job=${job?.id} attempt=${job?.attemptsMade ?? 0} error=${error.message}`
    );
  });

  return worker;
}
