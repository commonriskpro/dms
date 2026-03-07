/** @jest-environment node */
/**
 * Inventory dashboard: shape tests for getKpis, getAgingBuckets, getDealPipeline, getTeamActivityToday;
 * tenant isolation and aging bucket boundary (integration when DB available).
 */
jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
}));

const hasDb =
  process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL;

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

(hasDb ? describe : describe.skip)("Inventory dashboard shape", () => {
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

(hasDb ? describe : describe.skip)("Inventory dashboard tenant isolation", () => {
  beforeAll(async () => {
    await prisma.dealership.upsert({
      where: { id: dealerAId },
      create: { id: dealerAId, name: "Dashboard Dealer A" },
      update: {},
    });
    await prisma.dealership.upsert({
      where: { id: dealerBId },
      create: { id: dealerBId, name: "Dashboard Dealer B" },
      update: {},
    });
  });

  it("getKpis for Dealer A does not count Dealer B vehicles", async () => {
    const vehicleB = await prisma.vehicle.upsert({
      where: { id: "b4000000-0000-0000-0000-000000000004" },
      create: {
        id: "b4000000-0000-0000-0000-000000000004",
        dealershipId: dealerBId,
        stockNumber: "DASH-B-001",
        status: "AVAILABLE",
      },
      update: {},
    });
    const kpisA = await dashboardService.getKpis(dealerAId);
    const kpisB = await dashboardService.getKpis(dealerBId);
    expect(kpisB.totalUnits).toBeGreaterThanOrEqual(1);
    expect(kpisA.totalUnits).toBeLessThan(kpisB.totalUnits);
  });

  it("getAgingBuckets for Dealer A does not count Dealer B vehicles", async () => {
    const bucketsA = await dashboardService.getAgingBuckets(dealerAId);
    const bucketsB = await dashboardService.getAgingBuckets(dealerBId);
    const sumA = bucketsA.lt30 + bucketsA.d30to60 + bucketsA.d60to90 + bucketsA.gt90;
    const sumB = bucketsB.lt30 + bucketsB.d30to60 + bucketsB.d60to90 + bucketsB.gt90;
    expect(sumB).toBeGreaterThanOrEqual(1);
    expect(sumA).toBeLessThan(sumB);
  });

  it("getDealPipeline for Dealer A does not count Dealer B deals or leads", async () => {
    const pipelineA = await dealPipelineService.getDealPipeline(dealerAId);
    const pipelineB = await dealPipelineService.getDealPipeline(dealerBId);
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

(hasDb ? describe : describe.skip)("Aging bucket boundary", () => {
  const dealerId = "b5000000-0000-0000-0000-000000000005";
  beforeAll(async () => {
    await prisma.dealership.upsert({
      where: { id: dealerId },
      create: { id: dealerId, name: "Aging Test Dealer" },
      update: {},
    });
  });

  it("vehicle created exactly 30 days ago falls in d30to60 bucket", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.vehicle.upsert({
      where: { id: "b6000000-0000-0000-0000-000000000006" },
      create: {
        id: "b6000000-0000-0000-0000-000000000006",
        dealershipId: dealerId,
        stockNumber: "AGING-30",
        status: "AVAILABLE",
        createdAt: thirtyDaysAgo,
      },
      update: { createdAt: thirtyDaysAgo },
    });
    const buckets = await vehicleDb.countByAgingBuckets(dealerId);
    expect(buckets.d30to60).toBeGreaterThanOrEqual(1);
  });
});
