import { randomUUID } from "node:crypto";
import * as dealerJobRunDb from "@/modules/crm-pipeline-automation/db/dealer-job-run";

type InternalJobRunSummary = {
  processed: number;
  failed: number;
  deadLetter?: number;
  skippedReason?: string | null;
};

export async function runTrackedInternalJob<T>(
  dealershipId: string,
  execute: () => Promise<{ data: T; summary: InternalJobRunSummary }>
): Promise<{ data: T; runId: string }> {
  const runId = randomUUID();
  const startedAt = new Date();

  try {
    const { data, summary } = await execute();
    const finishedAt = new Date();
    await dealerJobRunDb.createDealerJobRun(dealershipId, {
      runId,
      dealershipId,
      startedAt,
      finishedAt,
      processed: summary.processed,
      failed: summary.failed,
      deadLetter: summary.deadLetter ?? 0,
      skippedReason: summary.skippedReason ?? null,
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    });
    return { data, runId };
  } catch (error) {
    const finishedAt = new Date();
    await dealerJobRunDb.createDealerJobRun(dealershipId, {
      runId,
      dealershipId,
      startedAt,
      finishedAt,
      processed: 0,
      failed: 1,
      deadLetter: 0,
      skippedReason: null,
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    });
    throw error;
  }
}
