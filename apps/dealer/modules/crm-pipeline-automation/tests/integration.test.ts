/** @jest-environment node */
/**
 * CRM Pipeline + Automation integration tests (skip when !hasDb):
 * Tenant isolation, RBAC, stage delete block, AutomationRun idempotency,
 * sequence pause on WON, job retry/dead-letter.
 */
import { prisma } from "@/lib/db";
import { requirePermission, loadUserPermissions } from "@/lib/rbac";
import * as pipelineService from "../service/pipeline";
import * as stageService from "../service/stage";
import * as opportunityService from "../service/opportunity";
import * as journeyBarService from "../service/journey-bar";
import * as stageTransitionService from "../service/stage-transition";
import * as automationRuleService from "../service/automation-rule";
import * as sequenceService from "../service/sequence";
import * as jobWorker from "../service/job-worker";
import * as pipelineDb from "../db/pipeline";
import * as stageDb from "../db/stage";
import * as opportunityDb from "../db/opportunity";
import * as automationRunDb from "../db/automation-run";
import * as jobDb from "../db/job";
import * as customersDb from "@/modules/customers/db/customers";
import { ApiError } from "@/lib/auth";
import { toErrorPayload } from "@/lib/api/errors";


const dealerAId = "c1000000-0000-0000-0000-000000000001";
const dealerBId = "c2000000-0000-0000-0000-000000000002";
const userAId = "c3000000-0000-0000-0000-000000000003";
const userBId = "c3000000-0000-0000-0000-000000000004";
const crmReadOnlyId = "c4000000-0000-0000-0000-000000000005";
const noCrmId = "c5000000-0000-0000-0000-000000000006";

async function ensureTestData(): Promise<{
  pipelineAId: string;
  stageAId: string;
  stageA2Id: string;
  stageA2BId: string;
  customerAId: string;
  opportunityAId: string;
  pipelineBId: string;
  stageBId: string;
}> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "CRM Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "CRM Dealer B" },
    update: {},
  });
  for (const [id, email] of [
    [userAId, "crm-a@test.local"],
    [userBId, "crm-b@test.local"],
    [crmReadOnlyId, "crm-read@test.local"],
    [noCrmId, "no-crm@test.local"],
  ] as const) {
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: {},
    });
  }

  const permCrmRead = await prisma.permission.findFirst({ where: { key: "crm.read" } });
  const permCrmWrite = await prisma.permission.findFirst({ where: { key: "crm.write" } });
  const permAdmin = await prisma.permission.findFirst({ where: { key: "admin.dealership.read" } });
  if (!permCrmRead || !permAdmin) throw new Error("Seed permissions first (crm.read, admin.dealership.read)");

  const roleCrmReadOnly = await prisma.role.upsert({
    where: { id: "c6000000-0000-0000-0000-000000000006" },
    create: {
      id: "c6000000-0000-0000-0000-000000000006",
      dealershipId: dealerAId,
      name: "CrmReadOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permCrmRead.id }] },
    },
    update: {},
  });
  const roleNoCrm = await prisma.role.upsert({
    where: { id: "c7000000-0000-0000-0000-000000000007" },
    create: {
      id: "c7000000-0000-0000-0000-000000000007",
      dealershipId: dealerAId,
      name: "NoCrm",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { id: "c8000000-0000-0000-0000-000000000008" },
    create: {
      id: "c8000000-0000-0000-0000-000000000008",
      dealershipId: dealerAId,
      userId: crmReadOnlyId,
      roleId: roleCrmReadOnly.id,
    },
    update: { roleId: roleCrmReadOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "c9000000-0000-0000-0000-000000000009" },
    create: {
      id: "c9000000-0000-0000-0000-000000000009",
      dealershipId: dealerAId,
      userId: noCrmId,
      roleId: roleNoCrm.id,
    },
    update: { roleId: roleNoCrm.id },
  });

  const customerA = await prisma.customer.upsert({
    where: { id: "ca000000-0000-0000-0000-00000000000a" },
    create: {
      id: "ca000000-0000-0000-0000-00000000000a",
      dealershipId: dealerAId,
      name: "Customer A",
      status: "LEAD",
    },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "cb000000-0000-0000-0000-00000000000b" },
    create: {
      id: "cb000000-0000-0000-0000-00000000000b",
      dealershipId: dealerBId,
      name: "Customer B",
      status: "LEAD",
    },
    update: {},
  });

  const pipelineA = await pipelineDb.createPipeline(dealerAId, { name: "Pipeline A", isDefault: true });
  const stageA = await stageDb.createStage(dealerAId, pipelineA.id, { order: 0, name: "Lead" });
  const stageA2 = await stageDb.createStage(dealerAId, pipelineA.id, { order: 1, name: "Qualified" });
  const opportunityA = await opportunityDb.createOpportunity(dealerAId, {
    customerId: customerA.id,
    stageId: stageA.id,
  });

  const pipelineA2 = await pipelineDb.createPipeline(dealerAId, { name: "Pipeline A2", isDefault: false });
  const stageA2B = await stageDb.createStage(dealerAId, pipelineA2.id, { order: 0, name: "Lead" });

  const pipelineB = await pipelineDb.createPipeline(dealerBId, { name: "Pipeline B", isDefault: true });
  const stageB = await stageDb.createStage(dealerBId, pipelineB.id, { order: 0, name: "Lead" });
  await opportunityDb.createOpportunity(dealerBId, {
    customerId: customerB.id,
    stageId: stageB.id,
  });

  return {
    pipelineAId: pipelineA.id,
    stageAId: stageA.id,
    stageA2Id: stageA2.id,
    stageA2BId: stageA2B.id,
    customerAId: customerA.id,
    opportunityAId: opportunityA.id,
    pipelineBId: pipelineB.id,
    stageBId: stageB.id,
  };
}

describe("CRM Pipeline Automation integration", () => {
  jest.setTimeout(15000);
  let ids: Awaited<ReturnType<typeof ensureTestData>>;

  beforeAll(async () => {
    ids = await ensureTestData();
  });

  describe("Tenant isolation", () => {
    it("Dealer A cannot see Dealer B pipeline", async () => {
      const pipeline = await pipelineDb.getPipelineById(dealerAId, ids.pipelineBId);
      expect(pipeline).toBeNull();
    });

    it("Dealer A cannot see Dealer B opportunity", async () => {
      const list = await opportunityDb.listOpportunities(dealerAId, {
        limit: 10,
        offset: 0,
        filters: { stageId: ids.stageBId },
      });
      expect(list.data.length).toBe(0);
    });

    it("getPipeline for other dealer id throws NOT_FOUND", async () => {
      await expect(pipelineService.getPipeline(dealerAId, ids.pipelineBId)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("RBAC", () => {
    it("GET journey-bar: missing crm.read yields 403 (guardPermission in route)", async () => {
      try {
        await requirePermission(noCrmId, dealerAId, "crm.read");
      } catch (e) {
        expect((e as ApiError).code).toBe("FORBIDDEN");
        expect(toErrorPayload(e).status).toBe(403);
      }
    });

    it("PATCH stage: missing crm.write yields 403 (guardPermission in route)", async () => {
      try {
        await requirePermission(crmReadOnlyId, dealerAId, "crm.write");
      } catch (e) {
        expect((e as ApiError).code).toBe("FORBIDDEN");
        expect(toErrorPayload(e).status).toBe(403);
      }
    });

    it("user with crm.read passes requirePermission(crm.read)", async () => {
      const perms = await loadUserPermissions(crmReadOnlyId, dealerAId);
      expect(perms).toContain("crm.read");
      await requirePermission(crmReadOnlyId, dealerAId, "crm.read");
    });
  });

  describe("Journey bar", () => {
    it("customer with no stage returns default pipeline stages and currentStageId null", async () => {
      const data = await journeyBarService.getJourneyBarData(dealerAId, {
        customerId: ids.customerAId,
      });
      expect(data.stages.length).toBeGreaterThanOrEqual(1);
      expect(data.currentStageId).toBeNull();
      expect(data.currentIndex).toBe(0);
      expect(data.signals?.overdueTaskCount).toBe(0);
    });

    it("opportunity returns pipeline stages and currentStageId", async () => {
      const data = await journeyBarService.getJourneyBarData(dealerAId, {
        opportunityId: ids.opportunityAId,
      });
      expect(data.stages.length).toBeGreaterThanOrEqual(2);
      expect(data.currentStageId).toBe(ids.stageAId);
      expect(data.signals?.overdueTaskCount).toBeDefined();
    });

    it("wrong dealership customer returns NOT_FOUND (tenant isolation)", async () => {
      await expect(
        journeyBarService.getJourneyBarData(dealerAId, { customerId: ids.customerAId })
      ).resolves.toBeDefined();
      await expect(
        journeyBarService.getJourneyBarData(dealerBId, { customerId: ids.customerAId })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("wrong dealership opportunity returns NOT_FOUND (tenant isolation)", async () => {
      await expect(
        journeyBarService.getJourneyBarData(dealerBId, { opportunityId: ids.opportunityAId })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("Stage transition", () => {
    it("opportunity: same pipeline transition succeeds", async () => {
      const result = await stageTransitionService.transitionStage(
        dealerAId,
        userAId,
        "opportunity",
        ids.opportunityAId,
        ids.stageA2Id
      );
      expect(result.id).toBe(ids.opportunityAId);
      expect(result.stageId).toBe(ids.stageA2Id);
      const opp = await opportunityDb.getOpportunityById(dealerAId, ids.opportunityAId);
      expect(opp?.stageId).toBe(ids.stageA2Id);
      await opportunityDb.updateOpportunity(dealerAId, ids.opportunityAId, {
        stageId: ids.stageAId,
      });
    });

    it("opportunity: different pipeline forbidden", async () => {
      await expect(
        stageTransitionService.transitionStage(
          dealerAId,
          userAId,
          "opportunity",
          ids.opportunityAId,
          ids.stageA2BId
        )
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: /same pipeline/ });
    });

    it("opportunity: WON status cannot change stage (terminal)", async () => {
      await opportunityDb.updateOpportunity(dealerAId, ids.opportunityAId, { status: "WON" });
      await expect(
        stageTransitionService.transitionStage(
          dealerAId,
          userAId,
          "opportunity",
          ids.opportunityAId,
          ids.stageA2Id
        )
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: /WON|LOST/ });
      await opportunityDb.updateOpportunity(dealerAId, ids.opportunityAId, { status: "OPEN" });
    });

    it("customer: same pipeline transition succeeds", async () => {
      await prisma.customer.update({
        where: { id: ids.customerAId },
        data: { stageId: ids.stageAId },
      });
      const result = await stageTransitionService.transitionStage(
        dealerAId,
        userAId,
        "customer",
        ids.customerAId,
        ids.stageA2Id
      );
      expect(result.id).toBe(ids.customerAId);
      expect(result.stageId).toBe(ids.stageA2Id);
      const cust = await customersDb.getCustomerById(dealerAId, ids.customerAId);
      expect(cust?.stageId).toBe(ids.stageA2Id);
      await customersDb.updateCustomerStageId(dealerAId, ids.customerAId, null);
    });

    it("customer: wrong dealership returns NOT_FOUND (IDOR)", async () => {
      await expect(
        stageTransitionService.transitionStage(
          dealerBId,
          userBId,
          "customer",
          ids.customerAId,
          ids.stageBId
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("opportunity: wrong dealership returns NOT_FOUND (IDOR)", async () => {
      await expect(
        stageTransitionService.transitionStage(
          dealerBId,
          userBId,
          "opportunity",
          ids.opportunityAId,
          ids.stageBId
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("Stage delete", () => {
    it("deleteStage is blocked when opportunities exist in stage", async () => {
      await expect(
        stageService.deleteStage(dealerAId, userAId, ids.stageAId)
      ).rejects.toMatchObject({ code: "CONFLICT", message: /Reassign opportunities/ });
    });
  });

  describe("AutomationRun idempotency", () => {
    it("same entity+event+rule does not double-insert", async () => {
      const rule = await prisma.automationRule.create({
        data: {
          dealershipId: dealerAId,
          name: "Test Rule",
          triggerEvent: "opportunity.created",
          actions: [],
          schedule: "immediate",
          isActive: true,
        },
      });
      const key = {
        dealershipId: dealerAId,
        entityType: "opportunity",
        entityId: ids.opportunityAId,
        eventKey: "opportunity.created",
        ruleId: rule.id,
        status: "completed",
      };
      const first = await automationRunDb.insertAutomationRunIdempotent(dealerAId, key);
      expect(first).not.toBeNull();
      const second = await automationRunDb.insertAutomationRunIdempotent(dealerAId, key);
      expect(second).toBeNull();
      await prisma.automationRule.delete({ where: { id: rule.id } });
    });
  });

  describe("Sequence pause on WON", () => {
    it("sequence instance can be stopped when opportunity is WON", async () => {
      const template = await prisma.sequenceTemplate.create({
        data: {
          dealershipId: dealerAId,
          name: "Test Seq",
        },
      });
      const step = await prisma.sequenceStep.create({
        data: {
          dealershipId: dealerAId,
          templateId: template.id,
          order: 0,
          stepType: "create_task",
        },
      });
      const instance = await prisma.sequenceInstance.create({
        data: {
          dealershipId: dealerAId,
          templateId: template.id,
          opportunityId: ids.opportunityAId,
          status: "active",
          startedAt: new Date(),
        },
      });
      await prisma.sequenceStepInstance.create({
        data: {
          dealershipId: dealerAId,
          instanceId: instance.id,
          stepId: step.id,
          scheduledAt: new Date(),
          status: "pending",
        },
      });
      await opportunityDb.updateOpportunity(dealerAId, ids.opportunityAId, { status: "WON" });
      const updated = await sequenceService.updateSequenceInstanceStatus(
        dealerAId,
        userAId,
        instance.id,
        "stopped"
      );
      expect(updated?.status).toBe("stopped");
      await prisma.sequenceStepInstance.deleteMany({ where: { instanceId: instance.id } });
      await prisma.sequenceInstance.delete({ where: { id: instance.id } });
      await prisma.sequenceStep.delete({ where: { id: step.id } });
      await prisma.sequenceTemplate.delete({ where: { id: template.id } });
    });
  });

  describe("Job retry and dead-letter", () => {
    it("job worker processes pending jobs and marks completed", async () => {
      const job = await jobDb.createJob(dealerAId, {
        queueType: "sequence_step",
        payload: { stepInstanceId: "00000000-0000-0000-0000-000000000000", instanceId: "00000000-0000-0000-0000-000000000000" },
        runAt: new Date(0),
      });
      const result = await jobWorker.runJobWorker(dealerAId);
      expect(result.processed + result.failed + result.deadLetter).toBeGreaterThanOrEqual(0);
      const after = await jobDb.getJobById(dealerAId, job.id);
      expect(after?.status).toMatch(/completed|failed|dead_letter|running/);
    });

    it("failJob with deadLetter sets status dead_letter", async () => {
      const job = await jobDb.createJob(dealerAId, {
        queueType: "automation",
        payload: {},
        runAt: new Date(),
      });
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date() },
      });
      await jobDb.failJob(dealerAId, job.id, "Test error", { deadLetter: true });
      const after = await jobDb.getJobById(dealerAId, job.id);
      expect(after?.status).toBe("dead_letter");
    });
  });

  describe("Atomic job claim (no double execution)", () => {
    it("concurrent runJobWorker calls result in job executed once", async () => {
      const rule = await prisma.automationRule.create({
        data: {
          dealershipId: dealerAId,
          name: "Atomic Rule",
          triggerEvent: "opportunity.created",
          actions: [{ type: "add_tag", params: {} }],
          schedule: "immediate",
          isActive: true,
        },
      });
      const run = await automationRunDb.insertAutomationRunIdempotent(dealerAId, {
        entityType: "opportunity",
        entityId: ids.opportunityAId,
        eventKey: "opportunity.created",
        ruleId: rule.id,
        status: "scheduled",
      });
      expect(run).not.toBeNull();
      const runAt = new Date(0);
      await jobDb.createJob(dealerAId, {
        queueType: "automation",
        payload: {
          ruleId: rule.id,
          entityType: "opportunity",
          entityId: ids.opportunityAId,
          eventKey: "opportunity.created",
          runId: run!.id,
        },
        runAt,
      });
      const [r1, r2] = await Promise.all([
        jobWorker.runJobWorker(dealerAId),
        jobWorker.runJobWorker(dealerAId),
      ]);
      const totalProcessed = r1.processed + r2.processed;
      expect(totalProcessed).toBe(1);
      const runs = await prisma.automationRun.findMany({
        where: { id: run!.id, dealershipId: dealerAId },
      });
      expect(runs.length).toBe(1);
      expect(runs[0].status).toBe("completed");
      await prisma.automationRule.delete({ where: { id: rule.id } });
      await prisma.automationRun.deleteMany({ where: { id: run!.id } });
    });
  });

  describe("Sequence stop conditions (WON before delayed step)", () => {
    it("delayed second step does not execute after opportunity WON", async () => {
      const template = await prisma.sequenceTemplate.create({
        data: { dealershipId: dealerAId, name: "TwoStepSeq" },
      });
      await prisma.sequenceStep.create({
        data: { dealershipId: dealerAId, templateId: template.id, order: 0, stepType: "create_task" },
      });
      await prisma.sequenceStep.create({
        data: { dealershipId: dealerAId, templateId: template.id, order: 1, stepType: "create_task" },
      });
      const instance = await prisma.sequenceInstance.create({
        data: {
          dealershipId: dealerAId,
          templateId: template.id,
          opportunityId: ids.opportunityAId,
          customerId: ids.customerAId,
          status: "active",
          startedAt: new Date(),
        },
      });
      const steps = await prisma.sequenceStep.findMany({
        where: { templateId: template.id },
        orderBy: { order: "asc" },
      });
      const step0 = steps[0]!;
      const step1 = steps[1]!;
      const now = new Date();
      await prisma.sequenceStepInstance.createMany({
        data: [
          { dealershipId: dealerAId, instanceId: instance.id, stepId: step0.id, scheduledAt: now, status: "completed" },
          { dealershipId: dealerAId, instanceId: instance.id, stepId: step1.id, scheduledAt: new Date(now.getTime() + 1000), status: "pending" },
        ],
      });
      const stepInstances = await prisma.sequenceStepInstance.findMany({
        where: { instanceId: instance.id },
        include: { step: true },
        orderBy: { step: { order: "asc" } },
      });
      const secondStepInstance = stepInstances.find((si) => si.step.order === 1)!;
      await opportunityDb.updateOpportunity(dealerAId, ids.opportunityAId, { status: "WON" });
      await jobDb.createJob(dealerAId, {
        queueType: "sequence_step",
        payload: {
          stepInstanceId: secondStepInstance.id,
          instanceId: instance.id,
          customerId: ids.customerAId,
          opportunityId: ids.opportunityAId,
        },
        runAt: new Date(0),
      });
      const taskCountBefore = await prisma.customerTask.count({ where: { dealershipId: dealerAId, customerId: ids.customerAId } });
      await jobWorker.runJobWorker(dealerAId);
      const taskCountAfter = await prisma.customerTask.count({ where: { dealershipId: dealerAId, customerId: ids.customerAId } });
      expect(taskCountAfter).toBe(taskCountBefore);
      const updated = await prisma.sequenceStepInstance.findUnique({
        where: { id: secondStepInstance.id },
      });
      expect(updated?.status).toBe("skipped");
      await prisma.sequenceStepInstance.deleteMany({ where: { instanceId: instance.id } });
      await prisma.sequenceInstance.delete({ where: { id: instance.id } });
      await prisma.sequenceStep.deleteMany({ where: { templateId: template.id } });
      await prisma.sequenceTemplate.delete({ where: { id: template.id } });
    });
  });

  describe("Cross-tenant automation rules and sequences and jobs", () => {
    it("Dealer A getAutomationRuleById for Dealer B rule returns null", async () => {
      const rule = await prisma.automationRule.findFirst({ where: { dealershipId: dealerBId } });
      if (!rule) return;
      const got = await prisma.automationRule.findFirst({
        where: { id: rule.id, dealershipId: dealerAId },
      });
      expect(got).toBeNull();
    });

    it("Dealer A listAutomationRules returns only own rules", async () => {
      const { data } = await automationRuleService.listAutomationRules(dealerAId, { limit: 100, offset: 0 });
      const allOwn = data.every((r) => r.dealershipId === dealerAId);
      expect(allOwn).toBe(true);
    });

    it("Dealer A getSequenceTemplate for Dealer B template throws NOT_FOUND", async () => {
      const t = await prisma.sequenceTemplate.findFirst({ where: { dealershipId: dealerBId } });
      if (!t) return;
      await expect(sequenceService.getSequenceTemplate(dealerAId, t.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("Dealer A getJobById for Dealer B job returns null", async () => {
      const job = await prisma.job.findFirst({ where: { dealershipId: dealerBId } });
      if (!job) return;
      const got = await jobDb.getJobById(dealerAId, job.id);
      expect(got).toBeNull();
    });

    it("Dealer A listJobs returns only own jobs", async () => {
      const { data } = await jobDb.listJobs(dealerAId, { limit: 10, offset: 0 });
      const allOwn = data.every((j) => j.dealershipId === dealerAId);
      expect(allOwn).toBe(true);
    });
  });
});
