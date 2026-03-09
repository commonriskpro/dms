/**
 * Analytics / Alerts job producer.
 * When REDIS_URL is set → pushes to BullMQ "analytics" queue.
 * When no Redis → no-op (analytics are best-effort).
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { recordJobEnqueue } from "@/lib/infrastructure/metrics/prometheus";

export type AnalyticsJobData = {
  dealershipId: string;
  type:
    | "inventory_dashboard"
    | "vin_stats"
    | "sales_metrics"
    | "customer_stats"
    | "alert_check"
    | string;
  context?: Record<string, unknown>;
};

export type AlertJobData = {
  dealershipId: string;
  ruleId: string;
  triggeredAt: string; // ISO 8601
};

/**
 * Enqueue an analytics computation job.
 * Best-effort: failures are logged but do not affect caller.
 */
export async function enqueueAnalytics(data: AnalyticsJobData): Promise<void> {
  if (!data.dealershipId) {
    console.error("[jobs/enqueueAnalytics] Missing dealershipId — skipped");
    return;
  }

  if (process.env.REDIS_URL) {
    try {
      const { Queue } = await import("bullmq");
      const { redisConnection } = await import("@/lib/infrastructure/jobs/redis");
      const queue = new Queue("analytics", { connection: redisConnection });
      await queue.add("analytics", data, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      });
      recordJobEnqueue("analytics");
    } catch (err) {
      console.error("[jobs/enqueueAnalytics] Failed to enqueue:", err);
    }
    return;
  }

  // No Redis: best-effort no-op — analytics are not critical path
  recordJobEnqueue("analytics");
}

/**
 * Enqueue a CRM alert evaluation job.
 * Best-effort: failures are logged but do not affect caller.
 */
export async function enqueueAlert(data: AlertJobData): Promise<void> {
  if (!data.dealershipId) {
    console.error("[jobs/enqueueAlert] Missing dealershipId — skipped");
    return;
  }

  if (process.env.REDIS_URL) {
    try {
      const { Queue } = await import("bullmq");
      const { redisConnection } = await import("@/lib/infrastructure/jobs/redis");
      const queue = new Queue("alerts", { connection: redisConnection });
      await queue.add("alert", data, {
        attempts: 3,
        backoff: { type: "fixed", delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 100 },
      });
      recordJobEnqueue("alerts");
    } catch (err) {
      console.error("[jobs/enqueueAlert] Failed to enqueue:", err);
    }
    return;
  }

  recordJobEnqueue("alerts");
}
