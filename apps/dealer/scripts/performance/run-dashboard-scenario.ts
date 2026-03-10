/**
 * Dashboard KPI/event refresh scenario runner.
 *
 * Measures repeated reads plus event-driven refresh jobs.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
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

const prisma = new PrismaClient();

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
  return {
    dealershipId: dealership.id,
    dealershipSlug: dealership.slug ?? slug,
    userId: membership?.userId ?? randomUUID(),
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
