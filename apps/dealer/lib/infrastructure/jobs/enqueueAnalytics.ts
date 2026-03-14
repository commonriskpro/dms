/**
 * Analytics / Alerts job producer.
 * Requires REDIS_URL. Pushes to BullMQ "analytics" / "alerts" queues; throws when Redis is unavailable.
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { recordJobEnqueue } from "@/lib/infrastructure/metrics/prometheus";
import { getQueueSingleton } from "@/lib/infrastructure/jobs/queueSingleton";

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
 * Enqueue an analytics computation job. Redis is required; throws if REDIS_URL is unset or enqueue fails.
 */
export async function enqueueAnalytics(data: AnalyticsJobData): Promise<void> {
  if (!data.dealershipId) {
    throw new Error("[jobs/enqueueAnalytics] Missing dealershipId");
  }
  if (!process.env.REDIS_URL) {
    throw new Error("[jobs/enqueueAnalytics] REDIS_URL is required for job enqueue");
  }
  const queue = await getQueueSingleton<AnalyticsJobData>("analytics");
  await queue.add("analytics", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  });
  recordJobEnqueue("analytics");
}

/**
 * Enqueue a CRM alert evaluation job. Redis is required; throws if REDIS_URL is unset or enqueue fails.
 */
export async function enqueueAlert(data: AlertJobData): Promise<void> {
  if (!data.dealershipId) {
    throw new Error("[jobs/enqueueAlert] Missing dealershipId");
  }
  if (!process.env.REDIS_URL) {
    throw new Error("[jobs/enqueueAlert] REDIS_URL is required for job enqueue");
  }
  const queue = await getQueueSingleton<AlertJobData>("alerts");
  await queue.add("alert", data, {
    attempts: 3,
    backoff: { type: "fixed", delay: 3000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
  });
  recordJobEnqueue("alerts");
}
