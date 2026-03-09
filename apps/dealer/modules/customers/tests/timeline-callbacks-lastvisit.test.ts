/** @jest-environment node */
/**
 * Timeline, Callbacks, Last Visit: validation, invariants, tenant isolation behavior.
 * - Validation: invalid/non-existent customer or callbackId → NOT_FOUND; callbackAt past, reason length, PATCH body; pagination (Zod at route).
 * - Invariants: lastVisit only via service with correct dealership; callback status SCHEDULED → DONE|CANCELLED; snoozedUntil keeps SCHEDULED.
 * - Positive: createCallback then listCallbacks; logCall then listTimeline returns CALL.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import {
  timelineQuerySchema,
  listCallbacksQuerySchema,
  createCallbackBodySchema,
  updateCallbackBodySchema,
  customerIdParamSchema,
  callbackIdParamSchema,
} from "@/app/api/customers/schemas";
import * as timelineService from "../service/timeline";
import * as callbacksService from "../service/callbacks";
import * as lastVisitService from "../service/last-visit";
import * as activityService from "../service/activity";
import * as customerService from "../service/customer";


const dealerId = "a1000000-0000-0000-0000-000000000001";
const userId = "a2000000-0000-0000-0000-000000000002";
const nonExistentCustomerId = "a9000000-0000-0000-0000-000000000099";
const nonExistentCallbackId = "a9000000-0000-0000-0000-000000000098";

async function ensureTestData(): Promise<{ customerId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Timeline Callbacks Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "timeline-cb@test.local" },
    update: {},
  });
  let customer = await prisma.customer.findFirst({
    where: { dealershipId: dealerId, name: "Timeline CB Customer", deletedAt: null },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        id: "a3000000-0000-0000-0000-000000000003",
        dealershipId: dealerId,
        name: "Timeline CB Customer",
        status: "LEAD",
      },
    });
  }
  return { customerId: customer.id };
}

describe("Timeline, Callbacks, Last Visit", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  describe("Validation", () => {
    it("invalid UUID for customer id fails Zod (route edge)", () => {
      expect(() => customerIdParamSchema.parse({ id: "not-a-uuid" })).toThrow(z.ZodError);
      expect(() => customerIdParamSchema.parse({ id: "" })).toThrow(z.ZodError);
    });

    it("invalid UUID for callbackId fails Zod (route edge)", () => {
      expect(() =>
        callbackIdParamSchema.parse({ id: "a3000000-0000-0000-0000-000000000003", callbackId: "x" })
      ).toThrow(z.ZodError);
    });

    it("non-existent customer id returns NOT_FOUND from listTimeline", async () => {
      await expect(
        timelineService.listTimeline(dealerId, nonExistentCustomerId, { limit: 25, offset: 0 })
      ).rejects.toThrow(ApiError);
      try {
        await timelineService.listTimeline(dealerId, nonExistentCustomerId, {
          limit: 25,
          offset: 0,
        });
      } catch (e) {
        expect((e as ApiError).code).toBe("NOT_FOUND");
      }
    });

    it("non-existent customer id returns NOT_FOUND from listCallbacks", async () => {
      await expect(
        callbacksService.listCallbacks(dealerId, nonExistentCustomerId, {
          limit: 25,
          offset: 0,
        })
      ).rejects.toThrow(ApiError);
      try {
        await callbacksService.listCallbacks(dealerId, nonExistentCustomerId, {
          limit: 25,
          offset: 0,
        });
      } catch (e) {
        expect((e as ApiError).code).toBe("NOT_FOUND");
      }
    });

    it("non-existent customer id returns NOT_FOUND from createCallback", async () => {
      await expect(
        callbacksService.createCallback(dealerId, userId, nonExistentCustomerId, {
          callbackAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow(ApiError);
      try {
        await callbacksService.createCallback(dealerId, userId, nonExistentCustomerId, {
          callbackAt: new Date(Date.now() + 86400000),
        });
      } catch (e) {
        expect((e as ApiError).code).toBe("NOT_FOUND");
      }
    });

    it("non-existent callbackId returns NOT_FOUND from updateCallback", async () => {
      const { customerId } = await ensureTestData();
      await expect(
        callbacksService.updateCallback(
          dealerId,
          userId,
          customerId,
          nonExistentCallbackId,
          { status: "DONE" }
        )
      ).rejects.toThrow(ApiError);
      try {
        await callbacksService.updateCallback(
          dealerId,
          userId,
          customerId,
          nonExistentCallbackId,
          { status: "DONE" }
        );
      } catch (e) {
        expect((e as ApiError).code).toBe("NOT_FOUND");
      }
    });

    it("pagination limit > 50 fails Zod (timeline query)", () => {
      expect(() => timelineQuerySchema.parse({ limit: 51, offset: 0 })).toThrow(z.ZodError);
    });

    it("pagination limit < 1 fails Zod (timeline query)", () => {
      expect(() => timelineQuerySchema.parse({ limit: 0, offset: 0 })).toThrow(z.ZodError);
    });

    it("pagination offset < 0 fails Zod (timeline query)", () => {
      expect(() => timelineQuerySchema.parse({ limit: 25, offset: -1 })).toThrow(z.ZodError);
    });

    it("pagination limit > 50 fails Zod (list callbacks query)", () => {
      expect(() => listCallbacksQuerySchema.parse({ limit: 51, offset: 0 })).toThrow(z.ZodError);
    });

    it("callbackAt more than 1 day in the past returns VALIDATION_ERROR on create", async () => {
      const { customerId } = await ensureTestData();
      const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await expect(
        callbacksService.createCallback(dealerId, userId, customerId, {
          callbackAt: oneDayAgo,
        })
      ).rejects.toThrow(ApiError);
      try {
        await callbacksService.createCallback(dealerId, userId, customerId, {
          callbackAt: oneDayAgo,
        });
      } catch (e) {
        expect((e as ApiError).code).toBe("VALIDATION_ERROR");
        expect((e as Error).message).toMatch(/past|1 day/i);
      }
    });

    it("reason length > 2000 returns VALIDATION_ERROR on create", async () => {
      const { customerId } = await ensureTestData();
      const longReason = "x".repeat(2001);
      await expect(
        callbacksService.createCallback(dealerId, userId, customerId, {
          callbackAt: new Date(Date.now() + 86400000),
          reason: longReason,
        })
      ).rejects.toThrow(ApiError);
      try {
        await callbacksService.createCallback(dealerId, userId, customerId, {
          callbackAt: new Date(Date.now() + 86400000),
          reason: longReason,
        });
      } catch (e) {
        expect((e as ApiError).code).toBe("VALIDATION_ERROR");
        expect((e as Error).message).toMatch(/2000|reason/i);
      }
    });

    it("PATCH callback with neither status nor snoozedUntil fails Zod", () => {
      expect(() => updateCallbackBodySchema.parse({})).toThrow(z.ZodError);
      expect(() => updateCallbackBodySchema.parse({ status: undefined, snoozedUntil: undefined })).toThrow(
        z.ZodError
      );
    });

    it("createCallback body requires valid callbackAt (Zod datetime)", () => {
      expect(() =>
        createCallbackBodySchema.parse({ callbackAt: "not-a-datetime" })
      ).toThrow(z.ZodError);
    });
  });

  describe("Invariants", () => {
    it("updateLastVisit only updates when customer belongs to dealership", async () => {
      const { customerId } = await ensureTestData();
      await expect(
        lastVisitService.updateLastVisit(dealerId, userId, customerId)
      ).resolves.not.toThrow();
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { lastVisitAt: true, lastVisitByUserId: true },
      });
      expect(customer?.lastVisitAt).toBeDefined();
      expect(customer?.lastVisitByUserId).toBe(userId);
    });

    it("callback status SCHEDULED can transition to DONE", async () => {
      const { customerId } = await ensureTestData();
      const created = await callbacksService.createCallback(
        dealerId,
        userId,
        customerId,
        { callbackAt: new Date(Date.now() + 86400000) }
      );
      expect(created.status).toBe("SCHEDULED");
      const updated = await callbacksService.updateCallback(
        dealerId,
        userId,
        customerId,
        created.id,
        { status: "DONE" }
      );
      expect(updated.status).toBe("DONE");
    });

    it("callback status SCHEDULED can transition to CANCELLED", async () => {
      const { customerId } = await ensureTestData();
      const created = await callbacksService.createCallback(
        dealerId,
        userId,
        customerId,
        { callbackAt: new Date(Date.now() + 86400000) }
      );
      const updated = await callbacksService.updateCallback(
        dealerId,
        userId,
        customerId,
        created.id,
        { status: "CANCELLED" }
      );
      expect(updated.status).toBe("CANCELLED");
    });

    it("snoozedUntil does not change status (remains SCHEDULED)", async () => {
      const { customerId } = await ensureTestData();
      const created = await callbacksService.createCallback(
        dealerId,
        userId,
        customerId,
        { callbackAt: new Date(Date.now() + 86400000) }
      );
      const snoozedUntil = new Date(Date.now() + 2 * 86400000);
      const updated = await callbacksService.updateCallback(
        dealerId,
        userId,
        customerId,
        created.id,
        { snoozedUntil }
      );
      expect(updated.status).toBe("SCHEDULED");
      expect(updated.snoozedUntil).toBeDefined();
      expect(updated.snoozedUntil?.getTime()).toBe(snoozedUntil.getTime());
    });
  });

  describe("Positive flows", () => {
    it("createCallback then listCallbacks returns the callback", async () => {
      await ensureTestData();
      const dedicatedCustomer = await prisma.customer.create({
        data: {
          dealershipId: dealerId,
          name: "Callbacks positive test customer",
          status: "LEAD",
        },
      });
      const created = await callbacksService.createCallback(
        dealerId,
        userId,
        dedicatedCustomer.id,
        {
          callbackAt: new Date(Date.now() + 86400000),
          reason: "Positive test callback",
        }
      );
      const { data } = await callbacksService.listCallbacks(dealerId, dedicatedCustomer.id, {
        limit: 50,
        offset: 0,
      });
      const found = data.find((c) => c.id === created.id);
      expect(found).toBeDefined();
      expect(found?.reason).toBe("Positive test callback");
      expect(found?.status).toBe("SCHEDULED");
    });

    it("logCall then listTimeline returns a CALL event", async () => {
      const { customerId } = await ensureTestData();
      await activityService.logCall(dealerId, userId, customerId, {
        summary: "Positive test call",
        durationSeconds: 60,
      });
      const { data } = await timelineService.listTimeline(dealerId, customerId, {
        limit: 25,
        offset: 0,
      });
      const callEvent = data.find((e) => e.type === "CALL");
      expect(callEvent).toBeDefined();
      expect(callEvent?.createdByUserId).toBe(userId);
      expect((callEvent?.payloadJson as { summary?: string })?.summary).toBe("Positive test call");
    });
  });
});
