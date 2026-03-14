import { z } from "zod";

// ─── Lead Form Submission Schema ──────────────────────────────────────────────
// Used by apps/websites public lead endpoint and websites-leads service.

const baseLeadSchema = z.object({
  formType: z.enum([
    "CONTACT",
    "CHECK_AVAILABILITY",
    "TEST_DRIVE",
    "GET_EPRICE",
    "FINANCING",
    "TRADE_VALUE",
  ]),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(200).trim(),
  phone: z.string().max(30).trim().optional(),
  message: z.string().max(2000).trim().optional(),
  vehicleSlug: z.string().max(200).optional(),  // for vehicle-linked forms
  pagePath: z.string().max(500).optional(),

  // UTM attribution
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),

  // Anti-spam honeypot — must be empty
  _hp: z.string().max(0).optional(),
});

// CONTACT form — general inquiry
export const contactLeadSchema = baseLeadSchema.extend({
  formType: z.literal("CONTACT"),
});

// CHECK_AVAILABILITY — linked to a vehicle
export const checkAvailabilityLeadSchema = baseLeadSchema.extend({
  formType: z.literal("CHECK_AVAILABILITY"),
  vehicleSlug: z.string().min(1).max(200),
  preferredContact: z.enum(["email", "phone", "either"]).optional(),
});

// TEST_DRIVE — schedule a test drive
export const testDriveLeadSchema = baseLeadSchema.extend({
  formType: z.literal("TEST_DRIVE"),
  vehicleSlug: z.string().min(1).max(200),
  preferredDate: z.string().max(50).optional(),
  preferredTime: z.string().max(50).optional(),
});

// GET_EPRICE — request a price
export const getEpriceLeadSchema = baseLeadSchema.extend({
  formType: z.literal("GET_EPRICE"),
  vehicleSlug: z.string().min(1).max(200),
});

// FINANCING — light financing inquiry
export const financingLeadSchema = baseLeadSchema.extend({
  formType: z.literal("FINANCING"),
  vehicleSlug: z.string().max(200).optional(),
});

// TRADE_VALUE — trade-in inquiry placeholder
export const tradeValueLeadSchema = baseLeadSchema.extend({
  formType: z.literal("TRADE_VALUE"),
  tradeYear: z.number().int().min(1900).max(2030).optional(),
  tradeMake: z.string().max(100).optional(),
  tradeModel: z.string().max(100).optional(),
  tradeMileage: z.number().int().min(0).optional(),
  tradeCondition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
});

// Union schema for discriminated validation
export const websiteLeadSubmissionSchema = z.discriminatedUnion("formType", [
  contactLeadSchema,
  checkAvailabilityLeadSchema,
  testDriveLeadSchema,
  getEpriceLeadSchema,
  financingLeadSchema,
  tradeValueLeadSchema,
]);

export type WebsiteLeadSubmission = z.infer<typeof websiteLeadSubmissionSchema>;

// ─── Lead Result ──────────────────────────────────────────────────────────────

export type WebsiteLeadResult = {
  ok: true;
  customerId?: string;      // only returned in trusted internal context, not to public
};
