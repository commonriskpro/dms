import { runTrackedInternalJob } from "../../../dealer/lib/internal-job-run";
import { runAlertJob } from "../../../dealer/modules/intelligence/service/async-jobs";
import type { AlertJobData } from "../queues";

export type AlertWorkerResult = {
  dealershipId: string;
  type: string;
  invalidatedPrefixes: string[];
  signalRuns: Record<string, unknown>;
  skippedReason?: string | null;
};

/**
 * Direct shared-service execution path for alerts jobs.
 * Mirrors dealer internal route semantics:
 * - runTrackedInternalJob wrapper
 * - same summary derivation for processed/failed/skipped
 * - same runAlertJob business logic execution
 */
export async function executeAlertsDirect(data: AlertJobData): Promise<AlertWorkerResult> {
  const result = await runTrackedInternalJob(data.dealershipId, async () => {
    const alertResult = await runAlertJob(data.dealershipId, data.ruleId, data.triggeredAt);
    return {
      data: alertResult,
      summary: {
        processed: alertResult.skippedReason ? 0 : 1,
        failed: 0,
        skippedReason: alertResult.skippedReason ?? null,
      },
    };
  });

  return result.data;
}
