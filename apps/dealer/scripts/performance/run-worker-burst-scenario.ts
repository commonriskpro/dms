/**
 * Bursty async enqueue scenario runner.
 *
 * Simulates bursts of analytics/alerts/CRM enqueue traffic for one dealership.
 * This script measures enqueue latency and optional dealer job-run deltas after a wait window.
 */
import { PrismaClient } from "@prisma/client";
import { enqueueAnalytics, enqueueAlert } from "@/lib/infrastructure/jobs/enqueueAnalytics";
import { enqueueCrmExecution } from "@/lib/infrastructure/jobs/enqueueCrmExecution";
import {
  parseArgs,
  printJson,
  readIntArg,
  readStringArg,
  summarizeDurations,
  timed,
} from "./_utils";

const prisma = new PrismaClient();

async function resolveDealership(slug: string) {
  const dealership =
    (await prisma.dealership.findFirst({
      where: { slug },
      select: { id: true, slug: true },
    })) ??
    (await prisma.dealership.findFirst({
      select: { id: true, slug: true },
      orderBy: { createdAt: "asc" },
    }));
  if (!dealership) throw new Error("No dealership found.");
  return dealership;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const slug = readStringArg(args, "dealership-slug", "demo");
  const burstSize = readIntArg(args, "burst-size", 50);
  const bursts = readIntArg(args, "bursts", 3);
  const pauseMs = readIntArg(args, "pause-ms", 500);
  const waitAfterMs = readIntArg(args, "wait-after-ms", 0);

  const dealership = await resolveDealership(slug);
  const jobRunBefore = await prisma.dealerJobRun.count({
    where: { dealershipId: dealership.id },
  });

  const analyticsMs: number[] = [];
  const alertsMs: number[] = [];
  const crmMs: number[] = [];
  let crmFailed = 0;

  for (let burst = 0; burst < bursts; burst += 1) {
    for (let i = 0; i < burstSize; i += 1) {
      const type = (["inventory_dashboard", "sales_metrics", "customer_stats"] as const)[i % 3];

      const analyticsTiming = await timed(() =>
        enqueueAnalytics({
          dealershipId: dealership.id,
          type,
          context: { burst, i, source: "perf-burst" },
        })
      );
      analyticsMs.push(analyticsTiming.durationMs);

      const alertTiming = await timed(() =>
        enqueueAlert({
          dealershipId: dealership.id,
          ruleId: `perf-rule-${i % 5}`,
          triggeredAt: new Date().toISOString(),
        })
      );
      alertsMs.push(alertTiming.durationMs);

      const crmTiming = await timed(() =>
        enqueueCrmExecution({
          dealershipId: dealership.id,
          source: "manual",
          triggeredByUserId: null,
        })
      );
      crmMs.push(crmTiming.durationMs);
      if (!crmTiming.value.enqueued) crmFailed += 1;
    }

    if (pauseMs > 0 && burst < bursts - 1) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }

  if (waitAfterMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitAfterMs));
  }

  const jobRunAfter = await prisma.dealerJobRun.count({
    where: { dealershipId: dealership.id },
  });

  printJson("scenario.worker_burst.complete", {
    scenario: "worker-burst",
    dealershipSlug: dealership.slug ?? slug,
    dealershipId: dealership.id,
    params: {
      burstSize,
      bursts,
      pauseMs,
      waitAfterMs,
      redisConfigured: Boolean(process.env.REDIS_URL),
    },
    metrics: {
      analyticsEnqueue: summarizeDurations(analyticsMs),
      alertsEnqueue: summarizeDurations(alertsMs),
      crmEnqueue: summarizeDurations(crmMs),
      crmFailedEnqueueCount: crmFailed,
      dealerJobRunDelta: jobRunAfter - jobRunBefore,
    },
  });
}

run()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[perf/worker-burst] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
