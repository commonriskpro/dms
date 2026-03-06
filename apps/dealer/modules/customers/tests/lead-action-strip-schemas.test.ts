/**
 * Unit tests: disposition and activity schemas (no DB).
 */
import {
  dispositionBodySchema,
  createActivityBodySchema,
  appointmentStubBodySchema,
  smsStubBodySchema,
} from "@/app/api/customers/schemas";

describe("Lead Action Strip schemas", () => {
  describe("dispositionBodySchema", () => {
    it("accepts status only", () => {
      const result = dispositionBodySchema.parse({ status: "LEAD" });
      expect(result.status).toBe("LEAD");
      expect(result.followUpTask).toBeUndefined();
    });

    it("accepts all CustomerStatus values", () => {
      for (const status of ["LEAD", "ACTIVE", "SOLD", "INACTIVE"] as const) {
        const result = dispositionBodySchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it("accepts status with followUpTask (title only)", () => {
      const result = dispositionBodySchema.parse({
        status: "ACTIVE",
        followUpTask: { title: "Follow up" },
      });
      expect(result.followUpTask?.title).toBe("Follow up");
      expect(result.followUpTask?.dueAt).toBeUndefined();
    });

    it("accepts status with followUpTask (title and dueAt ISO)", () => {
      const dueAt = "2025-06-01T14:00:00.000Z";
      const result = dispositionBodySchema.parse({
        status: "SOLD",
        followUpTask: { title: "Call back", dueAt },
      });
      expect(result.followUpTask?.dueAt).toBe(dueAt);
    });

    it("rejects invalid status", () => {
      expect(() => dispositionBodySchema.parse({ status: "INVALID" })).toThrow();
    });

    it("rejects empty followUpTask title", () => {
      expect(() =>
        dispositionBodySchema.parse({
          status: "LEAD",
          followUpTask: { title: "" },
        })
      ).toThrow();
    });
  });

  describe("createActivityBodySchema", () => {
    it("accepts activityType only", () => {
      const result = createActivityBodySchema.parse({ activityType: "sms_sent" });
      expect(result.activityType).toBe("sms_sent");
      expect(result.metadata).toBeUndefined();
    });

    it("accepts all allowed activity types", () => {
      for (const type of ["sms_sent", "appointment_scheduled", "disposition_set", "task_created"] as const) {
        const result = createActivityBodySchema.parse({ activityType: type });
        expect(result.activityType).toBe(type);
      }
    });

    it("accepts metadata without PII keys", () => {
      const result = createActivityBodySchema.parse({
        activityType: "appointment_scheduled",
        metadata: { scheduledAt: "2025-06-01T14:00:00.000Z", taskId: "some-uuid" },
      });
      expect(result.metadata).toEqual({ scheduledAt: "2025-06-01T14:00:00.000Z", taskId: "some-uuid" });
    });

    it("rejects metadata with email key", () => {
      expect(() =>
        createActivityBodySchema.parse({
          activityType: "sms_sent",
          metadata: { email: "x@y.com" },
        })
      ).toThrow(/PII/);
    });

    it("rejects metadata with phone key", () => {
      expect(() =>
        createActivityBodySchema.parse({
          activityType: "sms_sent",
          metadata: { phone: "555-1234" },
        })
      ).toThrow(/PII/);
    });

    it("rejects metadata with messageBody key", () => {
      expect(() =>
        createActivityBodySchema.parse({
          activityType: "sms_sent",
          metadata: { messageBody: "hello" },
        })
      ).toThrow(/PII/);
    });

    it("rejects invalid activityType", () => {
      expect(() =>
        createActivityBodySchema.parse({ activityType: "invalid_type" })
      ).toThrow();
    });
  });

  describe("appointmentStubBodySchema", () => {
    it("accepts scheduledAt only", () => {
      const result = appointmentStubBodySchema.parse({
        scheduledAt: "2025-06-01T14:00:00.000Z",
      });
      expect(result.scheduledAt).toBe("2025-06-01T14:00:00.000Z");
      expect(result.notes).toBeUndefined();
    });

    it("accepts scheduledAt and notes", () => {
      const result = appointmentStubBodySchema.parse({
        scheduledAt: "2025-06-01T14:00:00.000Z",
        notes: "Optional notes",
      });
      expect(result.notes).toBe("Optional notes");
    });

    it("rejects invalid datetime", () => {
      expect(() =>
        appointmentStubBodySchema.parse({ scheduledAt: "not-a-date" })
      ).toThrow();
    });
  });

  describe("smsStubBodySchema", () => {
    it("accepts empty body", () => {
      const result = smsStubBodySchema.parse({});
      expect(result.message).toBeUndefined();
    });

    it("accepts optional message", () => {
      const result = smsStubBodySchema.parse({ message: "Hi" });
      expect(result.message).toBe("Hi");
    });
  });
});
