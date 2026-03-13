/**
 * AI demo pipeline — seed demo data (idempotent).
 * Vehicles (10), Leads (6), Deals (3). Scenarios: aging inventory alert, missing photos, lead pipeline stages, funding pending deal.
 * Does not modify existing application code. Requires DATABASE_URL and dealer Prisma client.
 */

import path from "path";
import { randomUUID } from "node:crypto";

const ROOT = process.cwd();
const dealerDir = path.join(ROOT, "apps/dealer");
const prismaClientPath = (() => {
  try {
    require.resolve(path.join(ROOT, "node_modules/@prisma/client"));
    return path.join(ROOT, "node_modules/@prisma/client");
  } catch {
    try {
      require.resolve(path.join(dealerDir, "node_modules/@prisma/client"));
      return path.join(dealerDir, "node_modules/@prisma/client");
    } catch {
      return path.join(ROOT, "node_modules/@prisma/client");
    }
  }
})();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require(prismaClientPath);
const prisma = new PrismaClient();

const DEMO_PREFIX = "DEMO";
const DEMO_STOCK_PREFIX = `${DEMO_PREFIX}-`;
const DEMO_CUSTOMER_PREFIX = `${DEMO_PREFIX} Lead `;

async function ensureDemoDealership() {
  let dealership = await prisma.dealership.findFirst({ where: { slug: "demo" } });
  if (!dealership) {
    dealership = await prisma.dealership.create({
      data: {
        name: "Demo Dealership",
        slug: "demo",
        settings: { timezone: "America/New_York", currency: "USD" },
      },
    });
  }
  let location = await prisma.dealershipLocation.findFirst({
    where: { dealershipId: dealership.id, name: "Main Lot" },
  });
  if (!location) {
    location = await prisma.dealershipLocation.create({
      data: {
        dealershipId: dealership.id,
        name: "Main Lot",
        addressLine1: "123 Demo St",
        city: "Anytown",
        region: "NY",
        postalCode: "10001",
        country: "US",
        isPrimary: true,
      },
    });
  }
  return { dealership, location };
}

async function ensurePipeline(dealershipId: string) {
  let pipeline = await prisma.pipeline.findFirst({
    where: { dealershipId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        dealershipId,
        name: "Sales Pipeline",
        isDefault: true,
        stages: {
          create: [
            { dealershipId, order: 1, name: "New Lead" },
            { dealershipId, order: 2, name: "Contacted" },
            { dealershipId, order: 3, name: "Appointment" },
            { dealershipId, order: 4, name: "Working Deal" },
            { dealershipId, order: 5, name: "Won" },
          ].map((s, i) => ({ ...s, id: randomUUID(), order: i + 1 })),
        },
      },
      include: { stages: { orderBy: { order: "asc" } } },
    });
  } else if (pipeline.stages.length === 0) {
    const baseStages = ["New Lead", "Contacted", "Appointment", "Working Deal", "Won"];
    await prisma.stage.createMany({
      data: baseStages.map((name, index) => ({
        id: randomUUID(),
        dealershipId,
        pipelineId: pipeline!.id,
        order: index + 1,
        name,
      })),
    });
    pipeline = await prisma.pipeline.findFirst({
      where: { id: pipeline.id },
      include: { stages: { orderBy: { order: "asc" } } },
    })!;
  }
  return pipeline!;
}

async function clearDemoData(dealershipId: string) {
  const demoVehicles = await prisma.vehicle.findMany({
    where: { dealershipId, stockNumber: { startsWith: DEMO_STOCK_PREFIX } },
    select: { id: true },
  });
  const vehicleIds = demoVehicles.map((v) => v.id);
  await prisma.inventoryAlertDismissal.deleteMany({
    where: { dealershipId, vehicleId: { in: vehicleIds } },
  });
  await prisma.vehicleReconLineItem.deleteMany({
    where: { recon: { vehicleId: { in: vehicleIds } } },
  });
  await prisma.vehicleRecon.deleteMany({
    where: { dealershipId, vehicleId: { in: vehicleIds } },
  });
  await prisma.deal.deleteMany({
    where: { dealershipId, notes: { startsWith: `${DEMO_PREFIX}:` } },
  });
  await prisma.opportunity.deleteMany({
    where: { dealershipId, source: DEMO_PREFIX },
  });
  await prisma.customer.deleteMany({
    where: { dealershipId, name: { startsWith: DEMO_CUSTOMER_PREFIX } },
  });
  await prisma.vehiclePhoto.deleteMany({
    where: { vehicleId: { in: vehicleIds } },
  });
  await prisma.vehicle.deleteMany({
    where: { dealershipId, stockNumber: { startsWith: DEMO_STOCK_PREFIX } },
  });
}

export async function runSeedDemo(): Promise<void> {
  const { dealership, location } = await ensureDemoDealership();
  const dealershipId = dealership.id;
  const locationId = location.id;
  const pipeline = await ensurePipeline(dealershipId);
  const stages = pipeline.stages;
  if (stages.length < 5) throw new Error("Pipeline must have at least 5 stages.");

  await clearDemoData(dealershipId);

  const big = (n: number) => BigInt(n);

  // Vehicles (10): one missing photos, one aging, one in recon
  const vehicleIds: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const id = randomUUID();
    vehicleIds.push(id);
    const isMissingPhotos = i === 1;
    const isAging = i === 2;
    const isInRecon = i === 3;
    const createdAt = isAging
      ? new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000);
    await prisma.vehicle.create({
      data: {
        id,
        dealershipId,
        locationId,
        stockNumber: `${DEMO_STOCK_PREFIX}${String(i).padStart(3, "0")}`,
        vin: isMissingPhotos ? null : `DEMO${id.replace(/-/g, "").slice(0, 13)}`,
        year: 2022 + (i % 3),
        make: ["Toyota", "Honda", "Ford", "Chevrolet", "Nissan"][i % 5],
        model: ["Camry", "Civic", "F-150", "Malibu", "Altima"][i % 5],
        trim: "Demo",
        mileage: 15000 + i * 5000,
        color: "Black",
        status: "AVAILABLE",
        salePriceCents: big(2500000 - i * 50000),
        auctionCostCents: big(1800000),
        transportCostCents: big(50000),
        reconCostCents: big(0),
        miscCostCents: big(0),
        createdAt,
        updatedAt: createdAt,
      },
    });
    if (isInRecon) {
      await prisma.vehicleRecon.create({
        data: {
          id: randomUUID(),
          dealershipId,
          vehicleId: id,
          status: "IN_PROGRESS",
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // Leads (6) — lead pipeline stages
  const stageIds = stages.map((s) => s.id);
  const leadStages = [stageIds[0], stageIds[1], stageIds[1], stageIds[2], stageIds[3], stageIds[4]];
  const customerIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const cid = randomUUID();
    customerIds.push(cid);
    await prisma.customer.create({
      data: {
        id: cid,
        dealershipId,
        name: `${DEMO_CUSTOMER_PREFIX}${i + 1}`,
        firstName: "Demo",
        lastName: `Lead ${i + 1}`,
        status: i >= 4 ? "ACTIVE" : "LEAD",
        stageId: leadStages[i],
        leadSource: DEMO_PREFIX,
      },
    });
    const vid = vehicleIds[i % vehicleIds.length];
    await prisma.opportunity.create({
      data: {
        id: randomUUID(),
        dealershipId,
        customerId: cid,
        vehicleId: vid,
        stageId: leadStages[i],
        source: DEMO_PREFIX,
        status: "OPEN",
        estimatedValueCents: big(2500000),
      },
    });
  }

  // Deals (3): funding pending, delivered, ready for delivery
  const dealCustomerId = customerIds[4]!;
  const dealVehicleIds = [vehicleIds[5], vehicleIds[6], vehicleIds[7]];
  await prisma.deal.create({
    data: {
      id: randomUUID(),
      dealershipId,
      customerId: dealCustomerId,
      vehicleId: dealVehicleIds[0]!,
      salePriceCents: big(2400000),
      purchasePriceCents: big(2300000),
      taxRateBps: 800,
      taxCents: big(192000),
      docFeeCents: big(50000),
      downPaymentCents: big(500000),
      totalFeesCents: big(250000),
      totalDueCents: big(2340000),
      frontGrossCents: big(100000),
      status: "CONTRACTED",
      deliveryStatus: null,
      notes: `${DEMO_PREFIX}: funding pending`,
    },
  });
  await prisma.deal.create({
    data: {
      id: randomUUID(),
      dealershipId,
      customerId: dealCustomerId,
      vehicleId: dealVehicleIds[1]!,
      salePriceCents: big(2800000),
      purchasePriceCents: big(2600000),
      taxRateBps: 800,
      taxCents: big(224000),
      docFeeCents: big(50000),
      downPaymentCents: big(600000),
      totalFeesCents: big(274000),
      totalDueCents: big(2674000),
      frontGrossCents: big(200000),
      status: "CONTRACTED",
      deliveryStatus: "DELIVERED",
      deliveredAt: new Date(),
      notes: `${DEMO_PREFIX}: delivered`,
    },
  });
  await prisma.deal.create({
    data: {
      id: randomUUID(),
      dealershipId,
      customerId: dealCustomerId,
      vehicleId: dealVehicleIds[2]!,
      salePriceCents: big(2200000),
      purchasePriceCents: big(2100000),
      taxRateBps: 800,
      taxCents: big(176000),
      docFeeCents: big(50000),
      downPaymentCents: big(400000),
      totalFeesCents: big(226000),
      totalDueCents: big(1826000),
      frontGrossCents: big(100000),
      status: "APPROVED",
      deliveryStatus: "READY_FOR_DELIVERY",
      notes: `${DEMO_PREFIX}: ready for delivery`,
    },
  });
}

async function main() {
  try {
    await runSeedDemo();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
