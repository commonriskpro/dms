import { runTrackedInternalJob } from "../../../dealer/lib/internal-job-run";
import { runAnalyticsJob } from "../../../dealer/modules/intelligence/service/async-jobs";
import type { AnalyticsJobData } from "../queues";

export type AnalyticsWorkerResult = {
  dealershipId: string;
  type: string;
  invalidatedPrefixes: string[];
  signalRuns: Record<string, unknown>;
  skippedReason?: string | null;
};

/**
 * Direct shared-service execution path for analytics jobs.
 * Mirrors dealer internal route semantics:
 * - runTrackedInternalJob wrapper
 * - same summary derivation for processed/failed/skipped
 * - same runAnalyticsJob business logic execution
 */
export async function executeAnalyticsDirect(
  data: AnalyticsJobData
): Promise<AnalyticsWorkerResult> {
  const result = await runTrackedInternalJob(data.dealershipId, async () => {
    const analyticsResult = await runAnalyticsJob(
      data.dealershipId,
      data.type,
      data.context
    );
    return {
      data: analyticsResult,
      summary: {
        processed: analyticsResult.skippedReason ? 0 : 1,
        failed: 0,
        skippedReason: analyticsResult.skippedReason ?? null,
      },
    };
  });

  return result.data;
}

