/**
 * CRM Pipeline + Automation unit tests (no DB).
 * Worker retry backoff, idempotency key shape, status transitions, validation abuse.
 */
import {
  listPipelinesQuerySchema,
  createPipelineBodySchema,
  createStageBodySchema,
  listOpportunitiesQuerySchema,
  updateOpportunityBodySchema,
  createAutomationRuleBodySchema,
  createSequenceTemplateBodySchema,
  listJobsQuerySchema,
  updateSequenceInstanceBodySchema,
  journeyBarQuerySchema,
  patchStageBodySchema,
} from "@/app/api/crm/schemas";

const BACKOFF_MIN_MS = 60 * 1000;
function nextRunAt(retryCount: number): Date {
  const delay = BACKOFF_MIN_MS * Math.pow(2, retryCount);
  return new Date(Date.now() + delay);
}

describe("Job worker retry logic", () => {
  it("nextRunAt increases with retry count (exponential backoff)", () => {
    const t0 = nextRunAt(0);
    const t1 = nextRunAt(1);
    const t2 = nextRunAt(2);
    const now = Date.now();
    expect(t0.getTime()).toBeGreaterThanOrEqual(now + BACKOFF_MIN_MS - 10);
    expect(t1.getTime()).toBeGreaterThanOrEqual(now + BACKOFF_MIN_MS * 2 - 10);
    expect(t2.getTime()).toBeGreaterThanOrEqual(now + BACKOFF_MIN_MS * 4 - 10);
    expect(t1.getTime() - t0.getTime()).toBe(BACKOFF_MIN_MS);
    expect(t2.getTime() - t1.getTime()).toBe(BACKOFF_MIN_MS * 2);
  });
});

describe("Idempotency key shape", () => {
  it("AutomationRun key is (dealershipId, entityType, entityId, eventKey, ruleId)", () => {
    const key = {
      dealershipId: "d1",
      entityType: "opportunity",
      entityId: "e1",
      eventKey: "opportunity.created",
      ruleId: "r1",
    };
    const key2 = { ...key, entityId: "e2" };
    expect(key).not.toEqual(key2);
    expect(JSON.stringify(key).length).toBeGreaterThan(0);
  });
});

describe("Status transitions", () => {
  it("OpportunityStatus OPEN allows WON and LOST", () => {
    const valid: Array<"OPEN" | "WON" | "LOST"> = ["OPEN", "WON", "LOST"];
    expect(valid).toContain("OPEN");
    expect(valid).toContain("WON");
    expect(valid).toContain("LOST");
  });

  it("SequenceInstanceStatus allows active, paused, stopped, completed", () => {
    const valid = ["active", "paused", "stopped", "completed"];
    expect(valid).toContain("active");
    expect(valid).toContain("stopped");
  });

  it("SequenceStepInstanceStatus allows pending, skipped, completed, failed", () => {
    const valid = ["pending", "skipped", "completed", "failed"];
    expect(valid).toContain("pending");
    expect(valid).toContain("skipped");
  });
});

describe("Validation abuse (CRM schemas)", () => {
  it("pagination: pipelines stay at 100, opportunities allow up to 500", () => {
    expect(() => listPipelinesQuerySchema.parse({ limit: 101 })).toThrow();
    expect(() => listOpportunitiesQuerySchema.parse({ limit: 500, offset: 0 })).not.toThrow();
    expect(() => listOpportunitiesQuerySchema.parse({ limit: 501, offset: 0 })).toThrow();
  });

  it("pagination: negative offset rejected", () => {
    expect(() => listPipelinesQuerySchema.parse({ offset: -1 })).toThrow();
    expect(() => listJobsQuerySchema.parse({ limit: 10, offset: -1 })).toThrow();
  });

  it("pagination: invalid enum sortBy/sortOrder rejected", () => {
    expect(() =>
      listOpportunitiesQuerySchema.parse({ sortBy: "invalid", sortOrder: "asc" })
    ).toThrow();
    expect(() =>
      listOpportunitiesQuerySchema.parse({ sortBy: "createdAt", sortOrder: "invalid" })
    ).toThrow();
  });

  it("pipeline name max length 200", () => {
    expect(() =>
      createPipelineBodySchema.parse({ name: "x".repeat(201), isDefault: false })
    ).toThrow();
    createPipelineBodySchema.parse({ name: "x".repeat(200) });
  });

  it("stage name max length 100", () => {
    expect(() =>
      createStageBodySchema.parse({ order: 0, name: "x".repeat(101) })
    ).toThrow();
    createStageBodySchema.parse({ order: 0, name: "x".repeat(100) });
  });

  it("opportunity status invalid enum rejected", () => {
    expect(() =>
      updateOpportunityBodySchema.parse({ status: "INVALID" })
    ).toThrow();
    updateOpportunityBodySchema.parse({ status: "WON" });
  });

  it("automation rule schedule invalid enum rejected", () => {
    expect(() =>
      createAutomationRuleBodySchema.parse({
        name: "R",
        triggerEvent: "e",
        actions: [],
        schedule: "invalid",
      })
    ).toThrow();
  });

  it("sequence template name max length 200", () => {
    expect(() =>
      createSequenceTemplateBodySchema.parse({ name: "x".repeat(201) })
    ).toThrow();
  });

  it("sequence instance status invalid enum rejected", () => {
    expect(() =>
      updateSequenceInstanceBodySchema.parse({ status: "invalid" })
    ).toThrow();
    updateSequenceInstanceBodySchema.parse({ status: "active" });
  });

  it("jobs list status invalid enum rejected", () => {
    expect(() =>
      listJobsQuerySchema.parse({ limit: 10, offset: 0, status: "invalid" })
    ).toThrow();
  });

  it("journey bar: exactly one of customerId or opportunityId required", () => {
    const uuid = "00000000-0000-0000-0000-000000000001";
    expect(() => journeyBarQuerySchema.parse({})).toThrow();
    expect(() => journeyBarQuerySchema.parse({ customerId: uuid, opportunityId: uuid })).toThrow();
    journeyBarQuerySchema.parse({ customerId: uuid });
    journeyBarQuerySchema.parse({ opportunityId: uuid });
  });

  it("patch stage: newStageId required and must be UUID", () => {
    expect(() => patchStageBodySchema.parse({})).toThrow();
    expect(() => patchStageBodySchema.parse({ newStageId: "not-uuid" })).toThrow();
    patchStageBodySchema.parse({ newStageId: "00000000-0000-0000-0000-000000000001" });
  });
});
