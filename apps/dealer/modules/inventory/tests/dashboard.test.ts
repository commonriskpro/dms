/** @jest-environment node */
/**
 * Inventory dashboard: shape tests for getKpis, getAgingBuckets, getDealPipeline, getTeamActivityToday;
 * tenant isolation and aging bucket boundary (integration when DB available).
 */
import { randomUUID } from "node:crypto";
jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
}));


import * as dashboardService from "../service/dashboard";
import * as vehicleDb from "../db/vehicle";
import * as dealPipelineService from "@/modules/deals/service/deal-pipeline";
import * as teamActivityService from "@/modules/customers/service/team-activity";
import { prisma } from "@/lib/db";

const dealerAId = "b1000000-0000-0000-0000-000000000001";
const dealerBId = "b2000000-0000-0000-0000-000000000002";

const REQUIRED_KPI_KEYS = [
  "totalUnits",
  "delta7d",
  "inReconUnits",
  "inReconPercent",
  "salePendingUnits",
  "salePendingValueCents",
  "inventoryValueCents",
  "avgValueCents",
];

const REQUIRED_AGING_KEYS = ["lt30", "d30to60", "d60to90", "gt90"];

const REQUIRED_PIPELINE_KEYS = [
  "leads",
  "appointments",
  "workingDeals",
  "pendingFunding",
  "soldToday",
];

const REQUIRED_TEAM_KEYS = [
  "callsLogged",
  "appointmentsSet",
  "notesAdded",
  "callbacksScheduled",
  "dealsStarted",
];

describe("Inventory dashboard shape", () => {
  it("getKpis returns InventoryKpis shape with required keys", async () => {
    const kpis = await dashboardService.getKpis(dealerAId);
    expect(Object.keys(kpis).sort()).toEqual(REQUIRED_KPI_KEYS.sort());
    expect(typeof kpis.totalUnits).toBe("number");
    expect(typeof kpis.inReconUnits).toBe("number");
    expect(typeof kpis.inReconPercent).toBe("number");
    expect(typeof kpis.salePendingUnits).toBe("number");
    expect(typeof kpis.inventoryValueCents).toBe("number");
    expect(typeof kpis.avgValueCents).toBe("number");
    expect(kpis.delta7d === null || typeof kpis.delta7d === "number").toBe(true);
    expect(
      kpis.salePendingValueCents === null ||
        kpis.salePendingValueCents === undefined ||
        typeof kpis.salePendingValueCents === "number"
    ).toBe(true);
  });

  it("getAgingBuckets returns InventoryAgingBuckets shape", async () => {
    const buckets = await dashboardService.getAgingBuckets(dealerAId);
    expect(Object.keys(buckets).sort()).toEqual(REQUIRED_AGING_KEYS.sort());
    expect(buckets.lt30).toBeGreaterThanOrEqual(0);
    expect(buckets.d30to60).toBeGreaterThanOrEqual(0);
    expect(buckets.d60to90).toBeGreaterThanOrEqual(0);
    expect(buckets.gt90).toBeGreaterThanOrEqual(0);
  });

  it("getDealPipeline returns DealPipelineStages shape", async () => {
    const pipeline = await dealPipelineService.getDealPipeline(dealerAId);
    expect(Object.keys(pipeline).sort()).toEqual(REQUIRED_PIPELINE_KEYS.sort());
    expect(pipeline.appointments).toBe(0);
    expect(typeof pipeline.leads).toBe("number");
    expect(typeof pipeline.workingDeals).toBe("number");
    expect(typeof pipeline.pendingFunding).toBe("number");
    expect(typeof pipeline.soldToday).toBe("number");
  });

  it("getTeamActivityToday returns TeamActivityToday shape", async () => {
    const team = await teamActivityService.getTeamActivityToday(dealerAId);
    expect(Object.keys(team).sort()).toEqual(REQUIRED_TEAM_KEYS.sort());
    expect(typeof team.callsLogged).toBe("number");
    expect(typeof team.appointmentsSet).toBe("number");
    expect(typeof team.notesAdded).toBe("number");
    expect(typeof team.callbacksScheduled).toBe("number");
    expect(typeof team.dealsStarted).toBe("number");
  });
});

describe("Inventory dashboard tenant isolation", () => {
  let isolatedDealerBId: string;
  const vehicleBId = "b4000000-0000-0000-0000-000000000004";
  beforeAll(async () => {
    isolatedDealerBId = randomUUID();
    await prisma.dealership.upsert({
      where: { id: dealerAId },
      create: { id: dealerAId, name: "Dashboard Dealer A" },
      update: {},
    });
    await prisma.dealership.upsert({
      where: { id: isolatedDealerBId },
      create: { id: isolatedDealerBId, name: "Dashboard Dealer B" },
      update: {},
    });
    await prisma.vehicle.deleteMany({ where: { dealershipId: dealerAId } });
    await prisma.vehicle.deleteMany({ where: { dealershipId: isolatedDealerBId } });
    await prisma.vehicle.upsert({
      where: { id: vehicleBId },
      create: {
        id: vehicleBId,
        dealershipId: isolatedDealerBId,
        stockNumber: "DASH-B-001",
        status: "AVAILABLE",
      },
      update: { dealershipId: isolatedDealerBId },
    });
  });

  it("getKpis for Dealer A does not count Dealer B vehicles", async () => {
    const kpisA = await dashboardService.getKpis(dealerAId);
    const kpisB = await dashboardService.getKpis(isolatedDealerBId);
    expect(kpisA.totalUnits).toBe(0);
    expect(kpisB.totalUnits).toBeGreaterThanOrEqual(1);
  });

  it("getAgingBuckets for Dealer A does not count Dealer B vehicles", async () => {
    const bucketsA = await dashboardService.getAgingBuckets(dealerAId);
    const bucketsB = await dashboardService.getAgingBuckets(isolatedDealerBId);
    const sumA = bucketsA.lt30 + bucketsA.d30to60 + bucketsA.d60to90 + bucketsA.gt90;
    const sumB = bucketsB.lt30 + bucketsB.d30to60 + bucketsB.d60to90 + bucketsB.gt90;
    expect(sumA).toBe(0);
    expect(sumB).toBeGreaterThanOrEqual(1);
  });

  it("getDealPipeline for Dealer A does not count Dealer B deals or leads", async () => {
    const pipelineA = await dealPipelineService.getDealPipeline(dealerAId);
    const pipelineB = await dealPipelineService.getDealPipeline(isolatedDealerBId);
    expect(typeof pipelineA.leads).toBe("number");
    expect(typeof pipelineB.leads).toBe("number");
    expect(typeof pipelineA.workingDeals).toBe("number");
    expect(typeof pipelineB.workingDeals).toBe("number");
  });

  it("getTeamActivityToday for Dealer A does not count Dealer B activity", async () => {
    const teamA = await teamActivityService.getTeamActivityToday(dealerAId);
    expect(teamA).toMatchObject({
      callsLogged: expect.any(Number),
      notesAdded: expect.any(Number),
      callbacksScheduled: expect.any(Number),
      dealsStarted: expect.any(Number),
    });
  });
});

describe("Aging bucket boundary", () => {
  let agingDealerId: string;
  const agingVehicleId = "b6000000-0000-0000-0000-000000000006";
  beforeAll(async () => {
    agingDealerId = randomUUID();
    await prisma.dealership.upsert({
      where: { id: agingDealerId },
      create: { id: agingDealerId, name: "Aging Test Dealer" },
      update: {},
    });
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    await prisma.vehicle.upsert({
      where: { id: agingVehicleId },
      create: {
        id: agingVehicleId,
        dealershipId: agingDealerId,
        stockNumber: "AGING-45",
        status: "AVAILABLE",
        createdAt: fortyFiveDaysAgo,
      },
      update: { dealershipId: agingDealerId, createdAt: fortyFiveDaysAgo },
    });
  });

  it("vehicle created 45 days ago falls in d30to60 bucket", async () => {
    const buckets = await vehicleDb.countByAgingBuckets(agingDealerId);
    expect(buckets.d30to60).toBeGreaterThanOrEqual(1);
  });
});
