/**
 * Performance dataset seeder (additive, safe by default).
 *
 * Usage examples:
 *   npm run perf:seed -- --tier small
 *   npm run perf:seed -- --tier medium --dealership-slug demo
 *   npm run perf:seed -- --tier large --fresh true
 */
import { randomUUID } from "node:crypto";
import {
  type Prisma,
  type CustomerStatus,
  type DealStatus,
  type InboxChannel,
  type InboxConversationStatus,
  type InboxMessageDirection,
  type InboxRoutingStatus,
  type InboxWaitingOn,
  type IntelligenceSignalDomain,
  type IntelligenceSignalSeverity,
  type VehicleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  parseArgs,
  printJson,
  readBoolArg,
  readIntArg,
  readStringArg,
} from "./_utils";

type Tier = "small" | "medium" | "large";

type TierConfig = {
  vehicles: number;
  customers: number;
  deals: number;
  opportunities: number;
  signals: number;
  customerTasks: number;
  daysBack: number;
};

const TIER_CONFIG: Record<Tier, TierConfig> = {
  small: {
    vehicles: 220,
    customers: 180,
    deals: 120,
    opportunities: 140,
    signals: 320,
    customerTasks: 120,
    daysBack: 120,
  },
  medium: {
    vehicles: 1200,
    customers: 900,
    deals: 700,
    opportunities: 750,
    signals: 2200,
    customerTasks: 700,
    daysBack: 240,
  },
  large: {
    vehicles: 4200,
    customers: 3200,
    deals: 2200,
    opportunities: 2400,
    signals: 7000,
    customerTasks: 2200,
    daysBack: 365,
  },
};

const PERF_PREFIX = "PERF_SIM";
const BATCH_SIZE = 300;

function assertTier(value: string): Tier {
  if (value === "small" || value === "medium" || value === "large") return value;
  throw new Error(`Invalid --tier value "${value}". Expected small|medium|large.`);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

function randomDateWithinDays(daysBack: number): Date {
  const now = Date.now();
  const days = randomInt(0, daysBack);
  const millis = randomInt(0, 24 * 60 * 60 * 1000);
  return new Date(now - days * 24 * 60 * 60 * 1000 - millis);
}

function makePerfTag(tier: Tier): string {
  return `${PERF_PREFIX}-${tier.toUpperCase()}`;
}

function vehicleStatus(): VehicleStatus {
  const roll = Math.random();
  if (roll < 0.7) return "AVAILABLE";
  if (roll < 0.82) return "HOLD";
  if (roll < 0.91) return "REPAIR";
  if (roll < 0.97) return "SOLD";
  if (roll < 0.99) return "WHOLESALE";
  return "ARCHIVED";
}

function customerStatus(): CustomerStatus {
  const roll = Math.random();
  if (roll < 0.62) return "LEAD";
  if (roll < 0.83) return "ACTIVE";
  if (roll < 0.95) return "SOLD";
  return "INACTIVE";
}

function dealStatus(): DealStatus {
  const roll = Math.random();
  if (roll < 0.62) return "CONTRACTED";
  if (roll < 0.75) return "APPROVED";
  if (roll < 0.88) return "STRUCTURED";
  if (roll < 0.96) return "DRAFT";
  return "CANCELED";
}

function vinFromId(id: string): string {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `P${compact.slice(0, 16)}`;
}

async function createManyChunked<T>(
  rows: T[],
  createMany: (chunk: T[]) => Promise<unknown>
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await createMany(rows.slice(i, i + BATCH_SIZE));
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const tier = assertTier(readStringArg(args, "tier", "small"));
  const dealershipSlug = readStringArg(args, "dealership-slug", "demo");
  const fresh = readBoolArg(args, "fresh", false);
  const multiplier = readIntArg(args, "multiplier", 1);
  if (multiplier < 1) {
    throw new Error("--multiplier must be >= 1");
  }

  const tag = makePerfTag(tier);
  const cfg = TIER_CONFIG[tier];
  const counts = {
    vehicles: cfg.vehicles * multiplier,
    customers: cfg.customers * multiplier,
    deals: cfg.deals * multiplier,
    opportunities: cfg.opportunities * multiplier,
    signals: cfg.signals * multiplier,
    customerTasks: cfg.customerTasks * multiplier,
  };
  const providerPrefix = `${tag.toLowerCase()}-inbox`;

  const dealership =
    (await prisma.dealership.findFirst({
      where: { slug: dealershipSlug },
      select: { id: true, slug: true, name: true },
    })) ??
    (await prisma.dealership.findFirst({
      select: { id: true, slug: true, name: true },
      orderBy: { createdAt: "asc" },
    }));

  if (!dealership) {
    throw new Error("No dealership found. Run base seed first.");
  }

  const location =
    (await prisma.dealershipLocation.findFirst({
      where: { dealershipId: dealership.id },
      select: { id: true },
    })) ??
    (await prisma.dealershipLocation.create({
      data: {
        dealershipId: dealership.id,
        name: "Perf Main Lot",
        addressLine1: "100 Perf Way",
        city: "Performance",
        region: "NY",
        postalCode: "10001",
        country: "US",
        isPrimary: false,
      },
      select: { id: true },
    }));

  const membership = await prisma.membership.findFirst({
    where: { dealershipId: dealership.id, disabledAt: null },
    select: { userId: true },
  });
  const actorUserId = membership?.userId ?? null;

  let pipeline = await prisma.pipeline.findFirst({
    where: { dealershipId: dealership.id, isDefault: true },
    select: { id: true },
  });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        dealershipId: dealership.id,
        name: "Default Pipeline",
        isDefault: true,
      },
      select: { id: true },
    });
  }
  let stages = await prisma.stage.findMany({
    where: { dealershipId: dealership.id, pipelineId: pipeline.id },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  if (stages.length === 0) {
    const baseStages = ["New Lead", "Contacted", "Qualified", "Negotiation", "Won"];
    await prisma.stage.createMany({
      data: baseStages.map((name, index) => ({
        id: randomUUID(),
        dealershipId: dealership.id,
        pipelineId: pipeline!.id,
        order: index + 1,
        name,
      })),
      skipDuplicates: true,
    });
    stages = await prisma.stage.findMany({
      where: { dealershipId: dealership.id, pipelineId: pipeline.id },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });
  }

  const lender =
    (await prisma.lender.findFirst({
      where: { dealershipId: dealership.id },
      select: { id: true },
    })) ??
    (await prisma.lender.create({
      data: {
        dealershipId: dealership.id,
        name: `Perf Lender ${tag}`,
        lenderType: "BANK",
        externalSystem: "NONE",
        isActive: true,
      },
      select: { id: true },
    }));

  if (fresh) {
    await prisma.$transaction([
      prisma.intelligenceSignal.deleteMany({
        where: { dealershipId: dealership.id, code: { startsWith: `${tag}:` } },
      }),
      prisma.opportunity.deleteMany({
        where: { dealershipId: dealership.id, source: { startsWith: `${tag}:` } },
      }),
      prisma.customerTask.deleteMany({
        where: { dealershipId: dealership.id, title: { startsWith: `${tag}:` } },
      }),
      prisma.dealFinance.deleteMany({
        where: { dealershipId: dealership.id, notes: { startsWith: `${tag}:` } },
      }),
      prisma.financeSubmission.deleteMany({
        where: { dealershipId: dealership.id, decisionNotes: { startsWith: `${tag}:` } },
      }),
      prisma.financeApplication.deleteMany({
        where: { dealershipId: dealership.id, createdBy: null },
      }),
      prisma.dealHistory.deleteMany({
        where: { dealershipId: dealership.id, changedBy: null, fromStatus: null },
      }),
      prisma.deal.deleteMany({
        where: { dealershipId: dealership.id, notes: { startsWith: `${tag}:` } },
      }),
      prisma.customer.deleteMany({
        where: { dealershipId: dealership.id, name: { startsWith: `${tag}:` } },
      }),
      prisma.inboxConversation.deleteMany({
        where: { dealershipId: dealership.id, provider: { startsWith: providerPrefix } },
      }),
      prisma.vehicle.deleteMany({
        where: { dealershipId: dealership.id, stockNumber: { startsWith: `${tag}-` } },
      }),
    ]);
  }

  const vehicleRows: Prisma.VehicleCreateManyInput[] = Array.from(
    { length: counts.vehicles },
    (_, idx) => {
      const id = randomUUID();
      const createdAt = randomDateWithinDays(cfg.daysBack);
      const status = vehicleStatus();
      return {
        id,
        dealershipId: dealership.id,
        vin: vinFromId(id),
        year: randomInt(2012, 2025),
        make: ["Toyota", "Honda", "Ford", "Chevrolet", "Nissan"][idx % 5],
        model: ["Camry", "Civic", "F-150", "Malibu", "Altima"][idx % 5],
        trim: ["Base", "Sport", "Limited"][idx % 3],
        stockNumber: `${tag}-${Date.now().toString(36)}-${idx}`,
        mileage: randomInt(5000, 145000),
        color: ["Black", "White", "Silver", "Blue", "Red"][idx % 5],
        status,
        salePriceCents: BigInt(randomInt(700_000, 3_200_000)),
        auctionCostCents: BigInt(randomInt(300_000, 1_700_000)),
        transportCostCents: BigInt(randomInt(0, 120_000)),
        reconCostCents: BigInt(randomInt(0, 220_000)),
        miscCostCents: BigInt(randomInt(0, 50_000)),
        locationId: location.id,
        createdAt,
        updatedAt: createdAt,
      };
    }
  );

  await createManyChunked(vehicleRows, (chunk) =>
    prisma.vehicle.createMany({ data: chunk, skipDuplicates: true })
  );

  const customerRows: Prisma.CustomerCreateManyInput[] = Array.from(
    { length: counts.customers },
    (_, idx) => {
      const createdAt = randomDateWithinDays(cfg.daysBack);
      return {
        id: randomUUID(),
        dealershipId: dealership.id,
        name: `${tag}: Customer ${idx + 1}`,
        leadSource: ["web", "walk-in", "referral", "social"][idx % 4],
        leadCampaign: `campaign-${(idx % 6) + 1}`,
        leadMedium: ["paid", "organic", "partner"][idx % 3],
        status: customerStatus(),
        stageId: stages[idx % stages.length]?.id ?? null,
        assignedTo: actorUserId,
        city: ["New York", "Miami", "Dallas", "Austin"][idx % 4],
        region: ["NY", "FL", "TX", "CA"][idx % 4],
        postalCode: `${10000 + (idx % 8000)}`,
        country: "US",
        tags: idx % 3 === 0 ? ["performance", "sim"] : ["performance"],
        createdAt,
        updatedAt: createdAt,
      };
    }
  );

  await createManyChunked(customerRows, (chunk) =>
    prisma.customer.createMany({ data: chunk, skipDuplicates: true })
  );

  const vehicles = await prisma.vehicle.findMany({
    where: { dealershipId: dealership.id, stockNumber: { startsWith: `${tag}-` } },
    select: { id: true, salePriceCents: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: counts.vehicles,
  });
  const customers = await prisma.customer.findMany({
    where: { dealershipId: dealership.id, name: { startsWith: `${tag}:` } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: counts.customers,
  });

  const dealRows: Prisma.DealCreateManyInput[] = Array.from(
    { length: Math.min(counts.deals, vehicles.length, customers.length) },
    (_, idx) => {
      const vehicle = vehicles[idx % vehicles.length];
      const customer = customers[idx % customers.length];
      const salePrice = Number(vehicle.salePriceCents);
      const purchase = Math.floor(salePrice * randomInt(62, 86) / 100);
      const fees = randomInt(20_000, 95_000);
      const downPayment = randomInt(30_000, 280_000);
      const taxBps = randomInt(550, 920);
      const tax = Math.floor((salePrice * taxBps) / 10_000);
      const totalDue = salePrice + tax + fees - downPayment;
      const createdAt = randomDateWithinDays(cfg.daysBack);
      const status = dealStatus();
      return {
        id: randomUUID(),
        dealershipId: dealership.id,
        customerId: customer.id,
        vehicleId: vehicle.id,
        salePriceCents: BigInt(salePrice),
        purchasePriceCents: BigInt(purchase),
        taxRateBps: taxBps,
        taxCents: BigInt(tax),
        docFeeCents: BigInt(randomInt(10_000, 45_000)),
        downPaymentCents: BigInt(downPayment),
        totalFeesCents: BigInt(fees),
        totalDueCents: BigInt(Math.max(0, totalDue)),
        frontGrossCents: BigInt(Math.max(0, salePrice - purchase)),
        status,
        createdAt,
        updatedAt: createdAt,
        notes: `${tag}: deal seed`,
      };
    }
  );

  await createManyChunked(dealRows, (chunk) =>
    prisma.deal.createMany({ data: chunk, skipDuplicates: true })
  );

  const deals = await prisma.deal.findMany({
    where: { dealershipId: dealership.id, notes: `${tag}: deal seed` },
    select: {
      id: true,
      status: true,
      customerId: true,
      salePriceCents: true,
      frontGrossCents: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: dealRows.length,
  });

  const contractedDeals = deals.filter((deal) => deal.status === "CONTRACTED");

  const dealHistoryRows: Prisma.DealHistoryCreateManyInput[] = contractedDeals.map((deal) => ({
    id: randomUUID(),
    dealershipId: dealership.id,
    dealId: deal.id,
    fromStatus: "APPROVED",
    toStatus: "CONTRACTED",
    changedBy: actorUserId,
    createdAt: new Date(deal.createdAt.getTime() + randomInt(1, 10) * 60 * 60 * 1000),
  }));
  await createManyChunked(dealHistoryRows, (chunk) =>
    prisma.dealHistory.createMany({ data: chunk, skipDuplicates: true })
  );

  const financeDeals = contractedDeals.filter((_, idx) => idx % 2 === 0);
  const dealFinanceRows: Prisma.DealFinanceCreateManyInput[] = financeDeals.map((deal) => {
    const amountFinanced = Number(deal.salePriceCents) - randomInt(40_000, 260_000);
    const products = randomInt(0, 65_000);
    return {
      id: randomUUID(),
      dealershipId: dealership.id,
      dealId: deal.id,
      financingMode: chance(0.82) ? "FINANCE" : "CASH",
      termMonths: [36, 48, 60, 72][randomInt(0, 3)],
      aprBps: randomInt(350, 1290),
      cashDownCents: BigInt(randomInt(20_000, 220_000)),
      amountFinancedCents: BigInt(Math.max(0, amountFinanced)),
      monthlyPaymentCents: BigInt(randomInt(28_000, 92_000)),
      totalOfPaymentsCents: BigInt(randomInt(1_000_000, 3_500_000)),
      financeChargeCents: BigInt(randomInt(0, 600_000)),
      productsTotalCents: BigInt(products),
      backendGrossCents: BigInt(randomInt(0, 85_000)),
      reserveCents: BigInt(randomInt(0, 30_000)),
      status: "CONTRACTED",
      lenderName: "Perf Lender",
      notes: `${tag}: finance seed`,
      createdAt: new Date(deal.createdAt.getTime() + randomInt(1, 20) * 60 * 1000),
      updatedAt: new Date(deal.createdAt.getTime() + randomInt(1, 25) * 60 * 1000),
    };
  });
  await createManyChunked(dealFinanceRows, (chunk) =>
    prisma.dealFinance.createMany({ data: chunk, skipDuplicates: true })
  );

  const financeApplicationRows: Prisma.FinanceApplicationCreateManyInput[] = financeDeals.map(
    (deal) => ({
      id: randomUUID(),
      dealershipId: dealership.id,
      dealId: deal.id,
      status: "COMPLETED",
      createdBy: actorUserId,
      createdAt: new Date(deal.createdAt.getTime() + randomInt(2, 40) * 60 * 1000),
      updatedAt: new Date(deal.createdAt.getTime() + randomInt(2, 55) * 60 * 1000),
    })
  );
  await createManyChunked(financeApplicationRows, (chunk) =>
    prisma.financeApplication.createMany({ data: chunk, skipDuplicates: true })
  );

  const appByDeal = new Map(financeApplicationRows.map((row) => [row.dealId, row.id]));
  const financeSubmissionRows: Prisma.FinanceSubmissionCreateManyInput[] = financeDeals.map(
    (deal) => ({
      id: randomUUID(),
      dealershipId: dealership.id,
      applicationId: appByDeal.get(deal.id)!,
      dealId: deal.id,
      lenderId: lender.id,
      status: "DECISIONED",
      submittedAt: new Date(deal.createdAt.getTime() + randomInt(1, 3) * 60 * 60 * 1000),
      decisionedAt: new Date(deal.createdAt.getTime() + randomInt(4, 8) * 60 * 60 * 1000),
      amountFinancedCents: BigInt(randomInt(650_000, 2_900_000)),
      termMonths: [36, 48, 60, 72][randomInt(0, 3)],
      aprBps: randomInt(350, 1290),
      paymentCents: BigInt(randomInt(24_000, 91_000)),
      productsTotalCents: BigInt(randomInt(0, 60_000)),
      backendGrossCents: BigInt(randomInt(0, 90_000)),
      reserveEstimateCents: BigInt(randomInt(0, 45_000)),
      decisionStatus: chance(0.78) ? "APPROVED" : "CONDITIONAL",
      approvedTermMonths: [36, 48, 60, 72][randomInt(0, 3)],
      approvedAprBps: randomInt(300, 1220),
      approvedPaymentCents: BigInt(randomInt(20_000, 88_000)),
      maxAdvanceCents: BigInt(randomInt(700_000, 3_000_000)),
      decisionNotes: `${tag}: submission seed`,
      fundingStatus: chance(0.42) ? "FUNDED" : "PENDING",
      fundedAmountCents: chance(0.42) ? BigInt(randomInt(600_000, 2_700_000)) : null,
      reserveFinalCents: chance(0.42) ? BigInt(randomInt(0, 40_000)) : null,
      createdAt: new Date(deal.createdAt.getTime() + randomInt(6, 20) * 60 * 1000),
      updatedAt: new Date(deal.createdAt.getTime() + randomInt(6, 40) * 60 * 1000),
    })
  );
  await createManyChunked(financeSubmissionRows, (chunk) =>
    prisma.financeSubmission.createMany({ data: chunk, skipDuplicates: true })
  );

  const opportunityRows: Prisma.OpportunityCreateManyInput[] = Array.from(
    { length: Math.min(counts.opportunities, customers.length) },
    (_, idx) => {
      const customer = customers[idx % customers.length];
      const maybeVehicle = vehicles[idx % vehicles.length];
      const maybeDeal = deals[idx % deals.length];
      const createdAt = randomDateWithinDays(cfg.daysBack);
      return {
        id: randomUUID(),
        dealershipId: dealership.id,
        customerId: customer.id,
        vehicleId: chance(0.65) ? maybeVehicle.id : null,
        dealId: chance(0.35) ? maybeDeal.id : null,
        stageId: stages[idx % stages.length].id,
        ownerId: actorUserId,
        source: `${tag}:source:${["web", "phone", "walkin"][idx % 3]}`,
        priority: ["low", "medium", "high"][idx % 3],
        estimatedValueCents: BigInt(randomInt(800_000, 3_600_000)),
        status: chance(0.75) ? "OPEN" : chance(0.5) ? "WON" : "LOST",
        nextActionAt: new Date(createdAt.getTime() + randomInt(1, 6) * 24 * 60 * 60 * 1000),
        nextActionText: "Perf follow-up",
        createdAt,
        updatedAt: createdAt,
      };
    }
  );
  await createManyChunked(opportunityRows, (chunk) =>
    prisma.opportunity.createMany({ data: chunk, skipDuplicates: true })
  );

  if (actorUserId) {
    const customerTaskRows: Prisma.CustomerTaskCreateManyInput[] = Array.from(
      { length: Math.min(counts.customerTasks, customers.length) },
      (_, idx) => {
        const customer = customers[idx % customers.length];
        const createdAt = randomDateWithinDays(cfg.daysBack);
        return {
          id: randomUUID(),
          dealershipId: dealership.id,
          customerId: customer.id,
          title: `${tag}: Call back ${idx + 1}`,
          description: "Performance simulation task",
          dueAt: new Date(createdAt.getTime() + randomInt(1, 10) * 60 * 60 * 1000),
          completedAt: chance(0.3)
            ? new Date(createdAt.getTime() + randomInt(2, 14) * 60 * 60 * 1000)
            : null,
          completedBy: chance(0.3) ? actorUserId : null,
          createdBy: actorUserId,
          createdAt,
          updatedAt: createdAt,
        };
      }
    );
    await createManyChunked(customerTaskRows, (chunk) =>
      prisma.customerTask.createMany({ data: chunk, skipDuplicates: true })
    );
  }

  let seededInboxConversations = 0;
  let seededInboxMessages = 0;
  const existingPerfInboxConversationCount = await prisma.inboxConversation.count({
    where: {
      dealershipId: dealership.id,
      provider: { startsWith: providerPrefix },
    },
  });

  if (existingPerfInboxConversationCount === 0 && customers.length > 0) {
    const conversationSeedCustomers = customers.slice(
      0,
      Math.min(customers.length, Math.max(120, Math.floor(counts.customers * 0.55)))
    );

    const conversationRows: Prisma.InboxConversationCreateManyInput[] = [];
    const participantRows: Prisma.InboxParticipantCreateManyInput[] = [];
    const messageRows: Prisma.InboxMessageCreateManyInput[] = [];
    const eventRows: Prisma.InboxMessageEventCreateManyInput[] = [];

    for (const [idx, customer] of conversationSeedCustomers.entries()) {
      const conversationId = randomUUID();
      const channel: InboxChannel = idx % 3 === 0 ? "EMAIL" : "SMS";
      const provider = channel === "EMAIL" ? `${providerPrefix}-email` : `${providerPrefix}-sms`;
      const messageCount = randomInt(3, 8);
      const baseAt = randomDateWithinDays(cfg.daysBack);
      const customerParticipantId = randomUUID();
      const repParticipantId = actorUserId ? randomUUID() : null;
      const status: InboxConversationStatus = chance(0.92) ? "OPEN" : "CLOSED";
      const assigned = actorUserId && chance(0.72);
      const routingStatus: InboxRoutingStatus = assigned ? "ASSIGNED" : "UNASSIGNED";

      let lastInboundAt: Date | null = null;
      let lastOutboundAt: Date | null = null;
      let lastMessageAt = baseAt;
      let lastMessageId = "";
      let lastPreview = "";
      let unreadCount = 0;
      let waitingOn: InboxWaitingOn = "NONE";

      participantRows.push({
        id: customerParticipantId,
        dealershipId: dealership.id,
        conversationId,
        role: "CUSTOMER",
        customerId: customer.id,
        displayName: `${tag}: Contact ${idx + 1}`,
        email: channel === "EMAIL" ? `perf-${tier}-${idx + 1}@example.com` : null,
        phone: channel === "SMS" ? `555000${String(10_000 + idx).slice(-4)}` : null,
        isPrimary: true,
        createdAt: baseAt,
      });

      if (repParticipantId) {
        participantRows.push({
          id: repParticipantId,
          dealershipId: dealership.id,
          conversationId,
          role: "REP",
          profileId: actorUserId,
          isPrimary: false,
          createdAt: baseAt,
        });
      }

      for (let msgIdx = 0; msgIdx < messageCount; msgIdx += 1) {
        const messageId = randomUUID();
        const direction: InboxMessageDirection =
          msgIdx === messageCount - 1
            ? chance(0.6)
              ? "INBOUND"
              : "OUTBOUND"
            : msgIdx % 2 === 0
              ? "OUTBOUND"
              : "INBOUND";
        const occurredAt = new Date(baseAt.getTime() + msgIdx * randomInt(30, 240) * 60 * 1000);
        const body = `${tag} ${channel === "EMAIL" ? "email" : "sms"} thread ${idx + 1} message ${msgIdx + 1}`;
        const preview = body.slice(0, 120);

        if (direction === "INBOUND") {
          lastInboundAt = occurredAt;
        } else {
          lastOutboundAt = occurredAt;
        }

        lastMessageAt = occurredAt;
        lastMessageId = messageId;
        lastPreview = preview;
        waitingOn = direction === "INBOUND" ? "TEAM" : "CUSTOMER";
        unreadCount = direction === "INBOUND" ? randomInt(1, 3) : 0;

        messageRows.push({
          id: messageId,
          dealershipId: dealership.id,
          conversationId,
          customerId: customer.id,
          channel,
          direction,
          provider,
          providerMessageId: `${provider}:msg:${customer.id}:${msgIdx + 1}`,
          providerThreadId: `${tag}:thread:${customer.id}:${channel.toLowerCase()}`,
          senderParticipantId:
            direction === "OUTBOUND" && repParticipantId ? repParticipantId : customerParticipantId,
          textBody: body,
          bodyPreview: preview,
          sentAt: direction === "OUTBOUND" ? occurredAt : null,
          receivedAt: direction === "INBOUND" ? occurredAt : null,
          createdAt: occurredAt,
        });

        eventRows.push({
          id: randomUUID(),
          dealershipId: dealership.id,
          messageId,
          provider,
          eventType: direction === "INBOUND" ? "REPLIED" : "SENT",
          providerEventId: `${provider}:evt:${customer.id}:${msgIdx + 1}`,
          occurredAt,
          createdAt: occurredAt,
        });
      }

      conversationRows.push({
        id: conversationId,
        dealershipId: dealership.id,
        customerId: customer.id,
        channel,
        provider,
        providerThreadId: `${tag}:thread:${customer.id}:${channel.toLowerCase()}`,
        status,
        routingStatus,
        waitingOn,
        assignedToUserId: assigned ? actorUserId : null,
        previewText: lastPreview,
        unreadCount,
        lastMessageAt,
        lastInboundAt,
        lastOutboundAt,
        lastMessageId,
        isResolved: status !== "OPEN",
        createdAt: baseAt,
        updatedAt: lastMessageAt,
      });
    }

    await createManyChunked(conversationRows, (chunk) =>
      prisma.inboxConversation.createMany({ data: chunk, skipDuplicates: true })
    );
    await createManyChunked(participantRows, (chunk) =>
      prisma.inboxParticipant.createMany({ data: chunk, skipDuplicates: true })
    );
    await createManyChunked(messageRows, (chunk) =>
      prisma.inboxMessage.createMany({ data: chunk, skipDuplicates: true })
    );
    await createManyChunked(eventRows, (chunk) =>
      prisma.inboxMessageEvent.createMany({ data: chunk, skipDuplicates: true })
    );

    seededInboxConversations = conversationRows.length;
    seededInboxMessages = messageRows.length;
  }

  const signalRows: Prisma.IntelligenceSignalCreateManyInput[] = Array.from(
    { length: counts.signals },
    (_, idx) => {
      const happenedAt = randomDateWithinDays(cfg.daysBack);
      return {
        id: randomUUID(),
        dealershipId: dealership.id,
        domain: ["INVENTORY", "CRM", "DEALS", "OPERATIONS", "ACQUISITION"][
          idx % 5
        ] as IntelligenceSignalDomain,
        code: `${tag}:signal:${idx + 1}`,
        severity: ["INFO", "SUCCESS", "WARNING", "DANGER"][
          idx % 4
        ] as IntelligenceSignalSeverity,
        title: `${tag} signal ${idx + 1}`,
        description: "Performance simulation signal",
        entityType: idx % 2 === 0 ? "vehicle" : "customer",
        entityId: idx % 2 === 0 ? vehicles[idx % vehicles.length]?.id : customers[idx % customers.length]?.id,
        actionLabel: "Review",
        actionHref: "/dashboard",
        metadata: { perfTag: tag, idx: idx + 1 },
        happenedAt,
        createdAt: happenedAt,
        updatedAt: happenedAt,
      };
    }
  );
  await createManyChunked(signalRows, (chunk) =>
    prisma.intelligenceSignal.createMany({ data: chunk, skipDuplicates: true })
  );

  printJson("seed.complete", {
    dealership: {
      id: dealership.id,
      slug: dealership.slug,
      name: dealership.name,
    },
    tier,
    multiplier,
    tag,
    fresh,
    created: {
      vehicles: vehicleRows.length,
      customers: customerRows.length,
      deals: dealRows.length,
      contractedDeals: contractedDeals.length,
      dealFinance: dealFinanceRows.length,
      financeSubmissions: financeSubmissionRows.length,
      opportunities: opportunityRows.length,
      signals: signalRows.length,
      customerTasks: actorUserId ? Math.min(counts.customerTasks, customers.length) : 0,
      inboxConversations: seededInboxConversations,
      inboxMessages: seededInboxMessages,
    },
  });
}

run()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[perf/seed] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
