/**
 * Inventory list/enrichment performance scenario runner.
 *
 * Calls getInventoryPageOverview repeatedly with realistic query variants.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getInventoryPageOverview } from "@/modules/inventory/service/inventory-page";
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
  if (!dealership) {
    throw new Error("No dealership found.");
  }
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
        email: `perf-${Date.now()}@local.test`,
        fullName: "Perf Scenario User",
      },
      select: { id: true },
    });
    userId = fallback.id;
  }
  return {
    dealershipId: dealership.id,
    dealershipSlug: dealership.slug ?? slug,
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
    const { durationMs, value } = await timed(() => getInventoryPageOverview(ctx, query));
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
