import { runTrackedInternalJob } from "../../../dealer/lib/internal-job-run";
import { runVinFollowUpJob } from "../../../dealer/modules/inventory/service/vin-followup";
import type { VinDecodeJobData } from "../queues";

export type VinDecodeWorkerResult = {
  dealershipId: string;
  vehicleId: string;
  vin: string;
  cacheWarmed: boolean;
  attachedDecode: boolean;
  skippedReason?: string | null;
};

/**
 * Direct shared-service execution path for vin decode follow-up jobs.
 * Mirrors dealer internal route semantics:
 * - runTrackedInternalJob wrapper
 * - same summary derivation for processed/failed/skipped
 * - same runVinFollowUpJob business logic execution
 */
export async function executeVinDecodeDirect(
  data: VinDecodeJobData
): Promise<VinDecodeWorkerResult> {
  const result = await runTrackedInternalJob(data.dealershipId, async () => {
    const vinResult = await runVinFollowUpJob(data.dealershipId, data.vehicleId, data.vin);
    return {
      data: vinResult,
      summary: {
        processed: vinResult.skippedReason ? 0 : 1,
        failed: 0,
        skippedReason: vinResult.skippedReason ?? null,
      },
    };
  });

  return result.data;
}
