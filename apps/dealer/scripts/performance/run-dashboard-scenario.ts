/**
 * Dashboard KPI/event refresh scenario runner.
 *
 * Measures repeated reads plus event-driven refresh jobs.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getDashboardV3Data } from "@/modules/dashboard/service/getDashboardV3Data";
import { runAnalyticsJob } from "@/modules/intelligence/service/async-jobs";
import {
  parseArgs,
  printJson,
  readIntArg,
  readStringArg,
  summarizeDurations,
  timed,
} from "./_utils";

async function resolveContext(slug: string) {
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
  const membership = await prisma.membership.findFirst({
    where: { dealershipId: dealership.id, disabledAt: null },
    select: { userId: true },
  });
  let userId = membership?.userId ?? null;
  if (userId) {
    const userExists = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      userId = null;
    }
  }
  if (!userId) {
    const profile = await prisma.profile.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    userId = profile?.id ?? null;
  }
  if (!userId) {
    const fallback = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `perf-dash-${Date.now()}@local.test`,
        fullName: "Perf Dashboard User",
      },
      select: { id: true },
    });
    userId = fallback.id;
  }
  return {
    dealershipId: dealership.id,
    dealershipSlug: dealership.slug ?? slug,
    userId,
    permissions: [
      "dashboard.read",
      "inventory.read",
      "crm.read",
      "customers.read",
      "deals.read",
      "finance.read",
    ],
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const slug = readStringArg(args, "dealership-slug", "demo");
  const iterations = readIntArg(args, "iterations", 8);
  const warmup = readIntArg(args, "warmup", 2);
  const mutationBursts = readIntArg(args, "mutation-bursts", 3);

  const ctx = await resolveContext(slug);
  const readDurations: number[] = [];
  const refreshDurations: number[] = [];
  const errors: Array<{ phase: string; message: string }> = [];
  const refreshTypes = ["inventory_dashboard", "sales_metrics", "customer_stats"] as const;
  const refreshSummary: Array<{ type: string; invalidatedPrefixes: number; skippedReason: string | null }> = [];
  const refreshByTypeDurations: Record<string, number[]> = {
    inventory_dashboard: [],
    sales_metrics: [],
    customer_stats: [],
  };
  const refreshStepDurations: Record<string, number[]> = {
    tenantCheck: [],
    invalidate: [],
    signals: [],
    total: [],
  };
  const refreshSignalByKeyDurations: Record<string, number[]> = {};

  const totalRuns = warmup + iterations;
  for (let i = 0; i < totalRuns; i += 1) {
    try {
      const { durationMs } = await timed(() =>
        getDashboardV3Data(ctx.dealershipId, ctx.userId, ctx.permissions)
      );
      if (i >= warmup) readDurations.push(durationMs);
    } catch (error) {
      errors.push({
        phase: `read-${i}`,
        message: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  for (let i = 0; i < mutationBursts; i += 1) {
    const type = refreshTypes[i % refreshTypes.length];
    try {
      const { durationMs, value } = await timed(() =>
        runAnalyticsJob(ctx.dealershipId, type, { source: "perf-simulation" })
      );
      refreshDurations.push(durationMs);
      refreshByTypeDurations[type].push(durationMs);
      if (value.timingsMs) {
        refreshStepDurations.tenantCheck.push(value.timingsMs.tenantCheck);
        refreshStepDurations.invalidate.push(value.timingsMs.invalidate);
        refreshStepDurations.signals.push(value.timingsMs.signals);
        refreshStepDurations.total.push(value.timingsMs.total);
        for (const [key, stepMs] of Object.entries(value.timingsMs.signalByKey ?? {})) {
          if (!refreshSignalByKeyDurations[key]) {
            refreshSignalByKeyDurations[key] = [];
          }
          refreshSignalByKeyDurations[key].push(stepMs);
        }
      }
      refreshSummary.push({
        type,
        invalidatedPrefixes: value.invalidatedPrefixes.length,
        skippedReason: value.skippedReason ?? null,
      });
    } catch (error) {
      errors.push({
        phase: `refresh-${i}`,
        message: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  let postRefreshReadMs: number | null = null;
  if (errors.length === 0) {
    try {
      const postRefreshRead = await timed(() =>
        getDashboardV3Data(ctx.dealershipId, ctx.userId, ctx.permissions)
      );
      postRefreshReadMs = postRefreshRead.durationMs;
    } catch (error) {
      errors.push({
        phase: "post-refresh-read",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  printJson("scenario.dashboard.complete", {
    scenario: "dashboard",
    dealershipSlug: ctx.dealershipSlug,
    dealershipId: ctx.dealershipId,
    params: {
      iterations,
      warmup,
      mutationBursts,
    },
    metrics: {
      dashboardReads: summarizeDurations(readDurations),
      refreshJobs: summarizeDurations(refreshDurations),
      refreshJobsByType: Object.fromEntries(
        Object.entries(refreshByTypeDurations).map(([type, durations]) => [
          type,
          summarizeDurations(durations),
        ])
      ),
      refreshStepBreakdown: Object.fromEntries(
        Object.entries(refreshStepDurations).map(([step, durations]) => [
          step,
          summarizeDurations(durations),
        ])
      ),
      refreshSignalBreakdown: Object.fromEntries(
        Object.entries(refreshSignalByKeyDurations).map(([key, durations]) => [
          key,
          summarizeDurations(durations),
        ])
      ),
      postRefreshReadMs,
    },
    refreshSummary,
    errorCount: errors.length,
    sampleErrors: errors.slice(0, 3),
  });
}

run()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[perf/dashboard] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
