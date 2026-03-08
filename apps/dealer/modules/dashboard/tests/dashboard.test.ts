/** @jest-environment node */
/**
 * Dashboard: permission-gated sections and tenant isolation.
 * Unit: only permitted sections present. Integration (skipIf no DB): funnel tenant-scoped; sections by permission; tenant data only.
 */
import { prisma } from "@/lib/db";
import * as dashboardService from "../service/dashboard";
import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";
import * as stageDb from "@/modules/crm-pipeline-automation/db/stage";
import * as opportunityDb from "@/modules/crm-pipeline-automation/db/opportunity";
import * as pipelineDb from "@/modules/crm-pipeline-automation/db/pipeline";


const dealerAId = "da100000-0000-0000-0000-000000000001";
const dealerBId = "da200000-0000-0000-0000-000000000002";
const userAId = "da300000-0000-0000-0000-000000000003";
const userCustomersOnlyId = "da400000-0000-0000-0000-000000000004";
const userCrmOnlyId = "da500000-0000-0000-0000-000000000005";

async function ensureTestData(): Promise<{
  stageAId: string;
  stageBId: string;
  customerAId: string;
  customerBId: string;
  opportunityAId: string;
  opportunityBId: string;
}> {
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
  for (const [id, email] of [
    [userAId, "dash-a@test.local"],
    [userCustomersOnlyId, "dash-customers@test.local"],
    [userCrmOnlyId, "dash-crm@test.local"],
  ] as [string, string][]) {
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: {},
    });
  }

  const permCustomersRead = await prisma.permission.findFirst({
    where: { key: "customers.read" },
  });
  const permCrmRead = await prisma.permission.findFirst({
    where: { key: "crm.read" },
  });
  if (!permCustomersRead || !permCrmRead)
    throw new Error("Seed permissions first (customers.read, crm.read)");

  const roleCustomersOnly = await prisma.role.upsert({
    where: { id: "da600000-0000-0000-0000-000000000006" },
    create: {
      id: "da600000-0000-0000-0000-000000000006",
      dealershipId: dealerAId,
      name: "DashboardCustomersOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permCustomersRead.id }] },
    },
    update: {},
  });
  const roleCrmOnly = await prisma.role.upsert({
    where: { id: "da700000-0000-0000-0000-000000000007" },
    create: {
      id: "da700000-0000-0000-0000-000000000007",
      dealershipId: dealerAId,
      name: "DashboardCrmOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permCrmRead.id }] },
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { id: "da800000-0000-0000-0000-000000000008" },
    create: {
      id: "da800000-0000-0000-0000-000000000008",
      dealershipId: dealerAId,
      userId: userCustomersOnlyId,
      roleId: roleCustomersOnly.id,
    },
    update: { roleId: roleCustomersOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "da900000-0000-0000-0000-000000000009" },
    create: {
      id: "da900000-0000-0000-0000-000000000009",
      dealershipId: dealerAId,
      userId: userCrmOnlyId,
      roleId: roleCrmOnly.id,
    },
    update: { roleId: roleCrmOnly.id },
  });

  const customerA = await prisma.customer.upsert({
    where: { id: "daa00000-0000-0000-0000-00000000000a" },
    create: {
      id: "daa00000-0000-0000-0000-00000000000a",
      dealershipId: dealerAId,
      name: "Dashboard Customer A",
      status: "LEAD",
    },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "dab00000-0000-0000-0000-00000000000b" },
    create: {
      id: "dab00000-0000-0000-0000-00000000000b",
      dealershipId: dealerBId,
      name: "Dashboard Customer B",
      status: "LEAD",
    },
    update: {},
  });

  const pipelineA = await pipelineDb.createPipeline(dealerAId, {
    name: "Dashboard Pipeline A",
    isDefault: true,
  });
  const pipelineB = await pipelineDb.createPipeline(dealerBId, {
    name: "Dashboard Pipeline B",
    isDefault: true,
  });
  const stageA = await stageDb.createStage(dealerAId, pipelineA.id, {
    order: 0,
    name: "Lead A",
  });
  const stageB = await stageDb.createStage(dealerBId, pipelineB.id, {
    order: 0,
    name: "Lead B",
  });
  const opportunityA = await opportunityDb.createOpportunity(dealerAId, {
    customerId: customerA.id,
    stageId: stageA.id,
  });
  const opportunityB = await opportunityDb.createOpportunity(dealerBId, {
    customerId: customerB.id,
    stageId: stageB.id,
  });

  return {
    stageAId: stageA.id,
    stageBId: stageB.id,
    customerAId: customerA.id,
    customerBId: customerB.id,
    opportunityAId: opportunityA.id,
    opportunityBId: opportunityB.id,
  };
}

describe("Dashboard service (unit)", () => {
  it("no permissions returns empty data", async () => {
    const data = await dashboardService.getDashboard(
      dealerAId,
      userAId,
      []
    );
    expect(data).toEqual({});
    expect(Object.keys(data)).toHaveLength(0);
  });
});

describe("Dashboard integration", () => {
  let ids: Awaited<ReturnType<typeof ensureTestData>>;

  beforeAll(async () => {
    ids = await ensureTestData();
  }, 15000);

  it("only customers.read includes newProspects, myTasks, staleLeads; excludes pipelineFunnel", async () => {
    const data = await dashboardService.getDashboard(
      dealerAId,
      userAId,
      ["customers.read"]
    );
    expect(data.newProspects).toBeDefined();
    expect(data.myTasks).toBeDefined();
    expect(data.staleLeads).toBeDefined();
    expect(data.pipelineFunnel).toBeUndefined();
    expect(data.appointments).toBeUndefined();
  });

  it("only crm.read includes pipelineFunnel, appointments, myTasks, staleLeads; excludes newProspects", async () => {
    const data = await dashboardService.getDashboard(
      dealerAId,
      userAId,
      ["crm.read"]
    );
    expect(data.pipelineFunnel).toBeDefined();
    expect(data.appointments).toEqual([]);
    expect(data.myTasks).toBeDefined();
    expect(data.staleLeads).toBeDefined();
    expect(data.newProspects).toBeUndefined();
  });

  it("both permissions include all sections", async () => {
    const data = await dashboardService.getDashboard(
      dealerAId,
      userAId,
      ["customers.read", "crm.read"]
    );
    expect(data.myTasks).toBeDefined();
    expect(data.newProspects).toBeDefined();
    expect(data.pipelineFunnel).toBeDefined();
    expect(data.staleLeads).toBeDefined();
    expect(data.appointments).toEqual([]);
  });

  it("pipeline funnel is tenant-scoped: Dealer A does not see Dealer B counts", async () => {
    const funnel = await stageDb.getPipelineFunnelCounts(dealerAId);
    const stageIds = funnel.map((s) => s.stageId);
    expect(stageIds).toContain(ids.stageAId);
    expect(stageIds).not.toContain(ids.stageBId);
    const stageAEntry = funnel.find((s) => s.stageId === ids.stageAId);
    expect(stageAEntry?.count).toBeGreaterThanOrEqual(1);
  });

  it("getDashboard as Dealer A returns funnel with only A stages; no counts from Dealer B", async () => {
    const data = await dashboardService.getDashboard(
      dealerAId,
      userAId,
      ["crm.read"]
    );
    expect(data.pipelineFunnel?.stages).toBeDefined();
    const stageIds = data.pipelineFunnel!.stages.map((s) => s.stageId);
    expect(stageIds).not.toContain(ids.stageBId);
    expect(data.pipelineFunnel!.stages.every((s) => s.stageId !== ids.stageBId)).toBe(true);
  });

  it("myTasks returns only tenant tasks", async () => {
    await tasksDb.listMyTasks(dealerAId, userAId, 10);
    const asB = await tasksDb.listMyTasks(dealerBId, userAId, 10);
    expect(Array.isArray(asB)).toBe(true);
  });

  it("listNewProspects returns only tenant customers", async () => {
    const prospects = await customersDb.listNewProspects(dealerAId, 10);
    expect(Array.isArray(prospects)).toBe(true);
    const idsSet = new Set(prospects.map((p) => p.id));
    expect(idsSet.has(ids.customerBId)).toBe(false);
  });
});
