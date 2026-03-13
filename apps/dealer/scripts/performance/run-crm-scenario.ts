/**
 * CRM/customer performance scenario runner.
 *
 * Exercises hot operational reads:
 * - customers list
 * - opportunities list
 * - inbox conversations
 * - command center
 */
import { prisma } from "@/lib/db";
import { listCustomers } from "@/modules/customers/service/customer";
import { listConversations } from "@/modules/customers/service/inbox";
import { listOpportunities } from "@/modules/crm-pipeline-automation/service/opportunity";
import { getCommandCenterData } from "@/modules/crm-pipeline-automation/service/command-center";
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
  const userId = await resolveScenarioUserId(prisma, dealership.dealershipId, "perf-crm");
  return {
    dealershipId: dealership.dealershipId,
    dealershipSlug: dealership.dealershipSlug,
    userId,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const slug = readStringArg(args, "dealership-slug", "demo");
  const iterations = readIntArg(args, "iterations", 12);
  const warmup = readIntArg(args, "warmup", 2);
  const pageSize = readIntArg(args, "page-size", 50);

  const ctx = await resolveContext(slug);

  const customerListMs: number[] = [];
  const opportunityListMs: number[] = [];
  const inboxListMs: number[] = [];
  const commandCenterMs: number[] = [];
  const customerRows: number[] = [];
  const opportunityRows: number[] = [];
  const inboxRows: number[] = [];

  const customerVariants = [
    { limit: pageSize, offset: 0, sort: { sortBy: "created_at" as const, sortOrder: "desc" as const } },
    {
      limit: pageSize,
      offset: pageSize,
      filters: { draft: "final" as const, status: "LEAD" as const, search: "PERF_SIM" },
      sort: { sortBy: "updated_at" as const, sortOrder: "desc" as const },
    },
    {
      limit: pageSize,
      offset: 0,
      filters: { search: "Customer", draft: "all" as const },
      sort: { sortBy: "status" as const, sortOrder: "asc" as const },
    },
  ];

  const opportunityVariants = [
    { limit: pageSize, offset: 0, sortBy: "createdAt" as const, sortOrder: "desc" as const },
    { limit: pageSize, offset: 0, sortBy: "updatedAt" as const, sortOrder: "desc" as const, filters: { status: "OPEN" as const } },
    { limit: pageSize, offset: pageSize, sortBy: "nextActionAt" as const, sortOrder: "asc" as const, filters: { q: "PERF_SIM" } },
  ];

  const inboxVariants = [
    { limit: pageSize, offset: 0 },
    { limit: pageSize, offset: pageSize },
  ];

  const commandCenterVariants = [
    { scope: "all" as const },
    { scope: "mine" as const },
    { scope: "team" as const, q: "PERF_SIM" },
  ];

  const totalRuns = warmup + iterations;
  for (let i = 0; i < totalRuns; i += 1) {
    const customerQuery = customerVariants[i % customerVariants.length];
    const opportunityQuery = opportunityVariants[i % opportunityVariants.length];
    const inboxQuery = inboxVariants[i % inboxVariants.length];
    const commandCenterQuery = commandCenterVariants[i % commandCenterVariants.length];

    const customerResult = await timed(() =>
      runPerfRequest("perf.crm.customers", "GET", ctx.dealershipId, () =>
        listCustomers(ctx.dealershipId, customerQuery)
      )
    );
    const opportunityResult = await timed(() =>
      runPerfRequest("perf.crm.opportunities", "GET", ctx.dealershipId, () =>
        listOpportunities(ctx.dealershipId, opportunityQuery)
      )
    );
    const inboxResult = await timed(() =>
      runPerfRequest("perf.crm.inbox", "GET", ctx.dealershipId, () =>
        listConversations(ctx.dealershipId, inboxQuery)
      )
    );
    const commandCenterResult = await timed(() =>
      runPerfRequest("perf.crm.command-center", "GET", ctx.dealershipId, () =>
        getCommandCenterData(ctx.dealershipId, ctx.userId, commandCenterQuery)
      )
    );

    if (i >= warmup) {
      customerListMs.push(customerResult.durationMs);
      opportunityListMs.push(opportunityResult.durationMs);
      inboxListMs.push(inboxResult.durationMs);
      commandCenterMs.push(commandCenterResult.durationMs);
      customerRows.push(customerResult.value.data.length);
      opportunityRows.push(opportunityResult.value.data.length);
      inboxRows.push(inboxResult.value.data.length);
    }
  }

  printJson("scenario.crm.complete", {
    scenario: "crm",
    dealershipSlug: ctx.dealershipSlug,
    dealershipId: ctx.dealershipId,
    params: {
      iterations,
      warmup,
      pageSize,
    },
    metrics: {
      customersList: summarizeDurations(customerListMs),
      opportunitiesList: summarizeDurations(opportunityListMs),
      inboxList: summarizeDurations(inboxListMs),
      commandCenter: summarizeDurations(commandCenterMs),
      rows: {
        customersAvg: customerRows.length
          ? Number((customerRows.reduce((sum, value) => sum + value, 0) / customerRows.length).toFixed(2))
          : 0,
        opportunitiesAvg: opportunityRows.length
          ? Number((opportunityRows.reduce((sum, value) => sum + value, 0) / opportunityRows.length).toFixed(2))
          : 0,
        inboxAvg: inboxRows.length
          ? Number((inboxRows.reduce((sum, value) => sum + value, 0) / inboxRows.length).toFixed(2))
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
    console.error("[perf/crm] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
