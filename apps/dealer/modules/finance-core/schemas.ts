import { z } from "zod";

const centsString = z.string().regex(/^-?\d+$/).optional().nullable();
const dateString = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable();

export const creditApplicationStatusEnum = z.enum([
  "DRAFT", "READY_TO_SUBMIT", "SUBMITTED", "APPROVED", "DENIED", "CONDITIONALLY_APPROVED", "WITHDRAWN",
]);

export const createCreditApplicationBodySchema = z.object({
  dealId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid(),
  applicantFirstName: z.string().min(1).max(128),
  applicantLastName: z.string().min(1).max(128),
  dob: dateString,
  ssn: z.string().regex(/^\d{9}$/).optional(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().email().max(256).optional().nullable(),
  addressLine1: z.string().max(256).optional().nullable(),
  addressLine2: z.string().max(256).optional().nullable(),
  city: z.string().max(128).optional().nullable(),
  state: z.string().max(64).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  housingStatus: z.string().max(64).optional().nullable(),
  housingPaymentCents: centsString,
  yearsAtResidence: z.number().int().min(0).optional().nullable(),
  employerName: z.string().max(256).optional().nullable(),
  jobTitle: z.string().max(128).optional().nullable(),
  employmentYears: z.number().int().min(0).optional().nullable(),
  monthlyIncomeCents: centsString,
  otherIncomeCents: centsString,
  notes: z.string().optional().nullable(),
}).strict();

export const updateCreditApplicationBodySchema = createCreditApplicationBodySchema.partial().extend({
  dealId: z.string().uuid().optional().nullable(),
  status: creditApplicationStatusEnum.optional(),
}).strict();

export const listCreditApplicationsQuerySchema = z.object({
  dealId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: creditApplicationStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const lenderApplicationStatusEnum = z.enum([
  "DRAFT", "SUBMITTED", "RECEIVED", "APPROVED", "DENIED", "COUNTER_OFFER", "STIP_PENDING", "FUNDED", "CANCELLED",
]);

export const createLenderApplicationBodySchema = z.object({
  creditApplicationId: z.string().uuid(),
  dealId: z.string().uuid(),
  lenderName: z.string().min(1).max(256),
  externalApplicationRef: z.string().max(256).optional().nullable(),
  aprBps: z.number().int().min(0).optional().nullable(),
  maxAmountCents: centsString,
  maxAdvanceBps: z.number().int().min(0).optional().nullable(),
  termMonths: z.number().int().min(1).optional().nullable(),
  downPaymentRequiredCents: centsString,
  decisionSummary: z.string().optional().nullable(),
}).strict();

export const updateLenderApplicationBodySchema = z.object({
  lenderName: z.string().min(1).max(256).optional(),
  status: lenderApplicationStatusEnum.optional(),
  externalApplicationRef: z.string().max(256).optional().nullable(),
  aprBps: z.number().int().min(0).optional().nullable(),
  maxAmountCents: centsString,
  maxAdvanceBps: z.number().int().min(0).optional().nullable(),
  termMonths: z.number().int().min(1).optional().nullable(),
  downPaymentRequiredCents: centsString,
  decisionSummary: z.string().optional().nullable(),
  submittedAt: z.string().datetime().optional().nullable(),
  decisionedAt: z.string().datetime().optional().nullable(),
}).strict();

export const listLenderApplicationsQuerySchema = z.object({
  creditApplicationId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  status: lenderApplicationStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const lenderStipulationTypeEnum = z.enum([
  "PROOF_OF_INCOME", "DRIVER_LICENSE", "RESIDENCE_PROOF", "INSURANCE", "REFERENCES", "OTHER",
]);
export const lenderStipulationStatusEnum = z.enum([
  "REQUESTED", "RECEIVED", "APPROVED", "REJECTED", "WAIVED",
]);

export const createLenderStipulationBodySchema = z.object({
  lenderApplicationId: z.string().uuid(),
  type: lenderStipulationTypeEnum,
  title: z.string().min(1).max(256),
  notes: z.string().optional().nullable(),
  requiredAt: z.string().datetime().optional().nullable(),
}).strict();

export const updateLenderStipulationBodySchema = z.object({
  title: z.string().min(1).max(256).optional(),
  notes: z.string().optional().nullable(),
  status: lenderStipulationStatusEnum.optional(),
  requiredAt: z.string().datetime().optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
  reviewedAt: z.string().datetime().optional().nullable(),
}).strict();
