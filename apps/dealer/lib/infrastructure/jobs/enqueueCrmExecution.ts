/**
 * CRM execution job producer.
 * Canonical path: enqueue dealership-scoped CRM execution in BullMQ.
 * No sync fallback: routes should fail clearly when Redis/worker execution is unavailable.
 */

import { recordJobEnqueue } from "@/lib/infrastructure/metrics/prometheus";
import { getQueueSingleton } from "@/lib/infrastructure/jobs/queueSingleton";

const CRM_EXECUTION_QUEUE = "crmExecution";

export type CrmExecutionJobData = {
  dealershipId: string;
  source?: "manual" | "cron";
  triggeredByUserId?: string | null;
};

export type CrmExecutionEnqueueResult =
  | { enqueued: true }
  | { enqueued: false; reason: "missing_dealership_id" | "redis_unavailable" | "enqueue_failed" };

export async function enqueueCrmExecution(data: CrmExecutionJobData): Promise<CrmExecutionEnqueueResult> {
  if (!data.dealershipId) {
    console.error("[jobs/enqueueCrmExecution] Missing dealershipId - skipped");
    return { enqueued: false, reason: "missing_dealership_id" };
  }

  if (!process.env.REDIS_URL) {
    console.error("[jobs/enqueueCrmExecution] REDIS_URL missing - CRM execution queue unavailable");
    return { enqueued: false, reason: "redis_unavailable" };
  }

  try {
    const queue = await getQueueSingleton<CrmExecutionJobData>(CRM_EXECUTION_QUEUE);
    await queue.add("crmExecution", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
    recordJobEnqueue(CRM_EXECUTION_QUEUE);
    return { enqueued: true };
  } catch (err) {
    console.error("[jobs/enqueueCrmExecution] Failed to enqueue CRM execution:", err);
    return { enqueued: false, reason: "enqueue_failed" };
  }
}
