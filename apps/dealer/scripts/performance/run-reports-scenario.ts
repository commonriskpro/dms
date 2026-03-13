/**
 * Reports performance scenario runner.
 *
 * Runs repeated report service calls against one dealership and prints timing summaries.
 */
import { prisma } from "@/lib/db";
import { getSalesSummary } from "@/modules/reports/service/sales-summary";
import { getFinancePenetration } from "@/modules/reports/service/finance-penetration";
import { getSalesByUser } from "@/modules/reports/service/sales-by-user";
import {
  parseArgs,
  printJson,
  readIntArg,
  readStringArg,
  resolveDealershipContext,
  runPerfRequest,
  summarizeDurations,
  timed,
} from "./_utils";

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const slug = readStringArg(args, "dealership-slug", "demo");
  const iterations = readIntArg(args, "iterations", 10);
  const rangeDays = readIntArg(args, "range-days", 90);
  const warmup = readIntArg(args, "warmup", 2);
  const groupBy = readStringArg(args, "group-by", "salesperson") as
    | "none"
    | "salesperson"
    | "location"
    | "leadSource";

  const { dealershipId } = await resolveDealershipContext(prisma, slug);
  const { from, to } = getDateRange(rangeDays);

  const salesSummaryMs: number[] = [];
  const financePenetrationMs: number[] = [];
  const salesByUserMs: number[] = [];

  const totalRuns = warmup + iterations;
  for (let i = 0; i < totalRuns; i += 1) {
    const { durationMs: summaryMs } = await timed(() =>
      runPerfRequest("perf.reports.sales-summary", "GET", dealershipId, () =>
        getSalesSummary({
          dealershipId,
          from,
          to,
          groupBy,
        })
      )
    );
    const { durationMs: financeMs } = await timed(() =>
      runPerfRequest("perf.reports.finance-penetration", "GET", dealershipId, () =>
        getFinancePenetration({
          dealershipId,
          from,
          to,
        })
      )
    );
    const { durationMs: byUserMs } = await timed(() =>
      runPerfRequest("perf.reports.sales-by-user", "GET", dealershipId, () =>
        getSalesByUser({
          dealershipId,
          from,
          to,
          limit: 50,
          offset: 0,
        })
      )
    );

    if (i >= warmup) {
      salesSummaryMs.push(summaryMs);
      financePenetrationMs.push(financeMs);
      salesByUserMs.push(byUserMs);
    }
  }

  const report = {
    scenario: "reports",
    dealershipSlug: slug,
    dealershipId,
    params: {
      iterations,
      warmup,
      rangeDays,
      from,
      to,
      groupBy,
      reportsPerfProfile: process.env.REPORTS_PERF_PROFILE === "1",
    },
    metrics: {
      salesSummary: summarizeDurations(salesSummaryMs),
      financePenetration: summarizeDurations(financePenetrationMs),
      salesByUser: summarizeDurations(salesByUserMs),
    },
  };

  printJson("scenario.reports.complete", report);
}

run()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[perf/reports] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
