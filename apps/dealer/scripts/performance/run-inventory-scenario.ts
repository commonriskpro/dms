/**
 * Inventory list/enrichment performance scenario runner.
 *
 * Calls getInventoryPageOverview repeatedly with realistic query variants.
 */
import { prisma } from "@/lib/db";
import { getInventoryPageOverview } from "@/modules/inventory/service/inventory-page";
import {
  parseArgs,
  printJson,
  readIntArg,
  readStringArg,
  resolveDealershipContext,
  resolveScenarioUserId,
  runPerfRequest,
  summarizeDurations,
  timed,
} from "./_utils";

async function resolveContext(slug: string) {
  const dealership = await resolveDealershipContext(prisma, slug);
  const userId = await resolveScenarioUserId(prisma, dealership.dealershipId, "perf-inv");
  return {
    dealershipId: dealership.dealershipId,
    dealershipSlug: dealership.dealershipSlug,
    userId,
    permissions: ["inventory.read", "deals.read", "crm.read"],
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const slug = readStringArg(args, "dealership-slug", "demo");
  const iterations = readIntArg(args, "iterations", 12);
  const warmup = readIntArg(args, "warmup", 2);
  const pageSize = readIntArg(args, "page-size", 50);

  const ctx = await resolveContext(slug);

  const queryVariants = [
    { page: 1, pageSize, sortBy: "createdAt", sortOrder: "desc" },
    { page: 1, pageSize, sortBy: "salePriceCents", sortOrder: "desc", status: "AVAILABLE" },
    { page: 2, pageSize, sortBy: "mileage", sortOrder: "asc", missingPhotosOnly: true },
    { page: 1, pageSize, search: "toyota", floorPlannedOnly: true },
  ];

  const totalMs: number[] = [];
  const rowCounts: number[] = [];

  const totalRuns = warmup + iterations;
  for (let i = 0; i < totalRuns; i += 1) {
    const query = queryVariants[i % queryVariants.length];
    const { durationMs, value } = await timed(() =>
      runPerfRequest("perf.inventory.overview", "GET", ctx.dealershipId, () =>
        getInventoryPageOverview(ctx, query)
      )
    );
    if (i >= warmup) {
      totalMs.push(durationMs);
      rowCounts.push(value.list.items.length);
    }
  }

  printJson("scenario.inventory.complete", {
    scenario: "inventory",
    dealershipSlug: ctx.dealershipSlug,
    dealershipId: ctx.dealershipId,
    params: {
      iterations,
      warmup,
      pageSize,
      inventoryOverviewProfile: process.env.INVENTORY_OVERVIEW_PROFILE === "1",
      variants: queryVariants.length,
    },
    metrics: {
      total: summarizeDurations(totalMs),
      rows: {
        min: rowCounts.length ? Math.min(...rowCounts) : 0,
        max: rowCounts.length ? Math.max(...rowCounts) : 0,
        avg: rowCounts.length
          ? Number((rowCounts.reduce((sum, value) => sum + value, 0) / rowCounts.length).toFixed(2))
          : 0,
      },
    },
  });
}

run()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[perf/inventory] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
