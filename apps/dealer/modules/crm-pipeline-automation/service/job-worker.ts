import * as jobDb from "../db/job";
import * as dealerJobRunDb from "../db/dealer-job-run";
import * as automationRunDb from "../db/automation-run";
import * as automationRuleDb from "../db/automation-rule";
import { executeRuleActions } from "./automation-engine";
import { auditLog } from "@/lib/audit";
import { processSequenceStepJob } from "./sequence";
import { getDealershipLifecycleStatus } from "@/lib/tenant-status";
import { logger } from "@/lib/logger";
import { captureApiException } from "@/lib/monitoring/sentry";

const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const BACKOFF_MIN_MS = 60 * 1000;

function nextRunAt(retryCount: number): Date {
  const delay = BACKOFF_MIN_MS * Math.pow(2, retryCount);
  return new Date(Date.now() + delay);
}

export async function runJobWorker(dealershipId: string): Promise<{ processed: number; failed: number; deadLetter: number }> {
  const runId = crypto.randomUUID();
  const startedAt = new Date();

  const lifecycleStatus = await getDealershipLifecycleStatus(dealershipId);
  if (lifecycleStatus !== "ACTIVE") {
    const durationMs = Math.max(0, Date.now() - startedAt.getTime());
    logger.info("Job worker skipped (tenant not active)", {
      requestId: runId,
      dealershipId,
      route: "job-worker",
      durationMs,
      skippedReason: "tenant_not_active",
      lifecycleStatus: lifecycleStatus ?? "unknown",
    });
    await auditLog({
      dealershipId,
      actorUserId: null,
      action: "job.skipped",
      entity: "Job",
      entityId: "",
      metadata: { reason: "tenant_not_active", lifecycleStatus: lifecycleStatus ?? "unknown" },
    });
    const finishedAt = new Date();
    await dealerJobRunDb.createDealerJobRun(dealershipId, {
      runId,
      dealershipId,
      startedAt,
      finishedAt,
      processed: 0,
      failed: 0,
      deadLetter: 0,
      skippedReason: "tenant_not_active",
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    });
    return { processed: 0, failed: 0, deadLetter: 0 };
  }
  const now = new Date();
  await jobDb.reclaimStuckRunningJobs(dealershipId, now);
  const claimed = await jobDb.claimNextPendingJobs(dealershipId, BATCH_SIZE, now);
  let processed = 0;
  let failed = 0;
  let deadLetter = 0;

  for (const job of claimed) {
    try {
      if (job.queueType === "automation") {
        const payload = job.payload as { ruleId: string; entityType: string; entityId: string; eventKey: string; runId?: string };
        const runId = payload.runId;
        if (runId && !(await automationRunDb.tryTransitionAutomationRunToRunning(dealershipId, runId))) {
          continue;
        }
        const rule = await automationRuleDb.getAutomationRuleById(dealershipId, payload.ruleId);
        if (rule) {
          await executeRuleActions(
            dealershipId,
            rule,
            payload.entityType,
            payload.entityId,
            {}
          );
          if (runId) await automationRunDb.updateAutomationRunStatus(dealershipId, runId, "completed");
        }
      } else if (job.queueType === "sequence_step") {
        await processSequenceStepJob(dealershipId, job.payload as Record<string, unknown>);
      }
      await jobDb.completeJob(dealershipId, job.id, new Date());
      await auditLog({
        dealershipId,
        actorUserId: null,
        action: "job.executed",
        entity: "Job",
        entityId: job.id,
        metadata: { jobId: job.id, queueType: job.queueType },
      });
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryCount = job.retryCount + 1;
      const goDeadLetter = retryCount >= (job.maxRetries ?? MAX_RETRIES);
      const errorCode = goDeadLetter ? "DEAD_LETTER" : "JOB_FAILED";
      logger.error("Job worker job failure", {
        requestId: runId,
        dealershipId,
        jobId: job.id,
        queueType: job.queueType,
        errorCode,
        errorName: err instanceof Error ? err.name : undefined,
      });
      captureApiException(err, {
        app: "dealer",
        requestId: runId,
        route: "job-worker",
        method: "background",
        dealershipId,
      });
      if (goDeadLetter) {
        await jobDb.failJob(dealershipId, job.id, message, { deadLetter: true });
        await auditLog({
          dealershipId,
          actorUserId: null,
          action: "job.dead_letter",
          entity: "Job",
          entityId: job.id,
          metadata: { jobId: job.id, queueType: job.queueType, errorCode: "DEAD_LETTER" },
        });
        deadLetter++;
      } else {
        await jobDb.failJob(dealershipId, job.id, message, {
          retry: true,
          nextRunAt: nextRunAt(retryCount),
        });
        await auditLog({
          dealershipId,
          actorUserId: null,
          action: "job.failed",
          entity: "Job",
          entityId: job.id,
          metadata: { jobId: job.id, queueType: job.queueType, retryCount },
        });
        failed++;
      }
    }
  }
  const finishedAt = new Date();
  await dealerJobRunDb.createDealerJobRun(dealershipId, {
    runId,
    dealershipId,
    startedAt,
    finishedAt,
    processed,
    failed,
    deadLetter,
    skippedReason: null,
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
  });
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  logger.info("Job worker run complete", {
    requestId: runId,
    dealershipId,
    route: "job-worker",
    processed,
    failed,
    deadLetter,
    durationMs,
  });
  return { processed, failed, deadLetter };
}
